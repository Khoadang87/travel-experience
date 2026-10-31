/* Hội An 360 walk, clean rewrite (w27). ONE forward-only video.
   Stick UP = play forward (playbackRate 0.5..1 by push), release/DOWN = pause. Drag = look. No reverse, no look-direction logic. */
import * as THREE from 'three';
const VER = 'w27';
const $ = id => document.getElementById(id), params = new URLSearchParams(location.search);
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const A = '../assets/walk/', ROOT = '../';
const evlog = []; const log = s => { evlog.push((performance.now() / 1000).toFixed(1) + ' ' + s); if (evlog.length > 60) evlog.shift(); };
window.__evlog = evlog;
$('ver').textContent = VER;

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
$('app').appendChild(renderer.domElement); const cv = renderer.domElement;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
const geo = new THREE.SphereGeometry(50, 128, 64); geo.scale(-1, 1, 1);
const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); scene.add(new THREE.Mesh(geo, mat));
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

// ---------- data ----------
let D = 0, HEAD = null, clips = [], junctions = [], clip = null;
const headAt = p => { if (!HEAD) return 0; p = Math.max(13, p); /* 0-13 s: intro shot pinned off-street in the table */ const i = Math.min(HEAD.h.length - 1, p / HEAD.dt), a = Math.floor(i), b = Math.min(HEAD.h.length - 1, a + 1), f = i - a; return -(HEAD.h[a] * (1 - f) + HEAD.h[b] * f); };

// ---------- video ----------
let v, tex; /* one <video>; replaced (never two at once) only if WebKit wedges it */
function mkV() { const old = v; v = document.createElement('video'); v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.crossOrigin = 'anonymous'; v.preload = 'auto';
  v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1'; document.body.appendChild(v); /* WebKit/iOS only decode (and finish seeks) for a <video> that is in the document */
  { const el = v, fr = () => { if (el !== v) return; window.__frames = (window.__frames || 0) + 1; el.requestVideoFrameCallback(fr); }; if (el.requestVideoFrameCallback) el.requestVideoFrameCallback(fr); } /* keep a frame callback registered: box WebKit only completes seeks with a frame consumer */
  const ot = tex; tex = new THREE.VideoTexture(v); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false; if (ot) { if (mat.map === ot) { mat.map = tex; mat.needsUpdate = true; } ot.dispose(); } if (old) { old.pause(); old.removeAttribute('src'); old.load(); old.remove(); } }
mkV();
let ready = false, hls = null, START = 0, URL0 = '';
async function probe(url) { for (let k = 0; k < 3; k++) { try { const r = await fetch(url, { cache: k ? 'reload' : 'default' }); if (r.ok && (await r.text()).includes('#EXTM3U')) return true; } catch (e) { log('probe ' + k + ' ' + e.name); } await new Promise(r => setTimeout(r, 600 * (k + 1))); } return false; }
function attach(url, t) { URL0 = url; START = t; if (hls) { hls.destroy(); hls = null; }
  mat.map = tex; mat.needsUpdate = true; /* box WebKit only completes a seek when the video's frames are being consumed by the texture */
  if (!v.canPlayType('application/vnd.apple.mpegurl') && window.Hls && Hls.isSupported()) { /* native HLS where the browser has it (iPhone Safari), hls.js elsewhere */ hls = new Hls({ startLevel: 0, startPosition: t, abrEwmaDefaultEstimate: 3e6, maxBufferLength: 12, maxMaxBufferLength: 24, backBufferLength: 8, startFragPrefetch: true, enableWorker: true }); hls.loadSource(url); hls.attachMedia(v);
    hls.on(Hls.Events.ERROR, (_, d) => { if (!d.fatal) return; log('hls fatal ' + d.type + ' ' + d.details); if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError(); else if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad(); }); }
  else { v.src = url + '#t=' + START; }
}
const pos = () => v.currentTime;
let seeking = null;
const once = (ev, ms) => new Promise(res => { const f = () => { clearTimeout(to); v.removeEventListener(ev, f); res(true); }; const to = setTimeout(() => { v.removeEventListener(ev, f); res(false); }, ms); v.addEventListener(ev, f); });
async function seekTo(t) { v.pause(); t = Math.max(0, Math.min(D - 0.2, t)); seeking = t; log('seek ' + t.toFixed(1));
  try { if (v.readyState < 2) await once('loadeddata', 8000); /* WebKit leaves a seek issued before the first decoded data pending forever */
    if (Math.abs(v.currentTime - t) < 0.04 && !v.seeking) return;
    for (let k = 0; k < 5; k++) { const p = once('seeked', 3000); v.currentTime = t + k * 0.1; /* step off a part boundary (EXT-X-DISCONTINUITY) on retries */ if (await p) return; log('seek stuck, retry ' + (k + 1) + ' rs' + v.readyState);
      /* WebKit can lose a seek: re-attach the media pipeline (hls.js) or reload the playlist (native), then seek again */
      { if (v.readyState < 2 && k >= 1) { log('new video element at ' + t.toFixed(1)); mkV(); attach(URL0, t); await once('loadeddata', 10000); if (Math.abs(v.currentTime - t) < 0.6 && !v.seeking) return; continue; } else { hls ? hls.recoverMediaError() : v.load(); } } } }
  finally { seeking = null; } }

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

// stick -> speed. Never negative.
const speed = () => { if (keys.ArrowUp || keys.KeyW) return 1; if (joy.id == null) return 0; const u = -joy.y; if (u < 0.2) return 0; return 0.5 + 0.5 * Math.min(1, (u - 0.2) / 0.65); };

// ---------- sound (footage audio track, separate file) ----------
const audio = new Audio(); audio.loop = false; audio.crossOrigin = 'anonymous'; audio.preload = 'auto'; let soundOn = false;
$('sound').onclick = () => { soundOn = !soundOn; $('sound').textContent = soundOn ? '🔊' : '🔇'; if (soundOn) { audio.currentTime = pos(); audio.play().catch(() => {}); } else audio.pause(); };

// ---------- clips, junctions, jumps ----------
const clipAt = t => clips.find(c => t >= c.lo - 0.5 && t <= c.hi + 0.5) || clips[0];
let jumping = false, lastJ = 0;
async function jump(t) { jumping = true; try { await seekTo(t); clip = clipAt(t); hd = headAt(t); look.yaw = 0; look.pitch = 0; window.__w.lastJump = t; } finally { lastPos = v ? v.currentTime : t; jumping = false; } }
function checkJunction(p) { if (performance.now() - lastJ < 3000) return; for (const j of junctions) { if (j.clip !== clip.id) continue; if (p >= j.at - 0.3 && p <= j.at + (j.window || 2)) { lastJ = performance.now(); log('junction ' + j.id); window.__w.lastJunction = j.id; jump(j.toTime); return; } } }

// ---------- minimap (schematic: integrate the heading table) ----------
const mm = $('minimap'), mctx = mm.getContext('2d'); let path = null;
function buildPath() { if (!HEAD) return; const main = clips[0]; const pts = []; let x = 0, y = 0; for (let t = main.lo; t <= main.hi; t += 1) { const h = -headAt(t); x += Math.sin(h); y -= Math.cos(h); pts.push([t, x, y]); }
  const xs = pts.map(p => p[1]), ys = pts.map(p => p[2]), mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys), s = 100 / Math.max(mxx - mnx, mxy - mny, 1);
  path = pts.map(([t, x, y]) => [t, 10 + (x - mnx) * s, 10 + (y - mny) * s]); }
const mapXY = t => { if (!path) return null; const i = Math.max(0, Math.min(path.length - 1, Math.round(t - path[0][0]))); return path[i]; };
function drawMap() { if (!path) return; mctx.clearRect(0, 0, 120, 120); mctx.strokeStyle = 'rgba(255,255,255,.75)'; mctx.lineWidth = 2; mctx.beginPath(); path.forEach(([, x, y], i) => i ? mctx.lineTo(x, y) : mctx.moveTo(x, y)); mctx.stroke();
  const p = pos(), c = clip && clip.id !== 'main' ? mapXY(clip.mapAt || p) : mapXY(p); if (!c) return; mctx.fillStyle = '#ff4d4d'; mctx.beginPath(); mctx.arc(c[1], c[2], 4.5, 0, 7); mctx.fill(); }
mm.addEventListener('pointerdown', e => { e.stopPropagation(); if (!path) return; const r = mm.getBoundingClientRect(), x = (e.clientX - r.left) * 120 / r.width, y = (e.clientY - r.top) * 120 / r.height; let bd = 1e9; const ds = path.map(p => { const d = (p[1] - x) ** 2 + (p[2] - y) ** 2; if (d < bd) bd = d; return [p[0], d]; }); if (bd >= 400) return; const near = ds.filter(q => q[1] <= bd + 16); const cur = v ? v.currentTime : 0; const pick = near.find(q => q[0] > cur + 5) || near[0]; jump(pick[0]); }); /* where the drawn path crosses itself, prefer the pass that lies ahead */

// ---------- explore ----------
$('explore-toggle').onclick = () => { $('explore').hidden = !$('explore').hidden; };
$('explore-close').onclick = () => { $('explore').hidden = true; };
$('go').onclick = () => { $('explore').hidden = true; jump(+$('pos').value); };

// ---------- loop ----------
let hd = 0, rate = 0, last = performance.now(), lastPos = 0;
renderer.setAnimationLoop(() => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (ready && !jumping) { const want = speed(); rate += (want - rate) * Math.min(1, dt * 8);
    const p = pos(); if (clip && p >= clip.hi - 0.3) { if (!v.paused) v.pause(); $('status').textContent = 'End of this street: tap the mini-map or Explore to continue'; }
    else if (want > 0) { const r = Math.max(0.5, Math.min(1, want)); if (v.playbackRate !== r) v.playbackRate = r; if (v.paused) v.play().catch(e => log('play ' + e.name)); $('status').textContent = ''; }
    else if (!v.paused) v.pause();
    if (soundOn) { if (v.paused) { audio.volume = 0.25; } else { audio.volume = 0.85; if (Math.abs(audio.currentTime - p) > 1.5) audio.currentTime = p; audio.playbackRate = v.playbackRate; } if (audio.paused) audio.play().catch(() => {}); }
    if (!v.paused) checkJunction(p);
    if (p < lastPos - 0.5 && !seeking && !jumping) log('BACKSTEP ' + lastPos.toFixed(2) + '>' + p.toFixed(2)); if (!seeking && !jumping) lastPos = p;
    const h = headAt(clip && clip.id === 'main' ? p : p); const d = Math.atan2(Math.sin(h - hd), Math.cos(h - hd)); hd += Math.max(-0.35 * dt, Math.min(0.35 * dt, d * Math.min(1, dt * 0.8)));
    if (now - (window.__mmT || 0) > 200) { window.__mmT = now; drawMap(); } }
  camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw + hd, 0, 'YXZ'));
  renderer.render(scene, camera); });

// ---------- boot ----------
(async () => { try {
  const j = await (await fetch(A + 'walk.json', { cache: 'no-cache' })).json(); const c = j.cdn;
  const url = c.base + (isIOS ? c.hlsIOS : c.hls);
  const r = await (await fetch(ROOT + 'routes.json', { cache: 'no-cache' })).json(); const route = r.routes[0]; clips = route.clips; junctions = (route.junctions || []).filter(x => (x.dir || 1) > 0); clip = clips[0];
  fetch(A + (c.heading || 'heading_w18.json')).then(x => x.json()).then(h => { HEAD = h; hd = headAt(Math.max(pos(), c.lo || 0)); buildPath(); }).catch(() => {});
  audio.src = c.audio;
  if (!(await probe(url))) throw new Error('The video stream is not reachable. Check the connection and reload.');
  D = c.duration; window.__src = 'r2'; $('pos').min = clips[0].lo; $('pos').max = clips[0].hi;
  attach(url, +(params.get('t') || c.lo || clips[0].lo));
  await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('Video took too long to load.')), 45000); v.addEventListener('loadedmetadata', () => { clearTimeout(to); res(); }, { once: true }); });
  await seekTo(+(params.get('t') || c.lo || clips[0].lo));
  mat.map = tex; mat.needsUpdate = true; ready = true; document.body.classList.remove('loading'); $('loader').hidden = true; log('ready');
  window.__ttff = performance.now();
} catch (e) { $('error').hidden = false; $('error').textContent = e.message; log('error ' + e.message); } })();

window.__w = { ver: VER, dbg: () => { const b = v.buffered, r = []; for (let i = 0; i < b.length; i++) r.push([+b.start(i).toFixed(2), +b.end(i).toFixed(2)]); return { ct: v.currentTime, rs: v.readyState, ns: v.networkState, paused: v.paused, seeking: v.seeking, buf: r, err: v.error && v.error.code }; }, state: () => ({ pos: pos(), D, rate: v.playbackRate, playing: !v.paused, ready, clip: clip && clip.id, hd, lookYaw: look.yaw, pitch: look.pitch, src: v.currentSrc || (hls && 'hls.js') }),
  jump, setLook: deg => { look.yaw = deg * Math.PI / 180; }, key: (k, on) => { keys[k] = on; }, joy: () => ({ ...joy }), vids: () => document.querySelectorAll('video').length,
  headAt, mapXY, mmTap: t => { const p = mapXY(t); const r = mm.getBoundingClientRect(); return p && { x: r.left + p[1] * r.width / 120, y: r.top + p[2] * r.height / 120 }; }, audio: () => ({ paused: audio.paused, vol: audio.volume }), lastJump: null, lastJunction: null };
