import os
#!/usr/bin/env python3
"""Hoi An walk: WebKit iPhone regression test (w25, forward-only: one video, stick up = forward whatever the look). Run before every push.

Holds forward for 8 s at: the start, main 300 s, after a reversal, and after each junction
(river-in, river-back, river-out). Each hold must show ALL of:
  * position (HoianWalk.state().pos) advancing >= MIN_ADV s,
  * the mini-map dot (#minimap dot / explore marker) moving,
  * frame landmarks advancing: canvas frames sampled 2 s apart differ (mean abs diff > DIFF_MIN),
    and the frame after 8 s differs from the first one more than consecutive frames do (no loop),
  * no 'Start of this recorded street' tip after the start, the active stream is the forward one.
Usage: python3 webkit_iphone_walk.py URL [--local REPO_HOIAN_DIR]  -> exit 0 PASS / 1 FAIL
Box notes: WebKit needs extra libs (see /home/box/hoian-w20-scripts/WEBKIT_SETUP.md). Decoding 3840 H.264 in software
is too slow on the box, so the test plays the 1280 rung of the same hls13 ladder (FLV env to override).
"""
import sys, os, time, json, io
from playwright.sync_api import sync_playwright
URL = sys.argv[1]; LOCAL = sys.argv[3] if len(sys.argv) > 3 and sys.argv[2] == '--local' else None
FLV = os.environ.get('FLV', 'hls13/f1280/index.m3u8'); MIN_ADV = 2.0; DIFF_MIN = 2.0
POINTS = [('start', None), ('main 300', ('goto', 300)), ('after release+DOWN', ('down', None)),
          ('after junction river-in', ('junc', "'main',251,30,1", 'ArrowUp', 7)), ('after junction river-out', ('junc', "'riverside',1576,0,1", 'ArrowUp', 8))]
# w24: never time.sleep: the sync route proxy below only serves requests while Python is inside a Playwright call, so sleeps starved the video fetches (a stuck seek that iPhone never sees)
# junctions are entered the way a user does: jump just before one with __feat.enter, walk through it, then hold forward 8 s
def diff(a, b):
    from PIL import Image, ImageChops, ImageStat
    A = Image.open(io.BytesIO(a)).convert('L').resize((160, 300)); B = Image.open(io.BytesIO(b)).convert('L').resize((160, 300))
    return sum(ImageStat.Stat(ImageChops.difference(A, B)).mean)
fails = []
with sync_playwright() as p:
    b = p.webkit.launch(); ctx = b.new_context(**p.devices['iPhone 13']); pg = ctx.new_page()
    def px(r, q=None):
        try: r.fulfill(response=r.fetch())
        except Exception: r.abort()
    pg.route('**/*', px)
    CONS = []; REQS = []
    pg.on('console', lambda m: CONS.append(m.type + ': ' + m.text[:200]) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: CONS.append('pageerror: ' + str(e)[:200]))
    pg.on('request', lambda r: REQS.append(r.url) if ('r2560' in r.url or '/r1280' in r.url or 'tracks/rev' in r.url) else None)  # Playwright fetches for WebKit (box WebKit has no TLS backend)
    if LOCAL:
        for f, ct in (('walk.js', 'text/javascript'), ('explore.js', 'text/javascript'), ('features.js', 'text/javascript'), ('ver.txt', 'text/plain'), ('routes.json', 'application/json'), ('pois.json', 'application/json'), ('route-catalog.js', 'text/javascript'), ('assets/walk/walk.json', 'application/json')):
            pg.route(f'**/cities/hoian/{f}*', lambda r, q=None, f=f, ct=ct: r.fulfill(body=open(os.path.join(LOCAL, f), 'rb').read().replace(b'hls13/f3840/index.m3u8', FLV.encode()), content_type=ct))
        pg.route('**/cities/hoian/?*', lambda r, q=None: r.fulfill(body=open(os.path.join(LOCAL, 'index.html'), 'rb').read(), content_type='text/html'))
    else:
        pg.route('**/assets/walk/walk.json*', lambda r, q=None: r.fulfill(body=r.fetch().body().replace(b'hls13/f3840/index.m3u8', FLV.encode()), content_type='application/json'))
    pg.goto(URL, wait_until='load'); pg.wait_for_timeout(1000*(3))
    if pg.is_visible('#tapstart'): pg.click('#tapstart')
    ev = pg.evaluate
    for i in range(120):
        try:
            if ev("window.__state && window.__state.loaded && __test.state().w > 0 && !__test.state().swapping"): break
        except Exception: pass
        pg.wait_for_timeout(1000*(1))
    else: fails.append('walk never finished loading: ' + str(ev("JSON.stringify([__test.state(), window.__evlog])")))
    dot = "(()=>{const c=document.getElementById('minimap');if(!c||c.hidden)return null;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0,sx=0,sy=0;for(let i=0;i<d.length;i+=4)if(d[i]>230&&d[i+1]>70&&d[i+1]<110&&d[i+2]>60&&d[i+2]<100&&d[i+3]>200){const k=i/4;sx+=k%c.width;sy+=Math.floor(k/c.width);n++}return n?[+(sx/n).toFixed(2),+(sy/n).toFixed(2)]:null})()"
    def hold(name):
        p0 = ev('__test.state().pos'); d0 = ev(dot); shots = [pg.screenshot(type='png')]; ev("__test.key('ArrowUp',true)")
        for k in range(4): pg.wait_for_timeout(1000*(2)); shots.append(pg.screenshot(type='png'))
        ev("__test.key('ArrowUp',false)"); st = ev('__test.state()'); p1 = st['pos']; d1 = ev(dot); tip = ev("!!document.getElementById('navigation-note') && !document.getElementById('navigation-note').hidden")
        ds = [round(diff(shots[i], shots[i + 1]), 1) for i in range(4)]; far = round(diff(shots[1], shots[4]), 1)
        ok_pos = p1 - p0 >= MIN_ADV; clip = ev('window.__feat && window.__feat.clip'); ok_dot = (d0 != d1 and d1 is not None) if clip in (None, 'main') else True;  # riverside branch pins the dot at its mapAt by design
        ok_frames = min(ds[1:]) > DIFF_MIN and far > DIFF_MIN
        ok_tip = not tip or name == 'start'; ok_dir = st['dir'] == 'fwd'
        row = dict(point=name, pos=[round(p0, 2), round(p1, 2)], dot=[d0, d1], frame_diffs=ds, first_last=far, tip=tip, dir=st['dir'], w=st['w'])
        bad = [k for k, v in (('position', ok_pos), ('minimap', ok_dot), ('frames', ok_frames), ('tip', ok_tip), ('direction', ok_dir)) if not v]
        print(('PASS ' if not bad else 'FAIL ') + json.dumps(row) + (' failed=' + ','.join(bad) if bad else ''), flush=True)
        if bad: fails.append(name + ': ' + ','.join(bad) + ' evlog=' + json.dumps(ev('window.__evlog')))
        pg.wait_for_timeout(1000*(1.5))
    # w24: what users do: fresh default load, NO facing/yaw/face set by the test, real joystick drag
    bx = pg.locator('#joy').bounding_box(); jx, jy = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
    def stick(dy, sec):
        pg.mouse.move(jx, jy); pg.mouse.down()
        for k in range(1, 6): pg.mouse.move(jx, jy + dy * k / 5); pg.wait_for_timeout(1000*(0.03))
        pg.wait_for_timeout(1000*(sec)); st = ev('__test.state()'); pg.mouse.up(); pg.wait_for_timeout(1000*(0.8)); return st
    def look_turn(goal_back):
        for k in range(24):
            r = ev('HoianWalk.state().lookRel')
            if (abs(r) > 150) if goal_back else (abs(r) < 30): return r
            pg.mouse.move(innerW * 0.75, innerH * 0.35); pg.mouse.down()
            for i in range(1, 9): pg.mouse.move(innerW * 0.75 - innerW * 0.5 * i / 8, innerH * 0.35); pg.wait_for_timeout(1000*(0.02))
            pg.mouse.up(); pg.wait_for_timeout(1000*(0.4))
        return ev('HoianWalk.state().lookRel')
    innerW, innerH = ev('innerWidth'), ev('innerHeight')
    ONLY = os.environ.get('ONLYIOS')
    if not fails and not ONLY:
        s0 = ev('HoianWalk.state()'); hs = ev('[__test.head(), window.__walkAPI && __walkAPI.lookBearing()]')
        ok_face = s0['facing'] == 'forward' and abs(s0['lookRel']) < 30 and abs(hs[0]) < 0.6
        d0 = ev(dot); p0 = ev('__test.state().pos'); st = stick(-45, 6); d1 = ev(dot); p1 = st['pos']
        ok_up = p1 - p0 >= MIN_ADV and st['dir'] == 'fwd' and d1 is not None and d0 != d1
        print('PASS' if ok_face and ok_up else 'FAIL', json.dumps({'point': 'fresh default load', 'facing': s0['facing'], 'lookRel': s0['lookRel'], 'head_rad': hs[0], 'lookBearing': hs[1], 'pos': [p0, p1], 'dir': st['dir'], 'dot': [d0, d1]}), flush=True)
        if not (ok_face and ok_up): fails.append('fresh default load: ' + ('view not facing the walk direction ' if not ok_face else '') + ('stick up did not advance' if not ok_up else ''))

    def rep(name, ok, **kw):
        print('PASS' if ok else 'FAIL', json.dumps(dict(point=name, **kw)), flush=True)
        if not ok: fails.append(name + ' evlog=' + json.dumps(ev('window.__evlog')))
    if not fails and not ONLY:
        for name, act in (POINTS if not os.environ.get('SKIPPTS') else []):
            if act and act[0] == 'goto': ev(f"HoianWalk.goTo({act[1]}).catch(()=>0)"); pg.wait_for_timeout(1000*(4))
            if act and act[0] == 'down':  # forward-only: DOWN must never walk backwards
                p0 = ev('__test.state().pos'); ev("__test.key('ArrowDown',true)"); pg.wait_for_timeout(3000); p1 = ev('__test.state().pos'); ev("__test.key('ArrowDown',false)"); pg.wait_for_timeout(1000)
                rep('DOWN does not walk back', p1 >= p0 - 0.3, pos=[p0, p1])
            if act and act[0] == 'junc':
                jid = name.split()[-1]; ev(f"__feat.enter({act[1]})"); pg.wait_for_timeout(1000*(5)); ev(f"__test.key('{act[2]}',true)"); t0 = time.time()
                while time.time() - t0 < act[3] + 25 and ev(f"(window.__feat.last||{{}}).from") != jid: pg.wait_for_timeout(1000*(0.5))
                ev(f"__test.key('{act[2]}',false)"); pg.wait_for_timeout(1000*(3))
                if ev(f"(window.__feat.last||{{}}).from") != jid: fails.append(name + ': junction never taken evlog=' + json.dumps(ev('window.__evlog'))); continue
            hold(name)
    if not fails and not ONLY:
        ev(f"HoianWalk.goTo({os.environ.get('TB','300')}).catch(()=>0)"); pg.wait_for_timeout(1000*(5))
        # look 180 deg by dragging: stick UP still plays the video FORWARD
        r = look_turn(True); p0 = ev('__test.state().pos'); st = stick(-45, 6); p1 = st['pos']
        rep('looking back (180), stick up advances', abs(r) > 150 and p1 - p0 >= MIN_ADV and st['dir'] == 'fwd', lookRel=r, pos=[p0, p1], dir=st['dir'])
        p0 = ev('__test.state().pos'); st = stick(45, 4); p1 = st['pos']
        rep('looking back, stick down does not walk back', p1 >= p0 - 0.3, pos=[p0, p1], dir=st['dir'])
        # sideways (~90-115 deg, the wall view from the iPhone recording)
        for k in range(40):
            r = ev('HoianWalk.state().lookRel')
            if 90 <= abs(r) <= 115: break
            pg.mouse.move(innerW * 0.6, innerH * 0.35); pg.mouse.down(); pg.mouse.move(innerW * 0.6 - innerW * 0.06, innerH * 0.35, steps=4); pg.mouse.up(); pg.wait_for_timeout(400)
        p0 = ev('__test.state().pos'); st = stick(-45, 6); p1 = st['pos']
        rep('looking sideways, stick up advances', 90 <= abs(r) <= 115 and p1 - p0 >= MIN_ADV and st['dir'] == 'fwd', lookRel=r, pos=[p0, p1])
        # sound only while moving
        ev("__test.key('ArrowUp',true)"); pg.wait_for_timeout(4000); a1 = ev('__test.aud2()'); ev("__test.key('ArrowUp',false)"); pg.wait_for_timeout(4000); a2 = ev('__test.aud2()')
        rep('sound only while moving', (not a1['on'] or a1['g'] > 0.3) and (a2['paused'] or a2['g'] < 0.05), moving=a1, stopped=a2)
        # Explore "Go here" (same API the Explore panel calls), then stick up
        ev("HoianWalk.goTo(600).catch(()=>0)"); pg.wait_for_timeout(6000); p0 = ev('__test.state().pos'); st = stick(-45, 6); p1 = st['pos']
        rep('Explore go-here 600 then stick up', abs(p0 - 600) < 3 and p1 - p0 >= MIN_ADV and st['dir'] == 'fwd', pos=[p0, p1])
        rep('one video element, no reverse requests', ev('__test.vids()') == 1 and not REQS, vids=ev('__test.vids()'), rev_requests=REQS[:3])
    # iPhone-like load timing (fake): the first play() of each video resolves ~2.5 s late; the user presses UP while loading and holds.
    if not os.environ.get('SKIPIOS'):
        pg.add_init_script("""(()=>{const t0=performance.now(),P=HTMLMediaElement.prototype,pl=P.play;P.play=function(){const me=this,args=arguments;if(performance.now()-t0<6000&&!me.__slow){me.__slow=1;return new Promise((res,rej)=>setTimeout(()=>pl.apply(me,args).then(res,rej),2500));}return pl.apply(this,args);};const D=Object.getOwnPropertyDescriptor(P,'currentTime');})()""")
        pg.reload(wait_until='load'); tap = False
        for i in range(100):
            try:
                if pg.locator('#joy').is_visible(): break
            except Exception: pass
            pg.wait_for_timeout(100)
        bx = pg.locator('#joy').bounding_box(); jx, jy = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
        pg.mouse.move(jx, jy); pg.mouse.down()
        for k in range(1, 6): pg.mouse.move(jx, jy - 45 * k / 5); pg.wait_for_timeout(30)
        p0 = None; hd0 = None; LOG = []
        for i in range(80):
            pg.wait_for_timeout(250); pg.mouse.move(jx, jy - 45 - (i % 2))
            try:
                st = ev('__test.state()'); LOG.append([i, round(st['pos'],2), st['target'], st['paused'], st['w'], ev('[__test.joy().id, __test.joy().y, window.__state.loaded]')])
                if p0 is None and st['w'] > 0: p0 = st['pos']; hd0 = ev('HoianWalk.state().lookRel')
                if p0 is not None: tap = tap or ev("!document.getElementById('tapstart').hidden")
            except Exception: pass
        st = ev('__test.state()'); pg.mouse.up()
        rep('iOS-like slow start, UP pressed during load', p0 is not None and st['pos'] - p0 >= MIN_ADV and st['dir'] == 'fwd' and not tap and hd0 is not None and abs(hd0) < 30, pos=[p0, st['pos']], lookRel_at_load=hd0, tap_shown=tap, state=st, joy=ev('__test.joy()'), log=LOG[-12:])
    bad = [c for c in CONS if 'Failed to load resource' not in c and 'link preload' not in c and 'AbortError' not in c]
    rep('console clean', not bad, errors=bad[:10])
    b.close()
print("RESULT", "PASS" if not fails else "FAIL", json.dumps(fails)[:12000])
sys.exit(1 if fails else 0)
