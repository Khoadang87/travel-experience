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
          <div class="look-hint">Look stick or drag: look around · Move stick: scrub the path · Play walks the character</div>
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
            <button type="button" class="text-btn view-360-btn" data-view-360>View 360 instead</button>
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
  const FOLLOW_BACK = 2.7;
  const FOLLOW_UP = 1.95;
  const FOLLOW_LOOK_Y = 0.85;
  const FOLLOW_SHOULDER = 0.28;
  const LEG_SWING = 0.5;
  const ARM_SWING = 0.4;
  const WALK_CYCLE = 1.0;
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
  let seeking = false;
  const pathBoundsMin = new THREE.Vector3(-10, -0.05, -10);
  const pathBoundsMax = new THREE.Vector3(10, 0.8, 10);
  const carPosition = new THREE.Vector3();
  const _tan = new THREE.Vector3();
  const _back = new THREE.Vector3();
  const _side = new THREE.Vector3();
  const _look = new THREE.Vector3();

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
    const dt = lastTs ? Math.min(0.08, (ts - lastTs) / 1000) : 0.016;
    lastTs = ts;
    yaw -= lookAxis.x * 1.4 * dt;
    pitch = clamp(pitch + lookAxis.y * 1.0 * dt, -1.2, 1.2);
    if (pathCurve) {
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
      }
      poseAvatarAndCamera();
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
    // Over-the-shoulder but pulled back and up, looking at mid-torso so the
    // whole figure stays in frame (head to toe) on a tall phone stage. Slightly
    // off to the right. Look stick/drag orbits that follow pose. Near a wall
    // (start/end of the aisle) there may not be room behind, so swing to a
    // three-quarter view inside the room.
    _back.set(-_tan.x, 0, -_tan.z).normalize();
    _back.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    _side.set(_tan.z, 0, -_tan.x).normalize();
    if (yaw) _side.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    const desiredBack = FOLLOW_BACK * Math.cos(clamp(pitch, -0.7, 0.7));
    const available = travelInBounds(carPosition, _back, desiredBack + 0.25);
    const pitchLift = Math.sin(clamp(pitch, -0.7, 0.7)) * 0.55;
    if (available < Math.min(1.5, desiredBack * 0.5)) {
      // Stay inside the room: ahead and to the side, looking back at the walker
      // (going "behind" here would push the camera through the window).
      _side.set(_tan.z, 0, -_tan.x).normalize();
      const left = travelInBounds(carPosition, _side, 1.6);
      _side.negate();
      const right = travelInBounds(carPosition, _side, 1.6);
      if (left >= right) _side.negate();
      const sideDist = Math.min(1.2, Math.max(0.5, Math.max(left, right) - 0.2));
      const aheadDist = Math.min(1.15, Math.max(0.55, travelInBounds(carPosition, _tan, 1.7) - 0.2));
      _look.copy(_tan).multiplyScalar(aheadDist).addScaledVector(_side, sideDist);
      if (yaw) _look.applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      pos.copy(carPosition).add(_look);
      pos.y = carPosition.y + FOLLOW_UP + 0.22 + pitchLift;
    } else {
      pos.copy(carPosition).addScaledVector(_back, Math.min(desiredBack, available - 0.12));
      const shoulderRoom = travelInBounds(carPosition, _side, FOLLOW_SHOULDER + 0.2);
      pos.addScaledVector(_side, Math.min(FOLLOW_SHOULDER, Math.max(0, shoulderRoom - 0.08)));
      pos.y = carPosition.y + FOLLOW_UP + pitchLift;
    }
    pos.x = clamp(pos.x, boundsMin.x, boundsMax.x);
    pos.y = clamp(pos.y, 0.9, Math.max(boundsMax.y, 2.55));
    pos.z = clamp(pos.z, boundsMin.z, boundsMax.z);
    camera.position.copy(pos);
    _look.copy(carPosition).addScaledVector(_tan, 0.35);
    _look.y = carPosition.y + FOLLOW_LOOK_Y;
    camera.lookAt(_look);
    camera.updateMatrixWorld(true);
  }

  function disposeAvatar() {
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
    const fade = dt / 0.18;
    if (target > animWalkWeight) animWalkWeight = Math.min(1, animWalkWeight + fade);
    else animWalkWeight = Math.max(0, animWalkWeight - fade);
    if (avatarAnim === "walk") {
      animTime += dt * (pathSpeed / Math.max(walkNaturalSpeed, 0.05));
    } else {
      animTime += dt * 0.35;
    }
    if (!avatarLimbs) return;
    const phase = (animTime / WALK_CYCLE) * Math.PI * 2;
    const w = animWalkWeight;
    avatarLimbs.legL.rotation.x = Math.sin(phase) * LEG_SWING * w;
    avatarLimbs.legR.rotation.x = Math.sin(phase + Math.PI) * LEG_SWING * w;
    avatarLimbs.armL.rotation.x = Math.sin(phase + Math.PI) * ARM_SWING * w;
    avatarLimbs.armR.rotation.x = Math.sin(phase) * ARM_SWING * w;
    // Small bob while walking; a quieter breath when idle.
    const bob = Math.abs(Math.sin(phase)) * 0.03 * w + Math.sin(animTime * 2) * 0.008 * (1 - w);
    avatarLimbs.figure.position.y = avatarLimbs.baseY + bob;
  }

  function buildSimpleFigure(height, color) {
    const h = height > 0.5 ? height : 1.7;
    const s = h / 1.7;
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color || 0xc27a4a),
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const figure = new THREE.Group();
    figure.name = "simple-figure";

    const hipY = 0.9 * s;
    const shoulderY = 1.36 * s;
    const headR = 0.13 * s;
    const headY = 1.57 * s;
    const torsoR = 0.15 * s;
    const torsoLen = 0.52 * s;
    const armRadius = 0.055 * s;
    const armLen = 0.58 * s;
    const legRadius = 0.07 * s;
    const footClear = 0.02 * s;
    const legLen = hipY - footClear;

    function capsule(radius, totalLen) {
      const mid = Math.max(0.01, totalLen - 2 * radius);
      return new THREE.CapsuleGeometry(radius, mid, 3, 10);
    }

    const torso = new THREE.Mesh(capsule(torsoR, torsoLen), mat);
    torso.name = "torso";
    torso.position.y = shoulderY - torsoLen * 0.45;
    figure.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 14, 10), mat);
    head.name = "head";
    head.position.y = headY;
    figure.add(head);

    function limb(x, jointY, radius, totalLen, name) {
      const pivot = new THREE.Group();
      pivot.name = name + "-pivot";
      pivot.position.set(x, jointY, 0);
      const mesh = new THREE.Mesh(capsule(radius, totalLen), mat);
      mesh.name = name;
      mesh.position.y = -totalLen * 0.5;
      pivot.add(mesh);
      figure.add(pivot);
      return pivot;
    }

    const shoulderX = 0.2 * s;
    const hipX = 0.09 * s;
    const armL = limb(-shoulderX, shoulderY, armRadius, armLen, "armL");
    const armR = limb(shoulderX, shoulderY, armRadius, armLen, "armR");
    const legL = limb(-hipX, hipY, legRadius, legLen, "legL");
    const legR = limb(hipX, hipY, legRadius, legLen, "legR");

    const step = 2 * legLen * Math.sin(LEG_SWING);
    const natural = (2 * step) / WALK_CYCLE;
    return { figure, armL, armR, legL, legR, mat, natural };
  }

  function makeContactShadow() {
    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext("2d");
    const grd = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grd.addColorStop(0, "rgba(0,0,0,0.38)");
    grd.addColorStop(0.5, "rgba(0,0,0,0.12)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.3),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })
    );
    shadow.name = "contact-shadow";
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.006;
    shadow.renderOrder = -2;
    return shadow;
  }

  async function loadAvatar(spec, floorY) {
    disposeAvatar();
    const height = spec && Number(spec.height) > 0 ? Number(spec.height) : 1.7;
    const color = spec && spec.color != null ? spec.color : 0xc27a4a;
    const built = buildSimpleFigure(height, color);
    built.figure.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(built.figure);
    const yLift = (Number.isFinite(floorY) ? floorY : 0) - box.min.y;
    built.figure.position.y += yLift;
    avatarYawOffset = spec && Number.isFinite(spec.yawOffset) ? spec.yawOffset : 0;
    if (built.natural > 0.2) walkNaturalSpeed = built.natural;

    avatarRoot = new THREE.Group();
    avatarRoot.name = "splat-avatar";
    avatarRoot.add(built.figure);
    avatarRoot.add(makeContactShadow());
    scene.add(avatarRoot);
    avatarLimbs = {
      figure: built.figure,
      armL: built.armL,
      armR: built.armR,
      legL: built.legL,
      legR: built.legR,
      baseY: built.figure.position.y,
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
    pathCurve = null;
    pathData = null;
    playing = false;
    pathU = 0;
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
      const avatarSpec = opts.avatar || credit.avatar;
      const pathSpec = opts.path || credit.path;
      try {
        await loadPath(pathSpec);
        if (gen !== openGen) return;
        const floorY = pathData && Number.isFinite(pathData.floorY) ? pathData.floorY : 0;
        await loadAvatar(avatarSpec, floorY);
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
        poseAvatarAndCamera();
      }
      // A few warm-up frames so the first visible image isn't empty.
      for (let i = 0; i < 6; i++) {
        if (pathCurve) poseAvatarAndCamera();
        else applyCamera();
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
    get bounds() {
      return {
        min: pathBoundsMin.toArray(),
        max: pathBoundsMax.toArray(),
      };
    },
    get stats() {
      return { loadMs: stats.loadMs, fps: stats.fps };
    },
  };
  window.__tgSplatPlayer = api;
  return api;
}
