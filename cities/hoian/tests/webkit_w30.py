"""w30 (w29 suite + FOE travel track + riverside one-way pause) walk-where-you-face test (forward + reversed stream) (cities/hoian/test/): WebKit iPhone 13 emulation on the box.
Usage: python3 webkit_w27.py URL [--local REPO_HOIAN_DIR] -> exit 0 PASS / 1 FAIL.
The box can't decode 3840 H.264 fast enough, so the 1280 rung of the same hls13 ladder is played (same timeline)."""
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOCAL = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--local' else None
SUB = 'test/' if '/hoian/test/' in URL else ''
VER = os.environ.get('VER', 'w30')
EVD = os.environ.get('EVD', '/workspace/qa/w30/ev')
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
    pg = page(); ev = pg.evaluate
    pg.goto(URL, wait_until='load')
    jb = None
    for i in range(10):
        jb = pg.evaluate("(()=>{const r=document.getElementById('joy').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
        if jb: break
        pg.wait_for_timeout(300)
    jx, jy = jb
    # slow start: finger on the stick (UP) while still loading; must walk once ready
    pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=4)
    for i in range(120):
        if ev("window.__w && __w.state().ready") or ev("!document.getElementById('error').hidden"): break
        pg.wait_for_timeout(500)
    st0 = ev('__w.state()'); pg.wait_for_timeout(5000); st1 = ev('__w.state()'); pg.mouse.up(); pg.wait_for_timeout(700); st2 = ev('__w.state()')
    rep('load + stick held during load walks once ready', st0['ready'] and st1['pos'] - st0['pos'] > 2, s0=st0, s1=st1, err=ev("document.getElementById('error').textContent"))
    rep('release pauses', not st2['playing'], s2=st2)
    rep(f'version label {VER} visible', ev("document.getElementById('ver').textContent") == VER and pg.is_visible('#ver'))
    rep('two video elements (forward + reversed), reversed stream attached', ev('__w.vids()') == 2 and ev('__w.state().rd') > 1000, vids=ev('__w.vids()'), rd=ev('__w.state().rd'))
    # initial view faces down the street: camera yaw = heading at the start position (fresh reload)
    pre = list(CONS); pg.reload(wait_until='load'); pg.wait_for_timeout(300)
    unload = CONS[len(pre):]; del CONS[len(pre):]  # WebKit reports segment fetches cancelled by the page reload as 'access control checks' errors; not a player error
    print('UNLOAD-CANCELLED', json.dumps(unload), flush=True)
    for i in range(120):
        if ev("window.__w && __w.state().ready"): break
        pg.wait_for_timeout(500)
    pg.wait_for_timeout(1500); s = ev('__w.state()'); h = ev(f"__w.headAt({s['pos']})")
    rep('initial view faces down the street', abs(s['hd'] - h) < 0.1 and abs(s['lookYaw']) < 1e-6 and s['pos'] < 6, hd=s['hd'], headAt=h, pos=s['pos'])
    def hold(dy, sec, samples=None):
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy + dy, steps=3); ps = [ev('__w.state().pos')]
        n = int(sec / 0.25)
        for k in range(n): pg.wait_for_timeout(250); ps.append(ev('__w.state().pos'))
        r = ev('__w.state().rate'); pg.mouse.up(); pg.wait_for_timeout(500); ps.append(ev('__w.state().pos')); return ps, r
    ev('__w.jump(300)'); pg.wait_for_timeout(3000)
    ps, r = hold(-50, 4); rep('stick UP walks forward', ps[-1] - ps[0] > 2, pos=[ps[0], ps[-1]])
    ps, r = hold(50, 3); rep('stick DOWN never walks back (pauses)', ps[-1] - ps[0] < 0.3 and min(b - a for a, b in zip(ps, ps[1:])) > -0.05, pos=[ps[0], ps[-1]], playing=ev('__w.state().playing'))
    import io
    from PIL import Image
    def shot(name): pg.screenshot(path=f'{EVD}/{name}.jpg', type='jpeg', quality=70)
    bad, adv, gaps = [], [], []
    ev('__w.jump(600)'); pg.wait_for_timeout(3000)
    for a in range(0, 360, 15):
        ev(f'__w.setLook({a})'); pg.wait_for_timeout(300); n0 = len(ev('__w.switches()')); ps, r = hold(-50, 2.5); sw = ev('__w.switches()')[n0:]
        d = ps[-1] - ps[0]; rel = min(a, 360 - a); adv.append(round(d, 2)); gaps += [x['gap'] for x in sw]
        exp = 1 if rel < 80 else -1 if rel > 100 else 0
        mono = all((b2 - a2) * (1 if d > 0 else -1) > -0.05 for a2, b2 in zip(ps, ps[1:]))
        if abs(d) < 0.5 or (exp and (d > 0) != (exp > 0)) or len(sw) > 1 or not mono: bad.append(dict(angle=a, adv=round(d, 2), switches=len(sw), mono=mono))
        if a in (0, 90, 180): ev('__w.setLook(%d)' % a)
    rep('360 deg sweep: UP walks toward the view (fwd <80, rev >100, band keeps), <=1 switch per push, monotone', not bad, bad=bad, adv=adv, gaps=gaps)
    # visual evidence: walking while facing behind - scenery should approach
    for a, nm in ((0, 'fwd'), (180, 'rev')):
        ev('__w.jump(700)'); pg.wait_for_timeout(3000); ev(f'__w.setLook({a}, 0)'); pg.wait_for_timeout(400)
        pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3); pg.wait_for_timeout(1500); shot(f'walk_{nm}_t0'); p0 = ev('__w.state().pos')
        pg.wait_for_timeout(4000); shot(f'walk_{nm}_t4'); p1 = ev('__w.state().pos'); pg.mouse.up(); pg.wait_for_timeout(500)
        rep(f'walk facing {nm}: position moves {"+" if a == 0 else "-"}', (p1 - p0) * (1 if a == 0 else -1) > 1.5, p=[p0, p1])
    # no flapping when the look wobbles around the 90 deg band while holding
    ev('__w.jump(800)'); pg.wait_for_timeout(3000); ev('__w.setLook(0)'); n0 = len(ev('__w.switches()'))
    pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3)
    for k in range(30): ev(f'__w.setLook({[75, 95, 105, 85, 78, 102][k % 6]})'); pg.wait_for_timeout(150)
    pg.mouse.up(); sw = ev('__w.switches()')[n0:]
    rep('look wobbling 75-105 deg while holding: no flapping (<=1 switch)', len(sw) <= 1, switches=sw)
    # reversed walk reaching the start of the main walk stops
    ev('__w.jump(9)'); pg.wait_for_timeout(3000); ev('__w.setLook(180)'); pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3); pg.wait_for_timeout(8000); s_ = ev('__w.state()'); stt = ev("document.getElementById('status').textContent"); pg.mouse.up(); pg.wait_for_timeout(400)
    rep('walking back to the start stops at the start', 4.3 <= s_['pos'] < 5.5 and 'Start of the walk' in (stt or ''), pos=s_['pos'], status=stt)
    # w30: riverside is forward-only: facing back must pause with the one-way hint, never walk away from the view
    ev('__w.jump(1500)'); pg.wait_for_timeout(3000); ev('__w.setLook(180)'); p0 = ev('__w.state().pos'); ps, r = hold(-50, 2)
    stt = ev("document.getElementById('status').textContent"); p1 = ev('__w.state().pos')
    rep('riverside facing back: pauses with one-way hint', abs(p1 - p0) < 0.3 and 'one way' in stt, p0=p0, p1=p1, status=stt)
    ev('__w.setLook(0)'); ps, r = hold(-50, 1.5); p2 = ev('__w.state().pos'); rep('riverside facing ahead: walks on', p2 > p1 + 0.5, p1=p1, p2=p2)
    ev('__w.setLook(0)')
    # look down at many points, both directions
    for t, a in ((300, 0), (700, 0), (1110, 0), (1110, 180), (1300, 180), (1500, 0)):
        ev(f'__w.jump({t})'); pg.wait_for_timeout(3000)
        if a: ev(f'__w.setLook({a})'); ps, r = hold(-50, 1.5)
        ev(f'__w.setLook({a}, -89)'); pg.wait_for_timeout(900); shot(f'down_{t}_{a}')
        from PIL import ImageStat
        im = Image.open(f'{EVD}/down_{t}_{a}.jpg').convert('L'); w, h = im.size; c = ImageStat.Stat(im.crop((w // 2 - 60, h // 2 - 60, w // 2 + 60, h // 2 + 60))).stddev[0]
        rep(f'nadir disc at {t}s facing {a} (dir {ev("__w.state().dir")})', c < 22, centre_std=round(c, 1))
        ev('__w.setLook(0, 0)')
    ev('__w.setLook(0)')
    ps, rl = hold(-24, 3); ps2, rf = hold(-60, 3); rep('analog speed: light push ~0.5-0.8x, full push 1x', 0.45 <= rl <= 0.85 and rf > 0.95, light=rl, full=rf)
    t = ev('__w.mmTap(600)'); pg.mouse.click(t['x'], t['y']); pg.wait_for_timeout(4000); lj = ev('__w.lastJump'); ps, r = hold(-50, 3)
    rep('mini-map tap jumps there, then UP walks', lj is not None and (abs(lj - 600) < 40 or ev(f'(()=>{{const a=__w.mapXY({lj}),b=__w.mapXY(600);return Math.hypot(a[1]-b[1],a[2]-b[2])}})()') < 6) and ps[-1] - ps[0] > 1.5, jump=lj, pos=[ps[0], ps[-1]])
    pg.click('#explore-toggle'); ev("document.getElementById('pos').value=900"); pg.click('#go'); pg.wait_for_timeout(4000); s = ev('__w.state()')
    rep('Explore go-here', abs(s['pos'] - 900) < 2, pos=s['pos'])
    for jid, start, exp in (('river-in', 250, 'riverside'), ('river-out', 1572, 'main')):
        ev(f'__w.jump({start})'); pg.wait_for_timeout(3000); pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3)
        for k in range(60):
            if ev('__w.lastJunction') == jid: break
            pg.wait_for_timeout(500)
        pg.wait_for_timeout(4000); pg.mouse.up(); pg.wait_for_timeout(500); s = ev('__w.state()')
        rep(f'junction {jid} forward', ev('__w.lastJunction') == jid and s['clip'] == exp, state=s)
    ev("__w.key('ArrowUp',false)")
    pg.click('#sound'); ps, r = hold(-50, 3); pg.mouse.move(jx, jy); pg.mouse.down(); pg.mouse.move(jx, jy - 50, steps=3); pg.wait_for_timeout(2000); a1 = ev('__w.audio()'); pg.mouse.up(); pg.wait_for_timeout(1500); a2 = ev('__w.audio()')
    rep('sound: full while walking, quieter when stopped', not a1['paused'] and a1['vol'] > 0.6 and a2['vol'] < 0.4, moving=a1, stopped=a2)
    el = ev('__evlog'); rep('no wrong-way step logged', not any('BACKSTEP' in x or 'REVSTEP' in x for x in el), evlog=el[-12:])
    allg = [x['gap'] for x in ev('__w.switches()')]; print('SWITCHES', json.dumps(ev('__w.switches()')), flush=True)
    rep('direction switch gap (frozen frame) median < 1500 ms', bool(allg) and sorted(allg)[len(allg) // 2] < 1500, gaps=allg)
    errs = [c for c in CONS if 'Failed to load resource' not in c and 'AbortError' not in c]
    rep('console clean', not errs, errors=errs)
    b.close()
print('RESULT', 'PASS' if not fails else 'FAIL', json.dumps(fails), flush=True); sys.exit(1 if fails else 0)
