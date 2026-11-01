/* Hội An 360 walk w30 (w30: camera/travel yaw fixed by 90 deg, travel direction from optical-flow FOE track, riverside one-way pause; w27 rewrite + w28 nadir disc + walk-where-you-face).
   Stick UP = walk toward where you look: facing the travel direction (|look yaw| < 80 deg) plays the forward stream; facing behind
   (> 100 deg) plays the time-reversed copy (hls13/r2560) from the same spot. 80-100 deg keeps the current direction (hysteresis);
   a change while holding the stick needs 0.4 s in the new direction; a fresh push switches at once. Release/DOWN = pause.
   All app logic (junctions, map, sound, Explore) uses FORWARD time; the reversed stream's time is RD - t. Riverside: forward only. */
import * as THREE from 'three';
const VER = 'w30';
const $ = id => document.getElementById(id), params = new URLSearchParams(location.search);
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const ROOT = window.WALK_ROOT ?? '../', A = ROOT + 'assets/walk/';
const evlog = []; const log = s => { evlog.push((performance.now() / 1000).toFixed(1) + ' ' + s); if (evlog.length > 60) evlog.shift(); };
window.__evlog = evlog;
$('ver').textContent = VER;

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
$('app').appendChild(renderer.domElement); const cv = renderer.domElement;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
const geo = new THREE.SphereGeometry(50, 128, 64); geo.scale(-1, 1, 1);
const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); scene.add(new THREE.Mesh(geo, mat));
/* w28 option B: soft nadir disc. Below CAP the view shows the ground colours from the rim (lat RIM), averaged sideways, so the
   operator/head-fill area becomes a calm blurred patch that matches the surrounding ground; it fades out over FADE. */
const NADIR = { cap: -62 * Math.PI / 180, fade: 7 * Math.PI / 180, rim: -58 * Math.PI / 180, on: !/[?&]nadir=0/.test(location.search) };
mat.onBeforeCompile = sh => {
  sh.uniforms.nCap = { value: NADIR.cap }; sh.uniforms.nFade = { value: NADIR.fade }; sh.uniforms.nRim = { value: NADIR.rim }; sh.uniforms.nOn = { value: NADIR.on ? 1 : 0 };
  sh.fragmentShader = 'uniform float nCap, nFade, nRim, nOn;\n' + sh.fragmentShader.replace('#include <map_fragment>', `
  #ifdef USE_MAP
    vec4 sampledDiffuseColor = texture2D(map, vMapUv);
    float lat = (vMapUv.y - 0.5) * 3.14159265;
    float a = nOn * (1.0 - smoothstep(nCap - nFade, nCap, lat));
    if (a > 0.0) {
      float ry = nRim / 3.14159265 + 0.5; vec4 acc = vec4(0.0);
      for (int k = -6; k <= 6; k++) { acc += texture2D(map, vec2(vMapUv.x + float(k) * 0.012, ry)); acc += texture2D(map, vec2(vMapUv.x + 0.5 + float(k) * 0.03, ry)); }
      vec4 rimC = acc / 26.0;
      sampledDiffuseColor = mix(sampledDiffuseColor, rimC, a);
    }
    diffuseColor *= sampledDiffuseColor;
  #endif`);
};
window.__nadir = NADIR;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- data ----------
let LO = 0, D = 0, HEAD = null, clips = [], junctions = [], clip = null;
/* w30: travel yaw in camera space. Table deg = image lon of travel (u = 0.5 + deg/360); the camera at yaw psi sees u = 0.75 - psi/2pi, so travel psi = pi/2 - h. w18-w29 used -h: 90 deg off. */
const rawH = p => { if (!HEAD) return 0; const i = Math.min(HEAD.h.length - 1, p / HEAD.dt), a = Math.floor(i), b = Math.min(HEAD.h.length - 1, a + 1), f = i - a; return HEAD.h[a] * (1 - f) + HEAD.h[b] * f; };
const headAt = p => Math.PI / 2 - rawH(p);

// ---------- video: two streams (F forward, R reversed); only the active one plays, the other is parked at the mapped time ----------
const st = { F: { id: 'F' }, R: { id: 'R' } }; let DIR = 'F'; let RD = 0; /* reversed stream duration: R time = RD - forward time */
let v, tex; /* v/tex = the active stream's element/texture */
const sync = () => { v = st[DIR].v; tex = st[DIR].tex; };
function mkV(s) { const old = s.v, ot = s.tex; const el = document.createElement('video'); el.muted = true; el.defaultMuted = true; el.playsInline = true; el.setAttribute('playsinline', ''); el.crossOrigin = 'anonymous'; el.preload = 'auto';
  el.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1'; document.body.appendChild(el); /* WebKit/iOS only decode (and finish seeks) for a <video> that is in the document */
  { const fr = () => { if (el !== s.v) return; s.frames = (s.frames || 0) + 1; if (s.id === DIR) window.__frames = (window.__frames || 0) + 1; el.requestVideoFrameCallback(fr); }; if (el.requestVideoFrameCallback) el.requestVideoFrameCallback(fr); }
  s.v = el; s.tex = new THREE.VideoTexture(el); s.tex.colorSpace = THREE.SRGBColorSpace; s.tex.minFilter = s.tex.magFilter = THREE.LinearFilter; s.tex.generateMipmaps = false;
  if (ot) { if (mat.map === ot) { mat.map = s.tex; mat.needsUpdate = true; } ot.dispose(); } if (old) { old.pause(); old.removeAttribute('src'); old.load(); old.remove(); } if (s.id === DIR) sync(); }
mkV(st.F); mkV(st.R); sync();
let ready = false;
async function probe(url) { for (let k = 0; k < 3; k++) { try { const r = await fetch(url, { cache: k ? 'reload' : 'default' }); if (r.ok && (await r.text()).includes('#EXTM3U')) return true; } catch (e) { log('probe ' + k + ' ' + e.name); } await new Promise(r => setTimeout(r, 600 * (k + 1))); } return false; }
function attach(s, url, t) { s.url = url; if (s.hls) { s.hls.destroy(); s.hls = null; }
  if (s.id === DIR) { mat.map = s.tex; mat.needsUpdate = true; } /* box WebKit only completes a seek when the video's frames are being consumed by a texture */
  const el = s.v;
  if (!el.canPlayType('application/vnd.apple.mpegurl') && window.Hls && Hls.isSupported()) { /* native HLS where the browser has it (iPhone Safari), hls.js elsewhere */ const h = s.hls = new Hls({ startLevel: 0, startPosition: t, abrEwmaDefaultEstimate: 3e6, maxBufferLength: s.id === DIR ? 12 : 4, maxMaxBufferLength: 24, backBufferLength: 8, startFragPrefetch: true, enableWorker: true }); h.loadSource(url); h.attachMedia(el);
    h.on(Hls.Events.ERROR, (_, d) => { if (!d.fatal) return; log('hls fatal ' + s.id + ' ' + d.type + ' ' + d.details); if (d.type === Hls.ErrorTypes.MEDIA_ERROR) h.recoverMediaError(); else if (d.type === Hls.ErrorTypes.NETWORK_ERROR) h.startLoad(); }); }
  else { el.src = url + '#t=' + t; }
}
const media = (id, t) => id === 'F' ? t : RD - t; /* forward time -> that stream's own time */
const pos = () => DIR === 'F' ? st.F.v.currentTime : RD - st.R.v.currentTime; /* always FORWARD time */
let seeking = null;
const once = (el, ev, ms) => new Promise(res => { const f = () => { clearTimeout(to); el.removeEventListener(ev, f); res(true); }; const to = setTimeout(() => { el.removeEventListener(ev, f); res(false); }, ms); el.addEventListener(ev, f); });
/* seek stream s to ITS OWN media time m (with the w27 WebKit retry/re-attach logic) */
async function seekS(s, m) { const el0 = s.v; el0.pause(); m = Math.max(0, Math.min((s.id === 'F' ? D : RD) - 0.2, m)); log('seek ' + s.id + ' ' + m.toFixed(1));
  if (s.v.readyState < 2) await once(s.v, 'loadeddata', 8000); /* WebKit leaves a seek issued before the first decoded data pending forever */
  if (Math.abs(s.v.currentTime - m) < 0.04 && !s.v.seeking) return true;
  for (let k = 0; k < 5; k++) { const el = s.v, p = once(el, 'seeked', 3000); el.currentTime = m + k * 0.1; /* step off a part boundary on retries */ if (await p) return true; log('seek stuck ' + s.id + ', retry ' + (k + 1) + ' rs' + el.readyState);
    if (el.readyState < 2 && k >= 1) { log('new video element ' + s.id + ' at ' + m.toFixed(1)); mkV(s); attach(s, s.url, m); await once(s.v, 'loadeddata', 10000); if (Math.abs(s.v.currentTime - m) < 0.6 && !s.v.seeking) return true; continue; } else { s.hls ? s.hls.recoverMediaError() : el.load(); } }
  return false; }
async function seekTo(t) { t = Math.max(0, Math.min(D - 0.2, t)); seeking = t; try { await seekS(st[DIR], media(DIR, t)); } finally { seeking = null; } }
/* park the inactive stream at the mapped spot while standing still, so a direction change only needs play() */
let parking = false;
async function park() { const o = st[DIR === 'F' ? 'R' : 'F']; if (parking || swapping || !o.url || !RD) return; const m = media(o.id, pos()); if (Math.abs(o.v.currentTime - m) < 0.3 && o.v.readyState >= 2) return; parking = true; try { await seekS(o, m); } finally { parking = false; } }
/* switch direction at the current spot. The old texture stays on screen (frozen) until the new stream has a decoded frame: no black. */
let swapping = false; const switches = [];
let jumpGen = 0; /* w30: a jump (map tap / Explore) during a direction switch cancels the switch */
async function setDir(to, why) { if (to === DIR || swapping) return; const g = jumpGen, p = pos(), from = DIR, o = st[to], t0 = performance.now(); swapping = true; st[from].v.pause(); log('dir ' + from + '>' + to + ' at ' + p.toFixed(1) + ' (' + why + ')');
  try { while (parking) await new Promise(r => setTimeout(r, 30)); const ok = await Promise.race([seekS(o, media(to, p)), new Promise(r => setTimeout(() => r(false), 4000))]); if (g !== jumpGen) { log('dir ' + to + ' cancelled by jump'); return; } if (!ok) { log('dir ' + to + ' not ready: stay ' + from); switches.push({ from, to, at: +p.toFixed(1), gap: -1, why: 'timeout' }); return; } const f0 = o.frames || 0;
    DIR = to; sync(); mat.map = o.tex; mat.needsUpdate = true; o.v.playbackRate = Math.max(0.5, Math.min(1, speed() || 1)); await Promise.race([o.v.play().catch(e => log('play ' + e.name)), new Promise(r => setTimeout(r, 1500))]); /* WebKit can leave play() pending: never block the loop on it */
    for (let k = 0; k < 60 && (o.frames || 0) <= f0; k++) await new Promise(r => setTimeout(r, 16)); /* until the first new frame is presented */
    const gap = Math.round(performance.now() - t0); switches.push({ from, to, at: +p.toFixed(1), gap, why }); if (switches.length > 40) switches.shift(); log('dir done ' + gap + 'ms');
  } finally { lastPos = pos(); swapping = false; } }

// ---------- input: stick + drag look ----------
const joyEl = $('joy'), knob = $('knob'); const joy = { id: null, y: 0, x: 0, cx: 0, cy: 0 };
const keys = {}; addEventListener('keydown', e => { keys[e.code] = true; }); addEventListener('keyup', e => { keys[e.code] = false; });
const look = { yaw: 0, pitch: 0, drag: null };
function joyStart(e) { const r = joyEl.getBoundingClientRect(); joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joyMove(e); }
function joyMove(e) { const R = joyEl.offsetWidth / 2 || 60; let dx = (e.clientX - joy.cx) / R, dy = (e.clientY - joy.cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`; }
function joyEnd() { joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; }
const inJoy = e => { const r = joyEl.getBoundingClientRect(); return e.clientX >= r.left - 16 && e.clientX <= r.right + 16 && e.clientY >= r.top - 16 && e.clientY <= r.bottom + 16; };
addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('button,a,#explore,#minimap,input')) return; if (joy.id == null && inJoy(e)) { joyStart(e); e.preventDefault(); return; } if (look.drag == null) look.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; }, { capture: true, passive: false });
addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joyMove(e); return; } const d = look.drag; if (d && d.id === e.pointerId) { const k = 1.6 * (camera.fov * Math.PI / 180) / innerHeight; look.yaw += (e.clientX - d.x) * k; look.pitch = Math.max(-1.2, Math.min(1.2, look.pitch + (e.clientY - d.y) * k)); d.x = e.clientX; d.y = e.clientY; } }, { capture: true });
const up = e => { if (e.pointerId === joy.id) joyEnd(); if (look.drag && look.drag.id === e.pointerId) look.drag = null; };
addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);

// stick -> speed (0 or 0.5..1). Direction comes from where you look, not from the stick.
const speed = () => { if (keys.ArrowUp || keys.KeyW) return 1; if (joy.id == null) return 0; const u = -joy.y; if (u < 0.2) return 0; return 0.5 + 0.5 * Math.min(1, (u - 0.2) / 0.65); };

// ---------- sound (footage audio track, separate file) ----------
const audio = new Audio(); audio.loop = false; audio.crossOrigin = 'anonymous'; audio.preload = 'auto'; let soundOn = false;
$('sound').onclick = () => { soundOn = !soundOn; $('sound').textContent = soundOn ? '🔊' : '🔇'; if (soundOn) { audio.currentTime = pos(); audio.play().catch(() => {}); } else audio.pause(); };

// ---------- clips, junctions, jumps ----------
const clipAt = t => clips.find(c => t >= c.lo - 0.5 && t <= c.hi + 0.5) || clips[0];
let jumping = false, lastJ = 0;
async function jump(t) { jumpGen++; jumping = true; $('status').textContent = ''; clip = clipAt(t); try { while (parking) await new Promise(r => setTimeout(r, 30)); /* w30: a park of this stream finishing after our seek used to drag the walk back to the old spot */ if (DIR !== 'F') { st.R.v.pause(); DIR = 'F'; sync(); mat.map = tex; mat.needsUpdate = true; } await seekTo(t); clip = clipAt(t); hd = headAt(t); look.yaw = 0; look.pitch = 0; window.__w.lastJump = t; } finally { lastPos = pos(); jumping = false; } }
function checkJunction(p) { if (performance.now() - lastJ < 3000) return; for (const j of junctions) { if (j.clip !== clip.id) continue; if (p >= j.at - 0.3 && p <= j.at + (j.window || 2)) { lastJ = performance.now(); log('junction ' + j.id); window.__w.lastJunction = j.id; jump(j.toTime); return; } } }

// ---------- minimap (schematic: integrate the heading table) ----------
const mm = $('minimap'), mctx = mm.getContext('2d'); let path = null;
function buildPath() { if (!HEAD) return; const main = clips[0]; const pts = []; let x = 0, y = 0; for (let t = main.lo; t <= main.hi; t += 1) { const h = rawH(t); x += Math.sin(h); y -= Math.cos(h); pts.push([t, x, y]); }
  const xs = pts.map(p => p[1]), ys = pts.map(p => p[2]), mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys), s = 100 / Math.max(mxx - mnx, mxy - mny, 1);
  path = pts.map(([t, x, y]) => [t, 10 + (x - mnx) * s, 10 + (y - mny) * s]); }
const mapXY = t => { if (!path) return null; const i = Math.max(0, Math.min(path.length - 1, Math.round(t - path[0][0]))); return path[i]; };
function drawMap() { if (!path) return; mctx.clearRect(0, 0, 120, 120); mctx.strokeStyle = 'rgba(255,255,255,.75)'; mctx.lineWidth = 2; mctx.beginPath(); path.forEach(([, x, y], i) => i ? mctx.lineTo(x, y) : mctx.moveTo(x, y)); mctx.stroke();
  const p = pos(), c = clip && clip.id !== 'main' ? mapXY(clip.mapAt || p) : mapXY(p); if (!c) return; mctx.fillStyle = '#ff4d4d'; mctx.beginPath(); mctx.arc(c[1], c[2], 4.5, 0, 7); mctx.fill(); }
mm.addEventListener('pointerdown', e => { e.stopPropagation(); if (!path) return; const r = mm.getBoundingClientRect(), x = (e.clientX - r.left) * 120 / r.width, y = (e.clientY - r.top) * 120 / r.height; let bd = 1e9; const ds = path.map(p => { const d = (p[1] - x) ** 2 + (p[2] - y) ** 2; if (d < bd) bd = d; return [p[0], d]; }); if (bd >= 400) return; const near = ds.filter(q => q[1] <= bd + 16); const cur = pos(); const pick = near.find(q => q[0] > cur + 5) || near[0]; jump(pick[0]); }); /* where the drawn path crosses itself, prefer the pass that lies ahead */

// ---------- explore ----------
$('explore-toggle').onclick = () => { $('explore').hidden = !$('explore').hidden; };
$('explore-close').onclick = () => { $('explore').hidden = true; };
$('go').onclick = () => { $('explore').hidden = true; jump(+$('pos').value); };

// ---------- loop ----------
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), BACK = 100 * Math.PI / 180, FRONT = 80 * Math.PI / 180;
let hd = 0, rate = 0, last = performance.now(), lastPos = 0, wasWant = 0, pend = null, idleT = 0;
const relYaw = () => wrap(look.yaw + hd - headAt(pos())); /* facing relative to the true travel direction now */
const wantDir = () => { if (!clip) return 'F'; const r = Math.abs(relYaw()); if (clip.id !== 'main' || !RD) return r > BACK ? 'P' : 'F'; /* riverside is forward-only: pause instead of walking away from where you look */ return r > BACK ? 'R' : r < FRONT ? 'F' : DIR; };
renderer.setAnimationLoop(() => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (ready && !jumping && !swapping) { const want = speed(); rate += (want - rate) * Math.min(1, dt * 8);
    const p = pos(); if (clip && (p < clip.lo - 1 || p > clip.hi + 1)) clip = clipAt(p);
    const wd0 = want > 0 ? wantDir() : DIR, oneWay = wd0 === 'P', wd = oneWay ? DIR : wd0;
    if (want > 0 && wd !== DIR) { if (!wasWant) { wasWant = want; setDir(wd, 'push'); return; } if (!pend || pend.d !== wd) pend = { d: wd, t: now }; else if (now - pend.t >= 400) { pend = null; wasWant = want; setDir(wd, 'hold'); return; } } else pend = null;
    wasWant = want;
    const atEnd = DIR === 'F' ? (clip && p >= clip.hi - 0.3) : (clip && p <= Math.max(clip.lo, clip.id === 'main' ? LO : 0) + 0.3);
    if (want > 0 && (atEnd || oneWay)) { if (!v.paused) v.pause(); $('status').textContent = oneWay ? 'This riverside path only plays one way: turn around to walk on' : DIR === 'F' ? 'End of this street: tap the mini-map or Explore to continue' : 'Start of the walk: turn around to walk on'; }
    else if (want > 0) { const r = Math.max(0.5, Math.min(1, want)); if (v.playbackRate !== r) v.playbackRate = r; if (v.paused) v.play().catch(e => log('play ' + e.name)); $('status').textContent = ''; }
    else if (!v.paused) v.pause();
    if (want === 0) { idleT += dt; if (idleT > 0.6) park(); } else idleT = 0;
    if (soundOn) { if (v.paused) { audio.volume = 0.25; } else { audio.volume = 0.85; if (DIR === 'F' && Math.abs(audio.currentTime - p) > 1.5) audio.currentTime = p; audio.playbackRate = v.playbackRate; } if (audio.paused) audio.play().catch(() => {}); } /* ambience only: it keeps playing forward while the picture walks the other way */
    if (!v.paused && DIR === 'F') checkJunction(p);
    if (!seeking) { if (DIR === 'F' && p < lastPos - 0.5) log('BACKSTEP ' + lastPos.toFixed(2) + '>' + p.toFixed(2)); if (DIR === 'R' && p > lastPos + 0.5) log('REVSTEP ' + lastPos.toFixed(2) + '>' + p.toFixed(2)); lastPos = p; }
    const h = headAt(p); const d = Math.atan2(Math.sin(h - hd), Math.cos(h - hd)); hd += Math.max(-0.35 * dt, Math.min(0.35 * dt, d * Math.min(1, dt * 0.8)));
    if (now - (window.__mmT || 0) > 200) { window.__mmT = now; drawMap(); } }
  camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw + hd, 0, 'YXZ'));
  renderer.render(scene, camera); });

// ---------- boot ----------
(async () => { try {
  const j = await (await fetch(A + 'walk.json', { cache: 'no-cache' })).json(); const c = j.cdn;
  const url = c.base + (isIOS ? c.hlsIOS : c.hls);
  const r = await (await fetch(ROOT + 'routes.json', { cache: 'no-cache' })).json(); const route = r.routes[0]; clips = route.clips; junctions = (route.junctions || []).filter(x => (x.dir || 1) > 0); clip = clips[0];
  fetch(A + 'heading_foe.json').then(x => x.json()).then(h => { HEAD = h; hd = headAt(Math.max(pos(), c.lo || 0)); buildPath(); }).catch(() => {});
  audio.src = c.audio;
  if (!(await probe(url))) throw new Error('The video stream is not reachable. Check the connection and reload.');
  D = c.duration; LO = c.lo || 0; /* 0..lo is the still intro: walking back stops there */ window.__src = 'r2'; $('pos').min = clips[0].lo; $('pos').max = clips[0].hi;
  const t0 = +(params.get('t') || c.lo || clips[0].lo); attach(st.F, url, t0);
  await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('Video took too long to load.')), 45000); st.F.v.addEventListener('loadedmetadata', () => { clearTimeout(to); res(); }, { once: true }); });
  await seekTo(t0);
  mat.map = tex; mat.needsUpdate = true; ready = true; document.body.classList.remove('loading'); $('loader').hidden = true; log('ready');
  window.__ttff = performance.now();
  if (c.rev && params.get('rev') !== '0') { const ru = c.base + c.rev; if (await probe(ru)) { RD = c.revDuration || c.duration; attach(st.R, ru, media('R', pos())); log('rev attached'); } else log('rev unreachable: forward only'); }
} catch (e) { $('error').hidden = false; $('error').textContent = e.message; log('error ' + e.message); } })();

window.__w = { ver: VER, dbg: () => { const b = v.buffered, r = []; for (let i = 0; i < b.length; i++) r.push([+b.start(i).toFixed(2), +b.end(i).toFixed(2)]); return { ct: v.currentTime, rs: v.readyState, ns: v.networkState, paused: v.paused, seeking: v.seeking, buf: r, err: v.error && v.error.code }; }, state: () => ({ pos: pos(), D, rate: v.playbackRate, playing: !v.paused, ready, clip: clip && clip.id, hd, lookYaw: look.yaw, pitch: look.pitch, src: v.currentSrc || (st[DIR].hls && 'hls.js'), dir: DIR, swapping, rd: RD }),
  jump, setLook: (deg, p) => { look.yaw = deg * Math.PI / 180; if (p != null) look.pitch = p * Math.PI / 180; }, key: (k, on) => { keys[k] = on; }, joy: () => ({ ...joy }), vids: () => document.querySelectorAll('video').length, switches: () => switches.slice(), wantDir: () => wantDir(), relYaw: () => relYaw() * 180 / Math.PI, rs: () => ({ F: [st.F.v.readyState, +st.F.v.currentTime.toFixed(2), st.F.v.paused], R: [st.R.v.readyState, +st.R.v.currentTime.toFixed(2), st.R.v.paused] }),
  headAt, mapXY, mmTap: t => { const p = mapXY(t); const r = mm.getBoundingClientRect(); return p && { x: r.left + p[1] * r.width / 120, y: r.top + p[2] * r.height / 120 }; }, audio: () => ({ paused: audio.paused, vol: audio.volume }), lastJump: null, lastJunction: null };
