"""garden (Sakura Lantern Garden) real-user test: iPhone 13 emulation (Chrome, swiftshader), joystick by real touch events, drag-to-look, collision, anti-stuck, idle people animation.
Usage: python3 tests/realuser_garden.py [live|local] [out_dir]"""
import sys,asyncio,json,math,os,random
from playwright.async_api import async_playwright
MODE=sys.argv[1] if len(sys.argv)>1 else 'live'; OUT=sys.argv[2] if len(sys.argv)>2 else '/workspace/qa/garden'; os.makedirs(OUT,exist_ok=True)
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
        try: await route.fulfill(body=open(os.path.join(LOCAL,u[len(BASE):]),'rb').read(),content_type={'js':'application/javascript','html':'text/html','css':'text/css','mp4':'video/mp4','mp3':'audio/mpeg','ogg':'audio/ogg','m4a':'audio/mp4','glb':'model/gltf-binary'}.get(u.rsplit('.',1)[-1],'application/octet-stream'),headers={'cache-control':'no-store'})
        except FileNotFoundError: await route.fulfill(status=404,body='')
      await pg.route(BASE+'**',serve)
    await pg.goto(BASE+'japan/test/'+os.environ.get('PAGE','garden.html')+'?cb='+str(random.random()))
    await pg.wait_for_function('window.__w&&window.__w.state().ready',timeout=180000)
    await pg.wait_for_timeout(3000)
    st=lambda: E('window.__w.state()')
    s=await st(); rec('load',s['people']>=20 and s['avatars']>=15 and not errs and len(s['models'])>=12,{'build':s['build'],'people':s['people'],'avatars':s['avatars'],'models':s['models'],'errors':errs[:3],'drawcalls':s['calls'],'tris':s['tris']})
    await pg.screenshot(path=OUT+'/01_spawn.png')
    # koi: small fish below the water surface, inside the pond
    kz=await E("""(()=>{const T=window.__THREE,out=[];window.__scene.traverse(o=>{if(o.isSkinnedMesh&&/^Object_(6|7|8|9|10)$/.test(o.name)){const b=new T.Box3().setFromObject(o,true);const z=b.getSize(new T.Vector3()),c=b.getCenter(new T.Vector3());out.push([Math.max(z.x,z.z),b.max.y,((c.x-13)/7)**2+(c.z/6.5)**2]);}});return out;})()""")
    rec('koi_small_in_pond',len(kz)>=5 and all(k[0]<0.75 and k[1]<0.12 and k[2]<1 for k in kz),{'n_meshes':len(kz),'max_len_m':round(max(k[0] for k in kz),2) if kz else None,'max_top_y':round(max(k[1] for k in kz),3) if kz else None})
    # people never walk through props (lanterns, komainu, toro, bonsai) or the pond (bridge excepted): sample 40 s
    cv=await E("""(async()=>{const pr=window.__props;let v=0,worst=99;const ex=[];for(let k=0;k<160;k++){await new Promise(r=>setTimeout(r,250));for(const p of window.__w._people()){for(const [x,z,r] of pr){const d=Math.hypot(p.x-x,p.z-z)-r;worst=Math.min(worst,d);if(d<0.15){v++;if(ex.length<4)ex.push([p.av,x,z]);}}
      if(((p.x-13)/7)**2+(p.z/6.5)**2<1&&!(p.x>5.2&&p.x<20.8&&Math.abs(p.z)<0.75)){v++;if(ex.length<4)ex.push(['pond',p.x,p.z]);}}}return {props:pr.length,violations:v,min_clear_m:+worst.toFixed(2),ex};})()""")
    cv['nav_min_clear_m']=await E('window.__w.navClear()')
    rec('npc_vs_props',cv['props']>=10 and cv['violations']==0 and cv['nav_min_clear_m']>=0.3,cv)
    # knees: every walker within 40 m bends its knees forward (no hyperextension); Tripo bodies must not walk until they have native clips
    kn=await E("""(async()=>{const T=window.__THREE;const P=window.__w.state();const find=(o,re)=>{let x=null;o.traverse(b=>{if(!x&&b.isBone&&re.test(b.name))x=b;});return x;};
      const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let n=0,back=0,worst=9,tripoWalk=0;
      for(let k=0;k<40;k++){await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,120)));const me=window.__w.state();
       for(const p of window.__w._people()){if(/tripo/.test(p.av))tripoWalk++;if(p.state!=='walk'||Math.hypot(p.x-me.x,p.z-me.z)>40)continue;p.obj.updateMatrixWorld(true);
        for(const s of['L','R']){const th=find(p.obj,new RegExp('_'+s+'_Thigh$')),ca=find(p.obj,new RegExp('_'+s+'_Calf$')),ft=find(p.obj,new RegExp('_'+s+'_Foot$'));if(!th||!ca||!ft)continue;
         th.getWorldPosition(a);ca.getWorldPosition(b);ft.getWorldPosition(c);const fw=new T.Vector3(Math.sin(p.yaw),0,Math.cos(p.yaw));const ha=c.clone().sub(a);const t=b.clone().sub(a).dot(ha)/ha.lengthSq();
         const off=b.clone().sub(a.clone().add(ha.multiplyScalar(t))).dot(fw);n++;worst=Math.min(worst,off);if(off<-0.02)back++;}}}
      return {leg_samples:n,backward:back,worst_knee_fwd_m:+worst.toFixed(3),tripo_people:tripoWalk};})()""")
    rec('knees_bend_forward',kn['leg_samples']>=20 and kn['backward']==0 and kn['tripo_people']==0,kn)
    jb=await pg.locator('#joy').bounding_box(); cx,cy=jb['x']+jb['width']/2,jb['y']+jb['height']/2; R=jb['width']*0.4
    async def hold(dx,dy,ms):
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':cx,'y':cy,'id':1}]})
      for k in range(1,5): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':cx+dx*R*k/4,'y':cy+dy*R*k/4,'id':1}]})
      await pg.wait_for_timeout(ms)
      await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(400)
    def rel(a,b):  # displacement of b vs a in player frame: (forward, right)
      dx,dz=b['x']-a['x'],b['z']-a['z'];y=a['yaw'];return dx*math.sin(y)-dz*math.cos(y), dx*math.cos(y)+dz*math.sin(y)
    for name,(dx,dy) in {'forward':(0,-1),'back':(0,1),'right':(1,0),'left':(-1,0)}.items():
      await E('window.__w.set(0,16,0)'); await pg.wait_for_timeout(300); a=await st(); await hold(dx,dy,2500); b2=await st(); f,r=rel(a,b2)
      exp={'forward':f>0.8 and abs(r)<0.4,'back':f<-0.8 and abs(r)<0.4,'right':r>0.8 and abs(f)<0.4,'left':r<-0.8 and abs(f)<0.4}[name]
      rec('stick_'+name,exp,{'fwd_m':round(f,2),'right_m':round(r,2)})
    await pg.screenshot(path=OUT+'/02_after_stick.png')
    # drag to look
    await E('window.__w.set(0,16,0)'); a=await st()
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':120,'y':300,'id':2}]})
    for k in range(1,9): await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':120+k*15,'y':300,'id':2}]})
    await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(300); b2=await st()
    rec('drag_look',abs(b2['yaw']-a['yaw'])>0.3,{'yaw_change_rad':round(b2['yaw']-a['yaw'],2)})
    # collision: teahouse, pond edge, pagoda mound side, west wall/bamboo
    for name,(x,z,yaw,check) in {'teahouse':(-12,-2,-math.pi/2,'x>-14.05'),'pond_edge':(12.7,10.5,0,'z>6.4'),'pagoda_mound':(6,-12,0,'z>-15.25'),'west_wall':(-22,20,-math.pi/2,'x>-28')}.items():
      await E(f'window.__w.set({x},{z},{yaw})'); await pg.wait_for_timeout(300)
      await hold(0,-1,4000); s=await st()
      ok=eval(check,{},{'x':s['x'],'z':s['z']}) and not s['blocked']
      rec('collide_'+name,ok,{'pos':[round(s['x'],2),round(s['z'],2)],'rule':check})
      if name=='teahouse': await pg.screenshot(path=OUT+'/03_collide_teahouse.png')
    # walk across the arched bridge (passable, rises above the water)
    await E(f'window.__w.set(4,0,{math.pi/2})'); maxy=0
    for _ in range(10):
      await hold(0,-1,1500); s=await st(); maxy=max(maxy,s['y'])
      if s['x']>21: break
    rec('bridge_crossable',s['x']>21 and maxy>0.15,{'x':round(s['x'],2),'max_eye_base_y':round(maxy,2)})
    # climb the stairs to the pagoda
    await E('window.__w.set(0,-13,0)')
    for _ in range(12):
      await hold(0,-1,1500); s=await st()
      if s['z']<-29.6: break
    rec('stairs_to_pagoda',s['z']<-29.5 and s['y']>4,{'z':round(s['z'],2),'y':round(s['y'],2)})
    await pg.screenshot(path=OUT+'/03b_pagoda_top.png')
    await E('window.__w.set(0,16,0)')
    # never stuck: 30 random stick pushes from random places
    random.seed(4); worst=0; bad=0
    for i in range(30):
      a=await st(); ang=random.random()*6.283; await hold(math.cos(ang),math.sin(ang),900); s=await st(); worst=max(worst,s['maxStuck'])
      if s['blocked']: bad+=1
    rec('never_stuck',bad==0 and worst<=120,{'blocked_frames':bad,'max_consecutive_no_move_frames':worst,'note':'anti-stuck nudge triggers at 90'})
    # people animate while user idle
    await E('window.__w.set(2,14,0.6)'); await pg.wait_for_timeout(1500)
    pp0=await E('window.__w._people().map(p=>[p.x,p.z])'); i1=await pg.screenshot(path=OUT+'/04_idle_a.png'); a=await st()
    await pg.wait_for_timeout(4000); i2=await pg.screenshot(path=OUT+'/05_idle_b.png'); b2=await st(); pp1=await E('window.__w._people().map(p=>[p.x,p.z])')
    from PIL import Image, ImageChops; import io
    d=ImageChops.difference(Image.open(io.BytesIO(i1)).convert('L'),Image.open(io.BytesIO(i2)).convert('L')).point(lambda v:255 if v>24 else 0)
    changed=sum(d.histogram()[255:])/(d.width*d.height)
    moved=sum(1 for p,q in zip(pp0,pp1) if abs(p[0]-q[0])+abs(p[1]-q[1])>0.05)
    rec('people_move_while_idle',moved>=3 and abs(b2['x']-a['x'])<1e-6,{'pixels_changed_pct':round(changed*100,2),'people_moved':moved,'of':len(pp0),'clips':b2['clips']})
    # layered backdrop: real 3D hills + evergreens, far ring, CC0 sky, <=2 videos, and no holes/hard edges around the horizon
    bd=await E('({...window.__backdrop,sky:!!(window.__sky&&window.__sky.material.map&&window.__sky.material.map.image&&window.__sky.material.map.image.width)})')
    holes=[]
    for k in range(8):
      a=k*math.pi/4; await E(f'window.__w.cam=[0,1.7,0,{200*math.sin(a):.1f},{200*math.cos(a):.1f},14]'); await pg.wait_for_timeout(1800)
      im=Image.open(io.BytesIO(await pg.screenshot(path=OUT+f'/bd_{k}.png'))).convert('RGB'); W,Hh=im.size; px=list(im.crop((0,int(Hh*0.06),W,int(Hh*0.3))).resize((W//4,int(Hh*0.24)//4)).get_flattened_data())
      dark=sum(1 for r,g,b_ in px if r+g+b_<12)/len(px); holes.append(round(dark*100,2))
    await E('window.__w.cam=null')
    rec('backdrop_layers_no_edges',bd.get('sky') and bd.get('sugi',0)>=300 and bd.get('blobs',0)>=150 and bd.get('videos',9)<=2 and bd.get('farR',0)>0 and max(holes)<0.5,{**bd,'dark_pct_per_heading':holes})
    # budgets: draw calls / triangles from a busy view and the overview; bytes downloaded
    bud=[]
    for c in [[0,1.7,30,0,-20,4],[0,45,40,0,-5,0]]:
      await E(f'window.__w.cam={json.dumps(c)}'); await pg.wait_for_timeout(2500); bud.append(await E('window.__frameInfo'))
    await E('window.__w.cam=null')
    res=await E('performance.getEntriesByType("resource").map(e=>[e.name,e.encodedBodySize||e.transferSize||0])')
    def fsz(u,n):
      if n or MODE!='local' or not u.startswith(BASE): return n
      try: return os.path.getsize(os.path.join(LOCAL,u.split('?')[0][len(BASE):]))
      except OSError: return 0
    mb=sum(fsz(u,n) for u,n in res)/1048576
    rec('budgets',max(x['calls'] for x in bud)<=450 and max(x['tris'] for x in bud)<=1000000 and mb<20,{'frames':bud,'downloaded_mb':round(mb,2),'limits':{'calls':450,'tris':1000000,'mb':20},'note':'tris include the shadow pass on frames where it renders'})
    # credits panel opens and names the sources
    await pg.click('#credits-btn'); await pg.wait_for_timeout(600)
    cp=await E('(()=>{const d=document.getElementById("credits-panel");return {shown:getComputedStyle(d).display!=="none",text:d.innerText}})()')
    rec('credits_panel',cp['shown'] and 'Poly Haven' in cp['text'] and 'Rocketbox' in cp['text'],{'shown':cp['shown'],'chars':len(cp['text'])})
    await pg.click('#credits-btn')
    # personal space: walkers stop >=2.5 m short of the visitor standing on the main path
    await E('window.__w.set(0,12,3.14)'); v=0; mind=99
    for k in range(16):
      await pg.wait_for_timeout(700)
      r=await E('window.__w._people().filter(p=>p.state==="walk"&&!p.yield).map(p=>Math.hypot(p.x-0,p.z-12))')
      for dd in r:
        mind=min(mind,dd); v+=dd<2.5
    rec('walkers_keep_distance',v==0,{'violations':v,'min_walking_dist_m':round(mind,2)})
    s=await st(); rec('fps_estimate',True,{'fps_swiftshader_cpu':round(s['fps'],1),'note':'software GPU on the box; not an iPhone measurement'})
    bg=await E('window.__w.bgv?window.__w.bgv():null')
    if bg is not None and len(bg)>0:
      t0=[v['t'] for v in bg]; await pg.wait_for_timeout(1500); bg2=await E('window.__w.bgv()')
      rec('bg_videos_playing',all(not v['paused'] and v['ready']>=2 for v in bg2) and any(b['t']!=a for b,a in zip(bg2,t0)),{'videos':bg2})
    au=await E('window.__aud?window.__aud():null')
    if au is not None:
      await pg.wait_for_timeout(1500); au=await E('window.__aud()')
      rec('ambient_sound_after_tap',au['started'] and au['ctx']=='running' and au['playing'].get('water') and au['playing'].get('crowd') and au['playing'].get('birds'),{'audio':au})
    for i,c in enumerate([[0,1.7,36,0,20,2.5],[0,1.7,30,0,-20,4],[4,1.7,12,14,0,1],[-6,1.7,4,-19,-2,3],[13,2.2,0.2,13,-8,1],[0,7,-30,0,10,3],[20,1.7,14,24,7,2],[0,45,40,0,-5,0],[-2,1.7,22,8,-5,1.5]]):
      await E(f'window.__w.cam={json.dumps(c)}'); await pg.wait_for_timeout(1800); await pg.screenshot(path=OUT+f'/{10+i}_view.png')
    await E('window.__w.cam=null')
    await ctx.close(); await b.close()
    json.dump(rows,open(OUT+'/results.json','w'),indent=1)
    print('SUMMARY',sum(r['pass'] for r in rows),'/',len(rows),'passed')
    sys.exit(0 if all(r['pass'] for r in rows) else 1)
asyncio.run(main())
