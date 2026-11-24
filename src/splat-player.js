import * as THREE from "three";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { detectWebGL2 } from "./webgl2.js";
import { PLACEHOLDER_SPLAT } from "./shared.js";

const DEG = Math.PI / 180;
const DEADZONE = 0.12;
const MAX_PIXEL_RATIO = 1.5;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function mountSplatPlayer(root) {
  root.innerHTML = `
    <div class="player-shell" hidden>
      <div class="player-panel" role="dialog" aria-modal="true" aria-labelledby="splat-title">
        <div class="player-top">
          <div>
            <p class="eyebrow" id="splat-kicker">Splat preview (test)</p>
            <h2 id="splat-title">Pin</h2>
          </div>
          <div class="player-top-actions">
            <button type="button" class="icon-btn" data-fs aria-label="Enter fullscreen">Full screen</button>
            <button type="button" class="icon-btn" data-close aria-label="Close player">Close</button>
          </div>
        </div>
        <p class="sample-banner" data-sample-banner></p>
        <div class="stage" data-stage>
          <canvas data-canvas></canvas>
          <div class="look-hint">Look stick or drag: look around · Move stick: walk — stays in the room — no avatar yet</div>
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
              <div class="stick" data-stick="move" role="application" aria-label="Move joystick: walk forward, back, and sideways, staying inside the room">
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
            <button type="button" class="text-btn" data-view-360>View 360 instead</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const shell = root.querySelector(".player-shell");
  const canvas = root.querySelector("[data-canvas]");
  const titleEl = root.querySelector("#splat-title");
  const banner = root.querySelector("[data-sample-banner]");
  const closeBtn = root.querySelector("[data-close]");
  const fsBtn = root.querySelector("[data-fs]");
  const view360Btn = root.querySelector("[data-view-360]");
  const panel = root.querySelector(".player-panel");

  let renderer = null;
  let scene = null;
  let camera = null;
  let spark = null;
  let mesh = null;
  let raf = 0;
  let openGen = 0;
  let ready = false;
  let onCloseCb = null;
  let onFallbackCb = null;
  let onView360Cb = null;
  let pos = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  const boundsMin = new THREE.Vector3(-10, 0.5, -10);
  const boundsMax = new THREE.Vector3(10, 2.2, 10);
  const WALK_SPEED = 1.8;
  let lookAxis = { x: 0, y: 0 };
  let moveAxis = { x: 0, y: 0 };
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastTs = 0;
  let fpsFrames = 0;
  let fpsWindowStart = 0;
  const stats = { loadMs: 0, fps: 0 };

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
    moveAxis = { x, y };
  });

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    yaw -= dx * 0.25 * DEG;
    pitch = clamp(pitch + dy * 0.2 * DEG, -1.2, 1.2);
    applyCamera();
  });
  const stopDrag = () => {
    dragging = false;
  };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);

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

  function ensureRenderer() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15141c);
    camera = new THREE.PerspectiveCamera(55, 1, 0.05, 5000);
    spark = new SparkRenderer({ renderer });
    scene.add(spark);
  }

  function resize() {
    if (!renderer) return;
    const stage = canvas.parentElement;
    const w = stage.clientWidth || 640;
    const h = stage.clientHeight || 360;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function clampToRoom() {
    pos.x = clamp(pos.x, boundsMin.x, boundsMax.x);
    pos.y = clamp(pos.y, boundsMin.y, boundsMax.y);
    pos.z = clamp(pos.z, boundsMin.z, boundsMax.z);
  }

  function applyCamera() {
    if (!camera) return;
    clampToRoom();
    camera.position.copy(pos);
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.updateMatrixWorld(true);
  }

  function applyConfiguredView(view) {
    if (!view) return false;
    if (Array.isArray(view.boundsMin) && Array.isArray(view.boundsMax)) {
      boundsMin.fromArray(view.boundsMin);
      boundsMax.fromArray(view.boundsMax);
    }
    if (Array.isArray(view.position)) {
      pos.fromArray(view.position);
    } else {
      return false;
    }
    if (Array.isArray(view.lookAt)) {
      const dir = new THREE.Vector3().fromArray(view.lookAt).sub(pos);
      yaw = Math.atan2(-dir.x, -dir.z);
      const horiz = Math.hypot(dir.x, dir.z);
      // YXZ: positive rotation.x looks down.
      pitch = clamp(-Math.atan2(dir.y, Math.max(horiz, 1e-5)), -1.2, 1.2);
    } else if (typeof view.yaw === "number") {
      yaw = view.yaw;
      pitch = typeof view.pitch === "number" ? view.pitch : 0;
    }
    applyCamera();
    return true;
  }

  // Fallback if a pin has no splatView: start inside a robust (percentile)
  // box of splat centers, at eye height, looking toward the densest wall.
  function applyInferredView(splatMesh) {
    const xs = [];
    const ys = [];
    const zs = [];
    const each = splatMesh.forEachSplat?.bind(splatMesh);
    if (typeof each !== "function") return false;
    let i = 0;
    each((_index, center) => {
      if ((i++ & 3) !== 0) return; // sample every 4th splat
      xs.push(center.x);
      ys.push(center.y);
      zs.push(center.z);
    });
    if (xs.length < 50) return false;
    const pct = (arr, p) => {
      const a = arr.slice().sort((a, b) => a - b);
      const idx = Math.min(a.length - 1, Math.max(0, Math.floor((p / 100) * (a.length - 1))));
      return a[idx];
    };
    const minX = pct(xs, 4);
    const maxX = pct(xs, 96);
    const minY = pct(ys, 8);
    const maxY = pct(ys, 92);
    const minZ = pct(zs, 4);
    const maxZ = pct(zs, 96);
    const inset = 0.4;
    boundsMin.set(minX + inset, minY + 0.9, minZ + inset);
    boundsMax.set(maxX - inset, maxY - 0.3, maxZ - inset);
    if (boundsMin.x > boundsMax.x) {
      const m = 0.5 * (boundsMin.x + boundsMax.x);
      boundsMin.x = m - 0.2;
      boundsMax.x = m + 0.2;
    }
    if (boundsMin.z > boundsMax.z) {
      const m = 0.5 * (boundsMin.z + boundsMax.z);
      boundsMin.z = m - 0.2;
      boundsMax.z = m + 0.2;
    }
    pos.set(0.5 * (minX + maxX), minY + 1.52, 0.5 * (minZ + maxZ));
    // Densest mid-height wall among the four faces.
    const midLo = minY + 0.3;
    const midHi = maxY - 0.2;
    const depth = 0.4;
    const faces = [
      { axis: "x", sign: -1, count: 0 },
      { axis: "x", sign: 1, count: 0 },
      { axis: "z", sign: -1, count: 0 },
      { axis: "z", sign: 1, count: 0 },
    ];
    for (let n = 0; n < xs.length; n++) {
      const y = ys[n];
      if (y < midLo || y > midHi) continue;
      if (xs[n] <= minX + depth) faces[0].count++;
      if (xs[n] >= maxX - depth) faces[1].count++;
      if (zs[n] <= minZ + depth) faces[2].count++;
      if (zs[n] >= maxZ - depth) faces[3].count++;
    }
    faces.sort((a, b) => b.count - a.count);
    const wall = faces[0];
    const look = pos.clone();
    if (wall.axis === "x") look.x = wall.sign < 0 ? minX : maxX;
    else look.z = wall.sign < 0 ? minZ : maxZ;
    look.y = pos.y - 0.12;
    const dir = look.sub(pos);
    yaw = Math.atan2(-dir.x, -dir.z);
    const horiz = Math.hypot(dir.x, dir.z);
    pitch = clamp(-Math.atan2(dir.y, Math.max(horiz, 1e-5)), -1.2, 1.2);
    applyCamera();
    return true;
  }

  function disposeMesh() {
    if (mesh) {
      scene.remove(mesh);
      if (typeof mesh.dispose === "function") {
        try {
          mesh.dispose();
        } catch (err) {
          // Ignore dispose errors from a failed load.
        }
      }
      mesh = null;
    }
  }

  function stopLoop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    lastTs = 0;
  }

  function tick(ts) {
    raf = requestAnimationFrame(tick);
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    yaw -= lookAxis.x * 1.4 * dt;
    pitch = clamp(pitch + lookAxis.y * 1.0 * dt, -1.2, 1.2);
    // Move stick: walk in the look direction (up/down) and strafe (left/right).
    // Camera looks down -Z at yaw 0, so forward is (-sin yaw, -cos yaw).
    if (moveAxis.x || moveAxis.y) {
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const walk = -moveAxis.y * WALK_SPEED * dt;
      const strafe = moveAxis.x * WALK_SPEED * dt;
      pos.x += forwardX * walk + rightX * strafe;
      pos.z += forwardZ * walk + rightZ * strafe;
    }
    applyCamera();
    if (renderer && scene && camera) renderer.render(scene, camera);
    if (ready) {
      fpsFrames += 1;
      if (!fpsWindowStart) fpsWindowStart = ts;
      const elapsed = ts - fpsWindowStart;
      if (elapsed >= 1000) {
        stats.fps = (fpsFrames * 1000) / elapsed;
        fpsFrames = 0;
        fpsWindowStart = ts;
      }
    }
  }

  function showShell() {
    shell.hidden = false;
    document.body.classList.add("player-open");
    resize();
  }

  function hideShell() {
    shell.hidden = true;
    document.body.classList.remove("player-open");
  }

  function fallback(note) {
    const cb = onFallbackCb;
    teardown({ silent: true });
    if (typeof cb === "function") cb(note);
  }

  function teardown(opts) {
    openGen += 1;
    ready = false;
    stopLoop();
    exitFullscreen(true);
    disposeMesh();
    hideShell();
    lookAxis = { x: 0, y: 0 };
    moveAxis = { x: 0, y: 0 };
    dragging = false;
    if (opts && opts.silent) return;
    const cb = onCloseCb;
    onCloseCb = null;
    onFallbackCb = null;
    onView360Cb = null;
    if (typeof cb === "function") cb();
  }

  async function open(opts = {}) {
    const gen = ++openGen;
    ready = false;
    stats.loadMs = 0;
    stats.fps = 0;
    fpsFrames = 0;
    fpsWindowStart = 0;
    onCloseCb = typeof opts.onClose === "function" ? opts.onClose : null;
    onFallbackCb = typeof opts.onFallback === "function" ? opts.onFallback : null;
    onView360Cb = typeof opts.onView360 === "function" ? opts.onView360 : null;

    const credit = opts.credit || PLACEHOLDER_SPLAT;
    const url = opts.src || credit.src;
    titleEl.textContent = opts.title || credit.title || "Splat preview";
    banner.innerHTML = `${escapeHtml(credit.credit)} <a href="${credit.commons}" target="_blank" rel="noopener">Source</a> · <a href="${credit.licenseUrl}" target="_blank" rel="noopener">${escapeHtml(credit.license)}</a>`;

    if (!detectWebGL2()) {
      fallback("Splat view needs WebGL2, which this browser doesn't provide, so this 360 stand-in is showing instead.");
      return;
    }

    try {
      ensureRenderer();
    } catch (err) {
      fallback("Splat view couldn't start WebGL, so this 360 stand-in is showing instead.");
      return;
    }

    disposeMesh();
    showShell();
    stopLoop();
    raf = requestAnimationFrame(tick);

    const t0 = performance.now();
    mesh = new SplatMesh({ url });
    scene.add(mesh);
    try {
      await mesh.initialized;
      if (gen !== openGen) return;
      const view = opts.view || credit.view;
      if (!applyConfiguredView(view)) {
        applyInferredView(mesh);
      }
      // A few warm-up frames so the first visible image isn't empty.
      for (let i = 0; i < 6; i++) {
        applyCamera();
        renderer.render(scene, camera);
        await new Promise((r) => requestAnimationFrame(r));
        if (gen !== openGen) return;
      }
      stats.loadMs = performance.now() - t0;
      ready = true;
    } catch (err) {
      if (gen !== openGen) return;
      console.error(err);
      fallback("The 3D splat couldn't be loaded, so this 360 stand-in is showing instead.");
    }
  }

  function close(opts) {
    teardown(opts);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  closeBtn.addEventListener("click", () => close());
  view360Btn.addEventListener("click", () => {
    const cb = onView360Cb;
    teardown({ silent: true });
    if (typeof cb === "function") cb();
  });

  function onKey(e) {
    if (shell.hidden) return;
    if (e.key === "Escape") {
      if (isFullscreen()) exitFullscreen();
      else close();
    }
  }
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", resize);

  const api = {
    open,
    close,
    get ready() {
      return ready;
    },
    get stats() {
      return { loadMs: stats.loadMs, fps: stats.fps };
    },
  };
  window.__tgSplatPlayer = api;
  return api;
}
