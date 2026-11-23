import { DEFAULT_360, FLAT, FLAT_BUSINESS } from "./shared.js";

const DEG = Math.PI / 180;

export function mountPlayer(root) {
  root.innerHTML = `
    <div class="player-shell" hidden>
      <div class="player-panel" role="dialog" aria-modal="true" aria-labelledby="player-title">
        <div class="player-top">
          <div>
            <p class="eyebrow" id="player-kicker">360 preview</p>
            <h2 id="player-title">Pin</h2>
          </div>
          <div class="player-top-actions">
            <button type="button" class="icon-btn" data-fs aria-label="Enter fullscreen">Full screen</button>
            <button type="button" class="icon-btn" data-close aria-label="Close player">Close</button>
          </div>
        </div>
        <p class="sample-banner" data-sample-banner></p>
        <p class="offer-line" data-offer hidden></p>
        <div class="stage" data-stage>
          <canvas data-canvas></canvas>
          <img data-poster alt="" hidden>
          <div class="watermark" data-watermark hidden></div>
          <div class="trial-end" data-trial-end hidden>Trial preview is capped at <span data-cap-label>45</span> seconds.</div>
          <div class="look-hint">Move stick: walk — the clip moves only while you walk · Look stick: look around</div>
        </div>
        <div class="player-controls">
          <div class="sticks">
            <div class="stick-wrap">
              <div class="stick" data-stick="look" role="application" aria-label="Look joystick">
                <div class="stick-knob"></div>
              </div>
              <span>Look</span>
            </div>
            <div class="stick-wrap">
              <div class="stick" data-stick="move" role="application" aria-label="Move joystick: push up or down to walk forward or back, left or right to turn">
                <span class="stick-dir dir-up" aria-hidden="true">↑</span>
                <span class="stick-dir dir-down" aria-hidden="true">↓</span>
                <span class="stick-dir dir-left" aria-hidden="true">←</span>
                <span class="stick-dir dir-right" aria-hidden="true">→</span>
                <div class="stick-knob"></div>
              </div>
              <span>Move</span>
            </div>
          </div>
          <div class="transport">
            <button type="button" class="text-btn" data-play>Play</button>
            <input type="range" min="0" max="1000" value="0" data-seek aria-label="Clip position">
            <span class="time" data-time>0:00 / 0:00</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const shell = root.querySelector(".player-shell");
  const canvas = root.querySelector("[data-canvas]");
  const titleEl = root.querySelector("#player-title");
  const kicker = root.querySelector("#player-kicker");
  const banner = root.querySelector("[data-sample-banner]");
  const offerEl = root.querySelector("[data-offer]");
  const watermark = root.querySelector("[data-watermark]");
  const trialEnd = root.querySelector("[data-trial-end]");
  const capLabel = root.querySelector("[data-cap-label]");
  const playBtn = root.querySelector("[data-play]");
  const seek = root.querySelector("[data-seek]");
  const timeEl = root.querySelector("[data-time]");
  const closeBtn = root.querySelector("[data-close]");
  const fsBtn = root.querySelector("[data-fs]");
  const panel = root.querySelector(".player-panel");
  const posterEl = root.querySelector("[data-poster]");

  const video = document.createElement("video");
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.muted = true;
  video.loop = false;
  video.crossOrigin = "anonymous";
  // Slow stroll: half-speed playback so people and street life read
  // as real and unhurried instead of rushing past the camera.
  video.playbackRate = 0.5;
  video.addEventListener("loadeddata", () => {
    // Browsers can reset playbackRate to 1 when a new source loads;
    // re-apply half-speed every time a clip loads.
    video.playbackRate = 0.5;
  });

  let yaw = 0;
  let pitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let raf = 0;
  let renderer, scene, camera, mesh, meshFlat, texture;
  let trial = false;
  let flatMode = false;
  let trialCap = 45;
  let walkAxis = 0;
  let turnAxis = 0;
  let walkSmooth = 0;
  let turnSmooth = 0;
  // Pause-while-walking state: whether the clip was playing when the
  // current walk started, and whether the walk itself paused it.
  let wasPlayingBeforeWalk = false;
  let walkPausedVideo = false;
  let lastTs = 0;
  let lookAxis = { x: 0, y: 0 };
  let lookVelX = 0;
  let lookVelY = 0;
  let dragVelX = 0;
  let dragVelY = 0;
  let capped = false;
  let onCloseCb = null;
  let pendingHi = null;
  const DEADZONE = 0.12;
  // Radians/sec at full stick deflection — matches the old 1.2° / 0.9°
  // per frame at 60fps, but now scaled by dt so yaw speed is the same
  // on a 60fps phone and on a ~11fps software renderer.
  const LOOK_YAW_SPEED = 1.2 * (Math.PI / 180) * 60;
  const LOOK_PITCH_SPEED = 0.9 * (Math.PI / 180) * 60;
  const TURN_YAW_SPEED = 1.2 * (Math.PI / 180) * 60;
  const LOOK_FRICTION = 6.5;
  const DRAG_FRICTION = 5.5;

  function maxTime() {
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    if (trial) return Math.min(dur || trialCap, trialCap);
    return dur;
  }

  function fmt(t) {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ":" + String(s).padStart(2, "0");
  }

  function syncTransport() {
    const cap = maxTime();
    if (cap > 0) seek.value = String(Math.round((video.currentTime / cap) * 1000));
    timeEl.textContent = `${fmt(video.currentTime)} / ${fmt(cap || video.duration || 0)}`;
    playBtn.textContent = video.paused ? "Play" : "Pause";
  }

  function enforceCap() {
    if (!trial) return;
    const cap = maxTime();
    if (video.currentTime >= cap - 0.05) {
      video.currentTime = cap;
      if (!video.paused) video.pause();
      capped = true;
      trialEnd.hidden = false;
    }
  }

  async function ensureThree() {
    if (renderer) return;
    const THREE = await import("../vendor/three.module.js");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 200);
    texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const geom = new THREE.SphereGeometry(80, 64, 48);
    geom.scale(-1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ map: texture });
    mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);
    // Curved screen for flat video: a cylindrical patch centred in
    // front of the camera (-Z), wide enough for ultrawide footage.
    // Same x-flip trick as the sphere so the picture is not mirrored.
    // Gentler curve than a tight cylinder (radius 45, 1.6 rad wide)
    // so the top/bottom edges stay nearly straight and the picture
    // is not cropped at the centre.
    const flatGeom = new THREE.CylinderGeometry(45, 45, 30.3, 64, 1, true, Math.PI - 0.8, 1.6);
    flatGeom.scale(-1, 1, 1);
    meshFlat = new THREE.Mesh(flatGeom, mat);
    meshFlat.visible = false;
    scene.add(meshFlat);
    camera.rotation.order = "YXZ";
  }

  function resize() {
    if (!renderer) return;
    const stage = canvas.parentElement;
    const w = stage.clientWidth || 640;
    const h = stage.clientHeight || 360;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    if (flatMode) {
      // Fit the curved screen (45 radius, 72 wide, 30.3 tall) in the
      // frame with a small margin, so it fills the panel instead of
      // sitting as a narrow band with big black areas above and below.
      const tanV = Math.max(0.354, 0.8 / aspect);
      camera.fov = Math.max(25, Math.min(100, (2 * Math.atan(tanV)) / DEG));
    } else {
      camera.fov = 75;
    }
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  function tick(ts) {
    raf = requestAnimationFrame(tick);
    // Frame time in seconds, clamped: walk speed must not depend on
    // the frame rate (headless/software rendering runs ~11fps, a
    // phone runs 60fps) — 0.015s/frame is the 60fps design rate.
    const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 1 / 60;
    lastTs = ts;
    // Look stick: dt-scaled yaw so speed is consistent across frame
    // rates, plus inertia that coasts and friction-decays on release.
    if (lookAxis.x || lookAxis.y) {
      lookVelX = lookAxis.x * LOOK_YAW_SPEED;
      lookVelY = lookAxis.y * LOOK_PITCH_SPEED;
    } else {
      const decay = Math.exp(-LOOK_FRICTION * dt);
      lookVelX *= decay;
      lookVelY *= decay;
      if (Math.abs(lookVelX) < 0.02) lookVelX = 0;
      if (Math.abs(lookVelY) < 0.02) lookVelY = 0;
    }
    if (lookVelX || lookVelY) {
      yaw -= lookVelX * dt;
      pitch = clamp(pitch - lookVelY * dt, -80 * DEG, 80 * DEG);
    }
    // Drag inertia: keep coasting after the pointer is released.
    if (!dragging && (dragVelX || dragVelY)) {
      const decay = Math.exp(-DRAG_FRICTION * dt);
      dragVelX *= decay;
      dragVelY *= decay;
      if (Math.abs(dragVelX) < 0.002) dragVelX = 0;
      if (Math.abs(dragVelY) < 0.002) dragVelY = 0;
      yaw -= dragVelX;
      pitch = clamp(pitch - dragVelY, -80 * DEG, 80 * DEG);
    }
    // Move stick: ease walk/turn toward the stick position so movement
    // ramps up instead of starting dead. On release (axis back to
    // zero), stop dead — no coast on walk/turn, so the clip freezes
    // the instant the stick is released (tests depend on this).
    walkSmooth = walkAxis === 0 ? 0 : easeToward(walkSmooth, walkAxis);
    turnSmooth = turnAxis === 0 ? 0 : easeToward(turnSmooth, turnAxis);

    if (turnSmooth) {
      // Push right to turn right, left to turn left — same yaw
      // convention as the Look stick and the arrow keys. dt-scaled
      // so a 60fps phone and a slower renderer turn at the same rate.
      yaw -= turnSmooth * TURN_YAW_SPEED * dt;
    }
    if (walkSmooth && !capped) {
      // Pause while walking: while the clip plays, per-frame forward
      // micro-seeks land where the playhead is about to be anyway,
      // so the media engine absorbs them and Move-up does nothing
      // (verified live). Scrubbing a paused video is exact, so pause
      // on walk and drive currentTime purely by scrub; resume on
      // release only if the clip was playing when the walk started —
      // never if the user had paused it, and never after the trial
      // cap fired. Turning only (turnSmooth, walk zero) never pauses.
      if (!video.paused) {
        wasPlayingBeforeWalk = true;
        walkPausedVideo = true;
        video.pause();
      } else if (!walkPausedVideo) {
        // Already paused and not by us: the user paused it — do not
        // resume it later.
        wasPlayingBeforeWalk = false;
      }
      // Walk along the recorded path: pushing up always walks the clip
      // forward, pushing down walks it back — at full speed, no matter
      // which way the camera is facing. The view direction (Look) is
      // independent: it only changes what you look at, never how fast
      // the clip moves. (An earlier version scaled the walk by
      // cos(yaw), so facing sideways walked nowhere; that made the
      // clip crawl when looking around, which is what the user
      // reported.)
      const walkForward = walkSmooth;
      const cap = maxTime();
      const next = video.currentTime + walkForward * 0.015 * (dt * 60);
      video.currentTime = Math.max(0, Math.min(cap || next, next));
      if (trial && video.currentTime >= cap - 0.05) enforceCap();
      
    } else if (wasPlayingBeforeWalk && !capped && !shell.hidden) {
      // Walk eased back to zero: resume, at half speed.
      wasPlayingBeforeWalk = false;
      walkPausedVideo = false;
      video.play().catch(() => {});
      video.playbackRate = 0.5;
    }
    if (camera) {
      // Flat mode: keep the curved screen in view.
      if (flatMode) {
        yaw = clamp(yaw, -0.3, 0.3);
        pitch = clamp(pitch, -0.3, 0.3);
      }
      camera.rotation.y = yaw;
      camera.rotation.x = pitch;
    }
    enforceCap();
    syncTransport();
    if (renderer) renderer.render(scene, camera);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  // Exponential ease toward a target; snaps to rest so a released
  // stick settles at exactly zero instead of creeping forever.
  function easeToward(current, target) {
    const next = current + (target - current) * 0.25;
    return Math.abs(next) < 0.002 ? 0 : next;
  }

  function bindStick(el, onAxis) {
    const knob = el.querySelector(".stick-knob");
    let pid = null;
    const center = () => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, rad: r.width / 2 };
    };
    const move = (cx, cy) => {
      const c = center();
      let dx = cx - c.x;
      let dy = cy - c.y;
      const max = c.rad - 18;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist > max) {
        dx = (dx / dist) * max;
        dy = (dy / dist) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      let nx = dx / max;
      let ny = dy / max;
      const mag = Math.hypot(nx, ny);
      if (mag < DEADZONE) {
        onAxis(0, 0);
        return;
      }
      const scaled = (mag - DEADZONE) / (1 - DEADZONE);
      onAxis((nx / mag) * scaled, (ny / mag) * scaled);
    };
    const end = () => {
      pid = null;
      knob.style.transform = "translate(0,0)";
      onAxis(0, 0);
    };
    el.addEventListener("pointerdown", (e) => {
      pid = e.pointerId;
      el.setPointerCapture(pid);
      move(e.clientX, e.clientY);
      e.preventDefault();
    });
    el.addEventListener("pointermove", (e) => {
      if (pid !== e.pointerId) return;
      move(e.clientX, e.clientY);
    });
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  bindStick(root.querySelector('[data-stick="look"]'), (x, y) => {
    lookAxis = { x, y };
  });
  bindStick(root.querySelector('[data-stick="move"]'), (x, y) => {
    turnAxis = x;
    walkAxis = -y;
  });

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    dragVelX = 0;
    dragVelY = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const stepX = dx * 0.25 * DEG;
    const stepY = dy * 0.2 * DEG;
    yaw -= stepX;
    pitch = clamp(pitch - stepY, -80 * DEG, 80 * DEG);
    dragVelX = dragVelX * 0.55 + stepX * 0.45;
    dragVelY = dragVelY * 0.55 + stepY * 0.45;
  });
  const stopDrag = () => {
    dragging = false;
  };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);

  playBtn.addEventListener("click", () => {
    if (video.paused) {
      if (trial && video.currentTime >= maxTime() - 0.05) video.currentTime = 0;
      capped = false;
      trialEnd.hidden = true;
      video.play().catch(() => {});
      // Re-apply half-speed after Play: loading a new source can reset
      // the rate to 1 even when it was set before play().
      video.playbackRate = 0.5;
    } else {
      video.pause();
    }
    syncTransport();
  });

  seek.addEventListener("input", () => {
    const cap = maxTime();
    const t = (Number(seek.value) / 1000) * cap;
    video.currentTime = t;
    if (trial && t >= cap - 0.05) enforceCap();
    else {
      capped = false;
      trialEnd.hidden = true;
    }
  });

  closeBtn.addEventListener("click", close);
  shell.addEventListener("click", (e) => {
    if (e.target === shell) close();
  });

  function onKey(e) {
    if (shell.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") yaw += 4 * DEG;
    if (e.key === "ArrowRight") yaw -= 4 * DEG;
    if (e.key === "ArrowUp") pitch = clamp(pitch + 3 * DEG, -80 * DEG, 80 * DEG);
    if (e.key === "ArrowDown") pitch = clamp(pitch - 3 * DEG, -80 * DEG, 80 * DEG);
    if (e.key === "w" || e.key === "W") video.currentTime = Math.min(maxTime(), video.currentTime + 0.15);
    if (e.key === "s" || e.key === "S") video.currentTime = Math.max(0, video.currentTime - 0.15);
    if (e.key === "a" || e.key === "A") yaw += 4 * DEG;
    if (e.key === "d" || e.key === "D") yaw -= 4 * DEG;
  }
  window.addEventListener("keydown", onKey);


  function showPoster(src) {
    if (!posterEl) return;
    if (src) posterEl.src = src;
    posterEl.hidden = !posterEl.src;
  }

  function hidePoster() {
    if (posterEl && video.readyState >= 2) posterEl.hidden = true;
  }

  video.addEventListener("loadeddata", hidePoster);
  video.addEventListener("seeked", hidePoster);
  video.addEventListener("canplay", hidePoster);

  function cancelPendingHi() {
    if (pendingHi) {
      try {
        pendingHi.pause();
        pendingHi.removeAttribute("src");
        pendingHi.load();
      } catch (_) {}
      pendingHi = null;
    }
  }

  function sameSrc(el, url) {
    try {
      return el.currentSrc === new URL(url, location.origin).href || el.src === new URL(url, location.origin).href;
    } catch {
      return el.src.endsWith(url);
    }
  }

  function loadClip(clip) {
    cancelPendingHi();
    video.poster = clip.poster || "";
    showPoster(clip.poster || "");
    const hi = clip.src;
    const low = clip.srcLow && clip.srcLow !== clip.src ? clip.srcLow : null;
    const startAt = low || hi;
    if (!sameSrc(video, startAt)) {
      video.src = startAt;
    } else {
      hidePoster();
    }
    video.preload = "auto";
    if (low && hi) {
      const upgrade = document.createElement("video");
      upgrade.preload = "auto";
      upgrade.muted = true;
      upgrade.playsInline = true;
      upgrade.setAttribute("playsinline", "");
      upgrade.setAttribute("webkit-playsinline", "");
      upgrade.crossOrigin = "anonymous";
      pendingHi = upgrade;
      const onReady = () => {
        if (pendingHi !== upgrade) return;
        const t = video.currentTime;
        const paused = video.paused;
        const rate = video.playbackRate;
        upgrade.removeEventListener("canplaythrough", onReady);
        upgrade.removeEventListener("loadeddata", onReady);
        showPoster(clip.poster || "");
        video.src = hi;
        const resume = () => {
          video.removeEventListener("loadeddata", resume);
          video.removeEventListener("canplay", resume);
          video.currentTime = t;
          video.playbackRate = rate || 0.5;
          if (!paused) video.play().catch(() => {});
          hidePoster();
        };
        video.addEventListener("loadeddata", resume);
        video.addEventListener("canplay", resume);
        pendingHi = null;
        try {
          upgrade.removeAttribute("src");
          upgrade.load();
        } catch (_) {}
      };
      upgrade.addEventListener("canplaythrough", onReady);
      upgrade.addEventListener("loadeddata", onReady);
      upgrade.src = hi;
    }
  }

  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }

  function isFullscreen() {
    return fsElement() === panel || panel.classList.contains("is-fullscreen");
  }

  function syncFsButton() {
    const on = isFullscreen();
    fsBtn.textContent = on ? "Exit full screen" : "Full screen";
    fsBtn.setAttribute("aria-label", on ? "Exit fullscreen" : "Enter fullscreen");
  }

  function enterCssFs() {
    panel.classList.add("is-fullscreen");
    document.body.classList.add("player-css-fs");
    resize();
    syncFsButton();
  }

  function leaveCssFs() {
    panel.classList.remove("is-fullscreen");
    document.body.classList.remove("player-css-fs");
    resize();
    syncFsButton();
  }

  function requestFullscreen() {
    const fn =
      panel.requestFullscreen ||
      panel.webkitRequestFullscreen ||
      panel.webkitRequestFullScreen ||
      panel.mozRequestFullScreen ||
      panel.msRequestFullscreen;
    if (typeof fn === "function") {
      const result = fn.call(panel);
      if (result && typeof result.catch === "function") {
        result.catch(() => enterCssFs());
      }
      // iOS may silently no-op; fall back shortly if we didn't enter.
      setTimeout(() => {
        if (!isFullscreen()) enterCssFs();
      }, 300);
    } else {
      enterCssFs();
    }
    syncFsButton();
  }

  function exitFullscreen(silent) {
    if (panel.classList.contains("is-fullscreen")) leaveCssFs();
    const fn =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.webkitCancelFullScreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;
    if (fsElement() && typeof fn === "function") {
      const result = fn.call(document);
      if (result && typeof result.catch === "function") result.catch(() => {});
    }
    if (!silent) syncFsButton();
  }

  function toggleFullscreen() {
    if (isFullscreen()) exitFullscreen();
    else requestFullscreen();
  }

  fsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFullscreen();
  });
  document.addEventListener("fullscreenchange", syncFsButton);
  document.addEventListener("webkitfullscreenchange", syncFsButton);

  async function open(opts = {}) {

    await ensureThree();
    trial = Boolean(opts.trial);
    flatMode = Boolean(opts.flat);
    // A pin may override the clip (demo / flat). Default is DEFAULT_360
    // (licensed stand-in on main).
    const clip = opts.clip || (flatMode ? FLAT : DEFAULT_360);
    mesh.visible = !flatMode;
    meshFlat.visible = flatMode;
    trialCap = Number(opts.trialCap || 45);
    onCloseCb = typeof opts.onClose === "function" ? opts.onClose : null;
    yaw = 0;
    pitch = 0;
    walkAxis = 0;
    turnAxis = 0;
    walkSmooth = 0;
    turnSmooth = 0;
    wasPlayingBeforeWalk = false;
    walkPausedVideo = false;
    lastTs = 0;
    lookAxis = { x: 0, y: 0 };
    lookVelX = 0;
    lookVelY = 0;
    dragVelX = 0;
    dragVelY = 0;
    capped = false;
    trialEnd.hidden = true;
    capLabel.textContent = String(trialCap);
    titleEl.textContent = opts.title || "360 preview";
    kicker.textContent = trial
      ? "Free trial render (watermarked, 45s cap)"
      : flatMode
        ? "Flat video, curved screen — demo"
        : "360 preview";
    banner.innerHTML = `${escapeHtml(clip.credit)} <a href="${clip.commons}" target="_blank" rel="noopener">Source</a> · <a href="${clip.licenseUrl}" target="_blank" rel="noopener">${escapeHtml(clip.license)}</a>`;
    // Offer line: only the example business pin shows it, so a buyer
    // sees what the pin is selling and where to read more. Reset on
    // every open so other pins never inherit it.
    if (opts.offer) {
      offerEl.hidden = false;
      offerEl.innerHTML = `Example pin — a buyer gets a 60-second clip pin like this, live for 1 year, with their name and a link. <a href="sales.html">See what a business pin includes →</a>`;
    } else {
      offerEl.hidden = true;
      offerEl.innerHTML = "";
    }
    watermark.hidden = !trial;
    watermark.textContent = trial
      ? `TRIAL PREVIEW · ${trialCap}s cap · ${clip.trialTag || "360 STAND-IN · not creator footage"}`
      : "";
    loadClip(clip);
    video.currentTime = 0;
    video.loop = !trial;
    video.playbackRate = 0.5;
    shell.hidden = false;
    document.body.classList.add("player-open");
    resize();
    if (!raf) raf = requestAnimationFrame(tick);
    // The clip opens paused and stays still until the user walks with
    // the Move stick (which scrubs the paused video) or presses Play.
    // No autoplay: when the user stops, the surroundings stop.
    video.pause();
    video.playbackRate = 0.5;
    syncTransport();
    window.__tgPlayer = api;
  }

  function close() {
    video.pause();
    cancelPendingHi();
    exitFullscreen(true);
    shell.hidden = true;
    document.body.classList.remove("player-open");
    const cb = onCloseCb;
    onCloseCb = null;
    if (typeof cb === "function") cb();
  }

  window.addEventListener("resize", resize);

  const api = {
    open,
    close,
    get yaw() {
      return yaw;
    },
    setYaw(v) {
      yaw = v;
    },
    get pitch() {
      return pitch;
    },
    get currentTime() {
      return video.currentTime;
    },
    setCurrentTime(t) {
      video.currentTime = t;
    },
    get trial() {
      return trial;
    },
    get trialCap() {
      return trialCap;
    },
    get capped() {
      return capped;
    },
    get paused() {
      return video.paused;
    },
    get video() {
      return video;
    },
    setWalkAxis(v) {
      walkAxis = v;
    },
    setTurnAxis(v) {
      turnAxis = v;
    },
    setMoveAxis(x, y) {
      turnAxis = x;
      walkAxis = -y;
    },
    setLookAxis(x, y) {
      lookAxis = { x, y };
    },
    maxTime,
  };
  window.__tgPlayer = api;
  return api;
}
