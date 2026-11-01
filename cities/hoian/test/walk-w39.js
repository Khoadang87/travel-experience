/* w39: stop automatic forward-facing turn; keep paused heading still. Return travel remains unavailable. */
/* w38: user rejected w37 blur turn on real iPhone. Pull-back pauses with explanation; explicit Back 5 s revisits earlier footage without playing it backwards. */
/* w37: explicit 180-degree back-look, stop while held, pointer capture and input reset. Return travel is unavailable; no reversed footage. */
/* Hội An 360 walk w36 (w36: stick pulled back (>100 deg from up) = same quick turnaround, then walks forward while held; sideways = turn the view, forward part walks) w35 (w35: bridge place lands at 1110 centred on the entrance) w34 (w34: reversed video is never played; facing back + push = quick blurred turnaround, then forward. Place picker on load / Explore.) (w33: bridge jump fires anywhere in the first 15.5 s whenever the view centre is within 40 deg of the bridge's tracked per-frame bearing (the 360 camera spins), checked before any direction switch; nadir disc is now a separate mesh (not a shader patch); start hint hidden after a jump or any walking). w32 (w32: from the canal-bank start, facing the Japanese Covered Bridge and pushing toward it, a <=2 s blur transition carries you to the bridge east entrance, then you walk in). w31 (w31: sound follows walking + remembered mute, iPhone starts on the 2560 rung and loads the reversed stream only after the first frame, debug line ?debug=1 / tap version 3x, 'Japanese Bridge' Explore jump, highp nadir disc). w30 (w30: camera/travel yaw fixed by 90 deg, travel direction from optical-flow FOE track, riverside one-way pause; w27 rewrite + w28 nadir disc + walk-where-you-face).
   Stick UP = walk toward where you look: facing the travel direction (|look yaw| < 80 deg) plays the forward stream; facing behind
   (> 100 deg) plays the time-reversed copy (hls13/r2560) from the same spot. 80-100 deg keeps the current direction (hysteresis);
   a change while holding the stick needs 0.4 s in the new direction; a fresh push switches at once. Release/DOWN = pause.
   All app logic (junctions, map, sound, Explore) uses FORWARD time; the reversed stream's time is RD - t. Riverside: forward only. */
import * as THREE from 'three';
const VER = 'w39';
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
const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); mat.precision = 'highp'; /* w31: iOS mediump made lat maths coarse near the pole */ scene.add(new THREE.Mesh(geo, mat));
/* w28 option B: soft nadir disc. Below CAP the view shows the ground colours from the rim (lat RIM), averaged sideways, so the
   operator/head-fill area becomes a calm blurred patch that matches the surrounding ground; it fades out over FADE. */
const NADIR = { cap: -62 * Math.PI / 180, fade: 7 * Math.PI / 180, rim: -58 * Math.PI / 180, on: !/[?&]nadir=0/.test(location.search) };
mat.onBeforeCompile = sh => {
  sh.uniforms.nCap = { value: NADIR.cap }; sh.uniforms.nFade = { value: NADIR.fade }; sh.uniforms.nRim = { value: NADIR.rim }; sh.uniforms.nOn = { value: NADIR.on && !/[?&]nshader=0/.test(location.search) ? 1 : 0 };
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
/* w33: on iPhone the shader patch above never showed (operator visible straight down). Root cause candidates are in the w33 notes; instead of relying on
   the material's compiled shader, draw a separate soft disc mesh just inside the sphere at the nadir, coloured from the ground ring of the current video frame. */
const discCv = document.createElement('canvas'); discCv.width = discCv.height = 128; const dctx = discCv.getContext('2d');
const discTex = new THREE.CanvasTexture(discCv); discTex.colorSpace = THREE.SRGBColorSpace;
const disc = new THREE.Mesh(new THREE.CircleGeometry(36, 64), new THREE.MeshBasicMaterial({ map: discTex, transparent: true, depthTest: false, depthWrite: false }));
disc.rotation.x = -Math.PI / 2; disc.position.y = -45; disc.renderOrder = 10; disc.frustumCulled = false; disc.visible = NADIR.on; scene.add(disc);
const sampCv = document.createElement('canvas'); sampCv.width = 64; sampCv.height = 32; const sctx = sampCv.getContext('2d', { willReadFrequently: true });
let discCol = [120, 115, 105], discOk = false;
function discPaint() { const g = dctx.createRadialGradient(64, 64, 0, 64, 64, 64), c = discCol.join(','); /* r: 0..64 maps to 0..36 world; opaque to lat -63 deg (r 23), fades to 0 at lat -51 (r 36) */
  g.addColorStop(0, `rgba(${c},1)`); g.addColorStop(0.62, `rgba(${c},1)`); g.addColorStop(1, `rgba(${c},0)`); dctx.clearRect(0, 0, 128, 128); dctx.fillStyle = g; dctx.fillRect(0, 0, 128, 128); discTex.needsUpdate = true; }
discPaint();
setInterval(() => { if (!v || v.readyState < 2) return; try { sctx.drawImage(v, 0, 0, 64, 32); const d = sctx.getImageData(0, 25, 64, 2).data; let r = 0, gg = 0, b = 0, n = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } discCol = [r / n | 0, gg / n | 0, b / n | 0]; discOk = true; discPaint(); } catch (e) { if (!discOk) log('disc sample ' + e.name); } }, 500);
window.__nadir = NADIR; window.__disc = () => ({ visible: disc.visible, col: discCol, ok: discOk });
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
  try { for (let k = 0; parking && k < 34; k++) await new Promise(r => setTimeout(r, 30)); /* w31: never wait more than ~1 s for a background park (a stuck WebKit park froze the walk for 15 s+) */ const ok = await Promise.race([seekS(o, media(to, p)), new Promise(r => setTimeout(() => r(false), 4000))]); if (g !== jumpGen) { log('dir ' + to + ' cancelled by jump'); return; } if (!ok) { log('dir ' + to + ' not ready: stay ' + from); switches.push({ from, to, at: +p.toFixed(1), gap: -1, why: 'timeout' }); return; } const f0 = o.frames || 0;
    DIR = to; sync(); mat.map = o.tex; mat.needsUpdate = true; o.v.playbackRate = Math.max(0.5, Math.min(1, speed() || 1)); await Promise.race([o.v.play().catch(e => log('play ' + e.name)), new Promise(r => setTimeout(r, 1500))]); /* WebKit can leave play() pending: never block the loop on it */
    for (let k = 0; k < 60 && (o.frames || 0) <= f0; k++) await new Promise(r => setTimeout(r, 16)); /* until the first new frame is presented */
    const gap = Math.round(performance.now() - t0); switches.push({ from, to, at: +p.toFixed(1), gap, why }); if (switches.length > 40) switches.shift(); log('dir done ' + gap + 'ms');
  } finally { lastPos = pos(); swapping = false; } }

// ---------- input: stick + drag look ----------
const joyEl = $('joy'), knob = $('knob'); const joy = { id: null, y: 0, x: 0, cx: 0, cy: 0 };
const keys = {}; addEventListener('keydown', e => { keys[e.code] = true; }); addEventListener('keyup', e => { keys[e.code] = false; });
const look = { yaw: 0, pitch: 0, drag: null };
function joyStart(e) { if (joy.id != null) return; joyEl.setPointerCapture?.(e.pointerId); const r = joyEl.getBoundingClientRect(); joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joyMove(e); }
function joyMove(e) { const R = joyEl.offsetWidth / 2 || 60; let dx = (e.clientX - joy.cx) / R, dy = (e.clientY - joy.cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`; }
function joyEnd() { if (joy.id != null && joyEl.hasPointerCapture?.(joy.id)) joyEl.releasePointerCapture(joy.id); joy.id = null; joy.backDone = false; joy.x = joy.y = 0; knob.style.transform = ''; }
const inJoy = e => { const r = joyEl.getBoundingClientRect(); return e.clientX >= r.left - 16 && e.clientX <= r.right + 16 && e.clientY >= r.top - 16 && e.clientY <= r.bottom + 16; };
addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('button,a,#explore,#places,#minimap,input')) return; if (joy.id == null && inJoy(e)) { joyStart(e); e.preventDefault(); return; } if (look.drag == null) look.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; }, { capture: true, passive: false });
addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joyMove(e); return; } const d = look.drag; if (d && d.id === e.pointerId) { const k = 1.6 * (camera.fov * Math.PI / 180) / innerHeight; look.yaw += (e.clientX - d.x) * k; look.pitch = Math.max(-1.55, Math.min(1.55, look.pitch + (e.clientY - d.y) * k)); d.x = e.clientX; d.y = e.clientY; } }, { capture: true });
const up = e => { if (e.pointerId === joy.id) joyEnd(); if (look.drag && look.drag.id === e.pointerId) look.drag = null; };
addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
joyEl.addEventListener('lostpointercapture', up);
addEventListener('blur', () => { joyEnd(); look.drag = null; for (const k of Object.keys(keys)) keys[k] = false; });

// stick -> speed (0 or 0.5..1). Direction comes from where you look, not from the stick.
const joyAng = () => Math.atan2(joy.x, -joy.y) * 180 / Math.PI; /* 0 = stick up, +-180 = pulled back */
const joyBack = () => joy.id != null && Math.hypot(joy.x, joy.y) >= 0.3 && Math.abs(joyAng()) > 100;
const speed = () => { if (keys.ArrowUp || keys.KeyW) return 1; if (joy.id == null) return 0;
  const m = Math.hypot(joy.x, joy.y); if (joyBack()) return 0; /* w36: pulled back = turnaround first, then forward while held */
  const u = -joy.y; if (u < 0.2) return 0; return 0.5 + 0.5 * Math.min(1, (u - 0.2) / 0.65); };
const joyTurn = () => { if (joy.id == null || joyBack()) return 0; const x = joy.x; return Math.abs(x) < 0.3 ? 0 : Math.sign(x) * (Math.abs(x) - 0.3) / 0.7; }; /* w36: sideways = turn the view (up to 70 deg/s) */

// ---------- sound (footage audio track, separate file) ----------
/* w31: sound plays only while you walk (paused when you stop); the 🔊/🔇 button mutes it and the choice is remembered (localStorage). iOS: unlocked on the first touch. */
const audio = new Audio(); audio.loop = false; audio.crossOrigin = 'anonymous'; audio.preload = 'none'; /* w31: the 19 MB ambience file no longer downloads during the first load; it streams once you walk */
const SK = 'hoianSound'; let soundOn = (() => { try { return localStorage.getItem(SK) !== 'off'; } catch (e) { return true; } })(); let unlocked = false;
const sndUI = () => { $('sound').textContent = soundOn ? '🔊 Sound on' : '🔇 Sound off'; $('sound').setAttribute('aria-pressed', String(soundOn)); };
sndUI();
const unlock = () => { if (unlocked) return; unlocked = true; audio.muted = true; const pr = audio.play(); if (pr) pr.then(() => { audio.pause(); audio.muted = false; }).catch(() => { audio.muted = false; unlocked = false; }); else { audio.pause(); audio.muted = false; } };
addEventListener('pointerdown', unlock, { capture: true }); addEventListener('touchend', unlock, { capture: true }); addEventListener('keydown', unlock, { capture: true });
$('sound').onclick = () => { soundOn = !soundOn; try { localStorage.setItem(SK, soundOn ? 'on' : 'off'); } catch (e) {} sndUI(); if (!soundOn) { audio.pause(); audio.volume = 0; } };
function soundTick(walking, p) { if (!soundOn || !walking) { if (!audio.paused) audio.pause(); return; } audio.volume = 0.85; if (Math.abs(audio.currentTime - p) > 1.5 && DIR === 'F') audio.currentTime = p; audio.playbackRate = Math.max(0.5, Math.min(1, v.playbackRate)); if (audio.paused) audio.play().catch(() => {}); }

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
/* w32: canal gap. The walk starts on the canal bank with the bridge side-on across the water, behind the filmer; no footage covers the last 40-60 m.
   Pushing at the start spot (LO..LO+1 s) while facing the bridge (within +-45 deg of its bearing) blurs out, seeks to the entrance approach and blurs back in (<= 2 s). */
const GAP_T = 1108, GAP_CONE = 40 * Math.PI / 180, GAP_ZONE_HI = 15.5;
/* w33: bridge image longitude u per frame time, template-tracked on the f2560 frames (/workspace/qa/w33/bridge_u.json); camera psi = 2pi(0.75-u) */
const GAP_U = [[4.5, 0.495], [4.75, 0.5], [5.0, 0.509], [5.25, 0.522], [5.5, 0.541], [5.75, 0.561], [6.0, 0.591], [6.25, 0.62], [6.5, 0.658], [6.75, 0.692], [7.0, 0.73], [7.25, 0.761], [7.5, 0.792], [7.75, 0.814], [8.0, 0.834], [8.25, 0.848], [8.5, 0.859], [8.75, 0.867], [9.0, 0.872], [9.25, 0.875], [9.5, 0.877], [9.75, 0.878], [10.0, 0.88], [10.25, 0.881], [10.5, 0.883], [10.75, 0.884], [11.0, 0.887], [11.25, 0.891], [11.5, 0.894], [11.75, 0.895], [12.0, 0.897], [12.25, 0.898], [12.5, 0.902], [12.75, 0.905], [13.0, 0.908], [13.25, 0.909], [13.5, 0.912], [13.75, 0.916], [14.0, 0.919], [14.25, 0.922], [14.5, 0.925], [14.75, 0.928], [15.0, 0.931], [15.25, 0.934], [15.5, 0.938]];
const gapPsi = p => { if (p < GAP_U[0][0]) p = GAP_U[0][0]; let i = 0; while (i < GAP_U.length - 2 && GAP_U[i + 1][0] < p) i++; const [t0, u0] = GAP_U[i], [t1, u1] = GAP_U[i + 1]; const u = u0 + (u1 - u0) * Math.max(0, Math.min(1, (p - t0) / (t1 - t0))); return 2 * Math.PI * (0.75 - u); };
let gapBusy = false;
const inGapZone = () => clip && clip.id === 'main' && pos() <= GAP_ZONE_HI;
const facingBridge = () => inGapZone() && look.pitch > -0.9 && Math.abs(wrap(look.yaw + hd - gapPsi(pos()))) < GAP_CONE;
let hintDone = false; /* w33: the start hint never comes back after a jump or after you have walked */
async function gapJump() { if (gapBusy) return; gapBusy = true; window.__w.gapJumps = (window.__w.gapJumps || 0) + 1; log('gap jump to bridge at ' + pos().toFixed(2)); hintDone = true; $('status').textContent = ''; for (const k of ['F', 'R']) if (st[k].v) st[k].v.pause();
  cv.style.transition = 'filter .45s ease-in, transform .45s ease-in'; cv.style.filter = 'blur(14px) brightness(1.15)'; cv.style.transform = 'scale(1.12)';
  try { await new Promise(r => setTimeout(r, 450)); await Promise.race([jump(GAP_T), new Promise(r => setTimeout(r, 1000))]); }
  finally { cv.style.transition = 'filter .5s ease-out, transform .5s ease-out'; cv.style.filter = ''; cv.style.transform = ''; setTimeout(() => { gapBusy = false; }, 600); } }
const BRIDGE_T = 1104; /* w31: the walk reaches the Japanese Covered Bridge at ~1112 s and is inside it ~1115-1125 s (the bridge seen at the start is behind the filmer's start point) */
/* w34 place picker: landing time + image longitude u of the landmark in that frame (camera yaw = 2*pi*(0.75-u)), all checked by eye on grabbed frames */
const PLACES = [
  { id: 'bridge', name: 'Japanese Covered Bridge', note: 'outside the east entrance, facing in', t: 1110, u: 0.49, lo: 1100, hi: 1150 },
  { id: 'hall', name: 'Quảng Triệu Assembly Hall (廣肇會館)', note: 'the gate on the street', t: 1061, u: 0.84, lo: 1045, hi: 1080 },
  { id: 'market', name: 'Market hall', note: 'the long tiled market roof', t: 530, u: 0.70, lo: 515, hi: 565 },
  { id: 'gate', name: 'Ornate yellow gate', note: 'three-arch gate with dragons', t: 503, u: 0.17, lo: 490, hi: 515 },
  { id: 'river', name: 'Riverside boats', note: 'boat landing at sunset', t: 1500, u: 0.65, lo: 1440, hi: 1580 },
  { id: 'start', name: 'Start of the walk', note: 'riverbank square', t: null, u: null } ];
let placeBusy = false;
async function goPlace(id) { const pl = PLACES.find(x => x.id === id); if (!pl || placeBusy) return; placeBusy = true; while (!ready) await new Promise(r => setTimeout(r, 100)); $('explore').hidden = true; $('places').hidden = true; hintDone = pl.id !== 'start';
  try { const t = pl.t == null ? LO : pl.t; await jump(t); if (pl.u != null) { look.yaw = wrap(2 * Math.PI * (0.75 - pl.u) - hd); look.pitch = 0; } window.__w.place = { id, t, at: pos() }; log('place ' + id + ' t=' + t); } finally { placeBusy = false; } }
{ const sec = document.createElement('section'); sec.id = 'places'; sec.style.cssText = 'position:fixed;left:10px;right:10px;top:calc(env(safe-area-inset-top) + 60px);background:rgba(20,20,20,.95);color:#fff;padding:14px;border-radius:12px;z-index:30;max-height:75vh;overflow:auto';
  sec.innerHTML = '<b>Where to?</b><p style="margin:4px 0 10px;opacity:.8">Pick a place; you can walk on from there.</p>' + PLACES.map(p => `<button type="button" data-place="${p.id}" style="display:block;width:100%;text-align:left;margin:6px 0;padding:10px;border:0;border-radius:10px;background:#333;color:#fff;font-size:15px">${p.name}<br><small style="opacity:.7">${p.note}</small></button>`).join('');
  document.body.appendChild(sec); sec.addEventListener('click', e => { const b = e.target.closest('button[data-place]'); if (b) goPlace(b.dataset.place); });
  if (params.get('places') === '0' || params.get('t')) sec.hidden = true;
  const b = document.createElement('button'); b.type = 'button'; b.id = 'go-places'; b.textContent = 'Places…'; $('go').after(' ', b); b.onclick = () => { $('explore').hidden = true; sec.hidden = false; };
  const bb = document.createElement('button'); bb.type = 'button'; bb.id = 'go-bridge'; bb.textContent = 'Japanese Bridge'; b.after(' ', bb); bb.onclick = () => goPlace('bridge'); }

// w38: explicit discontinuous revisit, never reverse playback or fake a turn.
{ const b = document.createElement('button'); b.id = 'back-step'; b.type = 'button';
  b.textContent = 'Back 5 s'; b.setAttribute('aria-label', 'Jump to a point five seconds earlier, not continuous backward walking');
  b.style.cssText = 'position:fixed;left:24px;bottom:calc(env(safe-area-inset-bottom) + 202px);border:1px solid #fff;background:rgba(0,0,0,.7);color:#fff;border-radius:12px;padding:10px 14px;font:inherit';
  document.body.appendChild(b);
  b.onclick = async () => { if (!ready || jumping || turnBusy || gapBusy || placeBusy) return;
    const floor = Math.max(clip.lo, clip.id === 'main' ? LO : 0), target = Math.max(floor, pos() - 5);
    if (pos() - target < 0.1) { $('status').textContent = 'Start of this route. Choose another place in Explore.'; return; }
    b.disabled = true; joyEnd(); const worldYaw = look.yaw + hd, pitch = look.pitch;
    if (!v.paused) v.pause(); soundTick(false, pos());
    try { await jump(target); look.yaw = wrap(worldYaw - hd); look.pitch = pitch;
      $('status').textContent = 'Jumped to an earlier point. Continuous return walking is unavailable.'; }
    finally { b.disabled = false; }
  };
}
// ---------- loop ----------
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), BACK = 100 * Math.PI / 180, FRONT = 80 * Math.PI / 180;
let hd = 0, rate = 0, last = performance.now(), lastPos = 0, wasWant = 0, pend = null, idleT = 0;
const relYaw = () => wrap(look.yaw + hd - headAt(pos())); /* facing relative to the true travel direction now */

// ---------- w34 turnaround: facing back + push never plays reversed video; blur, swing the view to face the travel direction, walk on forward ----------
let turnBusy = false;
async function turnaround(backPull = false) { if (turnBusy || gapBusy) return; turnBusy = true; window.__w.turns = (window.__w.turns || 0) + 1; log('turnaround at ' + pos().toFixed(2)); $('status').textContent = ''; if (!v.paused) v.pause();
  cv.style.transition = 'filter .25s ease-in'; cv.style.filter = 'blur(10px) brightness(1.1)';
  const y0 = look.yaw, dy = backPull ? Math.PI : wrap(headAt(pos()) - hd - y0), T = 550, t0 = performance.now();
  try { await new Promise(r => setTimeout(r, 120)); await new Promise(res => { const step = () => { const k = Math.min(1, (performance.now() - t0) / T), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; look.yaw = y0 + dy * e; if (k < 1) requestAnimationFrame(step); else res(); }; step(); }); const hn = headAt(pos()); look.yaw = wrap(look.yaw + hd - hn); hd = hn; /* end state = the normal walking state: camera follows the travel heading, look.yaw ~ 0 */ }
  finally { cv.style.transition = 'filter .35s ease-out'; cv.style.filter = ''; setTimeout(() => { turnBusy = false; }, 150); } }
const wantDir = () => { if (!clip) return 'F'; const r = Math.abs(relYaw()); if (clip.id !== 'main' || !RD) return r > BACK ? 'P' : 'F'; /* riverside is forward-only: pause instead of walking away from where you look */ return r > BACK ? 'R' : r < FRONT ? 'F' : DIR; };
renderer.setAnimationLoop(() => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (ready && !jumping && !swapping) { const want = speed(); if (want > 0 && window.__revStart) window.__revStart(); rate += (want - rate) * Math.min(1, dt * 8);
    const p = pos(); if (clip && (p < clip.lo - 1 || p > clip.hi + 1)) clip = clipAt(p);
    if (want > 0 && facingBridge()) { if (!v.paused) v.pause(); gapJump(); return; } /* w33: before the direction switch, so a push toward the bridge never walks normal footage */
    if (joyBack() && !joy.backDone) { joy.backDone = true; window.__w.backPulls = (window.__w.backPulls || 0) + 1; if (!v.paused) v.pause(); soundTick(false, p); $('status').textContent = 'Return walking unavailable. Tap Back 5 s to revisit an earlier point.'; camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw + hd, 0, 'YXZ')); renderer.render(scene, camera); return; } /* w37: a back pull turns 180 degrees once, then remains stopped. */
    if (joyBack() && !turnBusy) { if (!v.paused) v.pause(); soundTick(false, p); $('status').textContent = 'Return walking unavailable. Tap Back 5 s to revisit an earlier point.'; camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw + hd, 0, 'YXZ')); renderer.render(scene, camera); return; }
    { const tr = joyTurn(); if (tr && !turnBusy) look.yaw += tr * 1.22 * dt; }
    if (turnBusy) { soundTick(false, p); camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw + hd, 0, 'YXZ')); renderer.render(scene, camera); return; }
    if (want > 0 && Math.abs(relYaw()) >= FRONT) {
      if (!v.paused) v.pause(); soundTick(false, p);
      $('status').textContent = 'This view is away from the recorded walking direction. Turn the view along the route, or use Back 5 s to revisit an earlier point.';
      camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw + hd, 0, 'YXZ')); renderer.render(scene, camera); return;
    }
    const wd0 = want > 0 ? wantDir() : DIR, oneWay = wd0 === 'P', wd = oneWay ? DIR : wd0;
    if (want > 0 && wd !== DIR) { if (!wasWant) { wasWant = want; setDir(wd, 'push'); return; } if (!pend || pend.d !== wd) pend = { d: wd, t: now }; else if (now - pend.t >= 400) { pend = null; wasWant = want; setDir(wd, 'hold'); return; } } else pend = null;
    wasWant = want;
    const atEnd = DIR === 'F' ? (clip && p >= clip.hi - 0.3) : (clip && p <= Math.max(clip.lo, clip.id === 'main' ? LO : 0) + 0.3);
    if (want > 0 && (atEnd || oneWay)) { if (!v.paused) v.pause(); $('status').textContent = oneWay ? 'This riverside path only plays one way: turn around to walk on' : DIR === 'F' ? 'End of this street: tap the mini-map or Explore to continue' : hintDone ? '' : 'Start of the walk: turn to the bridge across the canal and push to go there'; }
    else if (want > 0) { const r = Math.max(0.5, Math.min(1, want)); if (v.playbackRate !== r) v.playbackRate = r; if (v.paused) v.play().catch(e => log('play ' + e.name)); $('status').textContent = ''; if (Math.abs(p - LO) > 1) hintDone = true; }
    else if (want === 0 && idleT > 1.5 && $('status').textContent) $('status').textContent = '';
    else if (!v.paused) v.pause();
    if (want === 0) { idleT += dt; if (idleT > 0.6) park(); } else idleT = 0;
    soundTick(want > 0 && !v.paused, p);
    if (!v.paused && DIR === 'F') checkJunction(p);
    if (!seeking) { if (DIR === 'F' && p < lastPos - 0.5) log('BACKSTEP ' + lastPos.toFixed(2) + '>' + p.toFixed(2)); if (DIR === 'R' && p > lastPos + 0.5) log('REVSTEP ' + lastPos.toFixed(2) + '>' + p.toFixed(2)); lastPos = p; }
    const h = headAt(p); const d = Math.atan2(Math.sin(h - hd), Math.cos(h - hd)); if (!v.paused) hd += Math.max(-0.35 * dt, Math.min(0.35 * dt, d * Math.min(1, dt * 0.8))); /* w39: freeze camera heading while stopped */
    if (now - (window.__mmT || 0) > 200) { window.__mmT = now; drawMap(); } }
  camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw + hd, 0, 'YXZ'));
  renderer.render(scene, camera); });

// ---------- w31 debug line (?debug=1, or tap the version label 3 times) ----------
const dbgEl = document.createElement('div'); dbgEl.id = 'dbg'; dbgEl.style.cssText = 'position:fixed;left:8px;right:136px;top:calc(env(safe-area-inset-top) + 76px);font:11px ui-monospace,Menlo,monospace;background:rgba(0,0,0,.65);padding:3px 6px;border-radius:6px;white-space:pre-wrap;pointer-events:none'; dbgEl.hidden = params.get('debug') !== '1'; document.body.appendChild(dbgEl);
{ let n = 0, t = 0; $('ver').style.pointerEvents = 'auto'; $('ver').addEventListener('pointerdown', e => { e.stopPropagation(); const now = performance.now(); n = now - t < 600 ? n + 1 : 1; t = now; if (n >= 3) { n = 0; dbgEl.hidden = !dbgEl.hidden; } }, true); }
const deg = r => Math.round(wrap(r) * 180 / Math.PI);
setInterval(() => { if (dbgEl.hidden || !v) return; const p = pos(); dbgEl.textContent = `${VER} ${clip ? clip.id : '-'} t=${p.toFixed(1)} dir=${DIR}${RD ? '' : '(noR)'} travel=${deg(headAt(p))} look=${deg(look.yaw + hd)} rel=${deg(relYaw())} pitch=${Math.round(look.pitch * 180 / Math.PI)} nadir=${NADIR.on ? 'on' : 'off'} disc=${discOk ? discCol.join('/') : 'nosample'} br=${inGapZone() ? deg(wrap(look.yaw + hd - gapPsi(p))) : '-'} hls=${st.F.hls ? 'js' : 'native'} stick=${joy.x.toFixed(2)}/${joy.y.toFixed(2)} back=${joyBack() ? 'yes' : 'no'} snd=${soundOn ? (audio.paused ? 'on-paused' : 'on-playing') : 'muted'} ${(v.videoWidth || 0)}p ttff=${window.__ttff ? Math.round(window.__ttff) : '-'}ms`; }, 250);

// ---------- boot ----------
const T0 = performance.now();
(async () => { try {
  const j = await (await fetch(A + 'walk.json', { cache: 'no-cache' })).json(); const c = j.cdn;
  const url = c.base + (isIOS ? (params.get('q') === '4k' ? c.hlsIOS : c.hlsIOS.replace('f3840', 'f2560')) : c.hls); /* w31: iPhone starts on 2560x1280 (~4.5 Mbit/s) instead of 4K (~11 Mbit/s); ?q=4k keeps 4K */
  const r = await (await fetch(ROOT + 'routes.json', { cache: 'no-cache' })).json(); const route = r.routes[0]; clips = route.clips; junctions = (route.junctions || []).filter(x => (x.dir || 1) > 0); clip = clips[0];
  fetch(A + 'heading_foe.json').then(x => x.json()).then(h => { HEAD = h; hd = headAt(Math.max(pos(), c.lo || 0)); buildPath(); }).catch(() => {});
  audio.src = c.audio;
  if (!(await probe(url))) throw new Error('The video stream is not reachable. Check the connection and reload.');
  D = c.duration; LO = c.lo || 0; /* 0..lo is the still intro: walking back stops there */ window.__src = 'r2'; $('pos').min = clips[0].lo; $('pos').max = clips[0].hi;
  const t0 = +(params.get('t') || c.lo || clips[0].lo); attach(st.F, url, t0);
  await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('Video took too long to load.')), 45000); st.F.v.addEventListener('loadedmetadata', () => { clearTimeout(to); res(); }, { once: true }); });
  await seekTo(t0);
  mat.map = tex; mat.needsUpdate = true; ready = true; document.body.classList.remove('loading'); $('loader').hidden = true; log('ready');
  window.__ttff = performance.now() - T0; log('ttff ' + Math.round(window.__ttff) + 'ms');
  /* w31: the reversed stream used to start downloading at once, competing with the forward stream; now it waits for the first push or 6 s */
  /* w34: the reversed stream (hls13/r2560) is never attached or played: reversed footage shows people walking backwards. Facing back + push = turnaround (or a real opposite-way clip). */
} catch (e) { $('error').hidden = false; $('error').textContent = e.message; log('error ' + e.message); } })();

window.__w = { ver: VER, dbg: () => { const b = v.buffered, r = []; for (let i = 0; i < b.length; i++) r.push([+b.start(i).toFixed(2), +b.end(i).toFixed(2)]); return { ct: v.currentTime, rs: v.readyState, ns: v.networkState, paused: v.paused, seeking: v.seeking, buf: r, err: v.error && v.error.code }; }, state: () => ({ pos: pos(), D, rate: v.playbackRate, playing: !v.paused, ready, clip: clip && clip.id, hd, lookYaw: look.yaw, pitch: look.pitch, src: v.currentSrc || (st[DIR].hls && 'hls.js'), dir: DIR, swapping, rd: RD }),
  jump, turnaround, joyBack: () => joyBack(), joyAng: () => joyAng(), goPlace, places: PLACES, turnBusy: () => turnBusy, setLook: (deg, p) => { look.yaw = deg * Math.PI / 180; if (p != null) look.pitch = p * Math.PI / 180; }, key: (k, on) => { keys[k] = on; }, joy: () => ({ ...joy }), vids: () => document.querySelectorAll('video').length, switches: () => switches.slice(), wantDir: () => wantDir(), relYaw: () => relYaw() * 180 / Math.PI, rs: () => ({ F: [st.F.v.readyState, +st.F.v.currentTime.toFixed(2), st.F.v.paused], R: [st.R.v.readyState, +st.R.v.currentTime.toFixed(2), st.R.v.paused] }),
  headAt, mapXY, mmTap: t => { const p = mapXY(t); const r = mm.getBoundingClientRect(); return p && { x: r.left + p[1] * r.width / 120, y: r.top + p[2] * r.height / 120 }; }, audio: () => ({ paused: audio.paused, vol: audio.volume, on: soundOn }), ttff: () => window.__ttff, nadir: NADIR, bridgeT: BRIDGE_T, gapT: GAP_T, gapPsi: p => gapPsi(p == null ? pos() : p) * 180 / Math.PI, hintDone: () => hintDone, facingBridge: () => facingBridge(), gapJumps: 0, lastJump: null, lastJunction: null };
