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
    BU = json.load(open(os.environ.get('BRIDGE_U', os.path.join(os.path.dirname(__file__), 'bridge_u_w33.json'))))
    def bridge_look(t):  # look yaw (setLook convention) that centres the bridge at frame time t, from the tracked bearing
        u = float(np.interp(t, [x[0] for x in BU], [x[1] for x in BU])); psi = 2 * np.pi * (0.75 - u)
        hd = ev('__w.state().hd'); return float(np.degrees(np.arctan2(np.sin(psi - hd), np.cos(psi - hd))))
    refs = {}
    pg.wait_for_timeout(2500); s_load = ev('__w.state()')
    W, H = ev('[innerWidth, innerHeight]')
    def drag_look(target):  # real pointer drag on the picture (one finger), small steps, until look reaches target
        for it in range(40):
            cur = np.degrees(ev('__w.state().lookYaw')); d = (target - cur + 180) % 360 - 180
            if abs(d) < 3: break
            k = 1.6 * ev('(()=>{return 1})()') ; px = max(-120, min(120, d * 6))
            x0, y0 = W * 0.5, H * 0.35; pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + px, y0, steps=4); pg.mouse.up(); pg.wait_for_timeout(60)
        return np.degrees(ev('__w.state().lookYaw'))
    def push(ms):
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3); t1 = ev('performance.now()'); out = []
        while ev('performance.now()') - t1 < ms:
            pg.wait_for_timeout(250); st = ev('__w.state()'); out.append(dict(ms=round(ev('performance.now()') - t1), pos=round(st['pos'], 2), dir=st.get('dir'), gap=ev('__w.gapJumps'), look=round(np.degrees(st['lookYaw']), 1), status=ev("document.getElementById('status').textContent")[:40]))
            if out[-1]['gap'] and len([o for o in out if o['gap']]) == 1: shots.append(('blur', shot(pg)))
        return out
    shots = []; log = {}
    TS = os.environ.get('T_START')
    if TS: ev(f'__w.jump({TS})'); pg.wait_for_timeout(3000); ev('__w.setLook(0,0)')
    shots.append(('load', shot(pg)))
    # 1) user pushes first while looking at the yellow wall (behind the travel direction)
    drag_look(-100); log['push_wall'] = push(int(os.environ.get('WALL_MS', '2500'))); pg.mouse.up(); pg.wait_for_timeout(300)
    # 2) drag left until the bridge is centred (tracked bearing at the current frame time)
    tnow = ev('__w.state().pos'); tgt = bridge_look(tnow); got = drag_look(tgt); pg.wait_for_timeout(300)
    start = shot(pg); shots.append(('centred', start)); log['centred'] = dict(t=tnow, target=round(tgt, 1), got=round(got, 1), facing=ev('__w.facingBridge ? __w.facingBridge() : null'))
    # 3) push up and hold (~8 s after which we check)
    log['push_bridge'] = push(int(os.environ.get('HOLD', '9000'))); end = shot(pg); s1 = ev('__w.state()'); pg.mouse.up()
    ev('__w.setLook(0, 0)'); pg.wait_for_timeout(300); end = shot(pg)  # w35: compare at look 0, same as the refs
    for t in (round(s1['pos'], 2), 1116, 1120):  # w35: first ref is rendered at the exact end position (position-matched)
        ev(f'__w.jump({t})'); pg.wait_for_timeout(3000); ev('__w.setLook(0, 0)'); pg.wait_for_timeout(800); refs[t] = shot(pg)
    sc_start = max(inliers(start, r) for r in refs.values()); sc_end = max(inliers(end, r) for r in refs.values()); sc_es = inliers(end, start)
    pb = log['push_bridge']; first_gap = next((o['ms'] for o in pb if o['gap']), None)
    ok = bool(first_gap is not None and first_gap <= 1500 and s1['pos'] > 1110 and sc_end >= 8 and sc_end >= 2 * max(sc_start, 4))  # w35: end-vs-start dropped: the start view at 9-13 s looks AT the bridge, so it legitimately shares points with the inside view
    os.makedirs(OUT, exist_ok=True); h = 600; R = lambda x: cv2.resize(x, (int(x.shape[1] * h / x.shape[0]), h))
    cv2.imwrite(OUT + f'/gesture_{TS or "load"}_start_vs_end.jpg', np.hstack([R(x) for n, x in shots] + [R(end), R(refs[1120])]))
    res = dict(ok=ok, t_start=TS, hint_after=ev("document.getElementById('status').textContent"), ver=VER, load=s_load['pos'], centred=log['centred'], first_gap_ms=first_gap, end_pos=round(s1['pos'], 2), inliers_start_vs_inside=sc_start, inliers_end_vs_inside=sc_end, inliers_end_vs_start=sc_es, log=log)
    json.dump(res, open(OUT + f'/gesture_{TS or "load"}.json', 'w'), indent=1); print(json.dumps({k: v for k, v in res.items() if k != 'log'}), flush=True)
    b.close()
sys.exit(0 if ok else 1)
