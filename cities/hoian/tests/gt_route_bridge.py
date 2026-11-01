"""Ground-truth direction test (independent of the player's heading logic).
For each (time, look yaw): jump, set look, screenshot the rendered canvas, hold stick UP 1.5 s, screenshot again, and measure
radial optical flow on the canvas: expansion (>0) = scenery approaching = walking toward where you look.
Usage: python3 gt_approach.py URL --local DIR  [env VER, POINTS=json list of [t, yaw_deg, label], OUT dir]"""
import sys, os, json, io
import numpy as np, cv2
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOCAL = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--local' else None
SUB = 'test/' if '/hoian/test/' in URL else ''
VER = os.environ.get('VER', 'w30'); JS = f'walk-{VER}.js'; FLV = os.environ.get('FLV', 'hls13/f1280/index.m3u8')
OUT = os.environ.get('OUT', '/workspace/qa/w30/gt'); os.makedirs(OUT, exist_ok=True)
EXTRA = json.loads(os.environ.get('EXTRA_FILES', '[]'))

def pair_scale(a, b):
    """Scale change (per mille) between two canvas shots: least-squares fit of flow = shift + e*(pos - centre) on textured pixels,
    excluding the top buttons/minimap and the stick/hint/credit block. >0 = image expands = approaching what is in view."""
    g1 = cv2.cvtColor(a, cv2.COLOR_BGR2GRAY); g2 = cv2.cvtColor(b, cv2.COLOR_BGR2GRAY)
    g1 = cv2.resize(g1, None, fx=0.5, fy=0.5); g2 = cv2.resize(g2, None, fx=0.5, fy=0.5); h, w = g1.shape
    f = cv2.calcOpticalFlowFarneback(g1, g2, None, 0.5, 4, 25, 5, 7, 1.5, 0)
    ys, xs = np.mgrid[0:h, 0:w]; m = np.zeros((h, w), bool); m[int(h * 0.12):int(h * 0.62)] = True; m[:int(h * 0.2), int(w * 0.65):] = False
    m &= np.abs(cv2.Laplacian(g1, cv2.CV_32F)) > 6
    X = np.stack([np.ones(m.sum()), xs[m] - w / 2], 1); ex = np.linalg.lstsq(X, f[..., 0][m], rcond=None)[0][1]
    Y = np.stack([np.ones(m.sum()), ys[m] - h / 2], 1); ey = np.linalg.lstsq(Y, f[..., 1][m], rcond=None)[0][1]
    return float((ex + ey) / 2 * 1000)
def sim_scale(a, b):
    """robust similarity fit (RANSAC) on SIFT matches in the picture area (no UI): returns scale-1 in per mille and inlier count"""
    h, w = a.shape[:2]; m = np.zeros((h, w), np.uint8); m[int(h * 0.1):int(h * 0.66)] = 255; m[:int(h * 0.2), int(w * 0.62):] = 0; m[:int(h * 0.12), :int(w * 0.45)] = 0
    s = cv2.SIFT_create(1500); g1, g2 = [cv2.cvtColor(x, cv2.COLOR_BGR2GRAY) for x in (a, b)]
    k1, d1 = s.detectAndCompute(g1, m); k2, d2 = s.detectAndCompute(g2, m)
    if d1 is None or d2 is None or len(k1) < 8 or len(k2) < 8: return 0.0, 0
    mt = [x for x, y in cv2.BFMatcher().knnMatch(d1, d2, k=2) if x.distance < 0.75 * y.distance]
    if len(mt) < 8: return 0.0, len(mt)
    p1 = np.float32([k1[x.queryIdx].pt for x in mt]); p2 = np.float32([k2[x.trainIdx].pt for x in mt])
    M, inl = cv2.estimateAffinePartial2D(p1, p2, method=cv2.RANSAC, ransacReprojThreshold=2.0, maxIters=5000, confidence=0.999)
    if M is None: return 0.0, 0
    return float((np.hypot(M[0, 0], M[1, 0]) - 1) * 1000), int(inl.sum())

def inliers(a, b):
    s = cv2.SIFT_create(1500); g1, g2 = [cv2.cvtColor(x, cv2.COLOR_BGR2GRAY) for x in (a, b)]
    h, w = g1.shape; m = np.zeros((h, w), np.uint8); m[int(h * 0.1):int(h * 0.7)] = 255; m[:int(h * 0.2), int(w * 0.6):] = 0
    k1, d1 = s.detectAndCompute(g1, m); k2, d2 = s.detectAndCompute(g2, m)
    if d1 is None or d2 is None or len(k1) < 8 or len(k2) < 8: return 0
    mt = [x for x, y in cv2.BFMatcher().knnMatch(d1, d2, k=2) if x.distance < 0.75 * y.distance]
    if len(mt) < 8: return 0
    p1 = np.float32([k1[x.queryIdx].pt for x in mt]); p2 = np.float32([k2[x.trainIdx].pt for x in mt])
    H, inl = cv2.findHomography(p1, p2, cv2.RANSAC, 4.0)
    return int(inl.sum()) if inl is not None else 0
shot = lambda pg: cv2.imdecode(np.frombuffer(pg.screenshot(), np.uint8), 1)
with sync_playwright() as p:
    b = p.webkit.launch(); ctx = b.new_context(**p.devices['iPhone 13']); pg = ctx.new_page()
    def px(r, q=None):
        try: r.fulfill(response=r.fetch())
        except Exception: r.abort()
    pg.route('**/*', px)
    def lf(path, ct): return lambda r, q=None: r.fulfill(body=open(os.path.join(LOCAL, path), 'rb').read().replace(b'hls13/f3840/index.m3u8', FLV.encode()), content_type=ct)
    for f, ct in [(SUB + JS, 'text/javascript'), (SUB + 'ver.txt', 'text/plain'), ('routes.json', 'application/json'), ('assets/walk/walk.json', 'application/json'), ('assets/walk/heading_foe.json', 'application/json'), ('vendor/hls.min.js', 'text/javascript'), ('vendor/three.module.js', 'text/javascript'), ('vendor/three.core.js', 'text/javascript')]:
        pg.route(f'**/cities/hoian/{f}*', lf(f, ct))
    for pat in (f'**/cities/hoian/{SUB}', f'**/cities/hoian/{SUB}?*', f'**/cities/hoian/{SUB}index.html*'): pg.route(pat, lf(SUB + 'index.html', 'text/html'))
    pg.goto(URL, wait_until='load'); ev = pg.evaluate
    for i in range(120):
        if ev("window.__w && __w.state().ready"): break
        pg.wait_for_timeout(500)
    jx, jy = ev("(()=>{const r=document.getElementById('joy').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
    # references: inside the bridge (main walk, facing travel direction)
    refs = {}
    for t in (1116, 1120):
        ev(f'__w.jump({t})'); pg.wait_for_timeout(3000); ev('__w.setLook(0, 0)'); pg.wait_for_timeout(800); refs[t] = shot(pg)
    T0 = float(os.environ.get('T0', '12')); hdT = lambda t: ev(f'__w.headAt({t})') * 180 / np.pi
    ev(f'__w.jump({T0})'); pg.wait_for_timeout(3000)
    wrapd = lambda a: (a + 180) % 360 - 180
    yaw = round(ev(f"(()=>{{const p=2*Math.PI*(0.75-0.9)-__w.headAt({T0});return Math.atan2(Math.sin(p),Math.cos(p))*180/Math.PI}})()"), 1) if T0 >= 8 else round(wrapd(ev('__w.gapPsi') - ev('__w.state().hd') * 180 / np.pi), 1)
    ev(f'__w.setLook({yaw}, 0)'); pg.wait_for_timeout(800); start = shot(pg); s0 = ev('__w.state()')
    log = [dict(ms=0, pos=s0['pos'], facing=ev('__w.facingBridge()'), yaw=yaw)]
    pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3)
    t1 = ev('performance.now()'); shots = []; jumped_at = None; turned = False
    while ev('performance.now()') - t1 < 60000:
        pg.wait_for_timeout(500); st = ev('__w.state()'); g = ev('__w.gapJumps'); stx = ev("document.getElementById('status').textContent")
        log.append(dict(ms=round(ev('performance.now()') - t1), pos=round(st['pos'], 2), dir=st.get('dir'), gap=g, look=round(st['lookYaw'] * 180 / np.pi, 1), filt=ev('document.querySelector("canvas").style.filter'), status=stx))
        if not g and not turned and 'turn to the bridge' in stx:
            # like a user: stopped at the start, turn to where the bridge is now (drag look), keep pushing
            shots.append(('stopped', shot(pg))); ny = round(wrapd(ev('__w.gapPsi') - st['hd'] * 180 / np.pi), 1); ev(f'__w.setLook({ny}, 0)'); turned = True; log[-1]['turned_to'] = ny
            pg.wait_for_timeout(300); shots.append(('turned', shot(pg)))
        if g and jumped_at is None: jumped_at = log[-1]['ms']; pg.wait_for_timeout(150); shots.append(('blur', shot(pg)))
        if jumped_at is not None and log[-1]['ms'] - jumped_at > 9000: break
    end = shot(pg); s1 = ev('__w.state()'); pg.mouse.up()
    sc_start = max(inliers(start, r) for r in refs.values()); sc_end = max(inliers(end, r) for r in refs.values()); sc_es = inliers(end, start)
    # blur duration: count of samples with a filter set
    blur_ms = 500 * sum(1 for x in log if x.get('filt'))  # sampled every 500 ms; the code itself caps the blur at 0.45 s + <=1 s seek + 0.5 s
    ok = bool(ev('__w.gapJumps') >= 1 and s1['pos'] > 1112 and sc_end >= 10 and sc_end > 2 * max(sc_start, 4) and sc_es < 8 and blur_ms <= 2000)
    os.makedirs(OUT, exist_ok=True)
    h = 600; R = lambda x: cv2.resize(x, (int(x.shape[1] * h / x.shape[0]), h))
    tiles = [R(start)] + [R(x) for n, x in shots] + [R(end), R(refs[1120])]
    cv2.imwrite(OUT + f'/route_{T0:g}_start_vs_end.jpg', np.hstack(tiles))
    res = dict(ok=ok, t0=T0, turned=turned, start_pos=s0['pos'], end_pos=round(s1['pos'], 2), end_dir=s1.get('dir'), gap_jumps=ev('__w.gapJumps'), inliers_start_vs_inside=sc_start, inliers_end_vs_inside=sc_end, inliers_end_vs_start=sc_es, blur_ms_sampled=blur_ms, jumped_at_ms=jumped_at, look_yaw=yaw, log=log)
    json.dump(res, open(OUT + f'/route_{T0:g}.json', 'w'), indent=1); print(json.dumps({k: v for k, v in res.items() if k != 'log'}), flush=True)
    b.close()
sys.exit(0 if ok else 1)
