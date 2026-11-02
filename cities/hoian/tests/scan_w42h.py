"""w60: pull-back via real input events. Usage: python3 webkit_w34.py URL --local DIR"""
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOCAL = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--local' else None
SUB = 'test/' if '/hoian/test/' in URL else ''
VER = os.environ.get('VER', 'w42g')
EVD = os.environ.get('EVD', os.environ.get('EVD2','/workspace/qa/w42h/scan'))
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
    ev("document.getElementById('places') && (document.getElementById('places').hidden=true)")
    ev("document.querySelectorAll('#joy,#hint,#back-step,#credit,#stickdbg,#minimap').forEach(e=>e.style.visibility='hidden')")
    import sys as _s
    TS = [float(x) for x in os.environ.get('TS','1100,1103,1106').split(',')]
    for t in TS:
        ev(f"__w.jump({t})")
        for i in range(40):
            pg.wait_for_timeout(250)
            if not ev("__w.state().jumping") and abs(ev('__w.state().pos') - t) < 0.6: break
        pg.wait_for_timeout(800); row = []
        for yd in range(-180, 180, 45):
            ev(f"__w.setLook({yd},0)"); pg.wait_for_timeout(350); row.append(cv2.resize(shot(f'_t'), (195, 422)))
            cv2.putText(row[-1], f'{int(t)} {yd}', (5, 410), 0, .7, (0, 255, 255), 2)
        cv2.imwrite(f'{EVD}/scan_{int(t)}.jpg', np.hstack(row)); print('row', t, flush=True)
    print('RESULT done')
