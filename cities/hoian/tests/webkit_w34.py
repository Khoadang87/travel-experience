"""w34: place picker, turnaround (no reversed video), stream audit. Usage: python3 webkit_w34.py URL --local DIR"""
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOCAL = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--local' else None
SUB = 'test/' if '/hoian/test/' in URL else ''
VER = os.environ.get('VER', 'w36')
EVD = os.environ.get('EVD', os.environ.get('EVD2','/workspace/qa/w36/ev'))
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
    rep(f'version {VER}, place picker shown on load', ev("document.getElementById('ver').textContent") == VER and pg.is_visible('#places'), n=ev("document.querySelectorAll('#places button').length"))
    jb = ev("(()=>{const r=document.getElementById('joy').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()"); jx, jy = jb
    def hold(dy, sec):
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy + dy, steps=3); ps = [ev('__w.state().pos')]; rel = []
        for k in range(int(sec / 0.25)): pg.wait_for_timeout(250); ps.append(ev('__w.state().pos')); rel.append(ev('__w.relYaw()'))
        pg.mouse.up(); pg.wait_for_timeout(500); ps.append(ev('__w.state().pos')); return ps, rel
    sift = cv2.SIFT_create(3000)
    def landmark(img, ref):
        """inliers of a homography between the screenshot's picture area and the landmark reference crop + median screen x of inliers (0..1)"""
        h, w = img.shape[:2]; m = np.zeros((h, w), np.uint8); m[int(h * 0.12):int(h * 0.7)] = 255; m[:int(h * 0.2), int(w * 0.62):] = 0
        k1, d1 = sift.detectAndCompute(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), m); k2, d2 = sift.detectAndCompute(cv2.cvtColor(ref, cv2.COLOR_BGR2GRAY), None)
        if d1 is None or d2 is None: return 0, None
        mt = [a for a, b in cv2.BFMatcher().knnMatch(d1, d2, k=2) if a.distance < 0.75 * b.distance]
        if len(mt) < 6: return len(mt), None
        p1 = np.float32([k1[a.queryIdx].pt for a in mt]); p2 = np.float32([k2[a.trainIdx].pt for a in mt])
        H, inl = cv2.findHomography(p2, p1, cv2.RANSAC, 8.0)
        if inl is None: return 0, None
        inl = inl.ravel().astype(bool); return int(inl.sum()), float(np.median(p1[inl, 0]) / w)
    REF = os.environ.get('PLACEREF', '/workspace/qa/w35/ref')
    for pl in ev('__w.places'):
        if pl['t'] is None: continue
        if not pg.is_visible('#places'): pg.click('#explore-toggle'); pg.click('#go-places')
        pg.click(f'#places button[data-place="{pl["id"]}"]')
        for i in range(40):
            if (ev('__w.place') or {}).get('id') == pl['id']: break
            pg.wait_for_timeout(250)
        pg.wait_for_timeout(1800); img = shot(f'place_{pl["id"]}'); s = ev('__w.state()')
        ref = cv2.imread(f'{REF}/{pl["id"]}.jpg'); n, cx = landmark(img, ref)
        rep(f'place {pl["id"]}: lands at {pl["t"]}s facing the landmark (picture match centred)', abs(s['pos'] - pl['t']) < 1.5 and n >= 15 and cx is not None and 0.25 < cx < 0.75 and not pg.is_visible('#places'), pos=s['pos'], inliers=n, cx=cx)
        if pl['id'] == 'bridge':
            ps, rel = hold(-50, 5); img2 = shot('place_bridge_walk5s'); n2, cx2 = landmark(img2, ref)
            rep('bridge place: UP walks in toward the bridge entrance', ps[-1] > ps[0] + 3 and min(b - a for a, b in zip(ps, ps[1:])) > -0.05, walk=[ps[0], ps[-1]], inl_after=n2)
    # turnaround: facing back + push -> blur, view swings to the travel direction, then forward walking; position never goes backwards
    for t in (300, 600, 900, 1300, 1500):
        ev(f'__w.jump({t})'); pg.wait_for_timeout(3000); ev('__w.setLook(0, 0)'); pg.wait_for_timeout(500); fwd = shot(f'turn_{t}_ref_fwd')
        ev('__w.setLook(180, 0)'); pg.wait_for_timeout(500); back = shot(f'turn_{t}_0_back'); n0 = ev('__w.turns || 0')
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3); pg.wait_for_timeout(250); mid = shot(f'turn_{t}_1_mid')
        for k in range(20):
            if (ev('__w.turns || 0') > n0) and not ev('__w.turnBusy()'): break
            pg.wait_for_timeout(100)
        aft = shot(f'turn_{t}_2_after')  # w35: picture right after the turn (the walker itself may turn a corner later, e.g. ~1300 s)
        ps = [ev('__w.state().pos')]
        rels = []
        for k in range(14): pg.wait_for_timeout(250); ps.append(ev('__w.state().pos')); rels.append(None if ev('__w.turnBusy()') else round(ev('__w.relYaw()'), 1))
        pg.mouse.up(); pg.wait_for_timeout(400); shot(f'turn_{t}_3_walked'); rel = next((r for r in rels if r is not None), 999)
        def sim(a, b):
            g = [cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)[int(x.shape[0] * .15):int(x.shape[0] * .65)] for x in (a, b)]
            k1, d1 = sift.detectAndCompute(g[0], None); k2, d2 = sift.detectAndCompute(g[1], None)
            return len([p for p, q in cv2.BFMatcher().knnMatch(d1, d2, k=2) if p.distance < 0.7 * q.distance])
        sf, sb = sim(aft, fwd), sim(aft, back); blur = cv2.Laplacian(cv2.cvtColor(mid, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var(); sharp = cv2.Laplacian(cv2.cvtColor(aft, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
        rep(f'turnaround at {t}s: one turn, ends facing travel, picture matches forward view (not back), walks on forward, never backwards', ev('__w.turns') - n0 == 1 and abs(rel) < 10 and max(abs(r) for r in rels if r is not None) < 10 and sf > 2 * sb and ps[-1] - ps[0] > 1.5 and min(b - a for a, b in zip(ps, ps[1:])) > -0.05,
            rel_just_after_turn=rel, rel_track=rels, match_fwd=sf, match_back=sb, walk=[ps[0], ps[-1]], blur_mid=round(blur), sharp_after=round(sharp))
    # w36: replay the phone gesture - pull the stick DOWN (and back diagonals) from various looks / times / places
    def sim2(a, b):
        g = [cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)[int(x.shape[0] * .15):int(x.shape[0] * .65)] for x in (a, b)]
        k1, d1 = sift.detectAndCompute(g[0], None); k2, d2 = sift.detectAndCompute(g[1], None)
        if d1 is None or d2 is None: return 0
        return len([p for p, q in cv2.BFMatcher().knnMatch(d1, d2, k=2) if p.distance < 0.7 * q.distance])
    cases = [('t', 600, 0, 0, 50), ('t', 600, 180, 0, 50), ('t', 900, 60, 0, 50), ('t', 300, 0, 35, 40), ('t', 1500, 0, -35, 40), ('place', 'market', None, 0, 50), ('place', 'hall', None, 30, 45), ('place', 'bridge', None, 0, 50)]
    for kind, where, look0, dx, dy in cases:
        if kind == 't': ev(f'__w.jump({where})'); pg.wait_for_timeout(3000); ev(f'__w.setLook({look0}, 0)')
        else: ev(f'__w.goPlace("{where}")'); pg.wait_for_timeout(3500)
        pg.wait_for_timeout(400); tag = f'pull_{where}_{look0}_{dx}_{dy}'; before = shot(tag + '_0_before'); ly0 = ev('__w.state().lookYaw'); hd0 = ev('__w.state().hd')
        ev('__w.setLook(0, 0)'); pg.wait_for_timeout(400); fwd = shot(tag + '_ref_fwd'); ev(f'__w.state && 0'); ev(f'(()=>{{}})()')
        pg.evaluate(f'__w.setLook({np.degrees(ly0)}, 0)'); pg.wait_for_timeout(300)
        n0 = ev('__w.turns || 0'); p0 = ev('__w.state().pos')
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx + dx, jy + dy, steps=3)
        for k in range(20):
            if ev('__w.turns || 0') > n0 and not ev('__w.turnBusy()'): break
            pg.wait_for_timeout(100)
        aft = shot(tag + '_1_after'); rel0 = ev('__w.relYaw()'); ps = [ev('__w.state().pos')]
        for k in range(12): pg.wait_for_timeout(250); ps.append(ev('__w.state().pos'))
        pg.mouse.up(); pg.wait_for_timeout(300); shot(tag + '_2_walked')
        sf, sb = sim2(aft, fwd), sim2(aft, before)
        ok = ev('__w.turns') - n0 == 1 and abs(rel0) < 10 and ps[-1] - ps[0] > 1.2 and min(b - a for a, b in zip(ps, ps[1:])) > -0.05 and min(ps) >= p0 - 0.05 and (sf > 2 * sb or look0 == 0 or (kind == 'place' and sf >= 20))
        rep(f'pull stick back ({dx},{dy}) at {kind} {where} look {look0}: one turnaround, faces travel, walks forward, never backward', ok, rel=rel0, match_fwd=sf, match_before=sb, walk=[ps[0], ps[-1]], p0=p0)
    # sideways push: turns the view, no walking, no turnaround
    ev('__w.jump(700)'); pg.wait_for_timeout(3000); ev('__w.setLook(0, 0)'); pg.wait_for_timeout(300)
    for dx in (55, -55):
        y0 = ev('__w.state().lookYaw'); p0 = ev('__w.state().pos'); n0 = ev('__w.turns || 0')
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx + dx, jy, steps=3); pg.wait_for_timeout(1500); shot(f'side_{dx}'); pg.mouse.up(); pg.wait_for_timeout(300)
        dyaw = np.degrees(ev('__w.state().lookYaw') - y0); p1 = ev('__w.state().pos')
        rep(f'sideways push {dx}: turns the view that way, no walk, no turnaround', 30 < abs(dyaw) < 140 and np.sign(dyaw) == np.sign(dx) and abs(p1 - p0) < 0.3 and ev('__w.turns || 0') == n0, dyaw=round(dyaw, 1), pos=[p0, p1])
    ev('__w.setLook(0, 0)')
    # 360 sweep: whatever the facing, a push never moves the position backwards
    bad = []
    ev('__w.jump(700)'); pg.wait_for_timeout(3000)
    for a in range(0, 360, 30):
        ev(f'__w.setLook({a}, 0)'); pg.wait_for_timeout(300); ps, rel = hold(-50, 2.5)
        if min(b - x for x, b in zip(ps, ps[1:])) < -0.05 or ps[-1] - ps[0] < 0.5: bad.append(dict(a=a, ps=[ps[0], ps[-1]]))
    rep('360 sweep: every push walks forward (turnaround when facing back), never backward', not bad, bad=bad)
    rep('no r2560 / _rev request ever made', not BADREQ, bad=BADREQ[:5])
    rep('reversed stream never attached (rd=0, dir always F)', ev('__w.state().rd') in (0, None) and ev('__w.state().dir') == 'F', st=ev('__w.state()'))
    el = ev('__evlog'); rep('no wrong-way step logged', not any('BACKSTEP' in x or 'REVSTEP' in x for x in el), evlog=el[-8:])
    errs = [c for c in CONS if 'Failed to load resource' not in c and 'AbortError' not in c]
    rep('console clean', not errs, errors=errs)
    b.close()
print('RESULT', 'PASS' if not fails else 'FAIL', json.dumps(fails), flush=True); sys.exit(1 if fails else 0)
