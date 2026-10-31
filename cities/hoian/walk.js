// Continuous controller-driven walk through real 360° walking footage of Hội An.
// Video time = position along the route. Forward = forward copy at a variable rate; backward = a pre-reversed copy.
// Standing still keeps the world alive by creeping forward at a very slow rate (never a short loop). Look is free 360°.
import * as THREE from 'three';
import { loadCatalog } from './route-catalog.js?v=w9';
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = matchMedia('(pointer:coarse)').matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
let BASE = 'assets/walk/';
let navigationPaused = false;
const showError = (m) => { $('spin').hidden = true; $('tapstart').hidden = true; $('loader').hidden = true; const e = $('error'); e.hidden = false; e.textContent = m; console.error('[viewer-error]', m); window.__viewerError = m; };
window.__state = { loaded: false };
/* the camera carrier occupies ~±18° around dead-behind, below the horizon: stop the turn far enough off-axis that he is outside the screen half-width */
const TURN_OFF = () => Math.min(0.95, Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect) + 0.42);
const IDLE = +(params.get('idle') || 0) /* 0 = standing still pauses the footage; ?idle=0.4 restores the old forward drift */, WALK = 1.0, JOG = 1.8;

const renderer = new THREE.WebGLRenderer({ antialias: false }); renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight); $('app').appendChild(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
const fitCam = () => { camera.aspect = innerWidth / innerHeight; const a = camera.aspect, oldv = new URLSearchParams(location.search).get('lowmask') === '0'; camera.fov = oldv ? 75 : Math.min(a < 1 ? 86 : 75, /* w6: wider portrait view (~47 deg across instead of ~36) = less upscaling of the footage */ 2 * Math.atan(Math.tan(82 * Math.PI / 360) / a) * 180 / Math.PI); camera.updateProjectionMatrix(); }; fitCam();
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); fitCam(); });
const geo = new THREE.SphereGeometry(50, 128, 64); geo.scale(-1, 1, 1);
/* w3: ground-plane proxy removed: it bent the lower hemisphere onto a fake floor and, with sideways sway, made the street wobble like water. The ground is now the plain footage. */
const mat = new THREE.MeshBasicMaterial({ color: 0xffffff }); const sphere = new THREE.Mesh(geo, mat); sphere.rotation.y = +(params.get("ry") ?? -Math.PI / 2); scene.add(sphere);
/* w20: the main-walk filmer's head is now removed in the video itself (ground from the same frame, mirrored from just ahead), so no shader mask. */
function mkVideo() { const v = document.createElement('video'); v.crossOrigin = 'anonymous'; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.setAttribute('muted', ''); v.muted = true; v.defaultMuted = true; v.preload = 'auto'; v.loop = false; v.disableRemotePlayback = true; v.setAttribute('x-webkit-airplay', 'deny');
  v.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1'; document.body.appendChild(v); return v; }
const gen = null; /* generated motion at stops removed (w6); see git history */
const crowd = null; /* ?crowd=1 test removed (assets/real, assets/crowd deleted for space) */
const audio = document.createElement('audio'); audio.loop = true; audio.preload = 'none'; document.body.appendChild(audio);
/* Ambience = the real street sound of the same source, cut to exactly the route (h1). One gain controller does all fades; WebAudio gain is used where available because iOS ignores audio.volume. */
const AVOL = 0.85, AOFF = 0; const aud = { g: 0, goal: 0, res: false, node: null };
const vidLive = () => !!(!swapping && window.__state.loaded && active && !active.el.paused && active.el.readyState >= 3 && performance.now() - lastAdv < 400 && frames > 3);
const aWant = () => Math.min(Math.max(0, AOFF + pos()), Math.max(0, D - 0.5));
function stopAudioNow() { aud.goal = 0; aud.g = 0; if (aud.node) aud.node.gain.value = 0; else audio.volume = 0; if (!audio.paused) audio.pause(); }
function aInit() { if (aud.node) return; try { const C = window.AudioContext || window.webkitAudioContext; const ctx = new C(); const src = ctx.createMediaElementSource(audio); aud.node = ctx.createGain(); aud.node.gain.value = 0; src.connect(aud.node).connect(ctx.destination); aud.ctx = ctx; ctx.resume?.(); } catch (e) { aud.node = null; } }
function aTick(dt) { if (!soundOn) return;
  /* standing still (idle=0): fade the street sound out and pause it, so nothing loops; it resumes in sync when you walk */
  if (!view.standing && !vidLive()) { aud.goal = 0; aud.g = 0; if (aud.node) aud.node.gain.value = 0; if (!audio.paused) audio.pause(); return; } /* w4: no picture moving = no sound, immediately */
  if (view.standing) { aud.goal = 0; if (aud.g < 0.02 && !audio.paused) audio.pause(); }
  else if (audio.paused) { if (document.hidden) return; audio.currentTime = aWant(); audio.play().catch(() => {}); aud.goal = AVOL; aud.res = false; }
  else { const drift = audio.currentTime - aWant(); if (!aud.res && Math.abs(drift) > (Math.abs(rate) > 0.6 ? 6 : 30)) { aud.res = true; aud.goal = 0; } if (aud.res && aud.g < 0.02) { audio.currentTime = aWant(); aud.res = false; aud.goal = AVOL; } if (!aud.res) aud.goal = AVOL; }
  aud.g += (aud.goal - aud.g) * Math.min(1, dt * (aud.goal < aud.g ? (vidLive() ? 4 : 14) : 1.6)); /* w4: cut sound fast when the picture stalls */ if (aud.node) { aud.node.gain.value = aud.g; if (aud.ctx.state === 'suspended') aud.ctx.resume(); } else audio.volume = Math.min(1, aud.g); }
const mkTex = v => { const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
let LO = 0, HI = 1e9, D = 0, rate = IDLE, target = IDLE, swapping = false, soundOn = false, frames = 0, lastAdv = performance.now(), quality = '4k', chunkSwaps = 0;
// A chunked track: the route split into L-second files, played back to back with the next chunk preloaded in a 2nd element.
const connection = navigator.connection || {};
let qualityMode = ['auto', 'high', 'low'].includes(params.get('quality')) ? params.get('quality') : connection.saveData ? 'low' : isIOS ? 'high' : 'auto'; /* w12: iOS Safari's native HLS started at 1280 and rarely climbed while the walk is paused/scrubbed, so iPhone/iPad pin the 3840 H.264 level by default; the button still cycles to Auto / Data saver */
setInterval(() => { if (window.__state?.loaded) updateQuality(); }, 1000); /* w12: keep the px badge live (native HLS changes level without telling us) */
function updateQuality() {
  const v = active?.el, label = qualityMode === 'high' ? 'High' : qualityMode === 'low' ? 'Data saver' : 'Auto';
  $('quality').textContent = `${label} · ${v?.videoWidth ? v.videoWidth + 'px' : 'loading'}`;
  $('quality').disabled = !window.__state.loaded;
}
function applyQuality(tr) {
  const h = tr?.hls;
  if (!h || !h.levels.length) return;
  h.autoLevelCapping = qualityMode === 'low' ? 0 : -1;
  const level = qualityMode === 'high' ? h.levels.length - 1 : qualityMode === 'low' ? 0 : -1;
  tr.refreshPausedLevel = level >= 0 ? level : null;
  h.currentLevel = level;
  updateQuality();
}
class Track {
  constructor(url, duration, lazy) {
    this.url = url; this.D = duration; const v = mkVideo();
    this.els = [v]; this.tex = [mkTex(v)]; this.k = 0; this.ci = 0; this.loaded = [0]; this.started = false;
    this.watch(v); v.preload = lazy ? 'none' : 'auto';
    if (!lazy) this.start();
  }
  fail(message) {
    this.failure = new Error(message);
    this.el.pause(); this.hls?.stopLoad();
    this.el.dispatchEvent(new Event('streamfailure'));
    if (this === active) showError(message + ' Please reload to retry.');
  }
  start(position = 0) {
    if (this.started) return;
    this.started = true; const v = this.el; v.preload = 'auto';
    const nativeOK = params.get('hlsjs') !== '1' && (isIOS || (/Safari/.test(navigator.userAgent) && !/Chrome|CriOS|Chromium|Android/.test(navigator.userAgent)));
    if (!(nativeOK && v.canPlayType('application/vnd.apple.mpegurl')) && window.Hls && Hls.isSupported()) {
      const h = this.hls = new Hls({ startLevel: 0, startPosition: position,
        abrEwmaDefaultEstimate: 3e6, maxBufferLength: 12, maxMaxBufferLength: 24, backBufferLength: 8,
        startFragPrefetch: true, enableWorker: true, autoLevelCapping: qualityMode === 'low' ? 0 : -1 });
      h.on(Hls.Events.MANIFEST_PARSED, () => { if (qualityMode !== 'auto') applyQuality(this); });
      h.on(Hls.Events.FRAG_BUFFERED, (_, data) => {
        if (this.refreshPausedLevel == null || data.frag.level !== this.refreshPausedLevel) return;
        const t = v.currentTime;
        if (data.frag.start <= t && data.frag.start + data.frag.duration > t) {
          this.refreshPausedLevel = null;
          // A paused decoder can keep the old low-resolution frame after its buffer was replaced.
          if (v.paused && !v.seeking && v.readyState >= 1) v.currentTime = t + 0.001;
        }
      });
      h.on(Hls.Events.ERROR, (_, data) => { if (data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR && this.tryRecover('hls ' + data.details)) return; if (data.fatal) this.fail('The video stream could not load (' + data.type + ').'); });
      h.loadSource(this.url); h.attachMedia(v);
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari cannot use hls.js level controls. Pin its media playlist in manual modes.
      const loadNative = async () => {
        let url = this.url;
        if (qualityMode !== 'auto') {
          const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error('The video playlist could not load.');
          const lines = (await response.text()).split(/\r?\n/), levels = [];
          for (let i = 0; i < lines.length; i++) if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
            const bitrate = +(lines[i].match(/(?:^|,)BANDWIDTH=(\d+)/)?.[1] || lines[i].match(/BANDWIDTH=(\d+)/)?.[1] || 0);
            const uri = lines.slice(i + 1).find(line => line.trim() && !line.startsWith('#'));
            if (uri) levels.push({ bitrate, url: new URL(uri.trim(), new URL(url, location.href)).href });
          }
          levels.sort((a, b) => a.bitrate - b.bitrate);
          if (levels.length) url = levels[qualityMode === 'high' ? levels.length - 1 : 0].url;
        }
        v.src = url; v.load();
      };
      loadNative().catch(e => this.fail(e.message));
    }
    else this.fail('This browser cannot play the walk. Try a browser with HLS support.');
  }
  get el() { return this.els[0]; } get nx() { return this.el; }
  get tpos() { return this.el.currentTime || 0; }
  wait(event, ready, timeout = 20000) {
    if (this.failure) return Promise.reject(this.failure);
    if (ready()) return Promise.resolve();
    const v = this.el;
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); v.removeEventListener(event, done); v.removeEventListener('error', failed); v.removeEventListener('streamfailure', failed); };
      const done = () => { if (ready()) { cleanup(); resolve(); } };
      const failed = () => setTimeout(() => { if (this.hls && !this.failure) return; /* w23: hls.js media error being recovered; keep waiting */ cleanup(); reject(this.failure || new Error('Video decoding failed.')); }, 0);
      const timer = setTimeout(() => { cleanup(); reject(new Error('The video is taking too long to load. Check your connection and reload.')); }, timeout);
      v.addEventListener(event, done); v.addEventListener('error', failed); v.addEventListener('streamfailure', failed);
    });
  }
  /* w23: WebKit's MSE decoder occasionally errors on a far jump; hls.js can re-attach and carry on (max 3 per minute) */
  tryRecover(why) { if (!this.hls) return false; const now = performance.now(); this._rec = (this._rec || []).filter(x => now - x < 60000); if (this._rec.length >= 3) return false; this._rec.push(now); evlog((this === fwdT ? 'F' : 'R') + ' recover: ' + why); switchStats.recover = (switchStats.recover || 0) + 1; const t = this.el.currentTime; this.hls.recoverMediaError(); if (t > 0) this.el.currentTime = t; return true; }
  watch(v) {
    v.addEventListener('error', () => { if (this.tryRecover('video error ' + (v.error && v.error.code))) return; this.fail('The video could not be decoded.'); });
    v.addEventListener('waiting', () => { if (this === active && !v.paused) setSpin(true); });
    v.addEventListener('playing', () => { if (this === active) setSpin(false); });
    v.addEventListener('resize', updateQuality);
    const frame = () => {
      if (this === active) {
        frames++; lastAdv = performance.now(); if (!window.__ttff) window.__ttff = Math.round(performance.now());
        this.nudged = false; setSpin(false); updateQuality();
        if (v.readyState >= 2 && mat.map !== this.tex[0] && !swapping) { mat.map = this.tex[0]; mat.needsUpdate = true; }
        // ABR may buffer sharper future segments while leaving the paused first frame blurry.
        // Replace that frame once, only when measured bandwidth comfortably supports the higher rendition.
        const h = this.hls;
        if (!this.startupQualityChecked && h && h.bandwidthEstimate > 0) {
          this.startupQualityChecked = true;
          if (qualityMode === 'auto' && !connection.saveData) {
            const best = h.levels.reduce((n, level, i) => level.bitrate < h.bandwidthEstimate * 0.7 ? i : n, 0);
            if (best > h.currentLevel) { this.refreshPausedLevel = best; h.currentLevel = best; }
          }
        }
      }
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(frame);
    };
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(frame); else v.addEventListener('timeupdate', frame);
  }
  async seek(t) { this._inSeek = (this._inSeek || 0) + 1; try { return await this._seek(t); } finally { this._inSeek--; this._ownSeek = performance.now(); } }
  async _seek(t) { const gen = this._gen = (this._gen || 0) + 1; /* w24: a newer seek on this stream supersedes this one (two retry loops fought over currentTime) */
    t = Math.max(0, Math.min(this.D - 0.05, t)); this.start(t);
    await this.wait('loadedmetadata', () => this.el.readyState >= 1);
    const v = this.el;
    /* w23: never seek a stream that has no decoded data yet (readyState 1): WebKit leaves such a seek pending forever (no 'seeked', readyState stuck at 1) and iOS native HLS can drop it and restart from 0. Let the first data arrive (the stream was started at t), then seek only if still needed */
    if (v.readyState < 2 && !this._hadData) { try { await this.wait('loadeddata', () => v.readyState >= 2, 4000); } catch (e) { if (this.failure) throw e; } }
    if (v.readyState >= 2) this._hadData = true;
    /* w23: also wait out (and repair) a seek that hls.js itself issued via startPosition: it is the one WebKit loses */
    if (Math.abs(v.currentTime - t) >= 0.04 || v.seeking || v.readyState < 2) {
      if (Math.abs(v.currentTime - t) >= 0.04) { evlog((this === fwdT ? 'F' : 'R') + ' seek ' + v.currentTime.toFixed(1) + '>' + t.toFixed(1) + (this === active ? ' ACTIVE' : '')); this._ownSeek = performance.now();
      v.currentTime = t; } else evlog((this === fwdT ? 'F' : 'R') + ' wait pending seek rs' + v.readyState);
      /* w18: the joined head/tail parts start each part ~2 frames late (0.067 s), so a seek that lands just before a part's first frame can sit in that gap forever; hop to the buffered start */
      const gapHop = setInterval(() => { if (v.readyState >= 2 || v.seeking && v.readyState >= 2) return; const b = v.buffered; for (let i = 0; i < b.length; i++) if (b.start(i) > v.currentTime && b.start(i) - v.currentTime < 0.5) { v.currentTime = b.start(i) + 0.01; break; } }, 700);
      try { /* w23: a seek that never completes (seen in WebKit; suspected on iPhone native HLS) is re-issued every 3 s instead of hanging the walk */ for (let k = 0; ; k++) { try { await this.wait('seeked', () => !v.seeking && v.readyState >= 2, k === 0 ? 1500 : k < 5 ? 2500 : 20000); break; } catch (e) { if (gen !== this._gen) { await this.wait('seeked', () => !v.seeking && v.readyState >= 2, 20000).catch(() => {}); break; } if (k >= 5 || this.failure) throw e; evlog((this === fwdT ? 'F' : 'R') + ' seek stuck, retry ' + (k + 1) + ' ct ' + v.currentTime.toFixed(2) + ' rs' + v.readyState); this._ownSeek = performance.now(); switchStats.stuckSeek = (switchStats.stuckSeek || 0) + 1; const bh = (() => { const b = v.buffered; for (let i = 0; i < b.length; i++) if (b.start(i) <= v.currentTime + 0.1 && b.end(i) > v.currentTime + 0.3) return true; return false; })(); if (this.hls && !bh && (k === 0 && v.readyState < 1)) { /* data for the target is not buffered yet: still loading (slow network), keep waiting, do not reset the loader */ } else if (this.hls) { /* w23 root cause: WebKit's media pipeline can lose a seek issued before its first sample (readyState 1): 'seeked' never fires and re-seeking does not help; re-attaching the MediaSource does */ this.hls.recoverMediaError(); v.currentTime = t + 0.1 * (k + 1); /* step off a part boundary (EXT-X-DISCONTINUITY at 4/288/570/902/1230/1318/1436 s) */ } else { /* native HLS: reload the playlist and seek again */ const src = v.currentSrc || v.src; v.src = src; v.load(); try { await this.wait('loadedmetadata', () => v.readyState >= 1, 8000); } catch (e2) {} v.currentTime = t + 0.1 * (k + 1); } } } } finally { clearInterval(gapHop); }
    } else { const gapHop = setInterval(() => { if (v.readyState >= 2) return; const b = v.buffered; for (let i = 0; i < b.length; i++) if (b.start(i) > v.currentTime && b.start(i) - v.currentTime < 0.5) { v.currentTime = b.start(i) + 0.01; break; } }, 700);
      try { await this.wait('loadeddata', () => v.readyState >= 2); } finally { clearInterval(gapHop); } }
  }
  tick() {}
  atEnd() { return this.el.duration && this.el.currentTime >= this.el.duration - 0.15; }
  pauseAll() { this.el.pause(); }
}

let fwdT, revT, active; let HEAD = null; /* w4: direction of travel in the footage (radians vs. frame centre), so 'ahead' follows the walker around corners */
const headAt = p => { if (!HEAD || params.get('follow') === '0') return 0; if (window.__src === 'r2' && p < 13) p = 13; /* w24 root cause of the sideways/backward opening view: heading_w18.json is pinned at -75 deg for 0-4.5 s (the 4 s intro shot) and its 9 s smoothing bleeds that into the real start, so the camera opened ~76 deg off the street and swung back over ~10 s. Use the first clean heading (13 s) until then */ const i = Math.max(0, Math.min(HEAD.h.length - 1, p / HEAD.dt)), a = Math.floor(i), b = Math.min(HEAD.h.length - 1, a + 1), f = i - a; return -(HEAD.h[a] * (1 - f) + HEAD.h[b] * f); /* footage heading is +right; view yaw is +left */ };
let STILL = []; let lastGoodPos = 0; const pos = () => { const tr = active === fwdT ? fwdT : revT, p = tr === fwdT ? tr.tpos : D - tr.tpos; /* w22: iOS native HLS can briefly report currentTime 0 (or D) while seeking/starting; never let that read as the start/end of the street */ if (tr && (tr.el.seeking || tr.el.readyState < 1) && Math.abs(p - lastGoodPos) > 5) return lastGoodPos; lastGoodPos = p; return p; }; // seconds along the route
function setSpin(on) { $('spin').hidden = !on; $('spin').setAttribute('aria-label', 'Buffering the walk'); }
async function playSafe(v) { try { return await Promise.race([v.play().then(() => true), new Promise(r => setTimeout(() => r(!v.paused), 1500))]); } catch (e) { return false; } }
async function snapTo(p) { if (swapping || !active) return; swapping = true; try { /* w22: jumps and junctions always land on the forward stream (parked, paused, decoded) so the first push up starts at once; reverse gets parked behind it */ if (active !== fwdT) { const old = active; old.pauseAll(); await fwdT.seek(p); active = fwdT; setBuf(fwdT, true); setBuf(old, false); } await active.seek(active === fwdT ? p : D - p); active.el.pause(); if (active.el.readyState >= 2) { mat.map = active.tex[active.k]; mat.needsUpdate = true; } } finally { swapping = false; } }
/* w5: direction switch without a hitch: the other stream is kept primed (paused at the mirrored frame) whenever you slow down or reverse,
   so switching is just play(); the old picture stays on screen until the new stream has a decoded frame, then we hand over. */
let primeT = 0; var switchStats = { n: 0, lastMs: 0, seeks: 0 }; const EVL = []; const evlog = m => { EVL.push((performance.now() / 1000).toFixed(1) + ' ' + m); if (EVL.length > 8) EVL.shift(); }; window.__evlog = EVL; /* w23: ?debug=1 shows the last events (seeks, switches, guards) */
/* w6: primed continuously, also while walking (every ~0.9 s, at most one seek in flight); a reversal of the stick primes at once */
let primeP = null;
const inBuf = (v, t) => { const b = v.buffered; for (let i = 0; i < b.length; i++) if (t >= b.start(i) - 0.05 && t <= b.end(i) - 0.5) return true; return false; };
function setBuf(tr, on) { if (tr?.hls) { tr.hls.config.maxBufferLength = on ? 16 : 22; tr.hls.config.maxMaxBufferLength = on ? 30 : 24; } }
function prime(now, urgent) { const o = active === fwdT ? revT : fwdT; if (swapping || primeP || !o.el.paused || (!urgent && now - primeT < 900)) return; if (urgent && o.el.readyState >= 2 && inBuf(o.el, o === fwdT ? pos() : D - pos())) return; /* already parked close enough: the switch will use it */ if (Math.abs(rate) > 0.3 && Math.sign(target) !== Math.sign(rate)) return; /* slowing to reverse: keep the parked buffer where it is */ const walking = Math.abs(rate) > 0.3 && !urgent, sg = Math.sign(rate), pp = Math.max(0, Math.min(D, pos() + (walking ? sg * 2.5 : 0))), m = o === fwdT ? pp : D - pp, d = ((o === fwdT ? o.tpos : D - o.tpos) - pos()) * sg; /* w6: while walking, park the other stream ~6 s ahead of you; its (small, 10 s) buffer then runs from there back past where you are, so reversing is a seek inside already-downloaded data */ if ((walking ? (d < -0.5 || d > 3.5) : Math.abs(o.tpos - m) > 0.3) || o.el.readyState < 3) { primeT = now; const ps = performance.now(); (switchStats.pl = switchStats.pl || []).push([Math.round(ps / 100) / 10, +pos().toFixed(1), +m.toFixed(1), !!urgent]); primeP = o.seek(m).catch(() => {}).finally(() => { primeP = null; switchStats.pl.at(-1).push(Math.round(performance.now() - ps)); }); } }
function idlePark() { const o = active === fwdT ? revT : fwdT, now = performance.now(); if (swapping || primeP || !o.el.paused || now - primeT < 300) return; const m = o === fwdT ? pos() : D - pos(); if (Math.abs(o.tpos - m) <= 0.3 && (o.el.readyState >= 2 || now - (o._pkT || 0) < 1500)) return; o._pkT = now; /* w22: a parked stream whose decoder was released (readyState 1) is re-seeked once so a frame is decoded before you push */ primeT = now; primeP = o.seek(m).catch(() => {}).finally(() => { primeP = null; }); }
const nextFrame = (v, ms) => new Promise(resolve => {
  let callback, timer;
  const done = value => { clearTimeout(timer); if (callback != null) v.cancelVideoFrameCallback?.(callback); v.removeEventListener('timeupdate', frame); resolve(value); };
  const frame = () => done(true);
  timer = setTimeout(() => done(false), ms);
  if (v.requestVideoFrameCallback) callback = v.requestVideoFrameCallback(frame); else v.addEventListener('timeupdate', frame, { once: true });
});
let swapOld = null; const STALE = Symbol('stale'); /* w17b */
async function switchTo(tr) { if (swapping || tr === active) return; swapping = true; evlog('switch to ' + (tr === fwdT ? 'F' : 'R') + ' at ' + pos().toFixed(1) + ' tgt ' + target.toFixed(2)); const t0 = performance.now(), p = pos(), m = tr === fwdT ? p : D - p, old = active, dir = tr === fwdT ? 1 : -1, stale = () => Math.sign(target) === -dir && Math.abs(target) > 0.05; /* w18: abort a slow switch once the stick asks for the other way, so a late reverse never takes over while you push forward */
  const guard = pr => Promise.race([pr, new Promise(r => { const iv = setInterval(() => { if (stale()) { clearInterval(iv); r(STALE); } }, 80); Promise.resolve(pr).finally(() => clearInterval(iv)); })]); /* w17b: a slow seek/start is abandoned as soon as the stick points the other way */
  swapOld = old; try { stopAudioNow(); old.pauseAll(); /* w18: the old direction never keeps rolling while we switch */ if (primeP && !inBuf(tr.el, tr === fwdT ? pos() : D - pos()) && !(tr.el.readyState >= 2 && Math.abs((tr === fwdT ? tr.tpos : D - tr.tpos) - p) < 3)) { /* w22: a parked stream with a decoded frame near you never waits for an in-flight park seek */ switchStats.waitP = 1; old.pauseAll(); /* never show the old direction moving the wrong way while we wait */ await Promise.race([primeP, new Promise(r => setTimeout(r, 1200))]); } else switchStats.waitP = 0; switchStats.tA = Math.round(performance.now() - t0); const m2 = tr === fwdT ? pos() : D - pos(); const pr = tr === fwdT ? tr.tpos : D - tr.tpos, ahead = tr === fwdT ? pr - p : p - pr; /* w6: a primed frame up to 3 s further along the NEW direction is used as is (a small skip the way you're going beats a frozen seek) */ switchStats.skip = +ahead.toFixed(2); switchStats.rs0 = [tr.el.readyState, +tr.el.currentTime.toFixed(2), +pr.toFixed(2), +p.toFixed(2), +m2.toFixed(2)]; if ((tr.el.readyState >= 2 || tr.el.readyState >= 1 && inBuf(tr.el, tr.el.currentTime)) && ahead > -0.3 && ahead < 3 && Math.abs((tr === fwdT ? tr.el.currentTime : D - tr.el.currentTime) - pr) < 0.1) { switchStats.parked = (switchStats.parked || 0) + 1; /* w22: already parked here with a decoded frame: just play() */ } else if (tr.el.readyState >= 1 && inBuf(tr.el, m2)) { switchStats.bufSeeks = (switchStats.bufSeeks || 0) + 1; old.pauseAll(); if (await guard(tr.seek(m2)) === STALE) { tr.pauseAll(); return; } } else if (tr.el.readyState < 2 || ahead < -3 || ahead > 3) { switchStats.seeks++; if (await guard(tr.seek(m2)) === STALE) { tr.pauseAll(); return; } }
    if (stale()) { tr.pauseAll(); return; } tr.el.playbackRate = Math.max(isIOS ? 0.5 : 0.0625, Math.abs(rate)); old.pauseAll(); /* old frame stays as the texture (frozen) */ setSpin(true); switchStats.rs = tr.el.readyState; const decoded = nextFrame(tr.el, 10000); const tP = Math.round(performance.now() - t0); const both = await guard(Promise.all([playSafe(tr.el), decoded])); if (both === STALE) { tr.pauseAll(); setSpin(false); switchStats.aborted = (switchStats.aborted || 0) + 1; return; } const [playing, framed] = both; switchStats.nf = framed; if (!playing || !framed) throw new Error('The return video is taking too long to start. Please reload to retry.'); if (stale()) { tr.pauseAll(); switchStats.aborted = (switchStats.aborted || 0) + 1; return; }
    mat.map = tr.tex[tr.k]; mat.needsUpdate = true; active = tr; setBuf(tr, true); setBuf(old, false); lastAdv = performance.now(); switchStats.n++; switchStats.lastMs = Math.round(performance.now() - t0); switchStats.tP = tP; setSpin(false); updateQuality(); } catch (e) { old.pauseAll(); tr.pauseAll(); showError(e.message); } finally { swapping = false; swapOld = null; } }

// input
const view = { face: params.get('face') === '-1' ? -1 : 1, turn: 0, yaw: +params.get('yaw') || 0, pitch: 0, sy: 0, sp: 0, gyro: null, gyroYaw0: 0, lat: 0, latT: 0 };
// nadir cap (w1): the source's camera-carrier/stitch area under the lens warps and flows like water while walking; cover it with a stable, soft ground-toned disc that fades out by ~48 deg below the horizon
const OLDV = params.get('lowmask') === '0', PORT = () => innerWidth < innerHeight; // w2: portrait = narrower vertical FOV, gaze ~7 deg up and a tighter look-down limit, so the smeared near road takes only the bottom of the screen (?lowmask=0 = old framing)
const PMIN = () => OLDV ? 0.75 : PORT() ? 0.32 : 0.6, GUP = () => OLDV ? 0 : PORT() ? 0.15 : 0.07; // w7: a little less road in portrait (look-down limit 18 deg, gaze lift 8.6 deg)
// w3 road: the near-field road in the source smears/flows like water (low-res stitched 360 + compression). Overlay a sharp, stable asphalt plane (texture cut from this same footage, made seamless), colour-matched live to the video's road, scrolled with walking so parallax is right; feathered into the video from ~13 deg below the horizon. ?road=0 disables.
const road = (() => { const RM = params.get('road'); if (true) return null; /* h1: road overlay assets were made for the old footage; disabled */ // ?road=2: test, the overlay is cut out wherever a person/bike/scooter is (precomputed masks) // w4: off by default (it erased nearby people's legs); ?road=1 opt-in
  const tx = new THREE.TextureLoader().load('assets/road/asphalt.jpg?v=w3'); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const m = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, uniforms: { map: { value: tx }, off: { value: 0 }, gain: { value: new THREE.Color(1, 1, 1) }, cam: { value: new THREE.Vector3() }, pmA: { value: null }, pmB: { value: null }, pmOn: { value: 0 }, fidx: { value: 0 }, rinv: { value: new THREE.Matrix3() } },
    vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position,1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D map, pmA, pmB; uniform float off, pmOn, fidx; uniform vec3 gain; uniform vec3 cam; uniform mat3 rinv; varying vec3 wp;
      float pmask(){ if (pmOn < 0.5) return 0.0; vec3 d = rinv * normalize(wp); float u = fract(atan(d.z, d.x) / 6.2831853); float bt = (acos(clamp(d.y, -1.0, 1.0)) / 3.14159265 - 98.0 / 180.0) / (64.0 / 180.0);
        if (bt < 0.0 || bt > 1.0) return bt > 1.0 ? 0.0 : 1.0; float j = fidx; bool b = j >= 1360.0; if (b) j -= 1360.0; float col = mod(j, 16.0), row = floor(j / 16.0);
        vec2 q = vec2((col + clamp(u, 0.002, 0.998)) / 16.0, (row + clamp(bt, 0.01, 0.99)) / 85.0); return b ? texture2D(pmB, q).r : texture2D(pmA, q).r; }
      void main(){ vec2 g = vec2(wp.x, wp.z + off); vec3 a = texture2D(map, g / 1.4).rgb; vec3 b = texture2D(map, mat2(0.8,-0.6,0.6,0.8) * g / 2.3 + 0.37).rgb;
        vec3 c = mix(a, b, 0.35 + 0.3 * texture2D(map, g / 9.0).g) * gain;
        float r = length(wp.xz - cam.xz); float dep = atan(1.6, r); float al = smoothstep(0.23, 0.40, dep) * (1.0 - smoothstep(2.0, 2.9, abs(wp.x)));
        al *= 1.0 - smoothstep(0.05, 0.5, pmask()); gl_FragColor = vec4(c, al);
        #include <colorspace_fragment>
      }` });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), m); mesh.position.y = -1.6; mesh.renderOrder = 5; scene.add(mesh);
  const c = document.createElement('canvas'); c.width = c.height = 8; const cx = c.getContext('2d', { willReadFrequently: true }); const rc = new THREE.Raycaster();
  const texMean = new THREE.Color().setRGB(87 / 255, 79 / 255, 76 / 255, THREE.SRGBColorSpace), tgt = new THREE.Color(1, 1, 1);
  if (RM === '2') { const L = new THREE.TextureLoader(), lt = f => { const t = L.load('assets/road/' + f + '?v=r2'); t.flipY = false; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter; return t; };
    m.uniforms.pmA.value = lt('pm0.png'); m.uniforms.pmB.value = lt('pm1.png'); fetch('assets/road/pm.json?v=r2').then(r => r.json()).then(j => { road.pj = j; m.uniforms.pmOn.value = 1; }).catch(() => {}); }
  return { mesh, m, cx, rc, texMean, tgt, last: 0, pj: null }; })();
const ROAD_MPS = +(params.get('roadspeed') ?? 1.3); // metres of road per route-second (normal walking)
function roadUpd(now) { if (!road) return; const u = road.m.uniforms; u.cam.value.copy(camera.position); road.mesh.position.x = 0; road.mesh.position.z = camera.position.z;
  u.off.value = (-pos() * ROAD_MPS) % 1400 - road.mesh.position.z * 0; // ground slides toward you as you walk forward
  if (now - road.last > 700) { road.last = now; try { const im = mat.map && mat.map.image; const W = im && (im.videoWidth || im.width), H = im && (im.videoHeight || im.height);
    if (W) { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0; f.normalize(); f.y = -0.42; road.rc.set(new THREE.Vector3(), f.normalize()); const hit = road.rc.intersectObject(sphere)[0];
      if (hit && hit.uv) { const sx = hit.uv.x * W, sy = (1 - hit.uv.y) * H; road.cx.drawImage(im, sx - W * 0.012, sy - H * 0.02, W * 0.024, H * 0.04, 0, 0, 8, 8); const d = road.cx.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const col = new THREE.Color().setRGB(r / 16320, g / 16320, b / 16320, THREE.SRGBColorSpace); road.tgt.setRGB(col.r / road.texMean.r, col.g / road.texMean.g, col.b / road.texMean.b); } } } catch (_) {} }
  u.gain.value.lerp(road.tgt, 0.04);
  if (road.pj) { u.fidx.value = Math.min(road.pj.n - 1, Math.max(0, Math.round((pos() - road.pj.t0) * road.pj.fps))); sphere.updateMatrixWorld(); u.rinv.value.setFromMatrix4(sphere.matrixWorld).invert(); } }
const nadir = (() => { if (params.get('nadir') === '0') return null;
  const m = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, uniforms: { col: { value: new THREE.Color(0.32, 0.30, 0.29) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 col; varying vec3 vp; float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5); } void main(){ float r = length(vp.xz); float dep = atan(1.6, r); float a = smoothstep(0.84, 1.08, dep); float g = 0.94 + 0.06 * h(floor(vp.xz * 90.0)); gl_FragColor = vec4(col * g * (0.9 + 0.1 * smoothstep(0.0, 1.4, r)), a); \n#include <colorspace_fragment>\n}' });
  const g = new THREE.CircleGeometry(1.6, 64); g.rotateX(-Math.PI / 2); const mesh = new THREE.Mesh(g, m); mesh.position.y = -1.6; mesh.renderOrder = 10; scene.add(mesh);
  const c = document.createElement('canvas'); c.width = 16; c.height = 8; const cx = c.getContext('2d', { willReadFrequently: true }); const tgt = new THREE.Color(0.32, 0.30, 0.29);
  return { mesh, m, c, cx, tgt, last: 0 }; })();
function nadirUpd(now) { if (!nadir) return; nadir.mesh.position.x = camera.position.x; nadir.mesh.position.z = camera.position.z;
  if (now - nadir.last > 700) { nadir.last = now; const im = mat.map && mat.map.image; try { if (im && (im.videoWidth || im.width)) { nadir.cx.drawImage(im, 0, 0, 16, 8); const d = nadir.cx.getImageData(0, 6, 16, 1).data; let r = 0, gg = 0, b = 0; for (let i = 0; i < 64; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } nadir.tgt.setRGB(r / 4080, gg / 4080, b / 4080, THREE.SRGBColorSpace); } } catch (_) {} }
  nadir.m.uniforms.col.value.lerp(nadir.tgt, 0.03); }
let drag = null; const cv = renderer.domElement;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
cv.addEventListener('pointermove', e => { if (!drag || e.pointerId !== drag.id) return; const k = camera.fov / innerHeight * Math.PI / 180; view.yaw += (e.clientX - drag.x) * k; view.pitch = THREE.MathUtils.clamp(view.pitch + (e.clientY - drag.y) * k, -PMIN(), 1.3); drag.x = e.clientX; drag.y = e.clientY; });
for (const n of ['pointerup', 'pointercancel']) cv.addEventListener(n, e => { if (drag && e.pointerId === drag.id) drag = null; }); // multi-touch: thumb on joystick + another finger dragging here to look
const keys = {}; addEventListener('keydown', e => { if (!navigationPaused && !['INPUT','TEXTAREA'].includes(e.target.tagName)) keys[e.code] = true; }); addEventListener('keyup', e => keys[e.code] = false);
const joyEl = $('joy'), knob = $('knob'); let joy = { x: 0, y: 0, id: null }; const evc = { down: 0, move: 0, up: 0, cancel: 0, ts: 0 };
for (const [k, n] of [['down', 'pointerdown'], ['move', 'pointermove'], ['up', 'pointerup'], ['cancel', 'pointercancel'], ['ts', 'touchstart']]) joyEl.addEventListener(n, () => evc[k]++, { passive: true });
joyEl.addEventListener('touchstart', e => e.preventDefault(), { passive: false }); joyEl.addEventListener('touchmove', e => e.preventDefault(), { passive: false }); // iOS: never let the page pan/scroll steal the stick
joyEl.addEventListener('pointerdown', e => { joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; try { joyEl.setPointerCapture(e.pointerId); } catch (_) {} knob.style.transition = 'none'; e.stopPropagation(); });
joyEl.addEventListener('pointermove', e => { if (e.pointerId !== joy.id) return; const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, L = Math.hypot(dx, dy) || 1, m = Math.min(1, L / 50) / L; joy.x = dx * m; joy.y = dy * m; knob.style.transform = `translate(${joy.x * 35}px,${joy.y * 35}px)`; });
const joyEnd = e => { if (e.pointerId === joy.id) { joy = { x: 0, y: 0, id: null }; knob.style.transition = ''; knob.style.transform = ''; } }; joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);
let gyroWant = params.get('gyro') === '1', gyroAttached = false; // tilt-to-look is opt-in (?gyro=1 or HoianWalk.setGyro(true)); default look = drag with any finger outside the joystick
function setGyro(on) { gyroWant = !!on; if (on) { if (!gyroAttached) enableGyro(); } else if (view.gyro) { const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); view.gyro = null; view.yaw = view.sy = e.y - view.turn; view.pitch = view.sp = THREE.MathUtils.clamp(e.x, -PMIN(), 1.3); } }
function enableGyro() { gyroAttached = true; const on = () => addEventListener('deviceorientation', ev => { if (ev.alpha == null || !gyroWant) return; const d = THREE.MathUtils.degToRad, o = d(screen.orientation?.angle || window.orientation || 0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(d(ev.beta), d(ev.alpha), -d(ev.gamma), 'YXZ')).multiply(new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -o));
    if (!view.gyro) { view.gyroYaw0 = view.yaw - new THREE.Euler().setFromQuaternion(q, 'YXZ').y; view.yaw = 0; view.pitch = 0; view.gyro = q; } else view.gyro.slerp(q, 0.35); });
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) DeviceOrientationEvent.requestPermission().then(p => p === 'granted' ? on() : (gyroAttached = false)).catch(() => { gyroAttached = false; }); else on(); }
// buttons: hold to walk forward/back (no scene switching)
function hold(btn, val) { const set = v => e => { e.preventDefault(); e.stopPropagation(); btnTarget = v; }; btn.addEventListener('pointerdown', set(val)); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, set(null)); }
let btnTarget = null;
// turning around: you always walk the way you face. Facing back = the reversed footage, seen from behind the camera, so the street flows toward you naturally.
/* w24: which way along the street the camera looks: +1 within ~90 deg of the walk direction, -1 behind (with hysteresis). Walk direction in camera yaw = view.hd (heading follow) */
function lookRel() { const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); let r = e.y - (view.hd || 0); r = Math.atan2(Math.sin(r), Math.cos(r)); return r; }
function lookFace() { const r = Math.abs(lookRel()), prev = view.lf || view.face; return prev > 0 ? (r > 1.75 ? -1 : 1) : (r < 1.40 ? 1 : -1); }
function edgeStatus() { const ae = pos() >= HI - 0.5, as = pos() <= LO + 0.5, st = $('nodestatus'); if ((ae && (view.lf || view.face) > 0) || (as && (view.lf || view.face) < 0)) { st.textContent = (ae ? 'End of the walk' : 'Start of the street') + (ae ? ' · pull the stick down to walk back' : ' · push the stick up to walk');  } else {  if (/Turn(ed)? around/.test(st.textContent)) st.textContent = ''; } }
let lastTurn = 0; function turnAround() { const n = performance.now(); if (n - lastTurn < 900) return; lastTurn = n; try { navigator.vibrate?.(12); } catch (e) {} view.face = -view.face; $('hint').hidden = true; }


(async () => {
  let prog;
  try {
    const catalog = await loadCatalog();
    const route = catalog.routes.find(r => r.id === (params.get('route') || catalog.defaultRoute));
    if (!route) throw new Error('This walk is not available. Open the default route to continue.');
    const manifest = new URL(route.manifest, location.href);
    BASE = new URL('.', manifest).href;
    const r = await fetch(manifest, { signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error('walk.json ' + r.status); const j = await r.json(); LO = params.has('full') ? 0 : (j.lo || 0) /* the source has an editorial fade at 277-280 s: the default route starts after it so the walk has no cut */; D = j.duration; HI = params.has('full') ? D : (j.hi || D) /* the source starts a fade-out in its last 0.7 s */;
    const probe = document.createElement('video'), ua = navigator.userAgent, isSafari = /Safari/.test(ua) && !/Chrome|CriOS|Chromium|Android|FxiOS/.test(ua);
    const hevcOK = isSafari && probe.canPlayType('video/mp4; codecs="hvc1.1.6.L153.B0"') !== '';
    const c = navigator.connection || {}, weak = c.saveData || (c.downlink && c.downlink < 2.5) || (navigator.deviceMemory && navigator.deviceMemory <= 2);
    quality = params.get('q') || (weak ? (j.tracks['2k5'] ? '2k5' : 'f2k') : '4k'); if (!j.tracks[quality]) quality = '4k'; window.__walkJ = j; const F = j.tracks[quality];
    const urls = (t) => t.files ? t.files.map(f => BASE + f) : Array.from({ length: t.n }, (_, i) => BASE + t.pattern.replace('%02d', String(i).padStart(2, '0'))); window.__urls = urls;
    /* w10: 8K ladder on Cloudflare R2 (HEVC 7680/5760 + H.264 3840/2560/1280, reverse 2560); falls back to the GitHub Pages ladder if R2 is unreachable or blocks CORS. ?cdn=0 = Pages only */
    let fU = new URL(F.hls, BASE).href, rU = new URL(j.tracks.rev.hls, BASE).href; window.__src = 'pages';
    if (j.cdn && params.get('cdn') !== '0') { try { const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 8000); /* w11: iPhone/iPad Safari gets the H.264-only ladder (3840 top): the 8K/5760 HEVC levels broke playback there; ?hevc=1 opts back in */ const cH = (isIOS && params.get('hevc') !== '1' && j.cdn.hlsIOS) ? j.cdn.hlsIOS : j.cdn.hls; window.__master = cH; const cr = await fetch(j.cdn.base + cH, { mode: 'cors', signal: ac.signal }); clearTimeout(to); if (cr.ok && (await cr.text()).includes('#EXTM3U')) { fU = j.cdn.base + cH; if (j.cdn.rev) rU = j.cdn.base + j.cdn.rev; window.__src = 'r2'; if (j.cdn.duration) { /* w15: the R2 stream is the extended continuous take (cdn.duration); Pages fallback keeps the original 11-min part */ D = j.cdn.duration; STILL = j.cdn.still || []; LO = params.has('full') ? 0 : (j.cdn.lo || 0); HI = params.has('full') ? D : (j.cdn.hi || D); } } } catch (e) { window.__src = 'pages (r2 failed: ' + e.name + ')'; } }
    { const r2 = window.__src === 'r2' && j.cdn.duration; fetch(new URL(r2 && j.cdn.heading ? j.cdn.heading : 'heading.json', BASE)).then(r => r.ok ? r.json() : null).then(h => { HEAD = h; }).catch(() => {}); window.__audioURL = new URL(r2 && j.cdn.audio ? j.cdn.audio : j.audio, BASE).href; }
    fwdT = new Track(fU, D, true); revT = new Track(rU, D, true); /* w4: reverse stream loads only after the forward walk is running */ active = fwdT;
    $('badge').innerHTML = `<b>Hội An</b> · real 360° street walk · <a href="https://github.com/Khoadang87/travel-experience/blob/main/cities/hoian/CREDITS.md" target="_blank">Credits</a>`; setTimeout(() => $('badge').classList.add('fade'), 100);
    $('streetbar').hidden = false; $('slabel').textContent = j.name;
    $('turnR').textContent = 'Walk ▶'; $('turnL').textContent = '↺ Turn around'; $('turnL').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); turnAround(); }); hold($('turnR'), 'walk');
    $('reset').textContent = 'Face ahead'; $('reset').onclick = () => { view.yaw = 0; view.pitch = 0; };
    updateQuality();
    document.addEventListener('visibilitychange', () => { if (document.hidden) { audio.pause(); active?.el.pause(); } else { if (soundOn) { aud.g = 0; aud.goal = AVOL; audio.currentTime = aWant(); audio.play().catch(() => {}); } if (active && !active.atEnd() && !view.standing) playSafe(active.el); } });
    $('quality').onclick = () => { qualityMode = qualityMode === 'auto' ? 'high' : qualityMode === 'high' ? 'low' : 'auto'; if (!active.hls) { params.set('quality', qualityMode); params.set('t', pos().toFixed(3)); location.search = params.toString(); return; } for (const tr of [fwdT, revT]) applyQuality(tr); updateQuality(); };
    $('scene').hidden = true;
    document.body.classList.add('minimal'); $('hint').textContent = isMobile ? 'Stick up: walk · stick down: walk back · 2nd finger: look' : 'W / ↑: walk · S / ↓: walk back · drag: look';
    new THREE.TextureLoader().load(BASE + j.poster, t => { t.colorSpace = THREE.SRGBColorSpace; if (!frames) { mat.map = t; mat.needsUpdate = true; if (!window.__state.loaded) renderer.setAnimationLoop(() => renderer.render(scene, camera)); } });
    audio.src = window.__audioURL;
    prog = setInterval(() => { try { const v = fwdT.el, b = v.buffered.length ? v.buffered.end(0) - v.currentTime : 0; $('fill').style.width = Math.min(100, 15 + b / 2 * 85) + '%'; } catch (e) {} }, 200);
    $('loadmsg').textContent = 'Loading the street…';
    await fwdT.seek(Math.max(LO, +(params.get('t') || 0))); fwdT.el.playbackRate = isIOS ? 1 : Math.max(0.0625, IDLE);
    if (fwdT.el.error) throw new Error('video failed to load (' + (fwdT.el.error.code) + ')');
    clearInterval(prog); $('loader').hidden = true; document.body.classList.remove('loading'); $('hint').classList.add('fade'); window.__state.loaded = true; updateQuality(); setSpin(true);
    if (!(await playSafe(fwdT.el))) showTap();
    let gyroOn = false;
    const onGesture = () => { $('tapstart').hidden = true; if (active.el.paused && !active.atEnd() && !view.standing) playSafe(active.el);
      if (!soundOn) { soundOn = true; aInit(); aud.g = 0; aud.goal = 0; if (aud.node) aud.node.gain.value = 0; else audio.volume = 0; audio.play().then(() => { if (!vidLive()) audio.pause(); }).catch(() => { soundOn = false; }); /* w4: unlock only; sound starts with the first moving frame */ }
      if (!gyroOn && isMobile && gyroWant && !gyroAttached) { gyroOn = true; enableGyro(); } };
    $('tapstart').onclick = onGesture; for (const ev of ['pointerup', 'touchend', 'keydown']) addEventListener(ev, () => { if (!soundOn || (active.el.paused && !active.atEnd())) onGesture(); }, true);
    // Reverse media stays unloaded until the user asks to walk backward.
  } catch (e) { clearInterval(prog); showError('The walk could not start: ' + e.message + '\nPlease reload.'); return; }
  let last = performance.now();
  const stall = { note: '' }; // HLS adapts quality; stream failures use the explicit error path.
  const dbgEl = params.get('debug') === '1' ? Object.assign(document.createElement('pre'), { id: 'walkdbg' }) : null; let dbgT = 0;
  if (dbgEl) { dbgEl.style.cssText = 'position:fixed;left:6px;right:6px;top:calc(env(safe-area-inset-top,0px) + 6px);z-index:98;margin:0;padding:8px 10px;background:rgba(0,0,0,.72);color:#ff9;font:600 15px/1.4 ui-monospace,Menlo,monospace;pointer-events:none;white-space:pre-wrap;border-radius:8px'; document.body.appendChild(dbgEl); }
  renderer.setAnimationLoop(() => { const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now; aTick(dt); crowd?.update(dt); gen?.update(dt);
    if (dbgEl && (dbgT += dt) > 0.25) { dbgT = 0; const v = active?.el; dbgEl.textContent = `walk ${quality} ${active === fwdT ? 'FWD' : 'REV'} chunk ${active?.ci} pos ${pos().toFixed(2)} [${LO}-${HI}]\nvideo ${v ? 'rs' + v.readyState + (v.paused ? ' PAUSED' : ' playing') + ' ct ' + v.currentTime.toFixed(2) + ' pr ' + v.playbackRate.toFixed(2) + ' ' + v.videoWidth + 'px' : '-'}\nstanding ${!!view.standing} target ${target.toFixed(2)} rate ${rate.toFixed(2)} swap ${swapping}\njoy ${joy.x.toFixed(2)},${joy.y.toFixed(2)} id ${joy.id} ev ${evc.down}/${evc.move}/${evc.up}/${evc.cancel} touch ${evc.ts}\nlast frame ${((now - lastAdv) / 1000).toFixed(1)}s ago ${stall.note} frames ${frames}
face ${view.face} other ${(() => { const o = active === fwdT ? revT : fwdT, e = o?.el; return e ? (o === fwdT ? 'F' : 'R') + ' rs' + e.readyState + (e.paused ? ' P' : ' PLAYING') + ' ct ' + e.currentTime.toFixed(2) + ' ' + e.videoWidth + 'px' : '-'; })()}
sw n${switchStats.n} parked ${switchStats.parked || 0} seeks ${switchStats.seeks} snap ${switchStats.snap || 0} stuck ${switchStats.stuck || 0}
${EVL.join('\n')}`; }
    let t = btnTarget === 'walk' ? WALK : null; const kf = keys.KeyW || keys.ArrowUp, jog = keys.ShiftLeft || keys.ShiftRight;
    /* w3: stick down walks backward along the street (view stays ahead); it no longer flips you around */
    if (t == null) { if (kf) t = jog ? JOG : WALK; else if (keys.KeyS || keys.ArrowDown) t = -WALK; else if (Math.abs(joy.y) > 0.2 && Math.abs(joy.y) > Math.abs(joy.x) * 0.7) { const m = (Math.abs(joy.y) - 0.2) / 0.8; t = Math.sign(-joy.y) * (m < 0.88 ? WALK * Math.max(0.35, Math.pow(m / 0.88, 1.2)) : JOG); } }
    view.lf = lookFace(); t = navigationPaused ? 0 : t == null ? IDLE : t * view.lf; /* w24: the stick follows where you LOOK along the street (within 90 deg of the walk direction = forward), not the last turn-around button state */ if (Math.abs(t) <= IDLE + 1e-6) t = IDLE; view.standing = IDLE === 0 && Math.abs(t) < 0.01 && Math.abs(rate) < 0.15; // standing: natural-looking forward footage at a slow drift
    target = t; rate += (target - rate) * Math.min(1, dt * 2.5);
    view.latT = (keys.KeyA ? -1 : keys.KeyD ? 1 : 0) + (Math.abs(joy.x) > 0.55 ? (joy.x - Math.sign(joy.x) * 0.55) / 0.45 : 0); view.lat = 0; /* w3: no sway */ { const jx = Math.abs(joy.x) > 0.6 && Math.abs(joy.x) > Math.abs(joy.y) * 1.4 ? /* w18: diagonals walk straight */ (joy.x - Math.sign(joy.x) * 0.6) / 0.4 : 0; const kt = (keys.KeyA ? -1 : keys.KeyD ? 1 : 0) + jx; if (kt) view.yaw -= kt * 0.9 * dt; /* w4: steer only when the stick is pushed clearly sideways */ }
    if (swapping && swapOld && !swapOld.el.paused) swapOld.el.pause(); /* w17b: a late play() must not restart the old direction mid-switch */
    if (window.__state.loaded && !swapping && !navigationPaused) {
      const idle = Math.abs(target) < 0.5;
      // direction: walking back uses the reversed track; idle keeps the current track (and ping-pongs at the ends)
      if (frames > 90) { /* only after the forward walk is running, so startup bandwidth goes to the first picture */ const dirA = active === fwdT ? 1 : -1, rev = Math.sign(target) === -dirA && Math.abs(target) > 0.05; if (Math.abs(target) > 0.3) prime(performance.now(), rev && !view._rv);  /* w22: standing still: park the other stream at your spot (one seek, never repeated while it loads) so either push starts with just play() */ view._rv = rev; }
      if (Math.abs(target) <= 0.3 && Math.abs(rate) < 0.3 && (frames > 90 || window.__ttff && performance.now() - window.__ttff > 4000)) idlePark(); /* w22: standing still: keep the other stream parked (decoded) at your spot so either push starts with just play() */
      let want = rate < -0.05 && target < 0 ? revT : rate > 0.3 && target > 0 ? fwdT : target > 0.3 ? fwdT : target < -0.3 ? revT : active; /* w18: follow the stick's intent, not the eased rate */ if (idle) want = IDLE > 0 ? ((pos() >= HI - 0.5) ? active : fwdT) : active;
      if (want !== active && !(want === revT && pos() <= LO + 0.2) && !(want === fwdT && pos() >= HI - 0.2)) switchTo(want);
      else if (active === fwdT && pos() >= HI - 0.05) { if (!active.el.paused) active.el.pause(); edgeStatus(); }
      else if (active === revT && pos() <= LO + 0.1) { if (!active.el.paused) active.el.pause(); edgeStatus(); }
      else if (view.standing) { if (!active.el.paused) active.el.pause(); edgeStatus(); }
      else { const v = active.el; if (v.paused && !active.atEnd() && !swapping && !v._pp) { v._pp = 1; playSafe(v).finally(() => { v._pp = 0; }); } let pr = Math.max(isIOS ? 0.5 : 0.0625, Math.min(3, Math.abs(Math.abs(rate - target) < 0.1 ? target : rate))); if (Math.abs(target) > 0.3 && STILL.some(([a, b]) => pos() >= a - 0.2 && pos() < b)) pr = 3; /* w22: stretches where the filmer stands still (measured with optical flow, walk.json cdn.still) fast-forward while the stick is held, so a push always moves you */ if (Math.abs(v.playbackRate - pr) > 0.1 || (pr === Math.abs(target) && v.playbackRate !== pr)) v.playbackRate = pr; /* few rate changes: each one can cost a pipeline flush on some engines */ active.tick(pr);
        edgeStatus(); }
    }
    view.sy += (view.yaw - view.sy) * 0.18; view.hd = view.hd ?? headAt(pos()); { const d = headAt(pos()) - view.hd; view.hd += Math.max(-0.35 * dt, Math.min(0.35 * dt, d * Math.min(1, dt * 0.8))); } const HD = view.hd; /* w5: heading eased (<=20 deg/s) */ view.sp += (view.pitch - view.sp) * 0.18; { const tt = view.face > 0 ? 0 : Math.PI - TURN_OFF(); view.turn += (tt - view.turn) * Math.min(1, dt * 2.2); } camera.quaternion.setFromEuler(new THREE.Euler(view.sp + GUP() + 0.15 * view.turn / Math.PI /* facing back: lift gaze a little so the camera carrier sits below frame */, view.sy + view.turn + HD, 0, 'YXZ'));
    if (view.gyro) camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), view.gyroYaw0)).multiply(view.gyro);
    { const eu = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); if (eu.x < -PMIN()) { eu.x = -PMIN(); camera.quaternion.setFromEuler(eu); } } // clamp final pitch (gyro included) so the stitched nadir never fills the screen
    nadirUpd(now); roadUpd(now);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize(); camera.position.copy(right.multiplyScalar(view.lat));
    const edge = pos() >= HI - 0.5 || pos() <= LO + 0.5, adv = now - lastAdv < 1500 || edge; $('live').textContent = adv ? (Math.abs(rate) > 0.5 && !edge ? (rate > 0 ? '● walking' : '● walking · turned around') : '● LIVE') + (soundOn ? '' : ' · tap for sound') : '○ loading';
    $('live').className = adv ? 'on' : ''; if (D) $('sfill').style.width = Math.max(0, (pos() - LO) / (HI - LO) * 100) + '%';
    renderer.render(scene, camera); });
  /* w23: guards that log to ?debug=1 and repair: (1) the stream that is not active never plays, (2) the picture always comes from the active stream, (3) a playing stream that jumps back on its own (iOS native HLS snap-back) is put back where it was, (4) holding the stick with the position not moving restarts the right stream */
  const wd = { el: null, ct: 0, p: 0, pT: 0 };
  setInterval(() => { if (!window.__state.loaded || swapping || navigationPaused || !active) return; const now = performance.now(), o = active === fwdT ? revT : fwdT, v = active.el;
    if (o && !o.el.paused) { o.el.pause(); evlog('paused stray ' + (o === fwdT ? 'F' : 'R')); }
    if (v.readyState >= 2 && mat.map !== active.tex[0]) { mat.map = active.tex[0]; mat.needsUpdate = true; evlog('texture -> active'); }
    const ct = v.currentTime;
    if (wd.el === v && !active._inSeek && !v.paused && !v.seeking && ct < wd.ct - 0.6 && now - (active._ownSeek || 0) > 1500) { evlog('SNAPBACK ' + (active === fwdT ? 'F' : 'R') + ' ' + wd.ct.toFixed(1) + '>' + ct.toFixed(1)); switchStats.snap = (switchStats.snap || 0) + 1; active._ownSeek = now; v.currentTime = wd.ct; }
    else if (!v.seeking || active._inSeek) wd.ct = ct; wd.el = v;
    const p = pos(), held = Math.abs(target) > 0.3 && !view.standing && (target > 0 ? p < HI - 0.6 : p > LO + 0.6);
    if (!held || Math.abs(p - wd.p) > 0.25) { wd.p = p; wd.pT = now; return; }
    if (active._inSeek || swapping) wd.pT = now; /* w23: a jump/seek in progress is not a stall; never fight it */
    if (now - wd.pT > 2000) { wd.pT = now; switchStats.stuck = (switchStats.stuck || 0) + 1; const want = target > 0 ? fwdT : revT; evlog('STUCK at ' + p.toFixed(1) + ' ' + (active === fwdT ? 'F' : 'R') + ' rs' + v.readyState + (v.paused ? ' P' : ' play') + ' ct ' + ct.toFixed(2)); if (want !== active) switchTo(want); else { active._ownSeek = now; active.seek(want === fwdT ? p + 0.05 : D - p + 0.05).then(() => playSafe(active.el)).catch(() => {}); } }
  }, 250);
  setInterval(() => { if (!window.__state.loaded || swapping) return; const v = active.el; if (!v.paused && !active.atEnd() && performance.now() - lastAdv > 2500 && !active.nudged) { active.nudged = true; v.currentTime = v.currentTime + 0.02; playSafe(v); lastAdv = performance.now(); return; } if (!v.paused && !active.atEnd() && performance.now() - lastAdv > 6000) { active.nudged = false; setSpin(true); $('nodestatus').textContent = 'Reconnecting…'; const p = pos(); active.loaded = [-1, -1]; active.seek(active === fwdT ? p : D - p).then(() => playSafe(active.el)); lastAdv = performance.now(); }
    else if (v.paused && !view.standing && !active.atEnd() && $('tapstart').hidden && !soundOn) showTap(); }, 1000);
})();
function showTap() { const t = $('tapstart'); t.textContent = '🔊 Tap to start'; t.hidden = false; }
/* Public hooks for custom UI (buttons etc.). Example: HoianWalk.setWalk(true) while a button is held.
   setWalk(on|null): walk forward like the stick; turnAround(); faceAhead(); state() -> { pos, lo, hi, facing, standing, sound } */
window.HoianWalk = {
  pauseNavigation: on => { navigationPaused = !!on; if (on) { for (const key in keys) delete keys[key]; joy = {x:0,y:0,id:null}; knob.style.transform = ''; btnTarget = null; target = rate = 0; active?.pauseAll(); stopAudioNow(); } },
  goTo: async value => { if (!Number.isFinite(value) || !active || swapping) throw new Error('Please wait for the current video to finish loading.'); const point = Math.max(0, Math.min(D - .1, value)); /* w18: junctions may jump outside the current clip range */ stopAudioNow(); await snapTo(point); view.hd = headAt(point); view.face = 1; view.turn = 0; target = rate = 0; },
  setGyro: on => setGyro(on), gyro: () => gyroWant, setWalk: on => { btnTarget = on ? 'walk' : null; }, turnAround: () => turnAround(), faceAhead: () => { view.yaw = 0; view.pitch = 0; }, state: () => ({ pos: pos(), quality: qualityMode, lo: LO, hi: HI, facing: (view.lf || view.face) > 0 ? 'forward' : 'back', lookRel: +THREE.MathUtils.radToDeg(lookRel()).toFixed(1), standing: !!view.standing, sound: soundOn, rate, joy: joy.y, swapping, base: active ? (active === fwdT ? 'fwd' : 'rev') + ' rs' + active.el.readyState + (active.el.paused ? 'P' : '>') : '-' }) };
/* w18: hooks for features.js (junctions, points of interest, mini-map). Footage bearing b (deg, +right of the frame centre) = camera yaw -b. */
window.__walkAPI = { THREE, scene, camera, canvas: renderer.domElement, view, pos: () => pos(), headAt: p => headAt(p), head: () => HEAD, range: () => ({ lo: LO, hi: HI, d: D }), setRange: (lo, hi) => { LO = lo; HI = hi; }, intent: () => target, loaded: () => !!window.__state.loaded, swapping: () => swapping,
  lookBearing: () => { const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); return -THREE.MathUtils.radToDeg(e.y); },
  jump: async (t, lookBearing, face = 1) => { await window.HoianWalk.goTo(t); view.face = face < 0 ? -1 : 1; view.lf = view.face; view.turn = view.face > 0 ? 0 : Math.PI - TURN_OFF(); /* w18: a branch can be entered walking its footage backwards (facing back) */ if (lookBearing != null) { const y = -THREE.MathUtils.degToRad(lookBearing) - view.hd - view.turn; view.yaw = view.sy = y; } } };
window.__hlsInfo = () => fwdT?.hls ? { cur: fwdT.hls.currentLevel, next: fwdT.hls.nextLoadLevel, start: fwdT.hls.startLevel, bw: Math.round(fwdT.hls.bandwidthEstimate / 1e5) / 10, lv: fwdT.hls.levels.map(l => l.width) } : null;
window.__test = { src: () => window.__src, sw: () => switchStats, hd: () => view.hd, shown: () => mat.map ? (mat.map.isVideoTexture ? 'video' : 'poster') : 'none', ttff: () => window.__ttff, head: () => headAt(pos()), vidLive: () => vidLive(), road: () => road && { gain: road.m.uniforms.gain.value.toArray(), off: road.m.uniforms.off.value }, look: () => ({ yaw: view.yaw, pitch: view.pitch, gyro: !!view.gyro }), nadir: () => nadir && nadir.m.uniforms.col.value.getHexString(), aud: () => ({ t: +audio.currentTime.toFixed(1), want: +aWant().toFixed(1), g: +aud.g.toFixed(2), paused: audio.paused, webaudio: !!aud.node, ctx: aud.ctx?.state }), turn: () => turnAround(), view: () => ({ face: view.face, turn: +view.turn.toFixed(2) }), setYaw: y => view.yaw = y, setPitch: p => view.pitch = p, key: (c, d) => keys[c] = d, els: () => [fwdT, revT].flatMap(t => t.els.map((v, j) => ({ t: t === fwdT ? "f" : "r", j, act: j === t.k, src: v.src.split("/").pop(), p: v.paused, rs: v.readyState, ct: +v.currentTime.toFixed(2), pr: v.playbackRate, buf: v.buffered.length ? +v.buffered.end(v.buffered.length - 1).toFixed(1) : 0 }))), state: () => ({ pos: pos(), D, rate, target, dir: active === fwdT ? 'fwd' : 'rev', chunk: active?.ci, frames, chunkSwaps, paused: active?.el.paused, w: active?.el.videoWidth, q: quality, swapping, err: window.__viewerError || null }) };

