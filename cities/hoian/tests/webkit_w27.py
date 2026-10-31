"""w27 clean-rewrite test (cities/hoian/test/): WebKit iPhone 13 emulation on the box.
Usage: python3 webkit_w27.py URL [--local REPO_HOIAN_DIR] -> exit 0 PASS / 1 FAIL.
The box can't decode 3840 H.264 fast enough, so the 1280 rung of the same hls13 ladder is played (same timeline)."""
import sys, os, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOCAL = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--local' else None
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
            for f, ct in (('test/walk-w27.js', 'text/javascript'), ('test/ver.txt', 'text/plain'), ('routes.json', 'application/json'), ('assets/walk/walk.json', 'application/json'), ('assets/walk/heading_w18.json', 'application/json'), ('vendor/hls.min.js', 'text/javascript'), ('vendor/three.module.js', 'text/javascript'), ('vendor/three.core.js', 'text/javascript')):
                pg.route(f'**/cities/hoian/{f}*', lf(f, ct))
            pg.route('**/cities/hoian/test/', lf('test/index.html', 'text/html')); pg.route('**/cities/hoian/test/?*', lf('test/index.html', 'text/html'))
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
    rep('version label w27 visible', ev("document.getElementById('ver').textContent") == 'w27' and pg.is_visible('#ver'))
    rep('one video element, no reverse stream', ev('__w.vids()') <= 1 and ev("performance.getEntriesByType('resource').every(e=>!/r2560|\\/r1280/.test(e.name))"))
    # initial view faces down the street: camera yaw = heading at the start position (fresh reload)
    pg.reload(wait_until='load')
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
    bad, adv = [], []
    for a in range(0, 360, 15):
        ev(f'__w.setLook({a})'); pg.wait_for_timeout(200); ps, r = hold(-50, 2.5)
        back = min(b2 - a2 for a2, b2 in zip(ps, ps[1:])); adv.append(round(ps[-1] - ps[0], 2))
        if back < -0.05 or ps[-1] - ps[0] < 0.5: bad.append(dict(angle=a, back=round(back, 3), adv=round(ps[-1] - ps[0], 2)))
    rep('360 deg in 15 deg steps: stick UP only moves forward', not bad, bad=bad, adv=adv)
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
    el = ev('__evlog'); rep('no backward step logged', not any('BACKSTEP' in x for x in el), evlog=el[-12:])
    errs = [c for c in CONS if 'Failed to load resource' not in c and 'AbortError' not in c]
    rep('console clean', not errs, errors=errs)
    b.close()
print('RESULT', 'PASS' if not fails else 'FAIL', json.dumps(fails), flush=True); sys.exit(1 if fails else 0)
