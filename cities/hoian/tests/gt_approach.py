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
PTS = json.loads(os.environ['POINTS'])
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
rows = []
with sync_playwright() as p:
    b = p.webkit.launch(); ctx = b.new_context(**p.devices['iPhone 13']); pg = ctx.new_page()
    def px(r, q=None):
        try: r.fulfill(response=r.fetch())
        except Exception: r.abort()
    pg.route('**/*', px)
    def lf(path, ct): return lambda r, q=None: r.fulfill(body=open(os.path.join(LOCAL, path), 'rb').read().replace(b'hls13/f3840/index.m3u8', FLV.encode()), content_type=ct)
    for f, ct in [(SUB + JS, 'text/javascript'), (SUB + 'ver.txt', 'text/plain'), ('routes.json', 'application/json'), ('assets/walk/walk.json', 'application/json'), ('assets/walk/heading_w18.json', 'application/json'), ('vendor/hls.min.js', 'text/javascript'), ('vendor/three.module.js', 'text/javascript'), ('vendor/three.core.js', 'text/javascript')] + [tuple(x) for x in EXTRA]:
        pg.route(f'**/cities/hoian/{f}*', lf(f, ct))
    for pat in (f'**/cities/hoian/{SUB}', f'**/cities/hoian/{SUB}?*', f'**/cities/hoian/{SUB}index.html*'): pg.route(pat, lf(SUB + 'index.html', 'text/html'))
    pg.goto(URL, wait_until='load'); ev = pg.evaluate
    for i in range(120):
        if ev("window.__w && __w.state().ready"): break
        pg.wait_for_timeout(500)
    jx, jy = ev("(()=>{const r=document.getElementById('joy').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
    for t, yaw, label, expect in PTS:
        ev(f'__w.jump({t})'); pg.wait_for_timeout(2500)
        if isinstance(yaw, dict):  # aim at an image longitude u of the source frame (e.g. the bridge): camera psi = 2pi(0.75-u), look = psi - hd
            yaw = round(ev(f"(()=>{{const p=2*Math.PI*(0.75-{yaw['u']})-__w.headAt({t});return Math.atan2(Math.sin(p),Math.cos(p))*180/Math.PI}})()"), 1)
        ev(f'__w.setLook({yaw}, 0)'); pg.wait_for_timeout(700)
        s0 = ev('__w.state()'); a = cv2.imdecode(np.frombuffer(pg.screenshot(), np.uint8), 1)
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3)
        # baseline = first frame AFTER the walk has visibly started (excludes the frozen frame of a direction switch)
        t0 = ev('performance.now()'); p0 = s0['pos']
        while ev('performance.now()') - t0 < 6000 and abs(ev('__w.state().pos') - p0) < 0.15: pg.wait_for_timeout(100)
        shots = [cv2.imdecode(np.frombuffer(pg.screenshot(), np.uint8), 1)]; t1 = ev('performance.now()')
        while ev('performance.now()') - t1 < 1800 or (len(shots) < 4 and ev('performance.now()') - t1 < 6000): pg.wait_for_timeout(250); shots.append(cv2.imdecode(np.frombuffer(pg.screenshot(), np.uint8), 1))
        a = shots[0]
        bimg = shots[-1]; s1 = ev('__w.state()'); pg.mouse.up(); ev('__w.freeze && __w.freeze(false)'); pg.wait_for_timeout(400)
        ps = [pair_scale(x, y) for x, y in zip(shots, shots[1:])]; flow = sum(ps); med = float(np.median(ps)) if ps else 0
        sp = [sim_scale(x, y) for x, y in zip(shots, shots[1:])]; simsum = sum(v for v, n in sp if n >= 8); simn = sum(n >= 8 for v, n in sp)
        fl, fln = sim_scale(shots[0], shots[-1])
        # primary: robust feature-based similarity (moving people are RANSAC outliers); flow only when too few static features
        est = [v if (n >= 6 and abs(v) < 500) else f for (v, n), f in zip(sp, ps)]  # per consecutive pair: RANSAC similarity (people = outliers), dense flow if too few features / degenerate fit
        scale = fl if (fln >= 10 and abs(fl) < 500) else sum(est)  # first->last RANSAC when well supported; else sum of per-pair estimates (large gaps under CPU load break first->last)
        st = ev("document.getElementById('status').textContent")
        res = 'approach' if scale > 8 else 'recede' if scale < -8 else ('stopped' if abs(s1['pos'] - s0['pos']) < 0.3 else 'unclear')
        nm = f'{OUT}/{label}_{t}_{yaw}'; cv2.imwrite(nm + '_a.jpg', cv2.resize(a, None, fx=0.4, fy=0.4)); cv2.imwrite(nm + '_b.jpg', cv2.resize(bimg, None, fx=0.4, fy=0.4))
        moved = abs(s1['pos'] - s0['pos'])
        if expect == 'pause': res = 'paused' if moved < 0.3 else res
        ok = (res == expect) or (expect == 'pause' and res == 'paused' and 'one way' in st)
        if abs(s0['pos'] - t) > 1: ok = False; res = 'jump-failed'
        row = dict(ok=ok, expect=expect, rel=round(ev('__w.relYaw ? __w.relYaw() : null') or 0, 1), label=label, t=t, yaw=yaw, result=res, scale_permille=round(scale, 1), sim_pairs=[round(v, 1) for v, n in sp], sim_first_last=[round(fl, 1), fln], flow_permille=round(flow, 1), pair_median=round(med, 2), pair_flow=[round(v, 1) for v in ps], pair_est=[round(v, 1) for v in est], pairs=len(ps), switches=ev('__w.switches().slice(-2)'), pos=[round(s0['pos'], 1), round(s1['pos'], 1)], clip=s1['clip'], dir=s1.get('dir'), status=st)
        rows.append(row); print(json.dumps(row), flush=True)
    b.close()
json.dump(rows, open(OUT + '/results.json', 'w'), indent=1)
print('GTDONE', sum(r['ok'] for r in rows), '/', len(rows))
