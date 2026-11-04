"""Trip anticipation flow, real-user test (iPhone 13 emulation, Chrome swiftshader):
book (in 1 minute) -> boarding pass -> pack camera -> countdown & teasers unlock -> Board now -> departure sequence -> lands in world-ls.html?arrive=1 -> passport stamp -> photo -> album on trip page.
Usage: python3 tests/realuser_trip_flow.py [live|local] [out_dir]"""
import sys,asyncio,json,os,random,time
from playwright.async_api import async_playwright
MODE=sys.argv[1] if len(sys.argv)>1 else 'live'; OUT=sys.argv[2] if len(sys.argv)>2 else '/workspace/qa/trip'; os.makedirs(OUT,exist_ok=True)
BASE='https://khoadang87.github.io/travel-experience/'; LOCAL=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
rows=[]
def rec(c,ok,info={}): rows.append({'case':c,'pass':bool(ok),**info}); print(('PASS ' if ok else 'FAIL ')+c,json.dumps(info),flush=True)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required'])
    dv={k:v for k,v in p.devices['iPhone 13'].items() if k!='default_browser_type'}; dv['device_scale_factor']=1
    ctx=await b.new_context(**dv,record_video_dir=OUT+'/video',record_video_size={'width':390,'height':664}); pg=await ctx.new_page(); E=pg.evaluate
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    if MODE=='local':
      async def serve(route):
        u=route.request.url.split('?')[0].split('#')[0]
        if u.endswith('/'): u+='index.html'
        try: await route.fulfill(body=open(os.path.join(LOCAL,u[len(BASE):]),'rb').read(),content_type={'js':'application/javascript','html':'text/html','jpg':'image/jpeg','css':'text/css'}.get(u.rsplit('.',1)[-1],'application/octet-stream'),headers={'cache-control':'no-store'})
        except FileNotFoundError: await route.fulfill(status=404,body='')
      await pg.route(BASE+'**',serve)
    cb='?cb='+str(random.random())
    await pg.goto(BASE+cb); rec('home_links_trip',await pg.locator('a[href="cities/taipei/test/trip.html"]').count()==1)
    await pg.click('a[href="cities/taipei/test/trip.html"]'); await pg.wait_for_selector('#bookBtn')
    await E("localStorage.clear()"); await pg.reload(); await pg.wait_for_selector('#bookBtn')
    await pg.screenshot(path=OUT+'/01_book.png',full_page=True)
    await pg.click('#when .opt[data-v="60"]'); await pg.fill('#name','Khoa'); await pg.click('#bookBtn'); t_book=time.time()
    await pg.wait_for_selector('#passImg[src^="data:image/png"]'); await pg.wait_for_timeout(500)
    tr=await E("JSON.parse(localStorage.getItem('teTrip'))")
    rec('booked_pass_saved',tr and tr['name']=='Khoa' and 55000<tr['depart']-tr['booked']<=60000,{'flight':tr['flight'],'seat':tr['seat'],'gate':tr['gate']})
    await pg.locator('#passImg').screenshot(path=OUT+'/02_boarding_pass.png')
    rec('pass_download_link',(await pg.get_attribute('#dl','href') or '').startswith('data:image/png'))
    await pg.click('#bag .opt[data-k="camera"]'); await pg.click('#bag .opt[data-k="passport"]')
    bag=await E("JSON.parse(localStorage.getItem('teTrip')).bag"); rec('bag_saved',set(bag)=={'camera','passport'},{'bag':bag})
    await pg.screenshot(path=OUT+'/03_countdown_start.png')
    u0=await E("document.querySelectorAll('.teaser[data-open=\"1\"]').length")
    await pg.wait_for_timeout(max(0,32-(time.time()-t_book))*1000)
    u1=await E("document.querySelectorAll('.teaser[data-open=\"1\"]').length"); cd=await E("[...'DHMS'].map(k=>document.getElementById('cd'+k).textContent).join(':')")
    await pg.screenshot(path=OUT+'/04_countdown_mid.png',full_page=True)
    await pg.wait_for_selector('#boardBtn:not(.hide)',timeout=70000); t_ready=time.time()-t_book
    u2=await E("document.querySelectorAll('.teaser[data-open=\"1\"]').length")
    rec('countdown_and_teasers_unlock',u0<u1<=u2==5,{'unlocked_at_start':u0,'at_32s':u1,'at_board':u2,'timer_at_32s':cd,'board_button_after_s':round(t_ready,1)})
    await pg.screenshot(path=OUT+'/05_board_now.png',full_page=True)
    await pg.click('#boardBtn'); await pg.wait_for_selector('#go:not([disabled])',timeout=60000); await pg.screenshot(path=OUT+'/06_tap_to_board.png')
    await pg.click('#go'); t0=time.time(); segs=[]
    for i,at in enumerate([4,10,16,24,30,34,40,44,50,56,61]):
      await pg.wait_for_timeout(max(0,at-(time.time()-t0))*1000)
      d=await E('window.__dep'); segs.append(d['seg']); await pg.screenshot(path=OUT+f'/1{i:02d}_seq_{d["seg"]}.png')
    await pg.wait_for_url('**/world-ls.html?arrive=1',timeout=60000); t_seq=time.time()-t0
    rec('departure_sequence',segs[0]=='gate' and 'bridge' in segs and 'takeoff' in segs and 'clouds' in segs and 'landing' in segs,{'segments_seen':segs,'seconds_to_world':round(t_seq,1)})
    await pg.wait_for_function('window.__w&&window.__w.state().ready',timeout=180000)
    await pg.wait_for_function('window.__stamped===true',timeout=20000); await pg.wait_for_timeout(1200)
    s=await E('window.__w.state()'); rec('lands_at_courtyard_entrance',abs(s['x'])<0.5 and s['z']>33,{'pos':[round(s['x'],2),round(s['z'],2)]})
    await pg.screenshot(path=OUT+'/20_arrival_stamp.png')
    pp=await E("JSON.parse(localStorage.getItem('tePassport'))"); rec('passport_stamp_saved',bool(pp) and pp[0]['place']=='Longshan Temple',{'stamps':len(pp or [])})
    await pg.click('#stamp'); await pg.wait_for_timeout(900)
    rec('photo_button_shown_with_camera',await pg.locator('#photo').is_visible())
    await pg.screenshot(path=OUT+'/21_world_with_camera.png')
    await pg.click('#photo'); await pg.wait_for_function('window.__photos>=1',timeout=15000); await pg.wait_for_timeout(700)
    al=await E("(JSON.parse(localStorage.getItem('teAlbum'))||[]).length"); rec('photo_saved_to_album',al>=1,{'album':al})
    img=await E("JSON.parse(localStorage.getItem('teAlbum'))[0].img"); import base64; open(OUT+'/22_album_photo.jpg','wb').write(base64.b64decode(img.split(',')[1]))
    await pg.screenshot(path=OUT+'/23_after_photo.png')
    await pg.goto(BASE+'cities/taipei/test/trip.html'+cb); await pg.wait_for_timeout(1500)
    rec('trip_page_shows_album_and_stamp',await pg.locator('#album img').count()>=1 and await pg.locator('#stamps .teaser').count()>=1)
    await pg.locator('#albumWrap').scroll_into_view_if_needed(); await pg.screenshot(path=OUT+'/24_trip_album.png')
    rec('no_page_errors',not errs,{'errors':errs[:3]})
    await ctx.close(); await b.close()
    json.dump(rows,open(OUT+'/results.json','w'),indent=1); print('SUMMARY',sum(r['pass'] for r in rows),'/',len(rows),'passed')
    sys.exit(0 if all(r['pass'] for r in rows) else 1)
asyncio.run(main())
