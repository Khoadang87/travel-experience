"""w42h: off-route push + look-inside via real input events. Usage: python3 webkit_w34.py URL --local DIR"""
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOCAL = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--local' else None
SUB = 'test/' if '/hoian/test/' in URL else ''
VER = os.environ.get('VER', 'w42h')
EVD = os.environ.get('EVD', os.environ.get('EVD2','/workspace/qa/w42h/ev'))
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
            pg.route('**/test/side-paths-w42h.html*', lf(SUB + 'side-paths-w42h.html', 'text/html'));
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
    # 1: user's gesture - look sideways off-route (60 deg, no hotspot) at 1103 and push: no sliding, arrow shown, view eases to the route, then walks
    for t, lk in ((1103, 60), (1103, -60), (800, 70)):
        settle(t, lk); p0 = pos(); before = shot(f'off_{t}_{lk}_before')
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3); pg.wait_for_timeout(150)
        arrow = ev("(()=>{const a=document.getElementById('path-arrow');return a.hidden?null:a.textContent})()"); p05 = pos(); mid = shot(f'off_{t}_{lk}_arrow')
        pg.wait_for_timeout(2500); p3 = pos(); rel = ev('__w.relYaw()'); pg.mouse.up(); pg.wait_for_timeout(300)
        rep(f'push facing {lk} deg off-route at {t}: no slide while off, arrow shown, eases to route then walks', arrow is not None and abs(p05 - p0) < 0.1 and abs(rel) < 45 and p3 - p0 > 0.4, arrow=arrow, p=[p0, p05, p3], rel=rel)
    # 2: look into the lantern courtyard / archway and push -> look-inside (zoomed real frame), not walking
    for hid, t in (('lantern', 1101), ('arch', 1106)):
        settle(t, 90); p0 = pos(); before = shot(f'in_{hid}_facing')
        tag = ev(f"(()=>{{const b=document.querySelector('[data-hot={hid}]');return b&&!b.hidden}})()")
        push(1.5); img = shot(f'in_{hid}_inside')
        st = ev("[__w.inside(), __w.fov(), document.getElementById('inside').hidden, document.getElementById('inside').textContent]")
        rep(f'push into {hid}: look-inside opens (zoomed, labelled), no walking', tag and st[0] == hid and st[1] < 45 and not st[2] and 'No footage goes inside' in st[3] and abs(pos() - p0) < 1.2, marker=tag, st=st[:3], p=[p0, pos()])
        rep(f'{hid} inside view is the same real scene zoomed in', inl(img, before) >= 15, m=inl(img, before))
        pg.click('#inside-back'); pg.wait_for_timeout(500)
        rep(f'{hid}: back to street restores', ev('__w.inside()') is None and ev('__w.fov()') == 75 and abs(ev('__w.relYaw()')) < 10)
    # 3: regression - forward along route walks; pull back still jumps
    settle(600); p0 = pos(); push(2.5); rep('forward along route walks', pos() - p0 > 1.2, p=[p0, pos()])
    settle(600); p0 = pos(); push(1.2, 0, 50); pg.wait_for_timeout(800); rep('pull back still jumps 5 s', 3.5 < p0 - pos() < 6.5, p=[p0, pos()])
    rep('no page errors', not CONS, cons=CONS[:5])
    print('RESULT', 'PASS' if not fails else 'FAIL ' + str(fails))
