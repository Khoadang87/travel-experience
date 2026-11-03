/* t1 (Taipei Ximending): w51 engine/design on 3 real night walks, 20 frame-matched links (evidence qa/taipei/ev_*.jpg).
   w51 = w50 design + w50a crossfade + w50c walk-back, plus: 3 more real junctions found by frame matching inside hls13
   (covered bridge visited twice, walk end returns to the start square), landmark-aligned crossfade on those, and a mini-map
   dead-reckoned from camera yaw + optical-flow heading, loop-closed at the real junctions (approximate, not GPS).
   w50: real footage only. New premium UI, place picker with real thumbnails, filmed-path arrows (junction graph of hls13: main walk + riverside branch),
   'Not filmed yet' markers/cards for side openings with no footage, edge notice when pushing off the filmed path, mini-map (filmed = solid, unfilmed = grey dashes).
   No zoom, no look-inside. Flags via window.W50: xfade (w50a: 0.5 s heading-matched crossfade), rev (w50c: walk back on time-reversed real footage).
   Engine (video, seek, stick, sound) copied from w42k. */
import * as THREE from 'three';
window.__w = {};
const CFG = window.W50 || {}; const VER = CFG.ver || 't1';
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
  if (!el.canPlayType('application/vnd.apple.mpegurl') && window.Hls && Hls.isSupported()) { /* native HLS where the browser has it (iPhone Safari), hls.js elsewhere */ const h = s.hls = new Hls({ startLevel: 0, startPosition: t, abrEwmaDefaultEstimate: 3e6, maxBufferLength: s.id === DIR ? 12 : 4, maxMaxBufferLength: 24, backBufferLength: 8, startFragPrefetch: true, enableWorker: true }); h.on(Hls.Events.FRAG_LOADING, () => { netBusy++; }); for (const e of [Hls.Events.FRAG_LOADED, Hls.Events.FRAG_LOAD_EMERGENCY_ABORTED]) h.on(e, () => { netBusy = Math.max(0, netBusy - 1); }); h.on(Hls.Events.ERROR, (_, d) => { if (d.details && /frag/i.test(d.details)) netBusy = Math.max(0, netBusy - 1); }); h.loadSource(url); h.attachMedia(el);
    h.on(Hls.Events.ERROR, (_, d) => { if (!d.fatal) return; log('hls fatal ' + s.id + ' ' + d.type + ' ' + d.details); if (d.type === Hls.ErrorTypes.MEDIA_ERROR) h.recoverMediaError(); else if (d.type === Hls.ErrorTypes.NETWORK_ERROR) h.startLoad(); }); }
  else { el.src = url + '#t=' + t; }
}
const media = (id, t) => id === 'F' ? t : RD - t; /* forward time -> that stream's own time */
const pos = () => DIR === 'F' ? st.F.v.currentTime : RD - st.R.v.currentTime; /* always FORWARD time */
let seeking = null;
const once = (el, ev, ms) => new Promise(res => { const f = () => { clearTimeout(to); el.removeEventListener(ev, f); res(true); }; const to = setTimeout(() => { el.removeEventListener(ev, f); res(false); }, ms); el.addEventListener(ev, f); });
let netBusy = 0, slowNet = false;
/* w51: wait for ev, but keep waiting (up to cap) while bytes are still arriving, so a slow link is not mistaken for a stuck seek */
const onceP = (el, ev, ms, cap) => new Promise(res => { let last = Date.now(); const t0 = last, pg = () => { last = Date.now(); }, f = () => { done(true); }, done = r => { clearInterval(iv); el.removeEventListener(ev, f); el.removeEventListener('progress', pg); res(r); }; const iv = setInterval(() => { const n = Date.now(); if (netBusy > 0) last = n; if (n - last > ms || n - t0 > cap) done(false); }, 250); el.addEventListener(ev, f); el.addEventListener('progress', pg); });
/* seek stream s to ITS OWN media time m (with the w27 WebKit retry/re-attach logic) */
async function seekS(s, m) { const el0 = s.v; el0.pause(); m = Math.max(0, Math.min((s.id === 'F' ? D : RD) - 0.2, m)); log('seek ' + s.id + ' ' + m.toFixed(1));
  if (s.v.readyState < 2) await onceP(s.v, 'loadeddata', 8000, 40000); /* WebKit leaves a seek issued before the first decoded data pending forever */
  if (Math.abs(s.v.currentTime - m) < 0.04 && !s.v.seeking) return true;
  for (let k = 0; k < 5; k++) { const el = s.v, p = onceP(el, 'seeked', 3000, 30000); el.currentTime = m + k * 0.1; /* step off a part boundary on retries */ if (await p) return true; log('seek stuck ' + s.id + ', retry ' + (k + 1) + ' rs' + el.readyState);
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
let stallMsg = false;
const fwdAhead = () => { const b = v.buffered, t = v.currentTime; for (let i = 0; i < b.length; i++) if (b.start(i) <= t + 0.1 && b.end(i) > t) return b.end(i) - t; return 0; };
const keys = {}; addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Escape') closeCards(); }); addEventListener('keyup', e => { keys[e.code] = false; });
const look = { yaw: 0, pitch: 0, drag: null };
function joyStart(e) { if (joy.id != null) return; joyEl.setPointerCapture?.(e.pointerId); const r = joyEl.getBoundingClientRect(); joy.id = e.pointerId; joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joyMove(e); }
function joyMove(e) { const R = joyEl.offsetWidth / 2 || 60; let dx = (e.clientX - joy.cx) / R, dy = (e.clientY - joy.cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } joy.x = dx; joy.y = dy; knob.style.transform = `translate(${dx * R * 0.6}px,${dy * R * 0.6}px)`; }
function joyEnd() { joy.nextBack = 0; if (joy.id != null && joyEl.hasPointerCapture?.(joy.id)) joyEl.releasePointerCapture(joy.id); joy.id = null; joy.backDone = false; joy.x = joy.y = 0; knob.style.transform = ''; }
const inJoy = e => { const r = joyEl.getBoundingClientRect(); return e.clientX >= r.left - 16 && e.clientX <= r.right + 16 && e.clientY >= r.top - 16 && e.clientY <= r.bottom + 16; };
addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('button,a,#explore,#places,#minimap,input')) return; if (joy.id == null && inJoy(e)) { joyStart(e); e.preventDefault(); return; } if (look.drag == null) look.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; }, { capture: true, passive: false });
addEventListener('pointermove', e => { if (e.pointerId === joy.id) { joyMove(e); return; } const d = look.drag; if (d && d.id === e.pointerId) { const k = 1.6 * (camera.fov * Math.PI / 180) / innerHeight; look.yaw += (e.clientX - d.x) * k; look.pitch = Math.max(-1.55, Math.min(1.55, look.pitch + (e.clientY - d.y) * k)); d.x = e.clientX; d.y = e.clientY; } }, { capture: true });
const up = e => { if (e.pointerId === joy.id) joyEnd(); if (look.drag && look.drag.id === e.pointerId) look.drag = null; };
addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
joyEl.addEventListener('lostpointercapture', up);
addEventListener('blur', () => { joyEnd(); look.drag = null; for (const k of Object.keys(keys)) keys[k] = false; });

// stick -> speed (0 or 0.5..1). Direction comes from where you look, not from the stick.
const joyAng = () => Math.atan2(joy.x, -joy.y) * 180 / Math.PI; /* 0 = stick up, +-180 = pulled back */
const joyBack = () => joy.id != null && Math.hypot(joy.x, joy.y) >= 0.22 && joy.y > 0.1 && Math.abs(joyAng()) > 100; /* w60: any downward drag past the deadzone */
const speed = () => { if (keys.ArrowUp || keys.KeyW) return 1; if (joy.id == null) return 0;
  const m = Math.hypot(joy.x, joy.y); if (joyBack()) return 0; /* w36: pulled back = turnaround first, then forward while held */
  const u = -joy.y; if (u < 0.2) return 0; return 0.5 + 0.5 * Math.min(1, (u - 0.2) / 0.65); };
const joyTurn = () => { if (joy.id == null || joyBack()) return 0; const x = joy.x; return Math.abs(x) < 0.3 ? 0 : Math.sign(x) * (Math.abs(x) - 0.3) / 0.7; }; /* w36: sideways = turn the view (up to 70 deg/s) */

// ---------- sound (footage audio track, separate file) ----------
/* w31: sound plays only while you walk (paused when you stop); the 🔊/🔇 button mutes it and the choice is remembered (localStorage). iOS: unlocked on the first touch. */
const audio = new Audio(); audio.loop = false; audio.crossOrigin = 'anonymous'; audio.preload = 'none'; /* w31: the 19 MB ambience file no longer downloads during the first load; it streams once you walk */
const SK = 'taipeiSound'; let soundOn = (() => { try { return localStorage.getItem(SK) !== 'off'; } catch (e) { return true; } })(); let unlocked = false;
const sndUI = () => { $('sound').innerHTML = soundOn ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>'; $('sound').setAttribute('aria-label', soundOn ? 'Sound on, tap to mute' : 'Sound off, tap to unmute'); $('sound').setAttribute('aria-pressed', String(soundOn)); };
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

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), D2R = Math.PI / 180;
let hd = 0, rate = 0, last = performance.now(), lastPos = 0, idleT = 0, aligning = false, fading = false, lastAct = '-';
const relYaw = () => wrap(look.yaw + hd - headAt(pos()));
const REV = !!CFG.rev; let revOn = false; /* true once the reversed stream is attached */
/* travel axis you are closest to: forward, or (w50c) backward along the same filmed street */
const relPath = () => { const r = relYaw(); return revOn && clip && Math.abs(r) > Math.PI / 2 ? wrap(r - Math.PI) : r; };

// ---------- transitions: w50 = short dip; w50a = 0.5 s crossfade with the old frame rotated so both travel directions line up ----------
const snapCv = document.createElement('canvas'); snapCv.width = 2048; snapCv.height = 1024; const snapCtx = snapCv.getContext('2d');
const snapTex = new THREE.CanvasTexture(snapCv); snapTex.colorSpace = THREE.SRGBColorSpace;
const snapGeo = new THREE.SphereGeometry(48, 96, 48); snapGeo.scale(-1, 1, 1);
const snap = new THREE.Mesh(snapGeo, new THREE.MeshBasicMaterial({ map: snapTex, transparent: true, opacity: 0, depthTest: false, depthWrite: false })); snap.renderOrder = 5; snap.visible = false; scene.add(snap);
const dip = $('dip');
async function go(t, why, shift) { if (fading || !ready) return; fading = true; const r0 = relYaw(), h0 = headAt(pos()); let snapped = false; lastAct = 'go ' + why;
  try { if (CFG.xfade && v.readyState >= 2) { try { snapCtx.drawImage(v, 0, 0, 2048, 1024); snapTex.needsUpdate = true; snapped = true; } catch (e) { log('snap ' + e.name); } }
    if (snapped) { snap.visible = true; snap.material.opacity = 1; snap.rotation.y = 0; } else { dip.classList.add('on'); await new Promise(r => setTimeout(r, 280)); }
    await jump(t); const h1 = headAt(pos());
    /* heading match: keep your angle to the direction of travel */
    if (shift != null) { look.yaw = wrap(r0 + h0 + shift - h1); hd = h1; if (snapped) snap.rotation.y = shift; } /* w51: same place filmed twice, keep landmarks where they were */
    else { look.yaw = r0; hd = h1; if (snapped) snap.rotation.y = h1 - h0; }
    window.__w.lastGo = { t, why, landed: pos(), snapped }; if (!why.startsWith('place')) { const q = PLACES.slice().sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0]; $('where').textContent = q && Math.abs(q.t - t) < 60 ? 'Near ' + q.name : 'Ximending streets'; }
    if (snapped) { await new Promise(r => setTimeout(r, 60)); const T = 500, s0 = performance.now(); await new Promise(res => { const st = () => { const k = Math.min(1, (performance.now() - s0) / T); snap.material.opacity = 1 - k * k * (3 - 2 * k); k < 1 ? requestAnimationFrame(st) : res(); }; st(); }); snap.visible = false; }
    else dip.classList.remove('on');
  } finally { fading = false; } }

// ---------- filmed graph ----------
/* Filmed exits (real footage on both sides): forward along the walk, the riverside branch, and its rejoin point. w51 adds three same-place revisits found by frame matching. */
const EXITS = [
  { id: 'j0a', clip: 'ftn', t0: 850, t1: 858, rot: -19.7, label: "Other filmed street (walk 2)", to: 2086 },
  { id: 'j0b', clip: 'o3w', t0: 2082, t1: 2090, rot: 19.7, label: "Toward Pedestrian street (walk 1)", to: 854 },
  { id: 'j1a', clip: 'ftn', t0: 784, t1: 792, rot: -83.0, label: "Other filmed street (walk 2)", to: 2030 },
  { id: 'j1b', clip: 'o3w', t0: 2026, t1: 2034, rot: 83.0, label: "Toward Pedestrian street (walk 1)", to: 788 },
  { id: 'j2a', clip: 'ftn', t0: 1112, t1: 1120, rot: 136.5, label: "Other filmed street (walk 2)", to: 2714 },
  { id: 'j2b', clip: 'o3w', t0: 2710, t1: 2718, rot: -136.5, label: "Toward Street-food stalls (walk 1)", to: 1116 },
  { id: 'j3a', clip: 'ftn', t0: 634, t1: 642, rot: 172.6, label: "Other filmed street (walk 2)", to: 2718 },
  { id: 'j3b', clip: 'o3w', t0: 2714, t1: 2722, rot: -172.6, label: "Other filmed street (walk 1)", to: 638 },
  { id: 'j4a', clip: 'ftn', t0: 1374, t1: 1382, rot: 14.6, label: "Other filmed street (walk 2)", to: 2736 },
  { id: 'j4b', clip: 'o3w', t0: 2732, t1: 2740, rot: -14.6, label: "Other filmed street (walk 1)", to: 1378 },
  { id: 'j5a', clip: 'ftn', t0: 294, t1: 302, rot: -52.1, label: "Other filmed street (walk 2)", to: 2992 },
  { id: 'j5b', clip: 'o3w', t0: 2988, t1: 2996, rot: 52.1, label: "Toward Covered mural arcade (walk 1)", to: 298 },
  { id: 'j6a', clip: 'ftn', t0: 544, t1: 552, rot: -11.3, label: "Toward Street of lights (walk 2)", to: 1874 },
  { id: 'j6b', clip: 'o3w', t0: 1870, t1: 1878, rot: 11.3, label: "Toward Big-brand corner (walk 1)", to: 548 },
  { id: 'j7a', clip: 'ftn', t0: 1350, t1: 1358, rot: -152.2, label: "Toward Street of lights (walk 2)", to: 1874 },
  { id: 'j7b', clip: 'o3w', t0: 1870, t1: 1878, rot: 152.2, label: "Other filmed street (walk 1)", to: 1354 },
  { id: 'j8a', clip: 'ftn', t0: 1516, t1: 1524, rot: 78.0, label: "Toward Street of lights (walk 2)", to: 1972 },
  { id: 'j8b', clip: 'o3w', t0: 1968, t1: 1976, rot: -78.0, label: "Toward Tree-lined walking street (walk 1)", to: 1520 },
  { id: 'j9a', clip: 'ftn', t0: 1062, t1: 1070, rot: -30.1, label: "Toward Street of lights (walk 2)", to: 1974 },
  { id: 'j9b', clip: 'o3w', t0: 1970, t1: 1978, rot: 30.1, label: "Toward Shop-lined arcade (walk 1)", to: 1066 },
  { id: 'j10a', clip: 'ftn', t0: 1428, t1: 1436, rot: 37.8, label: "Toward Big-screen junction (walk 3)", to: 3102 },
  { id: 'j10b', clip: 'vwb', t0: 3098, t1: 3106, rot: -37.8, label: "Other filmed street (walk 1)", to: 1432 },
  { id: 'j11a', clip: 'ftn', t0: 460, t1: 468, rot: -87.3, label: "Toward Big-screen junction (walk 2)", to: 3076 },
  { id: 'j11b', clip: 'o3w', t0: 3072, t1: 3080, rot: 87.3, label: "Toward Rainbow crosswalk (walk 1)", to: 464 },
  { id: 'j12a', clip: 'ftn', t0: 1590, t1: 1598, rot: -90.3, label: "Other filmed street (walk 2)", to: 2654 },
  { id: 'j12b', clip: 'o3w', t0: 2650, t1: 2658, rot: 90.3, label: "Toward Tree-lined walking street (walk 1)", to: 1594 },
  { id: 'j13a', clip: 'ftn', t0: 726, t1: 734, rot: 140.2, label: "Other filmed street (walk 2)", to: 2656 },
  { id: 'j13b', clip: 'o3w', t0: 2652, t1: 2660, rot: -140.2, label: "Other filmed street (walk 1)", to: 730 },
  { id: 'j14a', clip: 'ftn', t0: 524, t1: 532, rot: 146.9, label: "Toward Shoe-store street (walk 3)", to: 3244 },
  { id: 'j14b', clip: 'vwb', t0: 3240, t1: 3248, rot: -146.9, label: "Toward Big-brand corner (walk 1)", to: 528 },
  { id: 'j15a', clip: 'ftn', t0: 1276, t1: 1284, rot: -126.1, label: "Toward Street of lights (walk 2)", to: 1822 },
  { id: 'j15b', clip: 'o3w', t0: 1818, t1: 1826, rot: 126.1, label: "Other filmed street (walk 1)", to: 1280 },
  { id: 'j16a', clip: 'ftn', t0: 814, t1: 822, rot: -61.7, label: "Toward Sports-store corner (walk 2)", to: 2588 },
  { id: 'j16b', clip: 'o3w', t0: 2584, t1: 2592, rot: 61.7, label: "Toward Pedestrian street (walk 1)", to: 818 },
  { id: 'j17a', clip: 'ftn', t0: 634, t1: 642, rot: 20.5, label: "Toward Street-food stalls (walk 1)", to: 1118 },
  { id: 'j17b', clip: 'ftn', t0: 1114, t1: 1122, rot: -20.5, label: "Other filmed street (walk 1)", to: 638 },
  { id: 'j18a', clip: 'ftn', t0: 544, t1: 552, rot: 143.0, label: "Other filmed street (walk 1)", to: 1354 },
  { id: 'j18b', clip: 'ftn', t0: 1350, t1: 1358, rot: -143.0, label: "Toward Big-brand corner (walk 1)", to: 548 },
  { id: 'j19a', clip: 'ftn', t0: 1062, t1: 1070, rot: -126.7, label: "Toward Tree-lined walking street (walk 1)", to: 1518 },
  { id: 'j19b', clip: 'ftn', t0: 1514, t1: 1522, rot: 126.7, label: "Toward Shop-lined arcade (walk 1)", to: 1066 } ];
/* Openings beside the walk that nobody filmed going in (bearings measured on rendered frames for w42i). */
const UNFILMED = []; /* t1: no side openings marked yet; pushing off a filmed path shows the edge notice */
const bAt = (b, p) => { if (typeof b === 'number') return b; if (p <= b[0][0]) return b[0][1]; for (let k = 1; k < b.length; k++) if (p <= b[k][0]) { const [t0, d0] = b[k - 1], [t1, d1] = b[k]; return d0 + (d1 - d0) * (p - t0) / (t1 - t0); } return b[b.length - 1][1]; };
const dirOf = (x, p) => x.rot != null ? headAt(x.to) + x.rot * D2R : headAt(p) + bAt(x.b, p) * D2R; /* rot exits: the target walk's forward direction, seen in this frame */ const offOf = (x, p) => Math.abs(wrap(look.yaw + hd - dirOf(x, p)));
const _v3 = new THREE.Vector3();
const scr = a => { _v3.set(-Math.sin(a), 0, -Math.cos(a)).project(camera); const behind = _v3.z > 1; return { x: (_v3.x + 1) / 2 * innerWidth, on: !behind && Math.abs(_v3.x) < 0.85, side: behind ? -Math.sign(_v3.x || 1) : Math.sign(_v3.x) }; };
const live = (x, p) => (!x.clip || (clip && clip.id === x.clip)) && p >= x.t0 && p <= x.t1;
const mkMarker = (x, cls, txt, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'mk ' + cls; b.innerHTML = txt; b.hidden = true; b.onclick = fn; $('marks').appendChild(b); return b; };
const exEls = EXITS.map(x => mkMarker(x, 'filmed', '<i>↗</i><span>' + x.label + '</span>', () => takeExit(x)));
const nfEls = UNFILMED.map(x => mkMarker(x, 'unfilmed', '<i></i><span>' + x.label + '<small>Not accessible right now, coming soon</small></span>', () => showNF(x)));
const fwdEl = mkMarker({}, 'ahead', '<i>↑</i>', () => {}); fwdEl.tabIndex = -1; fwdEl.setAttribute('aria-label', 'Hold to walk forward'); fwdEl.style.touchAction = 'none';
{ const on = e => { e.preventDefault(); e.stopPropagation(); keys.ArrowUp = true; try { fwdEl.setPointerCapture(e.pointerId); } catch (_) {} }, off = () => { keys.ArrowUp = false; }; fwdEl.addEventListener('pointerdown', on); for (const n of ['pointerup', 'pointercancel', 'lostpointercapture']) fwdEl.addEventListener(n, off); }
function takeExit(x) { if (fading) return; window.__w.exits = (window.__w.exits || 0) + 1; log('exit ' + x.id); go(x.to, 'exit ' + x.id, x.rot != null ? -x.rot * D2R : null); }
function placeMarkers() { if (!ready || !clip) return; const p = pos(), card = !$('nf').hidden || !$('places').hidden;
  const put = (el, a, show, y) => { const s = scr(a); show = show && s.on && !card; el.hidden = !show; if (show) { el.style.left = Math.max(70, Math.min(innerWidth - 70, s.x)) + 'px'; el.style.top = y + 'px'; } };
  EXITS.forEach((x, i) => put(exEls[i], dirOf(x, p), live(x, p) && offOf(x, p) < 70 * D2R, innerHeight * 0.5));
  UNFILMED.forEach((x, i) => put(nfEls[i], dirOf(x, p), live(x, p) && offOf(x, p) < 60 * D2R, innerHeight * (0.40 + 0.07 * i)));
  put(fwdEl, headAt(p) + (revOn && DIR === 'R' ? Math.PI : 0), !v.seeking && Math.abs(relPath()) < 50 * D2R && !(clip && p >= clip.hi - 1), innerHeight * 0.66); }
setInterval(placeMarkers, 80);
const exitAhead = p => EXITS.find(x => live(x, p) && offOf(x, p) < 25 * D2R && Math.abs(relYaw()) > 15 * D2R);
const nfAhead = p => UNFILMED.find(x => live(x, p) && offOf(x, p) < 25 * D2R && Math.abs(relYaw()) > 20 * D2R);

// ---------- cards ----------
function showNF(x) { joyEnd(); if (!v.paused) v.pause(); $('nf-title').textContent = x.label; $('nf').hidden = false; window.__w.nfShown = x.id; lastAct = 'not filmed ' + x.id; }
function closeCards() { $('nf').hidden = true; }
function faceStreet() { closeCards(); const r = relPath(), y0 = look.yaw, s0 = performance.now(); const st = () => { const k = Math.min(1, (performance.now() - s0) / 450), e = 1 - (1 - k) ** 3; look.yaw = y0 - r * e; if (k < 1) requestAnimationFrame(st); }; st(); }
$('nf-back').onclick = faceStreet; $('nf-x').onclick = closeCards; $('nf-places').onclick = () => { closeCards(); openPlaces(); };

// ---------- places ----------
const PLACES = [
  { id: 'start', name: "Bronze-statue plaza", area: "Start of the night walk", t: 5, fwd: 1 },
  { id: 'terrace', name: "Caf\u00e9 terrace", area: "Lanterns and umbrellas", t: 200, fwd: 1 },
  { id: 'arcade', name: "Covered mural arcade", area: "Under cover", t: 298, fwd: 1 },
  { id: 'rainbow', name: "Rainbow crosswalk", area: "Ximending landmark", t: 464, fwd: 1 },
  { id: 'plaza', name: "Big-brand corner", area: "Wide pedestrian plaza", t: 548, fwd: 1 },
  { id: 'walkst', name: "Pedestrian street", area: "Lights and crowds", t: 854, fwd: 1 },
  { id: 'shoparcade', name: "Shop-lined arcade", area: "Pink shopfronts", t: 1066, fwd: 1 },
  { id: 'food', name: "Street-food stalls", area: "Busy junction", t: 1116, fwd: 1 },
  { id: 'trees', name: "Tree-lined walking street", area: "Second loop", t: 1594, fwd: 1 },
  { id: 'lights', name: "Street of lights", area: "Second walker", t: 1900, fwd: 1 },
  { id: 'backst', name: "Quiet back street", area: "Away from the crowds", t: 2200, fwd: 1 },
  { id: 'corner', name: "Sports-store corner", area: "Wide junction", t: 2500, fwd: 1 },
  { id: 'screens', name: "Big-screen junction", area: "Third walker", t: 3102, fwd: 1 },
  { id: 'shoes', name: "Shoe-store street", area: "Neon signs", t: 3244, fwd: 1 } ];
let placeBusy = false, here = 'start';
async function goPlace(id) { const pl = PLACES.find(x => x.id === id); if (!pl || placeBusy) return; placeBusy = true; closePlaces(); while (!ready) await new Promise(r => setTimeout(r, 100));
  try { const t = pl.t == null ? LO : pl.t; await go(t, 'place ' + id); if (pl.u != null) look.yaw = wrap(2 * Math.PI * (0.75 - pl.u) - hd); else look.yaw = 0; look.pitch = 0; here = id; $('where').textContent = pl.name; window.__w.place = { id, t, at: pos() }; } finally { placeBusy = false; } }
$('grid').innerHTML = PLACES.map((p, i) => `<button type="button" class="card" data-place="${p.id}"><img src="t1/thumbs/${p.id}.jpg" alt="" loading="${i < 6 ? 'eager' : 'lazy'}" width="240" height="180"><span><b>${p.name}</b><small>${p.area}</small></span></button>`).join('');
$('grid').addEventListener('click', e => { const b = e.target.closest('[data-place]'); if (b) goPlace(b.dataset.place); });
function openPlaces() { closeCards(); joyEnd(); $('places').hidden = false; document.body.classList.add('picking'); }
function closePlaces() { $('places').hidden = true; document.body.classList.remove('picking'); }
$('where-btn').onclick = openPlaces; $('places-x').onclick = closePlaces;
if (params.get('places') === '0' || params.get('t')) closePlaces(); else openPlaces();

// ---------- mini-map (w51): shape from w50/path-w51.json = camera yaw (frame-to-frame phase correlation) + optical-flow heading,
// integrated and loop-closed at the real junctions. Approximate (dead reckoning, no GPS). Solid = filmed, green rings = real junctions,
// grey dashes = openings nobody filmed. ----------
const mm = $('minimap'), mctx = mm.getContext('2d'); let MP = null;
fetch('t1/path-t1.json?v=1').then(r => r.json()).then(j => { MP = j.pts; window.__w.mapPts = MP.length; drawMap(); }).catch(e => log('map ' + e.message));
const mpAt = t => { if (!MP) return null; let lo = 0, hi = MP.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (MP[m][0] < t) lo = m + 1; else hi = m; } const q = MP[lo], r = MP[Math.max(0, lo - 1)]; if (!r || q[0] === r[0] || t >= q[0]) return q; if (q[0] - r[0] > 1.5 || clips.some(c => r[0] <= c.hi && q[0] >= c.hi)) return t - r[0] < q[0] - t ? r : q; /* gap between main end and riverside start */ const f = (t - r[0]) / (q[0] - r[0]); return [t, r[1] + (q[1] - r[1]) * f, r[2] + (q[2] - r[2]) * f, q[3]]; };
function drawMap() { if (!MP) return; const W = 120; mctx.clearRect(0, 0, W, W);
  const seg = (lo, hi) => MP.filter(q => q[0] >= lo && q[0] <= hi);
  const line = (P, col, w, dash) => { mctx.setLineDash(dash || []); mctx.strokeStyle = col; mctx.lineWidth = w; mctx.lineCap = 'round'; mctx.lineJoin = 'round'; mctx.beginPath(); P.forEach(([, x, y], i) => i ? mctx.lineTo(x, y) : mctx.moveTo(x, y)); mctx.stroke(); };
  for (const u of UNFILMED) { const m = (u.t0 + u.t1) / 2, c = mpAt(m); if (!c) continue; const d = c[3] - bAt(u.b, m) * D2R; line([[0, c[1], c[2]], [0, c[1] + Math.sin(d) * 10, c[2] - Math.cos(d) * 10]], 'rgba(200,200,200,.6)', 2, [2, 3]); }
  line(seg(0, 1799.5), 'rgba(244,236,223,.9)', 2); line(seg(1800, 3085.5), 'rgba(224,165,38,.95)', 2); line(seg(3086, 3348), 'rgba(120,200,255,.95)', 2);
  for (const x of EXITS) { const c = mpAt(x.to); if (!c) continue; mctx.setLineDash([]); mctx.strokeStyle = '#5fd18a'; mctx.lineWidth = 1.6; mctx.beginPath(); mctx.arc(c[1], c[2], 3.6, 0, 7); mctx.stroke(); }
  if (!ready) return; const p = pos(), c = mpAt(p); if (!c) return;
  const va = c[3] - relYaw(); mctx.setLineDash([]); mctx.fillStyle = 'rgba(184,50,42,.3)'; mctx.beginPath(); mctx.moveTo(c[1], c[2]); mctx.arc(c[1], c[2], 16, va - Math.PI / 2 - 0.6, va - Math.PI / 2 + 0.6); mctx.fill();
  mctx.fillStyle = '#e0483c'; mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(c[1], c[2], 4.5, 0, 7); mctx.fill(); mctx.stroke(); }
mm.addEventListener('pointerdown', e => { e.stopPropagation(); if (!MP || !ready) return; const r = mm.getBoundingClientRect(), x = (e.clientX - r.left) * 120 / r.width, y = (e.clientY - r.top) * 120 / r.height; let best = null, bd = 1e9; for (const q of MP) { if (q[0] < LO || clips.every(c => q[0] < c.lo || q[0] > c.hi - 1)) continue; const d = (q[1] - x) ** 2 + (q[2] - y) ** 2; if (d < bd) { bd = d; best = q; } } if (best && bd < 120) go(best[0], 'map'); });

// ---------- w50c: walk back on reversed real footage ----------
if (REV) { $('turn').hidden = false; $('turn').onclick = () => { const y0 = look.yaw, s0 = performance.now(); lastAct = 'turn back'; window.__w.turnBacks = (window.__w.turnBacks || 0) + 1; const st = () => { const k = Math.min(1, (performance.now() - s0) / 600), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; look.yaw = y0 + Math.PI * e; if (k < 1) requestAnimationFrame(st); }; st(); }; }

// ---------- loop ----------
const OFF = 45 * D2R; let edgeT = 0;
const edge = (on, side) => { const el = $('edge'); if (on) { edgeT = performance.now(); el.classList.toggle('left', side < 0); el.classList.add('on'); } else if (performance.now() - edgeT > 1200) el.classList.remove('on'); };
renderer.setAnimationLoop(() => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (ready && !jumping && !swapping && !fading) { const want = $('nf').hidden && $('places').hidden ? speed() : 0; rate += (want - rate) * Math.min(1, dt * 8); if (want > 0 && v.readyState < 3 && !v.paused) { $('status').textContent = 'Loading the next stretch…'; stallMsg = true; } else if (stallMsg) { stallMsg = false; if (!$('loop-btn')) $('status').textContent = ''; }
    const p = pos(); if (clip && (p < clip.lo - 1 || p > clip.hi + 1)) clip = clipAt(p);
    { const tr = joyTurn(); if (tr) look.yaw += tr * 1.22 * dt; }
    if (want === 0) aligning = false;
    if (want > 0 && !aligning) { const x = exitAhead(p); if (x) { if (!v.paused) v.pause(); takeExit(x); return; } const n = nfAhead(p); if (n) { if (!v.paused) v.pause(); showNF(n); return; } }
    const rp = relPath();
    if (want > 0 && (Math.abs(rp) >= OFF || (aligning && Math.abs(rp) > 0.17))) { aligning = true; if (!v.paused) v.pause(); soundTick(false, p);
      look.yaw -= Math.sign(rp) * Math.min(Math.abs(rp), 1.3 * dt); edge(true, -Math.sign(rp)); lastAct = 'off-path push';
      camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw + hd, 0, 'YXZ')); renderer.render(scene, camera); return; }
    edge(false);
    const wd = revOn && clip ? (Math.abs(relYaw()) > 100 * D2R ? 'R' : Math.abs(relYaw()) < 80 * D2R ? 'F' : DIR) : 'F';
    if (want > 0 && wd !== DIR) { setDir(wd, 'push'); return; }
    const atEnd = DIR === 'F' ? (clip && p >= clip.hi - 0.3) : (clip && p <= clip.lo + 0.3);
    if (want > 0 && atEnd) { if (!v.paused) v.pause(); if (false) { const st0 = $('status'); if (!st0.querySelector('#loop-btn')) { st0.innerHTML = 'End of this filmed walk. <button id="loop-btn" class="btn pri" type="button">Round the square again</button>'; $('loop-btn').onclick = e => { e.stopPropagation(); st0.textContent = ''; const x = EXITS.find(q => q.id === 'loop-start'); window.__w.exits = (window.__w.exits || 0) + 1; log('end loop'); go(x.to, 'end loop', x.rot * -D2R); }; } } else $('status').textContent = DIR === 'F' ? 'End of the filmed street. Pick another place to keep going.' : 'Start of this filmed walk. Pick another place to keep going.'; }
    else if (want > 0) { const r = Math.max(0.5, Math.min(1, want)); if (v.playbackRate !== r) v.playbackRate = r; if (v.paused) v.play().catch(e => log('play ' + e.name)); $('status').textContent = ''; document.body.classList.add('walked'); }
    else if (!v.paused) v.pause();
    if (want === 0) { idleT += dt; if (idleT > 0.6 && revOn && fwdAhead() > 8) park(); if (idleT > 2.5 && !$('loop-btn')) $('status').textContent = ''; } else idleT = 0;
    soundTick(want > 0 && !v.paused && DIR === 'F', p);
    const h = headAt(p), d = wrap(h - hd); if (!v.paused) hd += Math.max(-0.35 * dt, Math.min(0.35 * dt, d * Math.min(1, dt * 0.8)));
    if (now - (window.__mmT || 0) > 150) { window.__mmT = now; drawMap(); } }
  camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw + hd, 0, 'YXZ'));
  renderer.render(scene, camera); });

// ---------- boot ----------
const T0 = performance.now();
(async () => { try {
  const j = await (await fetch(A + 'walk.json', { cache: 'no-cache' })).json(); const c = j.cdn;
  let url = c.base + (isIOS ? (params.get('q') === '4k' ? c.hlsIOS : c.hlsIOS.replace('f3840', 'f2560')) : c.hls);
  /* w51: native iPhone HLS gets one fixed level; time a 400 KB slice first and drop to f1280 (1.8 Mbps) on a slow link, since f2560 (6 Mbps) cannot keep up there */
  if (isIOS && url.includes('f2560') && params.get('q') !== 'hi') { try { const pl = await (await fetch(url)).text(), seg = new URL(pl.split('\n').find(l => /\.m4s/.test(l) && !/^#/.test(l)).trim(), url).href, t0 = performance.now(), rb = await (await fetch(seg, { headers: { Range: 'bytes=0-399999' } })).arrayBuffer(), mbps = rb.byteLength * 8 / ((performance.now() - t0) * 1000); log('probe ' + mbps.toFixed(1) + ' Mbps'); if (mbps < 7 || params.get('q') === 'lo') { url = url.replace('f2560', 'f1280'); slowNet = true; } } catch (e) { log('probe failed'); } }
  const r = await (await fetch(ROOT + 'routes.json', { cache: 'no-cache' })).json(); clips = r.routes[0].clips; clip = clips[0];
  fetch(A + 'heading_foe.json').then(x => x.json()).then(h => { HEAD = h; hd = headAt(Math.max(pos(), c.lo || 0)); drawMap(); }).catch(() => {});
  audio.src = c.audio;
  $('load-msg').textContent = 'Connecting to the street…';
  if (!(await probe(url))) throw new Error('The video stream is not reachable. Check the connection and reload.');
  D = c.duration; LO = Math.max(c.lo || 0, CFG.lo || 0); /* w51: start at 11 s, past the man walking close to the operator-removal patch (qa/w51/melt) */ const t0 = +(params.get('t') || LO); attach(st.F, url, t0);
  $('load-msg').textContent = 'Loading real 360° footage…';
  await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('The video took too long to load.')), 45000); st.F.v.addEventListener('loadedmetadata', () => { clearTimeout(to); res(); }, { once: true }); });
  await seekTo(t0); mat.map = tex; mat.needsUpdate = true; ready = true; document.body.classList.remove('loading'); window.__ttff = performance.now() - T0; log('ready');
  if (REV && c.rev && slowNet) log('rev skipped on slow link'); else if (REV && c.rev) { const ru = c.base + c.rev; if (await probe(ru)) { RD = c.revDuration || c.duration; attach(st.R, ru, media('R', pos())); revOn = true; log('rev attached'); } else log('rev unreachable'); }
} catch (e) { $('error').hidden = false; $('error').textContent = e.message; log('error ' + e.message); } })();
Object.assign(window.__w, { ver: VER, state: () => ({ pos: pos(), ready, clip: clip && clip.id, dir: DIR, revOn, relYaw: relYaw() / D2R, playing: !v.paused, fading }), go, goPlace, takeExit, showNF, setLook: (d, pt) => { look.yaw = d * D2R; if (pt != null) look.pitch = pt * D2R; }, key: (k, on) => { keys[k] = on; }, lastAct: () => lastAct, exits: 0, places: PLACES, headAt, ttff: () => window.__ttff, switches: () => switches.slice() });
