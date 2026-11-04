"""world-ls real-user test: iPhone 13 emulation (Chrome, swiftshader), joystick by real touch events, drag-to-look, collision, anti-stuck, idle people animation.
Usage: python3 tests/realuser_world_ls.py [live|local] [out_dir]"""
import sys,asyncio,json,math,os,random
from playwright.async_api import async_playwright
MODE=sys.argv[1] if len(sys.argv)>1 else 'live'; OUT=sys.argv[2] if len(sys.argv)>2 else '/workspace/qa/world'; os.makedirs(OUT,exist_ok=True)
BASE='https://khoadang87.github.io/travel-experience/cities/'; LOCAL=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','cities')
rows=[]
def rec(c,ok,info): rows.append({'case':c,'pass':bool(ok),**info}); print(('PASS ' if ok else 'FAIL ')+c,json.dumps(info),flush=True)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    dv={k:v for k,v in p.devices['iPhone 13'].items() if k!='default_browser_type'}; dv['device_scale_factor']=1
    ctx=await b.new_context(**dv,record_video_dir=OUT+'/video',record_video_size={'width':390,'height':664}); pg=await ctx.new_page(); cdp=await ctx.new_cdp_session(pg); E=pg.evaluate
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    if MODE=='local':
      async def serve(route):
        u=route.request.url.split('?')[0]
        try: await route.fulfill(body=open(os.path.join(LOCAL,u[len(BASE):]),'rb').read(),content_type={'js':'application/javascript','html':'text/html','css':'text/css'}.get(u.rsplit('.',1)[-1],'application/octet-stream'),headers={'cache-control':'no-store'})
        except FileNotFoundError: await route.fulfill(status=404,body='')
      await pg.route(BASE+'**',serve)
    await pg.goto(BASE+'taipei/test/'+os.environ.get('PAGE','world-ls.html')+'?cb='+str(random.random()))
    await pg.wait_for_function('window.__w&&window.__w.state().ready',timeout=180000)
    await pg.wait_for_timeout(3000)
    st=lambda: E('window.__w.state()')
    s=await st(); rec('load',s['people']>=20 and not errs,{'build':s['build'],'people':s['people'],'errors':errs[:3],'drawcalls':s['calls'],'tris':s['tris']})
    await pg.screenshot(path=OUT+'/01_spawn.png')
    jb=await pg.locator('#joy').bounding_box(); cx,cy=jb['x']+jb['width']/2,jb['y']+jb['height']/2; R=jb['width']*0.4
    async def hold(dx,dy,ms):
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx,'y':cy,'id':1}]})
      for k in range(1,5): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx+dx*R*k/4,'y':cy+dy*R*k/4,'id':1}]})
      await pg.wait_for_timeout(ms)
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(400)
    def rel(a,b):  # displacement of b vs a in player frame: (forward, right)
      dx,dz=b['x']-a['x'],b['z']-a['z'];y=a['yaw'];return dx*math.sin(y)-dz*math.cos(y), dx*math.cos(y)+dz*math.sin(y)
    for name,(dx,dy) in {'forward':(0,-1),'back':(0,1),'right':(1,0),'left':(-1,0)}.items():
      await E('window.__w.set(0,14,0)'); await pg.wait_for_timeout(300); a=await st(); await hold(dx,dy,2500); b2=await st(); f,r=rel(a,b2)
      exp={'forward':f>0.8 and abs(r)<0.4,'back':f<-0.8 and abs(r)<0.4,'right':r>0.8 and abs(f)<0.4,'left':r<-0.8 and abs(f)<0.4}[name]
      rec('stick_'+name,exp,{'fwd_m':round(f,2),'right_m':round(r,2)})
    await pg.screenshot(path=OUT+'/02_after_stick.png')
    # drag to look
    await E('window.__w.set(0,14,0)'); a=await st()
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':120,'y':300,'id':2}]})
    for k in range(1,9): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':120+k*15,'y':300,'id':2}]})
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(300); b2=await st()
    rec('drag_look',abs(b2['yaw']-a['yaw'])>0.3,{'yaw_change_rad':round(b2['yaw']-a['yaw'],2)})
    # collision: walk into main hall core (front face z=-8.5), into burner, into west corridor wall, into front-hall wall
    for name,(x,z,yaw,check) in {'main_hall':(-4,-1,0,'z>-8.5'),'main_hall_side_porch_ok':(-8.6,-4,0,'z<-8.5'),'burner':(0,9,0,'z>4+2.3'),'west_wall':(-18,0,-math.pi/2,'x>-26'),'front_hall_wall':(-7,25,0,'z>20.5')}.items():
      await E(f'window.__w.set({x},{z},{yaw})'); await pg.wait_for_timeout(300)
      if name.endswith('_ok'):  # passable: keep walking until through (slow emulators run sim < real time)
        for _ in range(8):
          await hold(0,-1,2500); s=await st()
          if s['z']<-8.5: break
      else:
        await hold(0,-1,4000); s=await st()
      ok=eval(check,{},{'x':s['x'],'z':s['z']}) and not s['blocked']
      rec('collide_'+name,ok,{'pos':[round(s['x'],2),round(s['z'],2)],'rule':check})
      if name=='main_hall': await pg.screenshot(path=OUT+'/03_collide_hall.png')
    # walk through the open central doorway of the front hall (should pass)
    await E('window.__w.set(0,23.5,0)')
    for _ in range(6):
      await hold(0,-1,2500); s=await st()
      if s['z']<19.5: break
    rec('front_door_passable',s['z']<19.5,{'z':round(s['z'],2)})
    # never stuck: 30 random stick pushes from random places
    random.seed(4); worst=0; bad=0
    for i in range(30):
      a=await st(); ang=random.random()*6.283; await hold(math.cos(ang),math.sin(ang),900); s=await st(); worst=max(worst,s['maxStuck'])
      if s['blocked']: bad+=1
    rec('never_stuck',bad==0 and worst<=120,{'blocked_frames':bad,'max_consecutive_no_move_frames':worst,'note':'anti-stuck nudge triggers at 90'})
    # people animate while user idle
    await E('window.__w.set(3,10,-0.4)'); await pg.wait_for_timeout(1500)
    a=await st(); i1=await pg.screenshot(path=OUT+'/04_idle_a.png'); await pg.wait_for_timeout(2500); i2=await pg.screenshot(path=OUT+'/05_idle_b.png'); b2=await st()
    from PIL import Image, ImageChops; import io
    d=ImageChops.difference(Image.open(io.BytesIO(i1)).convert('L'),Image.open(io.BytesIO(i2)).convert('L')).point(lambda v:255 if v>24 else 0)
    changed=sum(d.histogram()[255:])/(d.width*d.height)
    moved=sum(1 for p,q in zip(a['sample'],b2['sample']) if abs(p['x']-q['x'])+abs(p['z']-q['z'])>0.05 or p['clip']!=q['clip'])
    rec('people_move_while_idle',changed>0.002 and abs(b2['x']-a['x'])<1e-6,{'pixels_changed_pct':round(changed*100,2),'sampled_people_moved':moved,'clips':b2['clips']})
    s=await st(); rec('fps_estimate',True,{'fps_swiftshader_cpu':round(s['fps'],1),'note':'software GPU on the box; not an iPhone measurement'})
    for i,c in enumerate([[0,60,45,0,-5],[14,11,34,0,0],[-6,1.7,6,0,-14],[10,1.7,-2,0,4],[24,1.7,10,24,-20],[0,1.7,34,0,20]]):
      await E(f'window.__w.cam={json.dumps(c)}'); await pg.wait_for_timeout(1800); await pg.screenshot(path=OUT+f'/1{i}_view.png')
    await E('window.__w.cam=null')
    await ctx.close(); await b.close()
    json.dump(rows,open(OUT+'/results.json','w'),indent=1)
    print('SUMMARY',sum(r['pass'] for r in rows),'/',len(rows),'passed')
    sys.exit(0 if all(r['pass'] for r in rows) else 1)
asyncio.run(main())
