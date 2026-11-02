import * as THREE from 'three';
import {Software360Renderer} from './software-360-w60.mjs';
import {wrap, boundedTime, movement, dragDelta, tableHeading, FRONT} from './navigation-w60.mjs';
import {SourceSession} from './source-session-w60.mjs';

function startWalk() {
const VER = 'w60', $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
let network, heading, returnHeading, busy = false, proposal = null, previousFocus, lastTravelHeading = NaN;
const records = [], record = (kind, data = {}) => {
  records.push({kind, version:VER, at:Math.round(performance.now()), ...data});
  if (records.length > 80) records.shift();
};
const look = {yaw:0, pitch:0, drag:null};
function createRenderer() {
  try {return new THREE.WebGLRenderer({antialias:false});}
  catch (error) {record('renderer-fallback',{reason:'WebGL unavailable'}); return new Software360Renderer({nadir:params.get('nadir') !== '0'});}
}
const renderer = createRenderer();
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight); $('app').append(renderer.domElement);
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, .1, 200);
const sphere = new THREE.SphereGeometry(50, 128, 64); sphere.scale(-1, 1, 1);
const material = new THREE.MeshBasicMaterial({color:0xffffff}); material.precision = 'highp';
scene.add(new THREE.Mesh(sphere, material));

// Preserve the separate nadir disc that was introduced for iPhone. This is a
// camera mask, not reconstructed scenery or a substitute walking surface.
const discCanvas = document.createElement('canvas'); discCanvas.width = discCanvas.height = 128;
const discContext = discCanvas.getContext('2d');
const discTexture = new THREE.CanvasTexture(discCanvas); discTexture.colorSpace = THREE.SRGBColorSpace;
const disc = new THREE.Mesh(new THREE.CircleGeometry(36, 64), new THREE.MeshBasicMaterial({map:discTexture, transparent:true, depthTest:false, depthWrite:false}));
disc.rotation.x = -Math.PI / 2; disc.position.y = -45; disc.renderOrder = 10; disc.frustumCulled = false;
disc.visible = params.get('nadir') !== '0'; scene.add(disc);
const sampleCanvas = document.createElement('canvas'); sampleCanvas.width = 64; sampleCanvas.height = 32;
const sampleContext = sampleCanvas.getContext('2d', {willReadFrequently:true});
function paintDisc(color = [120, 115, 105]) {
  const c = color.join(','), gradient = discContext.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, `rgba(${c},1)`); gradient.addColorStop(.62, `rgba(${c},1)`); gradient.addColorStop(1, `rgba(${c},0)`);
  discContext.clearRect(0, 0, 128, 128); discContext.fillStyle = gradient; discContext.fillRect(0, 0, 128, 128); discTexture.needsUpdate = true;
}
paintDisc();

// Bounded, disposable media adapters. An unavailable return file leaves the old
// panorama selected. No expiring/signed provider URL is embedded in this player.
function createAdapter(path) {
  const video = document.createElement('video');
  video.muted = video.defaultMuted = true; video.playsInline = true;
  video.setAttribute('playsinline', ''); video.crossOrigin = 'anonymous'; video.preload = 'auto';
  video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1';
  document.body.append(video);
  const texture = new THREE.VideoTexture(video); texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
  let hls, disposed = false, fatal = '', frameTime = NaN, callbackId;
  if (video.requestVideoFrameCallback) {
    const frame = (_, metadata) => { frameTime = metadata.mediaTime; if (!disposed) callbackId = video.requestVideoFrameCallback(frame); };
    callbackId = video.requestVideoFrameCallback(frame);
  }
  const wait = (condition, timeout, message) => new Promise((resolve, reject) => {
    const started = performance.now();
    const tick = () => {
      if (disposed) return reject(new Error('Cancelled route load.'));
      if (fatal || video.error) return reject(new Error(fatal || 'The recorded video could not load.'));
      if (condition()) return resolve();
      if (performance.now() - started >= timeout) return reject(new Error(message));
      setTimeout(tick, 40);
    }; tick();
  });
  const adapter = {video, texture, pause:() => video.pause(), get error() {return fatal || (video.error ? 'The recorded stream stopped. Your last view is preserved.' : '');},
    async prepare(time) {
      if (path.source_kind === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) {
        if (!window.Hls?.isSupported()) throw new Error('This browser cannot play the recorded stream.');
        hls = new window.Hls({startPosition:time, maxBufferLength:12, maxMaxBufferLength:24, backBufferLength:8, startLevel:0, abrEwmaDefaultEstimate:3e6});
        let recoveries = 0;
        hls.on(window.Hls.Events.ERROR, (_, data) => {
          if (!data.fatal) return;
          if (recoveries++ < 1 && data.type === window.Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
          else fatal = 'The recorded stream failed to load. Your previous view is preserved.';
        });
        hls.loadSource(path.src); hls.attachMedia(video);
      } else { video.src = path.src + (path.source_kind === 'hls' ? '#t=' + time : ''); video.load(); }
      await wait(() => video.readyState >= 1, 25000, 'The recorded video took too long to load.');
      if (Number.isFinite(video.duration) && video.duration < path.end - .05) throw new Error('The media file does not contain this route.');
      frameTime = NaN; video.currentTime = time;
      await wait(() => !video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - time) < .6, 15000, 'The requested recorded point did not load.');
      // Some WebKit versions present no frame while a new element is paused.
      // A bounded muted decode primes the target, still behind the old panorama.
      if (video.requestVideoFrameCallback && (!Number.isFinite(frameTime) || Math.abs(frameTime - time) > .6)) {
        const playing = video.play(); playing?.catch(() => {});
        try { await wait(() => Number.isFinite(frameTime) && Math.abs(frameTime - time) < .6, 1800, 'A decoded panorama was not presented.'); }
        finally { video.pause(); }
      }
      video.pause();
      // Muted frame priming can advance the playhead while the event loop is
      // busy projecting the old panorama. Land again while paused before the
      // source transaction validates and exposes the requested starting point.
      const afterPrime = video.currentTime;
      const correctedLanding = Math.abs(afterPrime - time) > .12;
      if (correctedLanding) {
        frameTime = NaN; video.currentTime = time;
        await wait(() => !video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - time) <= .12,
          15000, 'The recorded starting point did not settle.');
      }
      console.info('Hoian media landing', JSON.stringify({version:VER, requested:time, afterPrime,
        correctedLanding, actual:video.currentTime, paused:video.paused, readyState:video.readyState}));
      return {decoded:video.readyState >= 2 && video.videoWidth > 0, time:video.currentTime};
    },
    dispose() {
      if (disposed) return; disposed = true; video.pause();
      if (callbackId != null) video.cancelVideoFrameCallback?.(callbackId);
      hls?.destroy(); video.removeAttribute('src'); video.load(); texture.dispose(); video.remove();
    }
  };
  return adapter;
}

const audio = new Audio(); audio.crossOrigin = 'anonymous'; audio.preload = 'none';
let soundOn = (() => {try {return localStorage.getItem('hoianSound') !== 'off';} catch {return true;}})();
let audioReady = false, playPending = false, playFailed = false;
const session = new SourceSession(createAdapter, next => {
  material.map = next.adapter.texture; material.needsUpdate = true;
  look.yaw = headingAt(next.path, next.adapter.video.currentTime); look.pitch = 0;
  lastTravelHeading = look.yaw;
  $('route-label').textContent = next.path.label + (renderer.mode ? ' · compatibility picture' : ''); $('startup').hidden = true;
  audio.pause(); playFailed = false; playPending = false;
  record('source-committed', {route:next.routeId, time:next.adapter.video.currentTime});
});
function headingAt(path, time) {
  if (path.heading_kind === 'main_foe') return tableHeading(heading, time);
  if (path.heading_kind === 'return_geometry_estimate') return tableHeading(returnHeading, time);
  return NaN;
}
function soundUI() {
  const unavailable = session.active?.path.sound_available === false || !audioReady;
  $('sound').disabled = unavailable; $('sound').textContent = unavailable ? 'No source sound' : soundOn ? 'Sound on' : 'Sound off';
  $('sound').setAttribute('aria-pressed', String(soundOn && !unavailable));
}
function pause() { session.active?.adapter.pause(); audio.pause(); }
function soundTick(playing) {
  const active = session.active;
  if (!playing || !soundOn || !audioReady || active?.path.sound_available === false) {audio.pause(); return;}
  const video = active.adapter.video;
  if (Math.abs(audio.currentTime - video.currentTime) > 1.5) audio.currentTime = video.currentTime;
  audio.playbackRate = video.playbackRate; audio.volume = .85;
  if (audio.paused) audio.play().catch(() => {});
}
let audioUnlockPending = false;
function unlockAudio() {
  if (!audioReady || audioUnlockPending || !audio.paused || !soundOn) return;
  audioUnlockPending = true; audio.muted = true;
  const attempt = audio.play();
  Promise.resolve(attempt).catch(() => {}).finally(() => {audio.pause(); audio.muted = false; audioUnlockPending = false;});
}
addEventListener('pointerdown', unlockAudio, {capture:true});
$('sound').onclick = () => {soundOn = !soundOn; try {localStorage.setItem('hoianSound', soundOn ? 'on' : 'off');} catch {} audio.pause(); soundUI();};

const joy = {id:null, x:0, y:0, cx:0, cy:0}, keys = {};
function resetInput() {
  const id = joy.id; joy.id = null; joy.x = joy.y = 0; look.drag = null;
  if (id != null && $('joy').hasPointerCapture?.(id)) $('joy').releasePointerCapture(id);
  $('knob').style.transform = ''; for (const key of Object.keys(keys)) keys[key] = false;
  pause();
}
function joystickMove(event) {
  const radius = $('joy').getBoundingClientRect().width / 2;
  let x = (event.clientX - joy.cx) / radius, y = (event.clientY - joy.cy) / radius;
  const length = Math.hypot(x, y); if (length > 1) {x /= length; y /= length;}
  joy.x = x; joy.y = y; $('knob').style.transform = `translate(${x * radius * .6}px,${y * radius * .6}px)`;
}
const modalOpen = () => !$('routes').hidden || !$('edit').hidden;
$('joy').addEventListener('pointerdown', event => {
  if (busy || modalOpen() || !session.active || joy.id != null) return;
  event.preventDefault(); playFailed = false;
  const rect = $('joy').getBoundingClientRect(); joy.id = event.pointerId; joy.cx = rect.left + rect.width / 2; joy.cy = rect.top + rect.height / 2;
  $('joy').setPointerCapture(event.pointerId); joystickMove(event);
});
renderer.domElement.addEventListener('pointerdown', event => {
  if (busy || modalOpen() || look.drag) return;
  renderer.domElement.setPointerCapture(event.pointerId); look.drag = {id:event.pointerId, x:event.clientX, y:event.clientY};
});
addEventListener('pointermove', event => {
  if (event.pointerId === joy.id) return joystickMove(event);
  const drag = look.drag;
  if (drag?.id === event.pointerId) {
    const delta = dragDelta(event.clientX - drag.x, event.clientY - drag.y, camera.fov, innerHeight);
    look.yaw = wrap(look.yaw + delta.yaw); look.pitch = Math.max(-1.55, Math.min(1.55, look.pitch + delta.pitch));
    drag.x = event.clientX; drag.y = event.clientY;
  }
});
const pointerEnd = event => {
  if (event.pointerId === joy.id) resetInput();
  if (look.drag?.id === event.pointerId) look.drag = null;
};
addEventListener('pointerup', pointerEnd); addEventListener('pointercancel', pointerEnd);
$('joy').addEventListener('lostpointercapture', pointerEnd);
addEventListener('blur', resetInput);
document.addEventListener('visibilitychange', () => {if (document.hidden) resetInput();});
addEventListener('keydown', event => {
  if (event.code === 'Escape') { if (!$('edit').hidden) closeModal('edit'); else if (!$('routes').hidden) closeModal('routes'); return; }
  if (event.code === 'Tab' && modalOpen()) {
    const modal = !$('edit').hidden ? $('edit') : $('routes');
    const nodes = [...modal.querySelectorAll('button:not(:disabled),a,summary')].filter(el => el.getClientRects().length);
    const first = nodes[0], last = nodes.at(-1);
    if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
    else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
    return;
  }
  if (busy || modalOpen() || !session.active || /INPUT|TEXTAREA|BUTTON|SUMMARY/.test(event.target.tagName)) return;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD'].includes(event.code)) {
    event.preventDefault(); keys[event.code] = true; playFailed = false;
  }
});
addEventListener('keyup', event => {keys[event.code] = false;});
function openModal(id) {
  resetInput(); previousFocus = document.activeElement; $(id).hidden = false;
  $('app').inert = true; $('joy').inert = true; document.querySelector('.topbar').inert = true;
  $(id).querySelector('button')?.focus();
}
function closeModal(id) {
  if (busy) session.cancel();
  $(id).hidden = true; resetInput();
  $('app').inert = false; $('joy').inert = false; document.querySelector('.topbar').inert = false;
  if (id === 'edit') proposal = null;
  previousFocus?.focus();
}
$('routes-open').onclick = () => openModal('routes'); $('routes-close').onclick = () => closeModal('routes');
$('edit-cancel').onclick = () => closeModal('edit');
function proposeEdit(choice) {
  proposal = choice; $('edit-notice').textContent = choice.notice; $('edit-confirm').textContent = 'View ' + network.paths[choice.path].label; $('edit-error').textContent = '';
  record('edit-proposed', {from:session.active.routeId, time:session.active.adapter.video.currentTime, junction:choice.junctionId});
  openModal('edit');
}
$('edit-confirm').onclick = async () => {
  const choice = proposal; if (!choice || busy) return;
  const result = await openRoute(choice.path, choice.time, 'explicit-edited-junction');
  if (result.ok) {closeModal('edit'); $('status').textContent = 'Edited source change complete. Release, then push up to follow this footage.';}
  else if (!result.cancelled) $('edit-error').textContent = result.error + ' The previous view is preserved.';
};
$('face-route').onclick = () => {
  const active = session.active; if (!active || busy) return;
  resetInput(); look.yaw = headingAt(active.path, active.adapter.video.currentTime);
  $('face-route').hidden = true; $('status').textContent = 'Facing the estimated recorded direction. Push up to follow the footage.';
};
async function openRoute(id, time, reason) {
  if (!network?.paths[id] || busy) return {ok:false, error:'Route is not ready.'};
  busy = true; resetInput(); $('status').textContent = 'Loading the recorded point. Playback will remain paused.';
  $('edit-confirm').disabled = true; $('retry').disabled = true;
  try {
    const result = await session.open(id, network.paths[id], time);
    record('load-result', {route:id, reason, ok:result.ok, cancelled:!!result.cancelled, time:result.time});
    if (result.ok) {$('status').textContent = 'Paused. Push up to follow the recorded path.'; $('face-route').hidden = true; soundUI();}
    else if (!result.cancelled) {
      $('status').textContent = result.error;
      if (!session.active) {$('load-message').textContent = result.error; $('retry').hidden = false;}
    }
    return result;
  } finally {busy = false; resetInput(); $('edit-confirm').disabled = false; $('retry').disabled = false;}
}
$('retry').onclick = () => openRoute('bridge_bound', network.paths.bridge_bound.start, 'retry');

let last = performance.now(), lastDiagnostic = 0, lastSample = 0;
renderer.setAnimationLoop(() => {
  const now = performance.now(), dt = Math.min(.1, (now - last) / 1000); last = now;
  const active = session.active;
  if (active && !busy && !modalOpen()) {
    const video = active.adapter.video, time = video.currentTime;
    const travelYaw = headingAt(active.path, time);
    if (!video.paused && Number.isFinite(travelYaw) && Number.isFinite(lastTravelHeading)) {
      look.yaw = wrap(look.yaw + wrap(travelYaw - lastTravelHeading));
    }
    lastTravelHeading = travelYaw;
    const back = keys.ArrowDown || keys.KeyS || (joy.id != null && Math.hypot(joy.x, joy.y) >= .3 && Math.abs(Math.atan2(joy.x, -joy.y)) > 100 * Math.PI / 180);
    const turn = back ? 0 : (keys.ArrowLeft || keys.KeyA ? 1 : keys.ArrowRight || keys.KeyD ? -1 : Math.abs(joy.x) >= .3 ? Math.sign(joy.x) * (Math.abs(joy.x) - .3) / .7 : 0);
    look.yaw = wrap(look.yaw + turn * 1.22 * dt);
    const push = keys.ArrowUp || keys.KeyW ? 1 : joy.id != null && joy.y < -.2 && !back ? .5 + .5 * Math.min(1, (-joy.y - .2) / .65) : 0;
    const intent = back ? 'return' : push ? 'forward' : 'idle';
    const choice = active.adapter.error ? {kind:'blocked', reason:active.adapter.error} : movement(network, active.routeId, time, look.yaw, travelYaw, intent);
    $('face-route').hidden = !(Number.isFinite(travelYaw) && Math.abs(wrap(look.yaw - travelYaw)) >= FRONT);
    if (choice.kind === 'edit_proposal') {pause(); proposeEdit(choice);}
    else if (choice.kind === 'play' && !playFailed) {
      video.playbackRate = Math.max(.5, Math.min(1, push));
      if (video.paused && !playPending) {
        playPending = true;
        video.play().catch(() => {if (session.active !== active) return; playFailed = true; resetInput(); $('status').textContent = 'Playback was blocked. Release and push again.';}).finally(() => {
          if (session.active !== active) return;
          playPending = false;
          const stillForward = (keys.ArrowUp || keys.KeyW || joy.id != null && joy.y < -.2) && movement(network, active.routeId, video.currentTime, look.yaw, headingAt(active.path, video.currentTime), 'forward').kind === 'play';
          if (busy || modalOpen() || document.hidden || !stillForward) video.pause();
        });
      }
      $('status').textContent = video.readyState < 3 ? 'Buffering the real footage…' : '';
    } else {pause(); if (choice.kind === 'blocked') $('status').textContent = choice.reason;}
    soundTick(choice.kind === 'play' && !video.paused && video.readyState >= 3);
    const elapsed = Math.max(0, time - active.path.start), duration = active.path.end - active.path.start;
    $('progress').textContent = `${video.paused ? 'Paused' : video.readyState < 3 ? 'Buffering' : 'Walking'} · ${Math.floor(elapsed)} / ${duration} s`;
    if (intent !== 'idle' && now - lastDiagnostic > 1000) {
      record('movement', {route:active.routeId, time, viewYaw:look.yaw, travelYaw, intent, outcome:choice.kind, paused:video.paused}); lastDiagnostic = now;
    }
  } else soundTick(false);
  if (active && now - lastSample > 500 && active.adapter.video.readyState >= 2) {
    lastSample = now;
    try {
      sampleContext.drawImage(active.adapter.video, 0, 0, 64, 32);
      const pixels = sampleContext.getImageData(0, 25, 64, 2).data, sum = [0,0,0];
      for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) sum[c] += pixels[i + c];
      paintDisc(sum.map(c => Math.round(c / (pixels.length / 4))));
    } catch { /* A blocked cross-origin sample must not stop the walk. */ }
  }
  if (active) {camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw, 0, 'YXZ')); renderer.render(scene, camera);}
  if (!$('debug').hidden && active) $('debug').textContent = JSON.stringify({version:VER, route:active.routeId, time:+active.adapter.video.currentTime.toFixed(2), viewYaw:look.yaw, heading:headingAt(active.path, active.adapter.video.currentTime), readyState:active.adapter.video.readyState, busy, stick:[joy.x,joy.y]}, null, 1);
});
addEventListener('resize', () => {camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);});
renderer.domElement.addEventListener('webglcontextlost', event => {event.preventDefault(); resetInput(); $('status').textContent = 'The picture renderer stopped. Reload to restore the filmed view.';});
// Freeze playback on unload without scheduling further work on the laptop.
addEventListener('pagehide', () => {resetInput(); session.cancel();});
$('debug').hidden = params.get('debug') !== '1';
window.__w = {ver:VER, records:() => records.map(item => ({...item})),
  state:() => ({route:session.active?.routeId, time:session.active?.adapter.video.currentTime, ready:!!session.active, busy, paused:session.active?.adapter.video.paused, look:{yaw:look.yaw,pitch:look.pitch}})};

(async () => {
  try {
    const response = await fetch('route-network-w60.json', {cache:'no-store'});
    if (!response.ok) throw new Error('The route definition is unavailable.'); network = await response.json();
    const h = await fetch(network.heading_src); if (!h.ok) throw new Error('The recorded direction data is unavailable.'); heading = await h.json();
    if (!Number.isFinite(tableHeading(heading, network.paths.bridge_bound.start))) throw new Error('The recorded direction data is invalid.');
    const rh = await fetch(network.paths.street_bound.heading_src);
    if (!rh.ok) throw new Error('The return direction data is unavailable.');
    returnHeading = await rh.json();
    if (!Number.isFinite(tableHeading(returnHeading, network.paths.street_bound.start))) throw new Error('The return direction data is invalid.');
    for (const [id, path] of Object.entries(network.paths)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'route-choice';
      const title = document.createElement('strong'), detail = document.createElement('span'); title.textContent = path.label; detail.textContent = path.description;
      button.append(title, detail); button.onclick = async () => {
        if (busy) return;
        const result = await openRoute(id, path.start, 'explicit-route-start');
        if (result.ok) closeModal('routes');
      }; $('route-choices').append(button);
    }
    fetch(network.main_audio_src).then(r => r.ok ? r.json() : Promise.reject()).then(data => {
      if (data.cdn?.audio) {audio.src = data.cdn.audio; audioReady = true; soundUI();}
    }).catch(() => {audioReady = false; soundUI();});
    await openRoute('bridge_bound', network.paths.bridge_bound.start, 'boot');
  } catch (error) {$('load-message').textContent = error.message; record('boot-error');}
})();

}
try { startWalk(); }
catch (error) {
  const startup = document.getElementById('startup');
  startup.hidden = false; startup.setAttribute('role','alert');
  startup.querySelector('h1').textContent = '360° view unavailable';
  document.getElementById('load-message').textContent = 'This browser could not start the 360° picture renderer. Try a browser with WebGL available, or reload the page. No footage has been replaced.';
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  document.getElementById('joy').hidden = true;
  document.getElementById('progress').textContent = 'Not loaded';
  const retry = document.getElementById('retry');
  retry.hidden = false; retry.disabled = false; retry.textContent = 'Reload page';
  retry.onclick = () => location.reload();
  window.__w = {ver:'w60', state:() => ({ready:false, failure:'startup-renderer', error:error.message})};
}
