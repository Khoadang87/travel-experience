"""Strict 'real-user' junction test (permanent). Usage: python3 tests/realuser_junctions.py t1|w51 [base_url] [out.json]
For every junction link: start just before the link, steer the view toward the exit and HOLD THE JOYSTICK UP (real pointer
drag, no marker taps) until the crossfade jump happens; then keep holding 5 s and require footage time to increase, the
stream to stay forward (DIR F) and the mini-map dot to advance. Repeat from the landing spot facing left/right/behind:
holding forward must never reverse. Hold forward through every Not-accessible spot / end of footage: must stop, never reverse.
Exit code 1 if any case fails."""
import sys,asyncio,json,math,re,urllib.request
from playwright.async_api import async_playwright
PAGE=sys.argv[1] if len(sys.argv)>1 else 't1'
BASE=sys.argv[2] if len(sys.argv)>2 else 'https://khoadang87.github.io/travel-experience/cities/'
LOCAL=None  # 'local' = serve this checkout's files under the github.io origin (R2 CORS only allows that origin)
if BASE=='local':
    import os; LOCAL=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','cities'); BASE='https://khoadang87.github.io/travel-experience/cities/'
def fetch(u):
    if LOCAL: return open(os.path.join(LOCAL,u[len(BASE):].split('?')[0]),'rb').read()
    return urllib.request.urlopen(u).read()
OUT=sys.argv[3] if len(sys.argv)>3 else f'/tmp/realuser_{PAGE}.json'
CFG={'t1':('taipei/test/real-t1.html','taipei/test/walk-t1.js','taipei/test/t1/path-t1.json'),
     'w51':('hoian/test/real-w51.html','hoian/test/walk-w51.js','hoian/test/w50/path-w51.json')}[PAGE]
src=fetch(BASE+CFG[1]+'?cb=1').decode()
def arr(name):
    m=re.search(r'const '+name+r' = \[(.*?)\];',src,re.S); body=re.sub(r'/\*.*?\*/','',m.group(1),flags=re.S)
    js=re.sub(r"(\w+):",r'"\1":',body).replace("'",'"'); return json.loads('['+js+']') if body.strip() else []
EXITS=arr('EXITS'); NF=arr('UNFILMED'); MP=json.loads(fetch(BASE+CFG[2]))['pts']
def dot(t):
    q=min(MP,key=lambda q:abs(q[0]-t)); return q[1],q[2]
rows=[]
def rec(case,ok,info): rows.append({'case':case,'pass':ok if ok is None else bool(ok),**info}); print(('N/A  ' if ok is None else 'PASS ' if ok else 'FAIL ')+case,json.dumps(info),flush=True)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
    pg=await b.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    E=pg.evaluate
    if LOCAL:
        async def serve(route):
            try: await route.fulfill(body=fetch(route.request.url),content_type={'js':'application/javascript','html':'text/html','json':'application/json','css':'text/css'}.get(route.request.url.split('?')[0].rsplit('.',1)[-1],'application/octet-stream'),headers={'cache-control':'no-store'})
            except FileNotFoundError: await route.fulfill(status=404,body='')
        await pg.route(BASE+'**',serve)
    await pg.goto(BASE+CFG[0]+'?cb=ru'); await pg.wait_for_function('window.__w&&window.__w.state&&window.__w.state().ready',timeout=120000)
    if await pg.locator('#places-x').is_visible(): await pg.click('#places-x')
    jb=await pg.locator('#joy').bounding_box(); cx,cy=jb['x']+jb['width']/2,jb['y']+jb['height']/2
    async def hold(on):
        if on: await pg.mouse.move(cx,cy); await pg.mouse.down(); await pg.mouse.move(cx,cy-jb['height']*0.45,steps=4)
        else: await pg.mouse.up()
    S=lambda: E('window.__w.state()')
    async def face_abs(a):  # make the view look along absolute image direction a (rad)
        await E(f'(()=>{{const s=window.__w.state(); window.__w.setLook(({a}-(s.hd!=null?s.hd:window.__w.headAt(s.pos)))*180/Math.PI,0)}})()')
    async def go(t):
        if await pg.locator('#nf-x').is_visible(): await pg.click('#nf-x')
        await E(f'window.__w.go({t},"t")'); await pg.wait_for_function(f'Math.abs(window.__w.state().pos-{t})<1.5&&!window.__w.state().fading',timeout=60000); await pg.wait_for_timeout(1200)
    async def walk5(tag,rel):
        # hold forward 5 s. Steering into another junction while holding is allowed (a forward jump); after any
        # jump the walk must again only move forward. Never DIR R, never time going backwards within a stretch.
        await E(f'window.__w.setLook({rel},0)'); await pg.wait_for_timeout(300); s0=await S(); ex=await E('window.__w.exits||0')
        await hold(True); ref=s0['pos']; mn_ok=True; dirs=set(); jumps=0; prev=s0['pos']
        for _ in range(25):
            await pg.wait_for_timeout(200); s=await S(); dirs.add(s['dir']); e=await E('window.__w.exits||0')
            if e>ex: ex=e; jumps+=1; prev=s['pos']; continue
            if s['fading']: prev=s['pos']; continue
            if s['pos']<prev-0.3: mn_ok=False
            prev=max(prev,s['pos'])
        await hold(False); s1=await S(); d0,d1=dot(s0['pos']),dot(s1['pos'])
        ok=mn_ok and dirs=={'F'} and (jumps>0 or (s1['pos']>s0['pos']+0.5 and math.dist(d0,d1)>0))
        rec(tag,ok,{'from':round(s0['pos'],2),'to':round(s1['pos'],2),'neverBack':mn_ok,'dirs':sorted(dirs),'junctionJumps':jumps,'dotMove':round(math.dist(d0,d1),2)})
    for x in EXITS:
        tag=f"{PAGE} {x['id']} {x['t0']}->{x['to']}"
        await go(max(0.5,x['t0']-2)); ex0=await E('window.__w.exits||0')
        h_to=await E(f"window.__w.headAt({x['to']})")
        await hold(True); took=False; last=None
        for _ in range(100):  # up to ~20 s holding forward, steering the view at the exit like a user would
            s=await S()
            a=(h_to+math.radians(x['rot'])) if 'rot' in x and x['rot'] is not None else (await E(f"window.__w.headAt({s['pos']})"))+math.radians(x['b'] if isinstance(x.get('b'),(int,float)) else 0)
            if not s['fading']: await face_abs(a)
            if (await E('window.__w.exits||0'))>ex0: took=True; break
            if s['pos']>x['t1']+1: break
            last=s; await pg.wait_for_timeout(200)
        await hold(False)
        rel=abs(math.degrees(math.remainder(a-await E(f"window.__w.headAt({(last or s)['pos']})"),2*math.pi)))
        if not took and rel<15:
            rec(tag+' arrive by push',None,{'reason':'N/A by design: the other walk runs the same way here (exit %.1f deg from travel); holding forward keeps this walk, tap the marker to switch'%rel}); continue
        if not took:
            rec(tag+' arrive by push',False,{'reason':'exit not taken while holding forward','exitVsTravelDeg':round(rel,1),'pos':round((await S())['pos'],2)}); continue
        await pg.wait_for_function('!window.__w.state().fading',timeout=20000); await pg.wait_for_timeout(800)
        s=await S()
        if abs(s['pos']-x['to'])>=3:
            y=next((y for y in EXITS if y is not x and y.get('clip')==x.get('clip') and abs(s['pos']-y['to'])<3 and y['t0']<=x['t1'] and x['t0']<=y['t1']),None)
            if y is not None and y.get('rot') is not None:
                ay=(await E(f"window.__w.headAt({y['to']})"))+math.radians(y['rot']); dd=abs(math.degrees(math.remainder(a-ay,2*math.pi)))
                if dd<25:
                    rec(tag+' arrive by push',None,{'reason':'N/A by design: overlaps link %s, which leaves the same spot in the same direction (%.1f deg apart); holding forward took %s, still walking forward; tap the marker for %s'%(y['id'],dd,y['id'],x['id']),'landed':round(s['pos'],2)}); continue
        rec(tag+' arrive by push',abs(s['pos']-x['to'])<3,{'landed':round(s['pos'],2)})
        land=s['pos']
        await walk5(tag+' hold fwd 5s',0)
        for nm,r in [('left',-90),('right',90),('behind',180)]:
            await go(land); await walk5(tag+f' facing {nm}',r)
    # Not-accessible spots: hold forward facing each opening -> must stop (card), never reverse
    for n in NF:
        tag=f"{PAGE} not-accessible {n['id']}"
        await go(n['t0']-2); s0=await S(); mn=s0['pos']; shown=False; await hold(True)
        for _ in range(60):
            s=await S(); bb=n['b']; bt=min(bb,key=lambda q:abs(q[0]-s['pos']))[1] if isinstance(bb,list) else bb
            if not shown: await face_abs((await E(f"window.__w.headAt({s['pos']})"))+math.radians(bt))
            mn=min(mn,s['pos']); shown=shown or bool(await E('!document.getElementById("nf").hidden'))
            await pg.wait_for_timeout(200)
        await hold(False); s1=await S()
        rec(tag,shown and mn>=s0['pos']-0.3 and s1['dir']=='F',{'cardShown':shown,'from':round(s0['pos'],2),'min':round(mn,2),'end':round(s1['pos'],2),'dir':s1['dir']})
        if shown and await pg.locator('#nf-back').is_visible(): await pg.click('#nf-back')
    # end of each filmed clip: holding forward must stop there, never reverse
    clips=json.loads(fetch(BASE+CFG[0].split('/test/')[0]+'/routes.json'))['routes'][0]['clips']
    for c in clips:
        tag=f"{PAGE} end of clip {c['id']}"; await go(c['hi']-4); s0=await S(); mn=s0['pos']; dirs=set(); ex0=await E('window.__w.exits||0'); jumped=False; await hold(True)
        for _ in range(40):
            s=await S()
            if not jumped and (await E('window.__w.exits||0'))>ex0: jumped=True  # dead end with a straight-ahead link: a forward jump is allowed
            if not jumped and not s['fading']: await face_abs(await E(f"window.__w.headAt({s['pos']})")); mn=min(mn,s['pos'])
            dirs.add(s['dir']); await pg.wait_for_timeout(200)
        await hold(False); s1=await S()
        rec(tag,mn>=s0['pos']-0.3 and dirs=={'F'} and (jumped or s1['pos']<=c['hi']+0.6),{'from':round(s0['pos'],2),'min':round(mn,2),'end':round(s1['pos'],2),'dirs':sorted(dirs),'junctionJump':jumped})
    errs=await E('(window.__evlog||[]).filter(l=>/error/i.test(l))'); await b.close()
  json.dump({'page':PAGE,'rows':rows,'errors':errs},open(OUT,'w'),indent=1)
  f=sum(r['pass'] is False for r in rows); na=sum(r['pass'] is None for r in rows); print(f'{PAGE}: {len(rows)-f-na} passed, {f} failed, {na} n/a'); sys.exit(1 if f else 0)
asyncio.run(main())
