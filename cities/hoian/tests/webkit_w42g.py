"""w60: pull-back via real input events. Usage: python3 webkit_w34.py URL --local DIR"""
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOCAL = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--local' else None
SUB = 'test/' if '/hoian/test/' in URL else ''
VER = os.environ.get('VER', 'w42g')
EVD = os.environ.get('EVD', os.environ.get('EVD2','/workspace/qa/w42g/ev'))
os.makedirs(EVD, exist_ok=True)
JS = os.environ.get('WALKJS', f'walk-{VER}.js')
FLV = os.environ.get('FLV', 'hls13/f1280/index.m3u8')
fails = []
def rep(name, ok, **kw):
    print('PASS' if ok else 'FAIL', json.dumps(dict(point=name, **kw))[:900], flush=True)
    if not ok: fails.append(name)
with sync_playwright() as p:
    b = p.webkit.launch(); ctx = b.new_context(**p.devices['iPhone 13'])
    CONS = []
    def page():
        pg = ctx.new_page()
        def px(r, q=None):
            try: r.fulfill(response=r.fetch())
            except Exception: r.abort()
        pg.route('**/*', px)
        pg.on('console', lambda m: CONS.append(m.type + ': ' + m.text[:200]) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: CONS.append('pageerror: ' + str(e)[:200]))
        if LOCAL:
            def lf(path, ct):
                return lambda r, q=None: r.fulfill(body=open(os.path.join(LOCAL, path), 'rb').read().replace(b'hls13/f3840/index.m3u8', FLV.encode()), content_type=ct)
            for f, ct in ((SUB + JS, 'text/javascript'), (SUB + 'ver.txt', 'text/plain'), ('routes.json', 'application/json'), ('assets/walk/walk.json', 'application/json'), ('assets/walk/heading_foe.json', 'application/json'), ('assets/walk/heading_w18.json', 'application/json'), ('vendor/hls.min.js', 'text/javascript'), ('vendor/three.module.js', 'text/javascript'), ('vendor/three.core.js', 'text/javascript')):
                pg.route(f'**/cities/hoian/{f}*', lf(f, ct))
            pg.route(f'**/cities/hoian/{SUB}', lf(SUB + 'index.html', 'text/html')); pg.route(f'**/cities/hoian/{SUB}?*', lf(SUB + 'index.html', 'text/html')); pg.route(f'**/cities/hoian/{SUB}index.html*', lf(SUB + 'index.html', 'text/html'))
        else:
            pg.route('**/assets/walk/walk.json*', lambda r, q=None: r.fulfill(body=r.fetch().body().replace(b'hls13/f3840/index.m3u8', FLV.encode()), content_type='application/json'))
        return pg
    BADREQ = []
    ctx.on('request', lambda r: BADREQ.append(r.url) if ('r2560' in r.url or '_rev' in r.url) else None)
    pg = page(); ev = pg.evaluate
    import numpy as np, cv2
    def shot(name): pg.screenshot(path=f'{EVD}/{name}.jpg', type='jpeg', quality=75); return cv2.imread(f'{EVD}/{name}.jpg')
    pg.goto(URL + ('&' if '?' in URL else '?') + 'debug=0', wait_until='load')
    for i in range(120):
        if ev("window.__w && __w.state().ready"): break
        pg.wait_for_timeout(500)
    pg.wait_for_timeout(1500); shot('places_menu')
    rep(f'version {VER}', ev("document.getElementById('ver').textContent") == VER)
    jb = ev("(()=>{const r=document.getElementById('joy').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()"); jx, jy = jb
    sift = cv2.SIFT_create(2000)
    def inl(a, b):
        h, w = a.shape[:2]; m = np.zeros((h, w), np.uint8); m[int(h*.15):int(h*.62)] = 255
        g = lambda x: cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)
        k1, d1 = sift.detectAndCompute(g(a), m); k2, d2 = sift.detectAndCompute(g(b), m)
        if d1 is None or d2 is None: return 0
        mt = [x for x, y in cv2.BFMatcher().knnMatch(d1, d2, k=2) if x.distance < 0.7 * y.distance]
        if len(mt) < 8: return len(mt)
        p1 = np.float32([k1[x.queryIdx].pt for x in mt]); p2 = np.float32([k2[x.trainIdx].pt for x in mt])
        _, msk = cv2.findHomography(p1, p2, cv2.RANSAC, 6.0); return int(msk.sum()) if msk is not None else 0
    def settle(t):
        ev(f"__w.jump({t})"); 
        for i in range(40):
            pg.wait_for_timeout(250)
            if not ev("__w.state().jumping") and abs(ev('__w.state().pos') - t) < 0.6: break
        ev("__w.setLook(0,0)"); pg.wait_for_timeout(1200)
    pos = lambda: ev('__w.state().pos')
    def pull_mouse(dx, dy, sec):
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx + dx, jy + dy, steps=4); pg.wait_for_timeout(400)
        dbg = ev("document.getElementById('stickdbg').textContent"); pg.wait_for_timeout(int(sec * 1000) - 400)
        pg.mouse.up(); pg.wait_for_timeout(1800); img = shot(f'pull_m_{dx}_{dy}_after'); return dbg, img
    TOUCH = """([cx,cy,dx,dy,phase])=>{const el=document.getElementById('joy');const mk=(x,y)=>({identifier:7,target:el,clientX:x,clientY:y});
      const t=phase==='end'?[]:[mk(cx+dx,cy+dy)];const ch=[mk(cx+dx,cy+dy)];
      const e=new Event('touch'+phase,{bubbles:true,cancelable:true});Object.defineProperty(e,'changedTouches',{value:ch});Object.defineProperty(e,'touches',{value:t});el.dispatchEvent(e);return document.getElementById('stickdbg').textContent}"""
    ev("document.getElementById('places') && (document.getElementById('places').hidden=true)")
    # A: real pointer drag down, held 3.6 s at t600 -> two 5 s jumps, picture = earlier footage
    settle(600); p0 = pos(); before = shot('A_before'); bp0 = ev('__w.backPulls||0')
    dbg, held = pull_mouse(0, 50, 3.6); p1 = pos(); n = ev('__w.backPulls||0') - bp0
    ev('__w.setLook(0,0)'); pg.wait_for_timeout(500); held = shot('A_after_look0'); p1 = pos(); settle(round(p1, 2)); ref = shot('A_ref_same_time'); settle(p0); now = shot('A_back_to_start')
    rep('pointer drag down held: jumps back repeatedly, readout shows stick', n >= 2 and p0 - p1 > 8 and 'y 0.' in dbg and 'BACK' in dbg, p0=p0, p1=p1, pulls=n, readout=dbg)
    rep('picture after pull = earlier footage (matches seek to that time, not the start frame)', inl(held, ref) > 2 * max(5, inl(held, before)), m_ref=inl(held, ref), m_before=inl(held, before))
    # B: touch-event fallback only (no pointer events)
    settle(900); p0 = pos(); bp0 = ev('__w.backPulls||0'); ev(TOUCH, [jx, jy, 0, 0, 'start']); r = ev(TOUCH, [jx, jy, 0, 45, 'move'])
    pg.wait_for_timeout(1300); img = shot('B_touch_held'); ev(TOUCH, [jx, jy, 0, 45, 'end']); pg.wait_for_timeout(600)
    rep('touch-event path alone (TouchEvent-shaped events; WebKit has no Touch constructor): stick tracks and pull-back jumps', ev('__w.backPulls||0') - bp0 >= 1 and p0 - pos() > 3.5 and ev('__w.joyState().id') is None, readout=r, p=[p0, pos()])
    # C: diagonals / shallow pulls
    for dx, dy in ((35, 40), (-35, 40), (10, 22)):
        settle(1200); p0 = pos(); bp0 = ev('__w.backPulls||0'); dbg, _ = pull_mouse(dx, dy, 1.2)
        rep(f'pull ({dx},{dy}) jumps back once', ev('__w.backPulls||0') - bp0 == 1 and 3.5 < p0 - pos() < 6.5, readout=dbg, p=[p0, pos()])
    # D: pull while a jump is still busy -> retried, not eaten
    settle(700); bp0 = ev('__w.backPulls||0'); ev("__w.jump(720)"); pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy + 50, steps=2)
    pg.wait_for_timeout(1400); lastw = ev('__w.lastAct()'); pg.mouse.up(); pg.wait_for_timeout(600)
    rep('pull during a busy jump is retried, not eaten', ev('__w.backPulls||0') - bp0 >= 1 and pos() < 718, p=pos(), last=lastw)
    # E: accepted controls unchanged: forward walks, sideways turns
    settle(400); p0 = pos(); pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3); pg.wait_for_timeout(2500); pg.mouse.up(); pg.wait_for_timeout(500)
    rep('forward push still walks forward', pos() - p0 > 1.2, p=[p0, pos()])
    y0 = ev('__w.relYaw()'); pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx + 55, jy, steps=3); pg.wait_for_timeout(1500); pg.mouse.up(); pg.wait_for_timeout(300)
    rep('sideways still turns, no back jump', abs(ev('__w.relYaw()') - y0) > 30, dyaw=ev('__w.relYaw()') - y0)
    shot('E_final')
    rep('no page errors', not CONS, cons=CONS[:5])
    print('RESULT', 'PASS' if not fails else 'FAIL ' + str(fails))
