"""ls3 real-user test: living moments, spot hunt, passport stamp, things-to-spot cards. iPhone 13 emulation in Chrome, joystick by real touch events.
Usage: python3 tests/realuser_live_ls.py [base|local] [shots_dir]"""
import sys,asyncio,json,math,os
from playwright.async_api import async_playwright
BASE=sys.argv[1] if len(sys.argv)>1 else 'https://khoadang87.github.io/travel-experience/cities/'
SH=sys.argv[2] if len(sys.argv)>2 else '/workspace/qa/taipei/temple/live'; os.makedirs(SH,exist_ok=True)
LOCAL=None
if BASE=='local': LOCAL=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','cities'); BASE='https://khoadang87.github.io/travel-experience/cities/'
rows=[]
def rec(c,ok,info): rows.append({'case':c,'pass':bool(ok),**info}); print(('PASS ' if ok else 'FAIL ')+c,json.dumps(info),flush=True)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
    dv={k:v for k,v in p.devices['iPhone 13'].items() if k!='default_browser_type'}; dv['device_scale_factor']=1
    ctx=await b.new_context(**dv); pg=await ctx.new_page(); cdp=await ctx.new_cdp_session(pg); E=pg.evaluate
    if LOCAL:
      async def serve(route):
        u=route.request.url.split('?')[0]
        try: await route.fulfill(body=open(os.path.join(LOCAL,u[len(BASE):]),'rb').read(),content_type={'js':'application/javascript','html':'text/html','json':'application/json','css':'text/css'}.get(u.rsplit('.',1)[-1],'application/octet-stream'),headers={'cache-control':'no-store'})
        except FileNotFoundError: await route.fulfill(status=404,body='')
      await pg.route(BASE+'**',serve)
    await pg.goto(BASE+'taipei/test/longshan-1.html?cb=lv&q=lo'); await pg.wait_for_function('window.__w&&window.__w.state&&window.__w.state().ready',timeout=120000)
    await E("localStorage.removeItem('tePassport');localStorage.removeItem('huntLongshan')"); await pg.reload(); await pg.wait_for_function('window.__w.state().ready',timeout=120000)
    if await pg.locator('#places-x').is_visible(): await pg.click('#places-x')
    rec('build',True,{'build':await E('window.__build')})
    jb=await pg.locator('#joy').bounding_box(); cx,cy=jb['x']+jb['width']/2,jb['y']+jb['height']/2
    async def hold(on):
      if on:
        await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx,'y':cy,'id':1}]})
        for k in range(1,5): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx,'y':cy-jb['height']*0.45*k/4,'id':1}]})
      else: await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    S=lambda: E('window.__w.state()'); L=lambda: E('window.__w.liveState()')
    async def go(t): await E(f'window.__w.go({t},"t")'); await pg.wait_for_function(f'Math.abs(window.__w.state().pos-{t})<1.5&&!window.__w.state().fading',timeout=60000)
    async def fwd(tag,yaw):
      await E(f'window.__w.setLook({yaw},0)'); s0=await S(); prev=s0['pos']; mono=True; dirs=set(); offAt=None
      await hold(True)
      for k in range(25):
        await pg.wait_for_timeout(200); s=await S(); l=await L(); dirs.add(s['dir'])
        if offAt is None and not l['on'] and l['opacity']<0.05: offAt=k*0.2
        if not s['fading'] and s['pos']<prev-0.3: mono=False
        prev=max(prev,s['pos'])
      await hold(False); s1=await S()
      ok=mono and dirs=={'F'} and s1['pos']>s0['pos']+1 and offAt is not None and offAt<=1.2
      rec(tag,ok,{'from':round(s0['pos'],2),'to':round(s1['pos'],2),'neverBack':mono,'dirs':sorted(dirs),'liveOffAfterS':offAt})
    bad=[]
    for t in [100,300,448,520,600,700,800,900,990]:
      await go(t); await pg.wait_for_timeout(300); w=await E("document.getElementById('where').textContent")
      if 'Ximending' in w or not w: bad.append((t,w))
    rec('place label is Longshan-only across 0-1000 s (incl. 448 s canopy, Koby section)',not bad,{'bad':bad,'at448':'checked'})
    # ---- living moments ----
    for lid,t in [('hall',242),('plaza',527)]:
      await go(t); await E('window.__w.setLook(0,0)'); await pg.wait_for_timeout(300)
      await pg.screenshot(path=f'{SH}/live_{lid}_walkframe.png')
      try: await pg.wait_for_function('window.__w.liveState().on&&window.__w.liveState().opacity>0.95',timeout=20000)
      except Exception: pass
      l1=await L(); await pg.wait_for_timeout(1500); l2=await L(); s=await S()
      await pg.screenshot(path=f'{SH}/live_{lid}_on.png')
      ok=l1['on'] and l1['id']==lid and l2['playing'] and l2['frames']>l1['frames'] and abs(s['pos']-t)<1.5
      rec(f'live {lid}: stop -> loop plays (fixed spot, people moving)',ok,{'live':l2,'stoodAt':round(s['pos'],2)})
      for nm,yaw in [('ahead',0),('left',-90),('right',90),('behind',180)]:
        if nm!='ahead':
          await go(t); 
          try: await pg.wait_for_function('window.__w.liveState().on',timeout=20000)
          except Exception: pass
        await fwd(f'live {lid}: push UP facing {nm} -> fades back, walks forward',yaw)
    # ---- loop wrap seam: loop must keep playing past 10 s ----
    await go(242); ts=[]
    for _ in range(28): await pg.wait_for_timeout(500); ts.append((await L())['t'] or 0)
    l=await L(); wraps=sum(1 for a,b in zip(ts,ts[1:]) if b<a-5); rec('live loop wraps at the 10 s seam and keeps playing',l['on'] and l['playing'] and wraps>=1 and max(ts)>9,{'live':l,'wraps':wraps,'maxT':max(ts)})
    await hold(True); await pg.wait_for_timeout(600); await hold(False)
    # ---- spot hunt: look at each target ----
    await E("localStorage.removeItem('tePassport');localStorage.removeItem('huntLongshan')"); await pg.reload(); await pg.wait_for_function('window.__w.state().ready',timeout=120000)
    if await pg.locator('#places-x').is_visible(): await pg.click('#places-x')
    hs=await E('window.__w.hunts'); 
    for i,h in enumerate(hs):
      t=(h['t0']+h['t1'])/2; await go(t)
      if i==len(hs)-1:  # last one by tapping it
        a=await E(f"window.__w.spotDir('{h['id']}',window.__w.state().pos)"); s=await S(); await E(f"window.__w.setLook(({a}-({s['hd']}))*180/Math.PI+20,0)"); await pg.wait_for_timeout(300)
        W,H=await E('[innerWidth,innerHeight]'); f=H/2/math.tan(math.radians(75/2)); await pg.mouse.click(W/2+f*math.tan(math.radians(20)),H*0.45); how='tap'
      else:
        a=await E(f"window.__w.spotDir('{h['id']}',window.__w.state().pos)"); s=await S(); await E(f"window.__w.setLook(({a}-({s['hd']}))*180/Math.PI,0)"); how='look'
      await pg.wait_for_timeout(900); hsN=await E('window.__w.huntState()')
      await pg.screenshot(path=f'{SH}/hunt_{h["id"]}.png')
      rec(f'hunt {h["id"]} found by {how}',h['id'] in hsN['found'],{'found':hsN['found']})
    await pg.wait_for_timeout(300); st=await E('window.__w.huntState()'); toast=await pg.locator('#stamp-toast').count()
    await pg.screenshot(path=f'{SH}/stamp_toast.png')
    rec('all found -> Longshan Temple stamp saved in passport',st['stamp'] and len(st['found'])==len(hs),{'stamp':st['passport'],'toast':toast})
    await E("document.getElementById('hunt-t').click()"); await pg.wait_for_timeout(200); await pg.click('#pass-b'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=f'{SH}/passport.png'); rec('passport view shows the stamp',await pg.locator('[data-stamp="taipei-longshan"]').count()==1,{})
    await pg.click('#passport .x')
    await pg.reload(); await pg.wait_for_function('window.__w.state().ready',timeout=120000); st=await E('window.__w.huntState()'); rec('stamp + hunt progress persist after reload',st['stamp'] and len(st['found'])==len(hs),{'found':st['found']})
    if await pg.locator('#places-x').is_visible(): await pg.click('#places-x')
    # ---- things to spot: markers visible, card opens, walking not blocked ----
    for sid,t in [('gate',80),('mainhall',253),('backhalls',333)]:
      await go(t); a=await E(f"window.__w.spotDir('{sid}',window.__w.state().pos)"); s=await S(); await E(f"window.__w.setLook(({a}-({s['hd']}))*180/Math.PI,0)"); await pg.wait_for_timeout(400)
      vis=[x['id'] for x in await E('window.__w.spots()') if x['shown']]
      if sid in vis:
        await pg.locator('.mk.spot:not([hidden])').first.click(); await pg.wait_for_timeout(300)
      card=await pg.locator('#fact').is_visible(); await pg.screenshot(path=f'{SH}/spot_{sid}.png')
      rec(f'spot {sid}: marker shown, fact card opens',sid in vis and card,{'visible':vis})
      await fwd(f'spot {sid}: card open, hold UP still walks forward',0)
    errs=await E('(window.__evlog||[]).filter(l=>/error|fatal/i.test(l))'); await b.close()
  json.dump({'rows':rows,'errors':errs},open(SH+'/live_test.json','w'),indent=1)
  f=sum(not r['pass'] for r in rows); print(f'ls3 live: {len(rows)-f} passed, {f} failed'); sys.exit(1 if f else 0)
asyncio.run(main())
