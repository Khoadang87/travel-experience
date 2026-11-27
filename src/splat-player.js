import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
import { detectWebGL2 } from "./webgl2.js";
import { PLACEHOLDER_SPLAT, bindFadeHint } from "./shared.js";
import { resolveStreetModel, collectWheels, WALK_DESIGN_SPEED } from "./street-models.js";

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
            <p class="eyebrow" id="splat-kicker">3D preview</p>
            <h2 id="splat-title">Pin</h2>
          </div>
          <div class="player-top-actions">
            <button type="button" class="icon-btn" data-fs aria-label="Full screen">Full screen</button>
            <button type="button" class="icon-btn" data-close aria-label="Close">Close</button>
          </div>
        </div>
        <p class="sample-banner" data-sample-banner></p>
        <div class="stage" data-stage>
          <canvas data-canvas></canvas>
        </div>
        <p class="look-hint" data-look-hint>
          <span class="hint-phone">Drag to look, hold stick to walk</span>
          <span class="hint-desktop">Look stick or drag to look around. Move stick scrubs the path. The character starts walking when the preview opens; Pause stops it.</span>
        </p>
        <div class="player-controls">
          <div class="sticks">
            <div class="stick-wrap stick-wrap-look">
              <div class="stick" data-stick="look" role="application" aria-label="Look joystick">
                <div class="stick-knob"></div>
              </div>
              <span>Look</span>
            </div>
            <div class="stick-wrap">
              <div class="stick" data-stick="move" role="application" aria-label="Move joystick: scrub the character along the path">
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
            <input type="range" min="0" max="1000" value="0" data-seek aria-label="Path position">
            <span class="time" data-time>0:00 / 0:00</span>
          </div>
          <div class="transport-actions">
            <button type="button" class="text-btn view-360-btn" data-view-360 hidden>View 360 instead</button>
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
  const playBtn = root.querySelector("[data-play]");
  const seek = root.querySelector("[data-seek]");
  const timeEl = root.querySelector("[data-time]");
  const panel = root.querySelector(".player-panel");
  const markHintUsed = bindFadeHint(root.querySelector("[data-look-hint]"));

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
  const FOLLOW_DIST = 3.35;
  const FOLLOW_UP = 2.08;
  const FOLLOW_LOOK_Y = 0.85;
  const LEG_SWING = 0.36;
  const ARM_SWING = 0.32;
  const WALK_CYCLE = 1.0;
  let cameraHold = null;
  let lookAxis = { x: 0, y: 0 };
  let moveAxis = { x: 0, y: 0 };
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastTs = 0;
  let fpsFrames = 0;
  let fpsWindowStart = 0;
  const stats = { loadMs: 0, fps: 0 };

  let avatarRoot = null;
  let avatarReady = false;
  let avatarYawOffset = 0;
  let pathCurve = null;
  let pathData = null;
  let pathLength = 0;
  let pathSpeed = 1.2;
  let pathU = 0;
  let playing = false;
  let playAnchorMs = 0;
  let playAnchorU = 0;
  let avatarAnim = "idle";
  let animTime = 0;
  let animWalkWeight = 0;
  let walkNaturalSpeed = 1.2;
  let lastAnimTs = 0;
  let avatarLimbs = null;
  let crowdRoot = null;
  let movers = [];
  let crowdLit = false;
  let streetGltfLoader = null;
  const streetModelCache = new Map();
  let streetEnvMap = null;
  let litTarget = null;
  let litQuad = null;
  let litScene = null;
  let seeking = false;
  let avatarTarget = null;
  let composeScene = null;
  let composeCam = null;
  let composeQuad = null;
  let glowTargetA = null;
  let glowTargetB = null;
  let blurScene = null;
  let blurQuad = null;
  let glowQuad = null;
  const _foot = new THREE.Vector3();
  const _clearCol = new THREE.Color();

  const pathBoundsMin = new THREE.Vector3(-10, -0.05, -10);
  const pathBoundsMax = new THREE.Vector3(10, 0.8, 10);
  const carPosition = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _back = new THREE.Vector3();
  const _side = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _spinQ = new THREE.Quaternion();
  const _wheelAxis = new THREE.Vector3(1, 0, 0);

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
      try { el.setPointerCapture(pid); } catch (_) {}
      move(e.clientX, e.clientY);
      e.preventDefault();
      e.stopPropagation();
      markHintUsed();
    });
    const endIf = (e) => {
      if (pid != null && e.pointerId !== pid) return;
      end();
    };
    el.addEventListener("pointermove", (e) => {
      if (pid !== e.pointerId) return;
      move(e.clientX, e.clientY);
    });
    el.addEventListener("pointerup", endIf);
    el.addEventListener("pointercancel", endIf);
  }

  bindStick(root.querySelector('[data-stick="look"]'), (x, y) => {
    lookAxis = { x, y };
  });
  bindStick(root.querySelector('[data-stick="move"]'), (x, y) => {
    moveAxis = { x, y };
  });

  let dragId = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    if (dragId != null) return;
    dragId = e.pointerId;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    markHintUsed();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (dragId !== e.pointerId) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    yaw -= dx * 0.25 * DEG;
    pitch = clamp(pitch + dy * 0.2 * DEG, -1.2, 1.2);
    applyCamera();
  });
  const stopDrag = (e) => {
    if (dragId != null && e && e.pointerId !== dragId) return;
    dragId = null;
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
    fsBtn.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
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
    scene.background = new THREE.Color(0x3a332c);
    camera = new THREE.PerspectiveCamera(55, 1, 0.05, 5000);
    spark = new SparkRenderer({ renderer });
    scene.add(spark);
    const hemi = new THREE.HemisphereLight(0xfff1dc, 0x2a221c, 1.05);
    scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffe6c4, 1.35);
    dir.position.set(2.2, 5.5, 3.0);
    scene.add(dir);
  }

  function resize() {
    if (!renderer) return;
    const stage = canvas.parentElement;
    const w = stage.clientWidth || 640;
    const h = stage.clientHeight || 360;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    // Tall phone stages have a tight horizontal FOV at 55° vertical, which
    // previously pushed the walker out of the street follow frame.
    camera.fov = streetFovForAspect(camera.aspect);
    camera.updateProjectionMatrix();
    ensureAvatarTarget();
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
    const dt = lastTs ? Math.min(0.08, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    yaw -= lookAxis.x * 1.4 * dt;
    pitch = clamp(pitch + lookAxis.y * 1.0 * dt, -1.2, 1.2);
    if (pathCurve) {
      let moverDt = dt;
      if (moveAxis.y || moveAxis.x) {
        const scrub = (-moveAxis.y * 0.85 + moveAxis.x * 0.25) * (pathSpeed / Math.max(pathLength, 0.001)) * dt;
        setPathU(pathU + scrub, { fromUser: true });
      } else if (playing) {
        // Cap the wall-clock step so a long SwiftShader/rAF stall cannot
        // jump the walker from mid-path to the end in one tick.
        const now = performance.now();
        const elapsed = Math.min(0.4, Math.max(0, (now - playAnchorMs) / 1000));
        setPathU(playAnchorU + (pathSpeed / Math.max(pathLength, 0.001)) * elapsed);
        playAnchorMs = now;
        playAnchorU = pathU;
        // Keep the crowd on the same clock as the walker; rAF dt is capped at
        // 0.08s and would leave pedestrians and cars almost still on a
        // slow GPU while the walker advances on the wall-clock cap.
        moverDt = elapsed;
      }
      poseAvatarAndCamera();
      if (playing) updateMovers(moverDt);
    } else {
      // No path: keep the interior walk camera.
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
    }
    updateAvatarPose(ts);
    if (renderer && scene && camera) renderFrame();
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


  function fmtTime(s) {
    s = Math.max(0, s || 0);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m + ":" + String(sec).padStart(2, "0");
  }

  function syncTransport() {
    const duration = pathLength / Math.max(pathSpeed, 0.001);
    const t = pathU * duration;
    if (timeEl) timeEl.textContent = fmtTime(t) + " / " + fmtTime(duration);
    if (seek && !seeking) seek.value = String(Math.round(pathU * 1000));
    if (playBtn) {
      playBtn.textContent = playing ? "Pause" : "Play";
      playBtn.setAttribute("aria-label", playing ? "Pause path" : "Play path");
    }
  }

  function setPathU(u, opts) {
    if (!pathCurve) return;
    if (pathData && pathData.closed) {
      pathU = u - Math.floor(u);
      if (pathU < 0) pathU += 1;
    } else {
      pathU = clamp(u, 0, 1);
      if (playing && (pathU <= 0 || pathU >= 1) && !(opts && opts.fromUser)) {
        playing = false;
        pathU = pathU >= 1 ? 1 : 0;
        setAvatarAnim("idle");
      }
    }
    if (opts && opts.fromUser) {
      playAnchorU = pathU;
      playAnchorMs = performance.now();
    }
    syncTransport();
  }

  function travelInBounds(origin, dir, maxDist) {
    let t = maxDist;
    const axes = [
      [origin.x, dir.x, boundsMin.x, boundsMax.x],
      [origin.z, dir.z, boundsMin.z, boundsMax.z],
    ];
    for (const [o, d, lo, hi] of axes) {
      if (Math.abs(d) < 1e-8) continue;
      const hit = d > 0 ? (hi - o) / d : (lo - o) / d;
      if (hit >= 0) t = Math.min(t, hit);
    }
    return Math.max(0, t);
  }

  function streetFovForAspect(aspect) {
    const a = Number.isFinite(aspect) ? aspect : 1;
    if (!(pathData && Number.isFinite(Number(pathData.followWorldX)))) return 55;
    if (a >= 0.75) return 55;
    const custom = Number(pathData && pathData.phoneFov);
    return Number.isFinite(custom) && custom >= 40 && custom <= 100 ? custom : 78;
  }

  function applyStreetFov() {
    if (!camera) return;
    const next = streetFovForAspect(camera.aspect);
    if (Math.abs(camera.fov - next) > 0.1) {
      camera.fov = next;
      camera.updateProjectionMatrix();
    }
  }

  function poseAvatarAndCamera() {
    if (!pathCurve || !camera) return;
    pathCurve.getPointAt(pathU, carPosition);
    pathCurve.getTangentAt(pathU, _tan);
    _tan.y = 0;
    if (_tan.lengthSq() < 1e-8) _tan.set(0, 0, 1);
    else _tan.normalize();
    if (avatarRoot) {
      avatarRoot.position.copy(carPosition);
      avatarRoot.rotation.y = Math.atan2(_tan.x, _tan.z) + avatarYawOffset;
      avatarRoot.updateMatrixWorld(true);
    }
    if (applyHeldCamera()) return;
    _back.set(-_tan.x, 0, -_tan.z).normalize();
    if (yaw) _back.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    const portrait = (camera.aspect || 1) < 0.75;
    const numPath = (key) => {
      const n = pathData ? Number(pathData[key]) : NaN;
      return Number.isFinite(n) ? n : NaN;
    };
    const pickFollow = (portraitKey, key, fallback) => {
      if (portrait && numPath(portraitKey) > 0) return numPath(portraitKey);
      if (numPath(key) > 0) return numPath(key);
      return fallback;
    };
    const followDist = pickFollow("followDistPortrait", "followDist", FOLLOW_DIST);
    const followUp = pickFollow("followUpPortrait", "followUp", FOLLOW_UP);
    const followLookY = numPath("followLookY") > 0 ? numPath("followLookY") : FOLLOW_LOOK_Y;
    let followWorldX = pathData && Number.isFinite(Number(pathData.followWorldX)) ? Number(pathData.followWorldX) : null;
    if (followWorldX != null && portrait && Number.isFinite(numPath("followWorldXPortrait"))) {
      followWorldX = numPath("followWorldXPortrait");
    }
    if (followWorldX != null) {
      applyStreetFov();
      // Street preview: sit east of the walker (world +X) so the lanes, cars,
      // and crosswalk people stay in a phone frame in both path directions.
      // A path may pin camera/look Z (followCamZ / followLookZ) so a tight
      // courtyard stays framed from one side instead of flipping into a wall.
      let lookWorldX = Number.isFinite(Number(pathData.followLookWorldX)) ? Number(pathData.followLookWorldX) : followWorldX * 0.8;
      if (portrait && Number.isFinite(numPath("followLookWorldXPortrait"))) lookWorldX = numPath("followLookWorldXPortrait");
      const lookAhead = Number(pathData.followLookAhead) > 0 ? Number(pathData.followLookAhead) : 3.0;
      pos.copy(carPosition).addScaledVector(_back, followDist);
      pos.x = carPosition.x + followWorldX;
      pos.y = carPosition.y + followUp + Math.sin(clamp(pitch, -0.7, 0.7)) * 0.45;
      if (Number.isFinite(numPath("followCamZ"))) pos.z = numPath("followCamZ");
      pos.x = clamp(pos.x, boundsMin.x, boundsMax.x);
      pos.y = clamp(pos.y, 0.9, Math.max(boundsMax.y, 3.2));
      pos.z = clamp(pos.z, boundsMin.z, boundsMax.z);
      camera.position.copy(pos);
      _look.copy(carPosition).addScaledVector(_tan, lookAhead);
      _look.x = carPosition.x + lookWorldX;
      _look.y = carPosition.y + followLookY;
      if (Number.isFinite(numPath("followLookZ"))) _look.z = numPath("followLookZ");
      camera.lookAt(_look);
      camera.updateMatrixWorld(true);
      return;
    }
    // Pull back far enough that the ~1.7 m figure fills about 40–55% of a
    // tall phone stage. Prefer a rear-quarter view inside the room; if the
    // window wall is too close behind, swing to the side (or slightly ahead)
    // rather than clipping through a wall.
    const targetDist = followDist * Math.cos(clamp(pitch, -0.55, 0.55));
    const pitchLift = Math.sin(clamp(pitch, -0.7, 0.7)) * 0.45;
    const angles = [0.4, -0.4, 0.6, -0.6, 0.85, -0.85, 0.2, -0.2, 0, 1.1, -1.1, 1.35, -1.35, 1.65, -1.65, 2.2, -2.2];
    let bestScore = -Infinity;
    let bestDist = 0;
    let bestAng = 0;
    for (const a of angles) {
      _side.copy(_back).applyAxisAngle(THREE.Object3D.DEFAULT_UP, a);
      const max = travelInBounds(carPosition, _side, targetDist + 0.5);
      const dist = Math.min(targetDist, Math.max(0, max - 0.16));
      if (dist < 1.5) continue;
      const distScore = 1 - Math.abs(dist - targetDist) / Math.max(targetDist, 0.01);
      const rearPref = Math.max(0, Math.cos(a));
      const shoulderPref = 1 - Math.min(1, Math.abs(Math.abs(a) - 0.45) / 1.8);
      const score = distScore * 2.4 + rearPref * 0.25 + shoulderPref * 0.2;
      if (score > bestScore) {
        bestScore = score;
        bestDist = dist;
        bestAng = a;
      }
    }
    if (bestDist > 0) {
      _back.applyAxisAngle(THREE.Object3D.DEFAULT_UP, bestAng);
      pos.copy(carPosition).addScaledVector(_back, bestDist);
    } else {
      pos.copy(carPosition).addScaledVector(_back, 1.6);
    }
    pos.y = carPosition.y + followUp + pitchLift;
    pos.x = clamp(pos.x, boundsMin.x, boundsMax.x);
    pos.y = clamp(pos.y, 0.9, Math.max(boundsMax.y, 2.55));
    pos.z = clamp(pos.z, boundsMin.z, boundsMax.z);
    camera.position.copy(pos);
    _look.copy(carPosition).addScaledVector(_tan, 0.2);
    _look.y = carPosition.y + followLookY;
    camera.lookAt(_look);
    camera.updateMatrixWorld(true);
  }

  function disposeCrowd() {
    for (const mover of movers) {
      if (mover.mixer) mover.mixer.stopAllAction();
    }
    movers = [];
    crowdLit = false;
    if (scene && scene.environmentIntensity != null) scene.environmentIntensity = 0.85;
    if (!crowdRoot) return;
    scene.remove(crowdRoot);
    crowdRoot.traverse((obj) => {
      if (obj.userData && obj.userData.sharedStreetModel) return;
      if (obj.geometry && typeof obj.geometry.dispose === "function") obj.geometry.dispose();
      const mat = obj.material;
      if (mat) {
        const list = Array.isArray(mat) ? mat : [mat];
        for (const m of list) {
          if (m && m.map && typeof m.map.dispose === "function") m.map.dispose();
          if (m && typeof m.dispose === "function") m.dispose();
        }
      }
    });
    crowdRoot = null;
  }

  function disposeAvatar() {
    disposeCrowd();
    avatarLimbs = null;
    avatarAnim = "idle";
    animTime = 0;
    animWalkWeight = 0;
    lastAnimTs = 0;
    if (!avatarRoot) return;
    scene.remove(avatarRoot);
    avatarRoot.traverse((obj) => {
      if (obj.geometry && typeof obj.geometry.dispose === "function") obj.geometry.dispose();
      const mat = obj.material;
      if (mat) {
        const list = Array.isArray(mat) ? mat : [mat];
        for (const m of list) {
          if (m && m.map && typeof m.map.dispose === "function") m.map.dispose();
          if (m && typeof m.dispose === "function") m.dispose();
        }
      }
    });
    avatarRoot = null;
    avatarReady = false;
  }

  async function loadPath(spec) {
    pathCurve = null;
    pathData = null;
    pathLength = 0;
    pathU = 0;
    playing = false;
    if (!spec) return false;
    if (typeof spec === "string") {
      const res = await fetch(spec, { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load path");
      spec = await res.json();
    }
    const pts = (spec.points || []).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    if (pts.length < 2) return false;
    pathData = spec;
    pathCurve = new THREE.CatmullRomCurve3(pts, Boolean(spec.closed), "centripetal");
    pathLength = pathCurve.getLength();
    pathSpeed = Number(spec.speed) > 0 ? Number(spec.speed) : 1.2;
    if (Array.isArray(spec.boundsMin) && Array.isArray(spec.boundsMax)) {
      pathBoundsMin.fromArray(spec.boundsMin);
      pathBoundsMax.fromArray(spec.boundsMax);
    }
    setPathU(0);
    return true;
  }

  function setAvatarAnim(name) {
    avatarAnim = name === "walk" ? "walk" : "idle";
  }

  function updateAvatarPose(ts) {
    const dt = lastAnimTs ? Math.min(0.25, (ts - lastAnimTs) / 1000) : 0.016;
    lastAnimTs = ts;
    const target = avatarAnim === "walk" ? 1 : 0;
    const fade = dt / 0.32;
    if (target > animWalkWeight) animWalkWeight = Math.min(1, animWalkWeight + fade);
    else animWalkWeight = Math.max(0, animWalkWeight - fade);
    if (avatarAnim === "walk") {
      animTime += dt * (pathSpeed / Math.max(walkNaturalSpeed, 0.05));
    } else {
      animTime += dt * 0.28;
    }
    if (!avatarLimbs) return;
    const phase = (animTime / WALK_CYCLE) * Math.PI * 2;
    const w = animWalkWeight * animWalkWeight * (3 - 2 * animWalkWeight);
    const sl = Math.sin(phase);
    const sr = Math.sin(phase + Math.PI);
    avatarLimbs.legL.rotation.x = sl * LEG_SWING * w;
    avatarLimbs.legR.rotation.x = sr * LEG_SWING * w;
    if (avatarLimbs.kneeL) avatarLimbs.kneeL.rotation.x = -(0.1 + Math.max(0, sl) * 0.62) * w;
    if (avatarLimbs.kneeR) avatarLimbs.kneeR.rotation.x = -(0.1 + Math.max(0, sr) * 0.62) * w;
    avatarLimbs.armL.rotation.x = Math.sin(phase + Math.PI) * ARM_SWING * w;
    avatarLimbs.armR.rotation.x = Math.sin(phase) * ARM_SWING * w;
    if (avatarLimbs.torso) {
      avatarLimbs.torso.rotation.y = sl * 0.06 * w;
      avatarLimbs.torso.rotation.z = sl * 0.035 * w;
    }
    if (avatarLimbs.head) {
      avatarLimbs.head.rotation.y = -sl * 0.04 * w;
    }
    // Hip drop from the stance leg keeps the planted foot on the floor
    // and gives a gentle body bob; no extra lift is added on top.
    plantFeet();
  }

  function disposeRt(rt) {
    if (rt) rt.dispose();
    return null;
  }

  function makeFullscreenMat(frag, extras) {
    return new THREE.ShaderMaterial(Object.assign({
      uniforms: Object.assign({ tDiffuse: { value: null } }, extras || {}),
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }, {}));
  }

  function ensureAvatarTarget() {
    if (!renderer) return;
    const size = new THREE.Vector2();
    renderer.getDrawingBufferSize(size);
    const w = Math.max(1, Math.floor(size.x));
    const h = Math.max(1, Math.floor(size.y));
    const gw = Math.max(1, Math.floor(w / 2));
    const gh = Math.max(1, Math.floor(h / 2));
    const sameAvatar = avatarTarget && avatarTarget.width === w && avatarTarget.height === h;
    const sameGlow = glowTargetA && glowTargetA.width === gw && glowTargetA.height === gh;
    const sameLit = litTarget && litTarget.width === w && litTarget.height === h;
    if (sameAvatar && sameGlow && sameLit && composeScene && blurScene && litScene) return;

    avatarTarget = disposeRt(avatarTarget);
    litTarget = disposeRt(litTarget);
    glowTargetA = disposeRt(glowTargetA);
    glowTargetB = disposeRt(glowTargetB);

    avatarTarget = new THREE.WebGLRenderTarget(w, h, {
      samples: 4,
      depthBuffer: true,
      stencilBuffer: false,
    });
    litTarget = new THREE.WebGLRenderTarget(w, h, {
      samples: 4,
      depthBuffer: true,
      stencilBuffer: false,
    });
    glowTargetA = new THREE.WebGLRenderTarget(gw, gh, { depthBuffer: false, stencilBuffer: false });
    glowTargetB = new THREE.WebGLRenderTarget(gw, gh, { depthBuffer: false, stencilBuffer: false });
    if (renderer.outputColorSpace) {
      avatarTarget.texture.colorSpace = renderer.outputColorSpace;
      litTarget.texture.colorSpace = renderer.outputColorSpace;
      glowTargetA.texture.colorSpace = renderer.outputColorSpace;
      glowTargetB.texture.colorSpace = renderer.outputColorSpace;
    }

    if (!composeCam) composeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    if (!blurScene) {
      const blurMat = makeFullscreenMat(
        `
          uniform sampler2D tDiffuse;
          uniform vec2 direction;
          uniform float intensity;
          varying vec2 vUv;
          void main() {
            vec2 texel = direction;
            vec4 sum = texture2D(tDiffuse, vUv) * 0.227027;
            sum += texture2D(tDiffuse, vUv + texel) * 0.1945946;
            sum += texture2D(tDiffuse, vUv - texel) * 0.1945946;
            sum += texture2D(tDiffuse, vUv + texel * 2.0) * 0.1216216;
            sum += texture2D(tDiffuse, vUv - texel * 2.0) * 0.1216216;
            sum += texture2D(tDiffuse, vUv + texel * 3.0) * 0.054054;
            sum += texture2D(tDiffuse, vUv - texel * 3.0) * 0.054054;
            sum += texture2D(tDiffuse, vUv + texel * 4.0) * 0.016216;
            sum += texture2D(tDiffuse, vUv - texel * 4.0) * 0.016216;
            gl_FragColor = sum * intensity;
          }
        `,
        { direction: { value: new THREE.Vector2() }, intensity: { value: 1 } }
      );
      blurMat.toneMapped = false;
      blurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat);
      blurQuad.frustumCulled = false;
      blurScene = new THREE.Scene();
      blurScene.add(blurQuad);
    }

    if (!composeScene) {
      const glowMat = makeFullscreenMat(
        `
          uniform sampler2D tDiffuse;
          uniform float intensity;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(tDiffuse, vUv) * intensity;
          }
        `,
        { intensity: { value: 0.95 } }
      );
      glowMat.transparent = true;
      glowMat.blending = THREE.AdditiveBlending;
      glowMat.premultipliedAlpha = true;
      glowQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), glowMat);
      glowQuad.frustumCulled = false;
      glowQuad.renderOrder = 0;

      const sharpMat = makeFullscreenMat(
        `
          uniform sampler2D tDiffuse;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(tDiffuse, vUv);
          }
        `
      );
      sharpMat.transparent = true;
      sharpMat.premultipliedAlpha = true;
      sharpMat.blending = THREE.CustomBlending;
      sharpMat.blendSrc = THREE.OneFactor;
      sharpMat.blendDst = THREE.OneMinusSrcAlphaFactor;
      sharpMat.blendSrcAlpha = THREE.OneFactor;
      sharpMat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      composeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), sharpMat);
      composeQuad.frustumCulled = false;
      composeQuad.renderOrder = 1;

      composeScene = new THREE.Scene();
      composeScene.add(glowQuad);
      composeScene.add(composeQuad);
    }

    composeQuad.material.uniforms.tDiffuse.value = avatarTarget.texture;
    glowQuad.material.uniforms.tDiffuse.value = glowTargetA.texture;

    if (!litScene) {
      const litMat = makeFullscreenMat(
        `
          uniform sampler2D tDiffuse;
          varying vec2 vUv;
          void main() {
            gl_FragColor = texture2D(tDiffuse, vUv);
          }
        `
      );
      litMat.transparent = true;
      litMat.premultipliedAlpha = true;
      litMat.blending = THREE.CustomBlending;
      litMat.blendSrc = THREE.OneFactor;
      litMat.blendDst = THREE.OneMinusSrcAlphaFactor;
      litMat.blendSrcAlpha = THREE.OneFactor;
      litMat.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      litQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), litMat);
      litQuad.frustumCulled = false;
      litScene = new THREE.Scene();
      litScene.add(litQuad);
    }
    litQuad.material.uniforms.tDiffuse.value = litTarget.texture;
  }

  function blitBlur(src, dest, dirX, dirY, intensity) {
    blurQuad.material.uniforms.tDiffuse.value = src.texture;
    blurQuad.material.uniforms.direction.value.set(dirX, dirY);
    blurQuad.material.uniforms.intensity.value = intensity;
    renderer.setRenderTarget(dest);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(blurScene, composeCam);
  }

  function renderFrame() {
    if (!renderer || !scene || !camera) return;
    const hasAvatar = !!(avatarRoot && avatarRoot.parent);
    const hasCrowd = !!(crowdRoot && crowdRoot.parent);
    if (avatarRoot) avatarRoot.visible = false;
    if (crowdRoot) crowdRoot.visible = false;
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    if (hasCrowd && crowdLit) {
      crowdRoot.visible = true;
      if (avatarRoot) avatarRoot.visible = false;
      renderLitCrowd();
      crowdRoot.visible = false;
    }
    const glowCrowd = hasCrowd && !crowdLit;
    if (hasAvatar || glowCrowd) {
      if (avatarRoot) avatarRoot.visible = true;
      if (crowdRoot) crowdRoot.visible = glowCrowd;
      renderAvatarOverlay();
    }
  }

  function renderLitCrowd() {
    ensureAvatarTarget();
    if (!litTarget || !litQuad || !composeCam) return;
    const prevBg = scene.background;
    const sparkVis = spark ? spark.visible : true;
    const prevColor = renderer.getClearColor(_clearCol);
    const prevAlpha = renderer.getClearAlpha();
    if (spark) spark.visible = false;
    scene.background = null;
    renderer.setRenderTarget(litTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.background = prevBg;
    if (spark) spark.visible = sparkVis;
    renderer.setClearColor(prevColor, prevAlpha);
    litQuad.material.uniforms.tDiffuse.value = litTarget.texture;
    renderer.autoClear = false;
    renderer.render(litScene, composeCam);
    renderer.autoClear = true;
  }

  function renderAvatarOverlay() {
    ensureAvatarTarget();
    if (!avatarTarget || !composeScene || !glowTargetA) return;
    const prevBg = scene.background;
    const sparkVis = spark ? spark.visible : true;
    const prevColor = renderer.getClearColor(_clearCol);
    const prevAlpha = renderer.getClearAlpha();
    if (spark) spark.visible = false;
    scene.background = null;
    renderer.setRenderTarget(avatarTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);

    const sx = 1 / glowTargetA.width;
    const sy = 1 / glowTargetA.height;
    const spread = 2.4;
    blitBlur(avatarTarget, glowTargetA, sx * spread, 0.0, 1.0);
    blitBlur(glowTargetA, glowTargetB, 0.0, sy * spread, 1.0);
    blitBlur(glowTargetB, glowTargetA, sx * spread, 0.0, 1.0);
    blitBlur(glowTargetA, glowTargetB, 0.0, sy * spread, 1.0);
    blitBlur(glowTargetB, glowTargetA, sx * 1.6, 0.0, 1.0);
    blitBlur(glowTargetA, glowTargetB, 0.0, sy * 1.6, 1.0);
    glowQuad.material.uniforms.tDiffuse.value = glowTargetB.texture;

    renderer.setRenderTarget(null);
    scene.background = prevBg;
    if (spark) spark.visible = sparkVis;
    renderer.setClearColor(prevColor, prevAlpha);
    renderer.autoClear = false;
    renderer.render(composeScene, composeCam);
    renderer.autoClear = true;
  }

  function disposeAvatarTarget() {
    avatarTarget = disposeRt(avatarTarget);
    litTarget = disposeRt(litTarget);
    glowTargetA = disposeRt(glowTargetA);
    glowTargetB = disposeRt(glowTargetB);
    if (composeQuad) {
      composeQuad.geometry.dispose();
      composeQuad.material.dispose();
      composeQuad = null;
    }
    if (glowQuad) {
      glowQuad.geometry.dispose();
      glowQuad.material.dispose();
      glowQuad = null;
    }
    if (blurQuad) {
      blurQuad.geometry.dispose();
      blurQuad.material.dispose();
      blurQuad = null;
    }
    composeScene = null;
    blurScene = null;
    composeCam = null;
  }

  function meshWorldBox(mesh) {
    const box = new THREE.Box3();
    if (!mesh || !mesh.geometry) return box;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    return box;
  }

  function plantFeet() {
    if (!avatarLimbs || !avatarLimbs.figure) return;
    const floor = avatarRoot ? avatarRoot.position.y : (Number.isFinite(avatarLimbs.floorY) ? avatarLimbs.floorY : 0);
    avatarLimbs.figure.position.y = avatarLimbs.baseY;
    avatarLimbs.figure.updateMatrixWorld(true);
    let lowest = Infinity;
    for (const foot of [avatarLimbs.footL, avatarLimbs.footR]) {
      if (!foot) continue;
      foot.updateWorldMatrix(true, false);
      const box = meshWorldBox(foot);
      if (box.min.y < lowest) lowest = box.min.y;
    }
    if (!Number.isFinite(lowest) || lowest === Infinity) return;
    avatarLimbs.figure.position.y = avatarLimbs.baseY + (floor - lowest);
    avatarLimbs.figure.updateMatrixWorld(true);
    updateFootShadows();
  }

  function updateFootShadows() {
    if (!avatarRoot || !avatarLimbs) return;
    for (const [foot, sh] of [
      [avatarLimbs.footL, avatarLimbs.shadowL],
      [avatarLimbs.footR, avatarLimbs.shadowR],
    ]) {
      if (!foot || !sh) continue;
      foot.getWorldPosition(_foot);
      avatarRoot.worldToLocal(_foot);
      sh.position.set(_foot.x, 0.004, _foot.z);
    }
  }

  function bodyBox(root) {
    const box = new THREE.Box3();
    root.updateMatrixWorld(true);
    root.traverse((obj) => {
      if (!obj.isMesh || /-(rim|halo)$/.test(obj.name || "")) return;
      const b = new THREE.Box3().setFromObject(obj);
      if (!b.isEmpty()) box.union(b);
    });
    return box;
  }

  function snapFeetToFloor(root, floorY) {
    if (!root || !Number.isFinite(floorY)) return;
    root.updateMatrixWorld(true);
    const box = bodyBox(root);
    if (!Number.isFinite(box.min.y)) return;
    const dy = floorY - box.min.y;
    if (Math.abs(dy) > 0.0005) {
      root.position.y += dy;
      root.updateMatrixWorld(true);
    }
  }

  function applyHeldCamera() {
    if (!cameraHold || !camera) return false;
    if (cameraHold === "crowd") return frameCrowdCamera();
    if (cameraHold === "car") return frameCarCamera();
    if (!avatarRoot) return false;
    const origin = new THREE.Vector3();
    avatarRoot.getWorldPosition(origin);
    const q = new THREE.Quaternion();
    avatarRoot.getWorldQuaternion(q);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    forward.y = 0;
    if (forward.lengthSq() < 1e-8) forward.set(0, 0, 1);
    else forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();
    const held = origin.clone();
    if (cameraHold === "feet") {
      origin.y += 0.08;
      held.copy(origin);
      held.addScaledVector(right, 0.75).addScaledVector(forward, 0.9);
      held.y = origin.y + 0.42;
    } else if (cameraHold === "knees") {
      origin.y += 0.48;
      held.copy(origin);
      held.addScaledVector(right, 0.8).addScaledVector(forward, 0.65);
      held.y = origin.y + 0.12;
    } else if (cameraHold === "side") {
      origin.y += 0.85;
      held.copy(origin);
      held.addScaledVector(right, 2.15).addScaledVector(forward, 0.2);
      held.y += 0.08;
    } else {
      origin.y += 0.85;
      held.copy(origin);
      held.addScaledVector(right, 1.25).addScaledVector(forward, 1.4);
      held.y += 0.22;
    }
    held.x = clamp(held.x, boundsMin.x, boundsMax.x);
    held.y = clamp(held.y, cameraHold === "feet" || cameraHold === "knees" ? 0.16 : 0.9, Math.max(boundsMax.y, 2.55));
    held.z = clamp(held.z, boundsMin.z, boundsMax.z);
    camera.position.copy(held);
    camera.lookAt(origin);
    camera.updateMatrixWorld(true);
    return true;
  }

  function addFigureLights(root) {
    const key = new THREE.DirectionalLight(0xf6f8ff, 0.85);
    key.name = "figure-key";
    key.position.set(0.85, 2.2, 1.4);
    key.target.position.set(0, 0.95, 0);
    root.add(key);
    root.add(key.target);

    const fill = new THREE.DirectionalLight(0xe4eaf6, 0.36);
    fill.name = "figure-fill";
    fill.position.set(-1.25, 1.3, 0.55);
    fill.target.position.set(0, 0.9, 0);
    root.add(fill);
    root.add(fill.target);
  }

  function attachFresnel(mat, strength, power) {
    const uniforms = {
      uRimPower: { value: power },
      uRimStrength: { value: strength },
      uRimColor: { value: new THREE.Color(0xffffff) },
    };
    mat.userData.rimUniforms = uniforms;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uRimPower = uniforms.uRimPower;
      shader.uniforms.uRimStrength = uniforms.uRimStrength;
      shader.uniforms.uRimColor = uniforms.uRimColor;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uRimPower;\nuniform float uRimStrength;\nuniform vec3 uRimColor;"
        )
        .replace(
          "#include <opaque_fragment>",
          "outgoingLight += uRimColor * (pow(1.0 - max(0.0, dot(normalize(normal), normalize(vViewPosition))), uRimPower) * uRimStrength);\n#include <opaque_fragment>"
        );
    };
    mat.needsUpdate = true;
  }

  // Body-of-revolution torso, later scaled on Z so it is round but not circularly wide.
  function torsoLatheGeometry(shoulderW, hipW, torsoH, neckH, neckR) {
    const shR = shoulderW / 2;
    const hipR = hipW / 2;
    const y0 = -torsoH / 2;
    const y1 = torsoH / 2;
    const pts = [];
    const cap = Math.min(0.07, hipR * 0.45);
    pts.push(new THREE.Vector2(0.001, y0));
    for (let i = 1; i <= 7; i += 1) {
      const t = i / 7;
      const a = (Math.PI / 2) * t;
      const r = hipR * Math.sin(a);
      pts.push(new THREE.Vector2(r, y0 + cap * (1 - Math.cos(a))));
    }
    const ySide0 = y0 + cap;
    const ySide1 = y1 - 0.05;
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 8;
      const y = ySide0 + (ySide1 - ySide0) * t;
      const r = hipR + (shR - hipR) * (t * t * (3 - 2 * t));
      pts.push(new THREE.Vector2(r, y));
    }
    for (let i = 1; i <= 8; i += 1) {
      const t = i / 8;
      const a = t * (Math.PI / 2);
      const r = neckR + (shR - neckR) * Math.cos(a);
      const y = ySide1 + (y1 + neckH - ySide1) * Math.sin(a);
      pts.push(new THREE.Vector2(Math.max(neckR * 0.95, r), y));
    }
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.computeVertexNormals();
    return geo;
  }

  function eggHeadGeometry(height, maxR) {
    const pts = [];
    const y0 = -height * 0.42;
    const y1 = height * 0.58;
    const peak = 0.62;
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const y = y0 + (y1 - y0) * t;
      let w;
      if (t < peak) {
        const u = t / peak;
        w = 0.14 + 0.86 * Math.sin((Math.PI / 2) * Math.pow(u, 0.85));
      } else {
        const u = (t - peak) / Math.max(0.001, 1 - peak);
        w = Math.cos((Math.PI / 2) * u);
      }
      pts.push(new THREE.Vector2(Math.max(0.001, maxR * w), y));
    }
    const geo = new THREE.LatheGeometry(pts, 28);
    geo.computeVertexNormals();
    return geo;
  }

  function dress(mesh) {
    mesh.renderOrder = 5;
    return mesh;
  }

  function buildSimpleFigure(height) {
    const h = height > 0.5 ? height : 1.7;
    const s = h / 1.7;
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf4f6ff,
      emissiveIntensity: 0.62,
      roughness: 0.46,
      metalness: 0.04,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      envMapIntensity: 0,
    });
    attachFresnel(mat, 0.3, 1.7);
    const figure = new THREE.Group();
    figure.name = "restroom-icon";

    const hipY = 0.83 * s;
    const headH = 0.29 * s;
    const headR = 0.102 * s;
    const neckH = 0.09 * s;
    const neckR = 0.058 * s;
    const torsoTop = h - headH - neckH * 0.55;
    const torsoH = torsoTop - hipY;
    const shoulderW = 0.45 * s;
    const hipW = 0.34 * s;
    const depth = 0.235 * s;
    const armR = 0.048 * s;
    const legR = 0.062 * s;
    const shoulderY = torsoTop - 0.03 * s;
    const armLen = Math.max(0.2 * s, shoulderY - hipY);
    const legLen = hipY;
    const legGap = 0.07 * s;
    const armGap = 0.016 * s;
    const footH = 0.04 * s;
    const footLen = 0.105 * s;

    const torsoGeo = torsoLatheGeometry(shoulderW, hipW, torsoH, neckH * 0.7, neckR);
    torsoGeo.scale(1, 1, depth / shoulderW);
    torsoGeo.computeVertexNormals();
    const torso = dress(new THREE.Mesh(torsoGeo, mat));
    torso.name = "torso";
    torso.position.y = hipY + torsoH * 0.5;
    figure.add(torso);

    const neck = dress(new THREE.Mesh(new THREE.CapsuleGeometry(neckR, Math.max(0.01, neckH - neckR), 8, 16), mat));
    neck.name = "neck";
    neck.position.y = torsoTop + neckH * 0.35;
    figure.add(neck);

    const head = dress(new THREE.Mesh(eggHeadGeometry(headH, headR), mat));
    head.name = "head";
    head.position.y = torsoTop + neckH * 0.7 + headH * 0.42;
    figure.add(head);

    function limbArm(x, jointY, radius, totalLen, name) {
      const pivot = new THREE.Group();
      pivot.name = name + "-pivot";
      pivot.position.set(x, jointY, 0);
      const cyl = Math.max(0.01, totalLen - radius * 2);
      const mesh = dress(new THREE.Mesh(new THREE.CapsuleGeometry(radius, cyl, 8, 16), mat));
      mesh.name = name;
      mesh.position.y = -totalLen * 0.5;
      pivot.add(mesh);
      const cap = dress(new THREE.Mesh(new THREE.SphereGeometry(radius * 1.12, 14, 12), mat));
      cap.name = name + "-shoulder";
      pivot.add(cap);
      figure.add(pivot);
      return pivot;
    }

    function makeLeg(x, name) {
      const hip = new THREE.Group();
      hip.name = name + "-pivot";
      hip.position.set(x, hipY, 0);
      const thighLen = (legLen - footH) * 0.48;
      const shinLen = legLen - footH - thighLen;
      const joint = legR * 1.15;
      const thighTop = joint * 0.35;
      const thighBot = -thighLen - joint;
      const thighCyl = Math.max(0.01, thighTop - thighBot - legR * 2);
      const thigh = dress(new THREE.Mesh(new THREE.CapsuleGeometry(legR, thighCyl, 8, 16), mat));
      thigh.name = name + "-thigh";
      thigh.position.y = (thighTop + thighBot) * 0.5;
      hip.add(thigh);
      const hipCap = dress(new THREE.Mesh(new THREE.SphereGeometry(legR * 1.08, 14, 12), mat));
      hipCap.name = name + "-hip";
      hip.add(hipCap);
      const knee = new THREE.Group();
      knee.name = name + "-knee";
      knee.position.y = -thighLen;
      hip.add(knee);
      const kneeCap = dress(new THREE.Mesh(new THREE.SphereGeometry(legR * 1.1, 14, 12), mat));
      kneeCap.name = name + "-knee-ball";
      knee.add(kneeCap);
      const shinTop = joint;
      const shinBot = -shinLen + joint * 0.2;
      const shinCyl = Math.max(0.01, shinTop - shinBot - legR * 0.95 * 2);
      const shin = dress(new THREE.Mesh(new THREE.CapsuleGeometry(legR * 0.95, shinCyl, 8, 16), mat));
      shin.name = name + "-shin";
      shin.position.y = (shinTop + shinBot) * 0.5;
      knee.add(shin);
      const ankle = new THREE.Group();
      ankle.name = name + "-ankle";
      ankle.position.y = -shinLen;
      knee.add(ankle);
      const footGeo = new THREE.SphereGeometry(legR * 1.05, 14, 10);
      const foot = dress(new THREE.Mesh(footGeo, mat));
      foot.name = name + "-foot";
      foot.scale.set(1.05, 0.38, footLen / (legR * 1.05));
      foot.position.set(0, -footH * 0.42, footLen * 0.28);
      ankle.add(foot);
      figure.add(hip);
      return { hip, knee, ankle, foot, thighLen, shinLen };
    }

    const shoulderX = shoulderW * 0.5 + armGap + armR;
    const armL = limbArm(-shoulderX, shoulderY, armR, armLen, "armL");
    const armRgt = limbArm(shoulderX, shoulderY, armR, armLen, "armR");
    const legX = legR + legGap * 0.5;
    const left = makeLeg(-legX, "legL");
    const right = makeLeg(legX, "legR");

    figure.updateMatrixWorld(true);
    const box = bodyBox(figure);
    const builtH = box.max.y - box.min.y;
    if (builtH > 0.01) figure.scale.multiplyScalar(h / builtH);
    figure.updateMatrixWorld(true);

    const scale = h / Math.max(builtH, 0.01);
    const step = 2 * ((left.thighLen + left.shinLen) * scale) * Math.sin(LEG_SWING);
    const natural = (2 * step) / WALK_CYCLE;
    return {
      figure,
      armL,
      armR: armRgt,
      legL: left.hip,
      legR: right.hip,
      kneeL: left.knee,
      kneeR: right.knee,
      footL: left.foot,
      footR: right.foot,
      torso,
      head,
      mat,
      natural,
    };
  }

  function makeFloorGlow() {
    const group = new THREE.Group();
    group.name = "floor-fx";

    function radial(inner, mid, outer, size) {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext("2d");
      const grd = ctx.createRadialGradient(64, 64, inner, 64, 64, 62);
      grd.addColorStop(0, mid);
      grd.addColorStop(0.45, outer);
      grd.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 128, 128);
      const tex = new THREE.CanvasTexture(c);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          depthWrite: false,
          depthTest: true,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        })
      );
      mesh.rotation.x = -Math.PI / 2;
      return mesh;
    }

    const glow = radial(8, "rgba(255,255,255,0.36)", "rgba(230,236,255,0.12)", 1.15);
    glow.name = "floor-glow";
    glow.material.blending = THREE.AdditiveBlending;
    glow.material.opacity = 0.7;
    glow.position.y = 0.008;
    glow.renderOrder = 4;
    const shadowL = radial(3, "rgba(0,0,0,0.58)", "rgba(0,0,0,0.2)", 0.3);
    shadowL.name = "contact-shadow-L";
    shadowL.position.set(-0.08, 0.004, 0.02);
    shadowL.renderOrder = 3;
    const shadowR = radial(3, "rgba(0,0,0,0.58)", "rgba(0,0,0,0.2)", 0.3);
    shadowR.name = "contact-shadow-R";
    shadowR.position.set(0.08, 0.004, 0.02);
    shadowR.renderOrder = 3;
    group.add(shadowL);
    group.add(shadowR);
    group.add(glow);
    group.userData.shadowL = shadowL;
    group.userData.shadowR = shadowR;
    return group;
  }

  function figureCanvasHeight() {
    if (!avatarRoot || !camera) return 0;
    avatarRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(avatarLimbs && avatarLimbs.figure ? avatarLimbs.figure : avatarRoot);
    const v = new THREE.Vector3();
    let y0 = 1;
    let y1 = -1;
    const min = box.min;
    const max = box.max;
    const corners = [
      [min.x, min.y, min.z], [min.x, min.y, max.z], [min.x, max.y, min.z], [min.x, max.y, max.z],
      [max.x, min.y, min.z], [max.x, min.y, max.z], [max.x, max.y, min.z], [max.x, max.y, max.z],
    ];
    for (const c of corners) {
      v.set(c[0], c[1], c[2]).project(camera);
      if (!Number.isFinite(v.y)) continue;
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    return Math.max(0, (y1 - y0) / 2);
  }


  function figureMaterial() {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf4f6ff,
      emissiveIntensity: 0.62,
      roughness: 0.46,
      metalness: 0.04,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      envMapIntensity: 0,
    });
    attachFresnel(mat, 0.3, 1.7);
    return mat;
  }

  function applyWalkPose(limbs, time, walkWeight) {
    if (!limbs) return;
    const phase = (time / WALK_CYCLE) * Math.PI * 2;
    const w = walkWeight * walkWeight * (3 - 2 * walkWeight);
    const sl = Math.sin(phase);
    const sr = Math.sin(phase + Math.PI);
    limbs.legL.rotation.x = sl * LEG_SWING * w;
    limbs.legR.rotation.x = sr * LEG_SWING * w;
    if (limbs.kneeL) limbs.kneeL.rotation.x = -(0.1 + Math.max(0, sl) * 0.62) * w;
    if (limbs.kneeR) limbs.kneeR.rotation.x = -(0.1 + Math.max(0, sr) * 0.62) * w;
    limbs.armL.rotation.x = Math.sin(phase + Math.PI) * ARM_SWING * w;
    limbs.armR.rotation.x = Math.sin(phase) * ARM_SWING * w;
    if (limbs.torso) {
      limbs.torso.rotation.y = sl * 0.06 * w;
      limbs.torso.rotation.z = sl * 0.035 * w;
    }
    if (limbs.head) {
      limbs.head.rotation.y = -sl * 0.04 * w;
    }
  }

  function plantMoverFeet(mover) {
    if (!mover || !mover.limbs || !mover.limbs.figure) return;
    const floor = mover.root.position.y;
    mover.limbs.figure.position.y = mover.limbs.baseY;
    mover.limbs.figure.updateMatrixWorld(true);
    let lowest = Infinity;
    for (const foot of [mover.limbs.footL, mover.limbs.footR]) {
      if (!foot) continue;
      foot.updateWorldMatrix(true, false);
      const box = meshWorldBox(foot);
      if (box.min.y < lowest) lowest = box.min.y;
    }
    if (!Number.isFinite(lowest) || lowest === Infinity) return;
    mover.limbs.figure.position.y = mover.limbs.baseY + (floor - lowest);
    mover.limbs.figure.updateMatrixWorld(true);
  }

  function buildSimpleCar() {
    const mat = figureMaterial();
    const car = new THREE.Group();
    car.name = "street-car";

    // Rounded lower body (length along Z, slightly wider than tall).
    const hull = dress(new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 2.85, 8, 20), mat));
    hull.name = "car-body";
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1.7, 1, 1.05);
    hull.position.y = 0.55;
    car.add(hull);

    const belt = dress(new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.38, 3.35), mat));
    belt.name = "car-belt";
    belt.position.y = 0.62;
    car.add(belt);

    const hood = dress(new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.14, 1.05), mat));
    hood.name = "car-hood";
    hood.position.set(0, 0.86, 1.15);
    car.add(hood);

    // Distinct cabin / greenhouse, shorter than the body and set slightly aft.
    const cabin = dress(new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.62, 1.65), mat));
    cabin.name = "car-cabin";
    cabin.position.set(0, 1.18, -0.22);
    car.add(cabin);

    const windshield = dress(new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.08, 0.85), mat));
    windshield.name = "car-windshield";
    windshield.position.set(0, 1.08, 0.72);
    windshield.rotation.x = -0.58;
    car.add(windshield);

    const rearWindow = dress(new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.08, 0.55), mat));
    rearWindow.name = "car-rear-window";
    rearWindow.position.set(0, 1.08, -1.08);
    rearWindow.rotation.x = 0.5;
    car.add(rearWindow);

    // Cylindrical wheels with the axle along X, sitting on the ground.
    const wheelR = 0.33;
    const wheelW = 0.24;
    const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 18);
    for (const [x, z] of [[-0.82, 1.12], [0.82, 1.12], [-0.82, -1.12], [0.82, -1.12]]) {
      const wheel = dress(new THREE.Mesh(wheelGeo, mat));
      wheel.name = "car-wheel";
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, wheelR, z);
      car.add(wheel);
    }

    car.updateMatrixWorld(true);
    const box = bodyBox(car);
    car.position.y += -box.min.y;
    car.updateMatrixWorld(true);
    return car;
  }

  function makeCurve(spec) {
    const pts = (spec.points || []).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    if (pts.length < 2) return null;
    const closed = Boolean(spec.closed);
    const curve = new THREE.CatmullRomCurve3(pts, closed, "centripetal");
    return { curve, length: curve.getLength(), speed: Number(spec.speed) > 0 ? Number(spec.speed) : 1.2, closed, height: Number(spec.height) > 0 ? Number(spec.height) : 1.7 };
  }

  function makeContactShadow(width, depth, opacity) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1a1612,
      transparent: true,
      opacity: opacity == null ? 0.34 : opacity,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 28), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(width || 0.55, depth || 0.38, 1);
    mesh.position.y = 0.012;
    mesh.renderOrder = -1;
    mesh.name = "contact-shadow";
    return mesh;
  }

  function ensureStreetEnvironment() {
    if (!renderer || !scene || streetEnvMap) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.HemisphereLight(0xcdd8e8, 0x5c584c, 1.05));
    const sun = new THREE.DirectionalLight(0xfff1d8, 1.15);
    sun.position.set(8, 14, 5);
    envScene.add(sun);
    streetEnvMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = streetEnvMap;
    scene.environmentIntensity = 0.85;
    pmrem.dispose();
  }

  function getStreetLoader() {
    if (streetGltfLoader) return streetGltfLoader;
    const ktx2 = new KTX2Loader().setTranscoderPath("vendor/three/addons/libs/basis/");
    ktx2.detectSupport(renderer);
    streetGltfLoader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
    return streetGltfLoader;
  }

  async function loadStreetTemplate(url) {
    if (streetModelCache.has(url)) return streetModelCache.get(url);
    const gltf = await getStreetLoader().loadAsync(url);
    streetModelCache.set(url, gltf);
    return gltf;
  }

  function prepareStreetClone(gltf) {
    const root = cloneSkinned(gltf.scene);
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.userData.sharedStreetModel = true;
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.frustumCulled = false;
      const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
      for (const mat of mats) {
        if (!mat) continue;
        if ("emissiveIntensity" in mat) mat.emissiveIntensity = 0;
        if ("envMapIntensity" in mat && mat.envMapIntensity == null) mat.envMapIntensity = 0.9;
      }
    });
    root.updateMatrixWorld(true);
    const box = bodyBox(root);
    if (Number.isFinite(box.min.y) && Math.abs(box.min.y) > 0.004) {
      root.position.y += -box.min.y;
      root.updateMatrixWorld(true);
    }
    return root;
  }

  function walkClip(gltf) {
    const clips = gltf.animations || [];
    return clips.find((c) => /walk/i.test(c.name)) || clips[0] || null;
  }

  async function loadCrowd(spec) {
    disposeCrowd();
    if (!spec || !scene) return 0;
    const peds = Array.isArray(spec.pedestrians) ? spec.pedestrians : [];
    const cars = Array.isArray(spec.cars) ? spec.cars : [];
    if (!peds.length && !cars.length) return 0;
    const usesModels = peds.some((item) => resolveStreetModel("pedestrian", item.model)) || cars.some((item) => resolveStreetModel("car", item.model));
    crowdLit = usesModels;
    crowdRoot = new THREE.Group();
    crowdRoot.name = "splat-crowd";
    if (usesModels) {
      ensureStreetEnvironment();
      const lighting = spec.lighting || {};
      const num = (key, fallback) => {
        const n = Number(lighting[key]);
        return Number.isFinite(n) && n >= 0 ? n : fallback;
      };
      const fill = new THREE.DirectionalLight(0xf3efe6, num("fill", 0.7));
      fill.position.set(-6, 6, -8);
      fill.name = "street-fill";
      crowdRoot.add(fill);
      const rim = new THREE.DirectionalLight(0xdde6f2, num("rim", 0.35));
      rim.position.set(6, 4, 8);
      rim.name = "street-rim";
      crowdRoot.add(rim);
      const hemiI = num("hemi", 0);
      if (hemiI > 0) {
        const hemi = new THREE.HemisphereLight(0xe8eef6, 0x6a6560, hemiI);
        hemi.name = "street-hemi";
        crowdRoot.add(hemi);
      }
      if (scene) scene.environmentIntensity = num("envIntensity", 0.85);
    } else addFigureLights(crowdRoot);

    async function addPedestrian(item, i) {
      const made = makeCurve(item);
      if (!made) return;
      const url = resolveStreetModel("pedestrian", item.model);
      const root = new THREE.Group();
      root.name = "pedestrian-" + (item.id || i + 1);
      let mixer = null;
      let limbs = null;
      let modelName = item.model || "simple";
      let natural = 1.2;
      if (url) {
        try {
          const gltf = await loadStreetTemplate(url);
          const figure = prepareStreetClone(gltf);
          root.add(figure);
          root.add(makeContactShadow(0.52, 0.36, 0.36));
          const clip = walkClip(gltf);
          if (clip) {
            mixer = new THREE.AnimationMixer(figure);
            const action = mixer.clipAction(clip);
            action.loop = THREE.LoopRepeat;
            action.play();
          }
          natural = WALK_DESIGN_SPEED;
        } catch (err) {
          console.error("Street pedestrian model failed", item.model, err);
          modelName = "simple";
        }
      }
      if (!mixer && modelName === "simple") {
        const built = buildSimpleFigure(made.height);
        built.figure.updateMatrixWorld(true);
        const box = bodyBox(built.figure);
        built.figure.position.y += 0 - box.min.y;
        built.figure.updateMatrixWorld(true);
        const floorFx = makeFloorGlow();
        root.add(built.figure);
        root.add(floorFx);
        limbs = {
          figure: built.figure,
          armL: built.armL,
          armR: built.armR,
          legL: built.legL,
          legR: built.legR,
          kneeL: built.kneeL,
          kneeR: built.kneeR,
          footL: built.footL,
          footR: built.footR,
          torso: built.torso,
          head: built.head,
          baseY: built.figure.position.y,
        };
        natural = built.natural || 1.2;
      }
      crowdRoot.add(root);
      const startU = Number(item.startU);
      const u0 = Number.isFinite(startU) ? startU - Math.floor(startU) : (i + 0.15) / Math.max(peds.length, 1);
      movers.push({
        kind: "pedestrian",
        id: item.id || root.name,
        model: modelName,
        root,
        limbs,
        mixer,
        wheels: null,
        curve: made.curve,
        length: made.length,
        speed: made.speed,
        closed: made.closed,
        u: u0,
        animTime: i * 0.37,
        natural,
      });
    }

    async function addCar(item, i) {
      const made = makeCurve(item);
      if (!made) return;
      const url = resolveStreetModel("car", item.model);
      const root = new THREE.Group();
      root.name = "car-" + (item.id || i + 1);
      let wheels = null;
      let modelName = item.model || "simple";
      if (url) {
        try {
          const gltf = await loadStreetTemplate(url);
          const car = prepareStreetClone(gltf);
          root.add(car);
          root.add(makeContactShadow(2.15, 1.05, 0.4));
          wheels = collectWheels(car, THREE);
        } catch (err) {
          console.error("Street car model failed", item.model, err);
          modelName = "simple";
        }
      }
      if (modelName === "simple" && !wheels) {
        root.add(buildSimpleCar());
      }
      crowdRoot.add(root);
      const u0 = (i + 0.3) / Math.max(cars.length, 1);
      movers.push({
        kind: "car",
        id: item.id || root.name,
        model: modelName,
        root,
        limbs: null,
        mixer: null,
        wheels,
        curve: made.curve,
        length: made.length,
        speed: made.speed,
        closed: made.closed,
        u: u0,
        animTime: 0,
        natural: 1,
      });
    }

    for (let i = 0; i < peds.length; i++) await addPedestrian(peds[i], i);
    for (let i = 0; i < cars.length; i++) await addCar(cars[i], i);
    scene.add(crowdRoot);
    // Place everyone once so the first frame is not stacked at the origin.
    updateMovers(0);
    return movers.length;
  }

  function updateMovers(dt) {
    if (!movers.length) return;
    const tmpT = new THREE.Vector3();
    const tmpP = new THREE.Vector3();
    for (const mover of movers) {
      if (dt > 0) {
        const du = (mover.speed / Math.max(mover.length, 0.001)) * dt;
        if (mover.closed) {
          mover.u = (mover.u + du) % 1;
          if (mover.u < 0) mover.u += 1;
        } else {
          mover.u = clamp(mover.u + du, 0, 1);
        }
      }
      const u = clamp(mover.u, 0, 1);
      mover.curve.getPointAt(u, tmpP);
      mover.curve.getTangentAt(u, tmpT);
      tmpT.y = 0;
      if (tmpT.lengthSq() < 1e-8) tmpT.set(0, 0, 1);
      else tmpT.normalize();
      mover.root.position.copy(tmpP);
      mover.root.rotation.y = Math.atan2(tmpT.x, tmpT.z);
      mover.root.updateMatrixWorld(true);
      if (mover.mixer) {
        mover.mixer.timeScale = mover.speed / Math.max(mover.natural, 0.05);
        if (dt > 0) mover.mixer.update(dt);
      } else if (mover.kind === "pedestrian" && mover.limbs) {
        mover.animTime += dt * (mover.speed / Math.max(mover.natural, 0.05));
        applyWalkPose(mover.limbs, mover.animTime, 1);
        plantMoverFeet(mover);
      }
      if (mover.kind === "pedestrian") snapFeetToFloor(mover.root, tmpP.y);
      if (mover.wheels && mover.wheels.length && dt > 0) {
        for (const wheel of mover.wheels) {
          wheel.spin += (mover.speed / Math.max(wheel.radius, 0.12)) * dt;
          _spinQ.setFromAxisAngle(_wheelAxis, wheel.spin);
          wheel.node.quaternion.copy(wheel.rest).multiply(_spinQ);
        }
      }
    }
  }

  function frameCarCamera() {
    const car = movers.find((m) => m.kind === "car" && m.root);
    if (!car || !camera) return false;
    const origin = car.root.position.clone();
    origin.y += 0.65;
    const held = origin.clone();
    held.x += 5.2;
    held.y += 2.05;
    held.z += 4.6;
    held.x = clamp(held.x, boundsMin.x, boundsMax.x);
    held.y = clamp(held.y, 0.6, Math.max(boundsMax.y, 3.2));
    held.z = clamp(held.z, boundsMin.z, boundsMax.z);
    camera.position.copy(held);
    camera.lookAt(origin);
    camera.updateMatrixWorld(true);
    return true;
  }

  function frameCrowdCamera() {
    const list = movers.filter((m) => m.root);
    if (!list.length || !camera) return false;
    const origin = new THREE.Vector3();
    let n = 0;
    for (const m of list) {
      origin.add(m.root.position);
      n += 1;
    }
    origin.multiplyScalar(1 / n);
    origin.y += 0.7;
    // Prefer a view that also catches the walker if it is nearby.
    if (avatarRoot) {
      origin.lerp(avatarRoot.position.clone().setY(avatarRoot.position.y + 0.85), 0.25);
    }
    const held = origin.clone();
    held.x += 5.4;
    held.y += 1.6;
    held.z += 4.2;
    held.x = clamp(held.x, boundsMin.x, boundsMax.x);
    held.y = clamp(held.y, 0.6, Math.max(boundsMax.y, 3.2));
    held.z = clamp(held.z, boundsMin.z, boundsMax.z);
    camera.position.copy(held);
    camera.lookAt(origin);
    camera.updateMatrixWorld(true);
    return true;
  }

  async function loadAvatar(spec, floorY) {
    disposeAvatar();
    const height = spec && Number(spec.height) > 0 ? Number(spec.height) : 1.7;
    const built = buildSimpleFigure(height);
    built.figure.updateMatrixWorld(true);
    const floor = Number.isFinite(floorY) ? floorY : 0;
    const box = bodyBox(built.figure);
    built.figure.position.y += floor - box.min.y;
    built.figure.updateMatrixWorld(true);
    avatarYawOffset = spec && Number.isFinite(spec.yawOffset) ? spec.yawOffset : 0;
    if (built.natural > 0.2) walkNaturalSpeed = built.natural;

    avatarRoot = new THREE.Group();
    avatarRoot.name = "splat-avatar";
    const floorFx = makeFloorGlow();
    avatarRoot.add(built.figure);
    avatarRoot.add(floorFx);
    addFigureLights(avatarRoot);
    scene.add(avatarRoot);
    avatarLimbs = {
      figure: built.figure,
      armL: built.armL,
      armR: built.armR,
      legL: built.legL,
      legR: built.legR,
      kneeL: built.kneeL,
      kneeR: built.kneeR,
      footL: built.footL,
      footR: built.footR,
      torso: built.torso,
      head: built.head,
      shadowL: floorFx.userData.shadowL,
      shadowR: floorFx.userData.shadowR,
      baseY: built.figure.position.y,
      floorY: floor,
    };
    animTime = 0;
    animWalkWeight = 0;
    setAvatarAnim("idle");
    updateAvatarPose(performance.now());
    avatarReady = true;
    return true;
  }

  function playPath() {
    if (!pathCurve) return;
    if (pathU >= 1 && !(pathData && pathData.closed)) pathU = 0;
    playing = true;
    playAnchorU = pathU;
    playAnchorMs = performance.now();
    setAvatarAnim("walk");
    syncTransport();
  }

  function pausePath() {
    playing = false;
    playAnchorU = pathU;
    playAnchorMs = performance.now();
    setAvatarAnim("idle");
    syncTransport();
  }

  function togglePlay() {
    if (playing) pausePath();
    else playPath();
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
    disposeAvatar();
    disposeAvatarTarget();
    pathCurve = null;
    pathData = null;
    playing = false;
    pathU = 0;
    hideShell();
    lookAxis = { x: 0, y: 0 };
    moveAxis = { x: 0, y: 0 };
    dragging = false;
    dragId = null;
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
    const bits = [escapeHtml(credit.credit || "")];
    if (credit.commons) bits.push(`<a href="${credit.commons}" target="_blank" rel="noopener">Source</a>`);
    if (credit.license && credit.licenseUrl) bits.push(`<a href="${credit.licenseUrl}" target="_blank" rel="noopener">${escapeHtml(credit.license)}</a>`);
    else if (credit.license) bits.push(escapeHtml(credit.license));
    banner.innerHTML = bits.join(" · ");

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
      const avatarSpec = opts.avatar || credit.avatar;
      const pathSpec = opts.path || credit.path;
      try {
        await loadPath(pathSpec);
        if (gen !== openGen) return;
        const floorY = pathData && Number.isFinite(pathData.floorY) ? pathData.floorY : 0;
        await loadAvatar(avatarSpec, floorY);
        if (gen !== openGen) return;
        await loadCrowd(pathData);
        if (gen !== openGen) return;
      } catch (avatarErr) {
        console.error(avatarErr);
        // Keep the splat view; the walker is optional.
        avatarReady = false;
      }
      if (pathCurve) {
        yaw = 0;
        pitch = 0.12;
        setPathU(0);
        // Autoplay before warm-up so the transport already reads Pause
        // on the first visible frame, not Play.
        playPath();
        poseAvatarAndCamera();
      }
      // A couple of warm-up frames so the first visible image isn't empty.
      // Cap the wait; a slow splat GPU can take many seconds per frame.
      for (let i = 0; i < 2; i++) {
        if (pathCurve) poseAvatarAndCamera();
        else applyCamera();
        renderFrame();
        syncTransport();
        await new Promise((r) => {
          let done = false;
          const finish = () => { if (!done) { done = true; r(); } };
          requestAnimationFrame(finish);
          setTimeout(finish, 250);
        });
        if (gen !== openGen) return;
      }
      stats.loadMs = performance.now() - t0;
      ready = true;
      if (pathCurve && !playing) playPath();
      else syncTransport();
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
  playBtn.addEventListener("click", () => togglePlay());
  seek.addEventListener("pointerdown", () => {
    seeking = true;
  });
  seek.addEventListener("input", () => {
    setPathU(Number(seek.value) / 1000, { fromUser: true });
    if (pathCurve) poseAvatarAndCamera();
  });
  const endSeek = () => {
    seeking = false;
    syncTransport();
  };
  seek.addEventListener("pointerup", endSeek);
  seek.addEventListener("pointercancel", endSeek);

  function onKey(e) {
    if (shell.hidden) return;
    if (e.key === "Escape") {
      if (isFullscreen()) exitFullscreen();
      else close();
    } else if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      togglePlay();
    }
  }
  window.addEventListener("keydown", onKey);
  window.addEventListener("resize", resize);

  const api = {
    open,
    close,
    play: playPath,
    pause: pausePath,
    seek(u) {
      setPathU(Number(u), { fromUser: true });
      if (pathCurve) poseAvatarAndCamera();
    },
    get ready() {
      return ready;
    },
    get avatarReady() {
      return avatarReady;
    },
    get playing() {
      return playing;
    },
    get pathU() {
      return pathU;
    },
    get yaw() {
      return yaw;
    },
    get pitch() {
      return pitch;
    },
    get pathLength() {
      return pathLength;
    },
    get carPosition() {
      return { x: carPosition.x, y: carPosition.y, z: carPosition.z };
    },
    get avatarPosition() {
      return { x: carPosition.x, y: carPosition.y, z: carPosition.z };
    },
    get anim() {
      return avatarAnim;
    },
    get animTime() {
      return animTime;
    },
    get walkNaturalSpeed() {
      return walkNaturalSpeed;
    },
    get figureHeight() {
      return figureCanvasHeight();
    },
    get bounds() {
      return {
        min: pathBoundsMin.toArray(),
        max: pathBoundsMax.toArray(),
      };
    },
    get stats() {
      return { loadMs: stats.loadMs, fps: stats.fps };
    },
    frameFigure(mode) {
      cameraHold = mode === "side" ? "side" : mode === "feet" ? "feet" : mode === "knees" ? "knees" : mode === "crowd" ? "crowd" : mode === "car" ? "car" : "threeQuarter";
    },
    clearFigureFrame() {
      cameraHold = null;
    },
    get pedestrians() {
      return movers.filter((m) => m.kind === "pedestrian").map((m) => ({
        id: m.id,
        model: m.model || "simple",
        u: m.u,
        position: { x: m.root.position.x, y: m.root.position.y, z: m.root.position.z },
      }));
    },
    get cars() {
      return movers.filter((m) => m.kind === "car").map((m) => ({
        id: m.id,
        model: m.model || "simple",
        u: m.u,
        position: { x: m.root.position.x, y: m.root.position.y, z: m.root.position.z },
      }));
    },
  };
  window.__tgSplatPlayer = api;
  return api;
}
