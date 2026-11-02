"""w42i: off-route push + look-inside via real input events. Usage: python3 webkit_w34.py URL --local DIR"""
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOCAL = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--local' else None
SUB = 'test/' if '/hoian/test/' in URL else ''
VER = os.environ.get('VER', 'w42i')
EVD = os.environ.get('EVD', os.environ.get('EVD2','/workspace/qa/w42i/ev'))
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
            pg.route('**/test/side-paths-w42i.html*', lf(SUB + 'side-paths-w42i.html', 'text/html'));
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
    ev("document.getElementById('places') && (document.getElementById('places').hidden=true)")
    jx, jy = ev("(()=>{const r=document.getElementById('joy').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
    sift = cv2.SIFT_create(2000)
    def inl(a, b):
        h, w = a.shape[:2]; m = np.zeros((h, w), np.uint8); m[int(h*.2):int(h*.62)] = 255
        g = lambda x: cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)
        k1, d1 = sift.detectAndCompute(g(a), m); k2, d2 = sift.detectAndCompute(g(b), m)
        if d1 is None or d2 is None: return 0
        mt = [x for x, y in cv2.BFMatcher().knnMatch(d1, d2, k=2) if x.distance < 0.7 * y.distance]
        if len(mt) < 8: return len(mt)
        p1 = np.float32([k1[x.queryIdx].pt for x in mt]); p2 = np.float32([k2[x.trainIdx].pt for x in mt])
        _, msk = cv2.findHomography(p1, p2, cv2.RANSAC, 6.0); return int(msk.sum()) if msk is not None else 0
    def settle(t, look=0):
        ev(f"__w.jump({t})")
        for i in range(40):
            pg.wait_for_timeout(250)
            if not ev("__w.state().jumping") and abs(ev('__w.state().pos') - t) < 0.6: break
        ev(f"__w.setLook({look},0)"); pg.wait_for_timeout(1200)
    pos = lambda: ev('__w.state().pos')
    def push(sec, dx=0, dy=-50):
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx + dx, jy + dy, steps=3); pg.wait_for_timeout(int(sec * 1000)); r = ev("__w.lastAct()"); pg.mouse.up(); pg.wait_for_timeout(400); return r
    TPL = cv2.imread('/workspace/qa/w42i/keep/r_1094_50.jpg')
    def drag_look(target_deg):
        x, y = 200, 330; pg.mouse.move(x, y); pg.mouse.down()
        for k in range(60):
            r = ev('__w.relYaw()')
            if abs(r - target_deg) < 4: break
            x += 6 if r < target_deg else -6
            if x < 30 or x > 360: pg.mouse.up(); x = 200; pg.mouse.move(x, y); pg.mouse.down()
            pg.mouse.move(x, y, steps=2)
        pg.mouse.up(); pg.wait_for_timeout(400); return ev('__w.relYaw()')
    # 1: the user's exact gesture: at 1099.6 pull back (lands 1094.6), drag the picture to look LEFT at the lantern courtyard / gateway, push up
    settle(1099.6); push(0.9, 0, 50); pg.wait_for_timeout(1500); p0 = pos()
    rl = drag_look(50); img0 = shot('user_gesture_1_looking_left')
    vis = ev("(()=>{const b=document.querySelector('[data-hot=lantern]');return b&&!b.hidden})()")
    push(1.2); img1 = shot('user_gesture_2_after_push')
    st = ev("[__w.inside(), __w.fov(), document.getElementById('inside').hidden]")
    rep('user gesture: at 1094.6 looking left, Look-inside button visible', abs(p0 - 1094.6) < 0.8 and vis, p=p0, rel=rl)
    rep('user gesture: push up opens look-inside (lantern), no turn-away, no walking', st[0] == 'lantern' and st[1] < 45 and not st[2] and abs(pos() - p0) < 0.5, st=st, last=ev('__w.lastAct()'))
    m1, mf = inl(img1, TPL), inl(img1, shot('_dummy') if False else cv2.imread('/workspace/qa/w42i/keep/r_1094_0.jpg'))
    rep('picture: look-inside shows the lantern courtyard (matches measured courtyard view, not the route view)', m1 >= 6 and m1 > 3 * mf, m_court=m1, m_route=mf)
    pg.click('#inside-back'); pg.wait_for_timeout(500)
    # visibility sweep: button shows whenever courtyard within ~50 deg during its window
    for t, lk in ((1090, 30), (1097, 90), (1101, 70)):
        settle(t, lk); rep(f'lantern button visible at {t} look {lk}', ev("(()=>{const b=document.querySelector('[data-hot=lantern]');return b&&!b.hidden})()"))
    # red gateway on the right
    settle(1105, -30); push(1.2); rep('push toward red gateway (right) at 1105 opens look-inside', ev('__w.inside()') == 'gate', last=ev('__w.lastAct()')); shot('gate_inside'); pg.click('#inside-back'); pg.wait_for_timeout(400)
    # no opening (right side trees at 1094.6): turned back to street with arrow, no slide
    settle(1094.6, -75); p0 = pos(); pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3); pg.wait_for_timeout(150)
    ar = ev("(()=>{const a=document.getElementById('path-arrow');return a.hidden?null:a.textContent})()"); p1 = pos(); shot('right_trees_arrow'); pg.wait_for_timeout(2500); pg.mouse.up()
    rep('no opening: arrow + turn back, no slide', ar is not None and abs(p1 - p0) < 0.1 and ev('__w.inside()') is None, arrow=ar)
    # 3: regression - forward along route walks; pull back still jumps
    settle(600); p0 = pos(); push(2.5); rep('forward along route walks', pos() - p0 > 1.2, p=[p0, pos()])
    settle(600); p0 = pos(); push(1.2, 0, 50); pg.wait_for_timeout(800); rep('pull back still jumps 5 s', 3.5 < p0 - pos() < 6.5, p=[p0, pos()])
    rep('no page errors', not CONS, cons=CONS[:5])
    print('RESULT', 'PASS' if not fails else 'FAIL ' + str(fails))
