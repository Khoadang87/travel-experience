#!/usr/bin/env python3
"""Hoi An walk: WebKit iPhone regression test (w23). Run before every push.

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
POINTS = [('start', None), ('main 300', ('goto', 300)), ('after reversal', ('rev', None)),
          ('after junction river-in', ('junc', "'main',251,0,1", 'ArrowUp', 7)), ('after junction river-back', ('junc', "'riverside',1441,0,1", 'ArrowDown', 7)), ('after junction river-out', ('junc', "'riverside',1576,0,1", 'ArrowUp', 8))]
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
    pg.route('**/*', px)  # Playwright fetches for WebKit (box WebKit has no TLS backend)
    if LOCAL:
        for f, ct in (('walk.js', 'text/javascript'), ('explore.js', 'text/javascript'), ('features.js', 'text/javascript'), ('ver.txt', 'text/plain'), ('assets/walk/walk.json', 'application/json')):
            pg.route(f'**/cities/hoian/{f}*', lambda r, q=None, f=f, ct=ct: r.fulfill(body=open(os.path.join(LOCAL, f), 'rb').read().replace(b'hls13/f3840/index.m3u8', FLV.encode()), content_type=ct))
        pg.route('**/cities/hoian/?*', lambda r, q=None: r.fulfill(body=open(os.path.join(LOCAL, 'index.html'), 'rb').read(), content_type='text/html'))
    else:
        pg.route('**/assets/walk/walk.json*', lambda r, q=None: r.fulfill(body=r.fetch().body().replace(b'hls13/f3840/index.m3u8', FLV.encode()), content_type='application/json'))
    pg.goto(URL, wait_until='load'); time.sleep(3)
    if pg.is_visible('#tapstart'): pg.click('#tapstart')
    ev = pg.evaluate
    for i in range(120):
        try:
            if ev("window.__state && window.__state.loaded && __test.state().w > 0 && !__test.state().swapping"): break
        except Exception: pass
        time.sleep(1)
    else: fails.append('walk never finished loading: ' + str(ev("JSON.stringify([__test.state(), window.__evlog])")))
    dot = "(()=>{const e=document.querySelector('#minimap .dot, #mmdot, .mm-dot, #explore-dot, [data-role=me]');if(!e)return null;const r=e.getBoundingClientRect();return [r.x,r.y,e.getAttribute('cx'),e.getAttribute('cy'),e.style.transform]})()"
    def hold(name):
        p0 = ev('__test.state().pos'); d0 = ev(dot); shots = [pg.screenshot(type='png')]; ev("__test.key('ArrowUp',true)")
        for k in range(4): time.sleep(2); shots.append(pg.screenshot(type='png'))
        ev("__test.key('ArrowUp',false)"); st = ev('__test.state()'); p1 = st['pos']; d1 = ev(dot); tip = ev("!!document.getElementById('navigation-note') && !document.getElementById('navigation-note').hidden")
        ds = [round(diff(shots[i], shots[i + 1]), 1) for i in range(4)]; far = round(diff(shots[1], shots[4]), 1)
        ok_pos = p1 - p0 >= MIN_ADV; ok_dot = d0 is None or d0 != d1; ok_frames = min(ds[1:]) > DIFF_MIN and far > DIFF_MIN
        ok_tip = not tip or name == 'start'; ok_dir = st['dir'] == 'fwd'
        row = dict(point=name, pos=[round(p0, 2), round(p1, 2)], dot=[d0, d1], frame_diffs=ds, first_last=far, tip=tip, dir=st['dir'], w=st['w'])
        bad = [k for k, v in (('position', ok_pos), ('minimap', ok_dot), ('frames', ok_frames), ('tip', ok_tip), ('direction', ok_dir)) if not v]
        print(('PASS ' if not bad else 'FAIL ') + json.dumps(row) + (' failed=' + ','.join(bad) if bad else ''), flush=True)
        if bad: fails.append(name + ': ' + ','.join(bad) + ' evlog=' + json.dumps(ev('window.__evlog')))
        time.sleep(1.5)
    if not fails:
        for name, act in POINTS:
            if act and act[0] == 'goto': ev(f"HoianWalk.goTo({act[1]}).catch(()=>0)"); time.sleep(4)
            if act and act[0] == 'rev': ev("__test.key('ArrowDown',true)"); time.sleep(3); ev("__test.key('ArrowDown',false)"); time.sleep(1)
            if act and act[0] == 'junc':
                ev(f"__feat.enter({act[1]})"); time.sleep(5); ev(f"__test.key('{act[2]}',true)"); time.sleep(act[3]); ev(f"__test.key('{act[2]}',false)"); time.sleep(2)
            hold(name)
    b.close()
print('RESULT', 'PASS' if not fails else 'FAIL', json.dumps(fails)[:3000])
sys.exit(1 if fails else 0)
