import { bindFadeHint } from "./shared.js";
import { bindPlayerFullscreen } from "./fullscreen.js";

// Hoi An-style video walk for flat portrait clips.
// Hold-to-walk, Explore, mini-map, stale-cache guard, and the sound
// toggle follow cities/hoian/walk-w27.js (commit 16996dd, 31 Oct 2026).
// Look-around is a modest overscale + pan inside the frame, not a 360 sphere.

const VER = "vw1";
const DEADZONE = 0.2;
const OVERSCALE = 1.28;

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function fmtTime(s) {
  s = Math.max(0, s || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return m + ":" + String(r).padStart(2, "0");
}

export function mountVideoWalkPlayer(root) {
  root.innerHTML = `
    <div class="player-shell" hidden>
      <div class="player-panel" role="dialog" aria-modal="true" aria-labelledby="videowalk-title">
        <div class="player-top">
          <div>
            <p class="eyebrow" id="videowalk-kicker">Video walk · private test</p>
            <h2 id="videowalk-title">Pin</h2>
          </div>
          <div class="player-top-actions">
            <button type="button" class="icon-btn" data-sound aria-label="Sound off">Sound off</button>
            <button type="button" class="icon-btn" data-fs aria-label="Full screen" aria-pressed="false">Full screen</button>
            <button type="button" class="icon-btn fs-exit-btn" data-fs-exit hidden aria-label="Exit full screen">✕</button>
            <button type="button" class="icon-btn" data-close aria-label="Close">Close</button>
          </div>
        </div>
        <p class="credit-line"><span data-sample-banner></span> <button type="button" class="text-link" data-credits>Credits</button></p>
        <div class="credit-details" data-credit-details hidden></div>
        <div class="stage videowalk-stage" data-stage>
          <video data-video playsinline webkit-playsinline muted preload="auto"></video>
          <p class="ai-edge-note" data-ai-edge-note hidden>Edges extended with AI</p>
          <canvas class="videowalk-minimap" data-minimap width="120" height="120" aria-label="Approximate walk map: tap to jump"></canvas>
        </div>
        <p class="look-caption" data-look-hint>
          <span class="hint-phone">Drag to look, hold stick to walk</span>
          <span class="hint-desktop">Hold Move up to walk. Release to stop. Drag or use Look to look around. You can also hold the Up arrow or W.</span>
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
              <div class="stick" data-stick="move" role="application" aria-label="Move joystick: hold up to walk forward">
                <span class="stick-dir dir-up" aria-hidden="true">↑</span>
                <div class="stick-knob"></div>
              </div>
              <span>Move</span>
            </div>
          </div>
          <div class="transport">
            <input type="range" min="0" max="1000" value="0" data-seek aria-label="Walk position">
            <span class="time" data-time>0:00 / 0:00</span>
          </div>
          <div class="videowalk-spots" data-spots></div>
        </div>
      </div>
    </div>
  `;

  const shell = root.querySelector(".player-shell");
  const panel = root.querySelector(".player-panel");
  const titleEl = root.querySelector("#videowalk-title");
  const banner = root.querySelector("[data-sample-banner]");
  const detailsEl = root.querySelector("[data-credit-details]");
  const creditsBtn = root.querySelector("[data-credits]");
  const stage = root.querySelector("[data-stage]");
  const video = root.querySelector("[data-video]");
  const mm = root.querySelector("[data-minimap]");
  const mctx = mm.getContext("2d");
  const closeBtn = root.querySelector("[data-close]");
  const fsBtn = root.querySelector("[data-fs]");
  const soundBtn = root.querySelector("[data-sound]");
  const exploreBtn = root.querySelector("[data-explore]");
  const explorePanel = root.querySelector("[data-explore-panel]");
  const exploreClose = root.querySelector("[data-explore-close]");
  // Explore is now a visible chip row; these optional refs stay for older API checks.
  const spotsEl = root.querySelector("[data-spots]");
  const goBtn = root.querySelector("[data-go]");
  const viewSplatBtn = root.querySelector("[data-view-splat]");
  const seek = root.querySelector("[data-seek]");
  const timeEl = root.querySelector("[data-time]");
  const lookStick = root.querySelector('[data-stick="look"]');
  const moveStick = root.querySelector('[data-stick="move"]');
  const lookKnob = lookStick.querySelector(".stick-knob");
  const moveKnob = moveStick.querySelector(".stick-knob");
  const markHintUsed = bindFadeHint(root.querySelector("[data-look-hint]"));

  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("muted", "");

  const audio = new Audio();
  audio.loop = true;
  audio.preload = "auto";
  let soundOn = false;

  let cfg = null;
  let ready = false;
  let closed = true;
  let duration = 0;
  let spots = [];
  let path = [];
  let overscale = OVERSCALE;
  let loopWalk = false;
  let onClose = null;
  let onViewSplat = null;
  let seeking = false;
  let jumping = false;
  let raf = 0;
  let lastTs = 0;
  let rate = 0;
  const keys = {};
  const move = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
  const lookJoy = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
  const look = { panX: 0, panY: 0, drag: null };
  let progMoveX = 0;
  let progMoveY = 0;
  let usingProgMove = false;

  function walkSpeed() {
    if (keys.ArrowUp || keys.KeyW) return 1;
    const y = usingProgMove ? progMoveY : move.id != null ? move.y : 0;
    const u = -y;
    if (u < DEADZONE) return 0;
    return 0.5 + 0.5 * Math.min(1, (u - DEADZONE) / 0.65);
  }

  function layoutVideo() {
    const sw = stage.clientWidth || 1;
    const sh = stage.clientHeight || 1;
    const vw = video.videoWidth || 9;
    const vh = video.videoHeight || 16;
    const cover = Math.max(sw / vw, sh / vh) * overscale;
    const dw = vw * cover;
    const dh = vh * cover;
    const maxX = Math.max(0, (dw - sw) / 2);
    const maxY = Math.max(0, (dh - sh) / 2);
    look.panX = clamp(look.panX, -maxX, maxX);
    look.panY = clamp(look.panY, -maxY, maxY);
    video.style.width = dw + "px";
    video.style.height = dh + "px";
    video.style.left = (sw - dw) / 2 + look.panX + "px";
    video.style.top = (sh - dh) / 2 + look.panY + "px";
    return { sw, sh, dw, dh, maxX, maxY };
  }

  function coversStage() {
    const s = stage.getBoundingClientRect();
    const v = video.getBoundingClientRect();
    const eps = 1.5;
    return (
      v.width > 8 &&
      v.height > 8 &&
      v.left <= s.left + eps &&
      v.top <= s.top + eps &&
      v.right >= s.right - eps &&
      v.bottom >= s.bottom - eps
    );
  }

  function setTimeLabel() {
    const t = video.currentTime || 0;
    const d = duration || video.duration || 0;
    timeEl.textContent = fmtTime(t) + " / " + fmtTime(d);
    if (!seeking) seek.value = d > 0 ? String(Math.round((t / d) * 1000)) : "0";
  }

  function drawMap() {
    const W = mm.width, H = mm.height;
    mctx.clearRect(0, 0, W, H);
    mctx.fillStyle = "rgba(0,0,0,0.45)";
    mctx.fillRect(0, 0, W, H);
    if (!path.length) return;
    const solid = path.filter((p) => !p.approx);
    const approx = path.filter((p) => p.approx);
    function stroke(pts, dash) {
      if (pts.length < 2) return;
      mctx.beginPath();
      mctx.setLineDash(dash || []);
      pts.forEach((p, i) => (i ? mctx.lineTo(p.x, p.y) : mctx.moveTo(p.x, p.y)));
      mctx.stroke();
    }
    mctx.strokeStyle = "rgba(255,255,255,0.8)";
    mctx.lineWidth = 2;
    stroke(solid, []);
    if (approx.length) {
      const bridge = solid.length ? [solid[solid.length - 1], ...approx] : approx;
      mctx.strokeStyle = "rgba(255,255,255,0.45)";
      stroke(bridge, [4, 3]);
      mctx.setLineDash([]);
    }
    const t = video.currentTime || 0;
    let best = path[0], bd = 1e9;
    for (const p of path) {
      const d = Math.abs(p.t - t);
      if (d < bd) { bd = d; best = p; }
    }
    mctx.fillStyle = "#ff4d4d";
    mctx.beginPath();
    mctx.arc(best.x, best.y, 4.5, 0, Math.PI * 2);
    mctx.fill();
  }

  async function jump(t) {
    jumping = true;
    t = clamp(t, 0, Math.max(0, duration - 0.05));
    try {
      video.pause();
      video.currentTime = t;
      if (soundOn) {
        try { audio.currentTime = t % (audio.duration || 8); } catch (_) {}
      }
      setTimeLabel();
      drawMap();
    } finally {
      jumping = false;
    }
  }

  function renderSpots() {
    spotsEl.innerHTML = "";
    for (const s of spots) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "text-btn videowalk-spot";
      b.textContent = s.label;
      b.dataset.t = String(s.t);
      b.addEventListener("click", () => {
        jump(s.t);
        root.querySelectorAll("[data-spots] .videowalk-spot").forEach((el) => {
          if (el === b) el.setAttribute("aria-current", "true");
          else el.removeAttribute("aria-current");
        });
      });
      spotsEl.appendChild(b);
    }
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (closed || !ready) return;
    const dt = Math.min(0.1, (now - (lastTs || now)) / 1000);
    lastTs = now;
    const want = walkSpeed();
    rate += (want - rate) * Math.min(1, dt * 8);
    const d = duration || video.duration || 0;
    const p = video.currentTime || 0;
    if (d && p >= d - 0.08 && !loopWalk) {
      if (!video.paused) video.pause();
    } else if (want > 0) {
      const r = Math.max(0.5, Math.min(1, want));
      if (video.playbackRate !== r) video.playbackRate = r;
      if (video.paused) video.play().catch(() => {});
    } else if (!video.paused) {
      video.pause();
    }
    if (soundOn) {
      audio.volume = video.paused ? 0.2 : 0.55;
      if (audio.paused) audio.play().catch(() => {});
    }
    // Look stick pans when held
    if (lookJoy.id != null || Math.abs(lookJoy.x) + Math.abs(lookJoy.y) > 0.02) {
      const lay = layoutVideo();
      look.panX = clamp(look.panX - lookJoy.x * lay.maxX * dt * 2.4, -lay.maxX, lay.maxX);
      look.panY = clamp(look.panY - lookJoy.y * lay.maxY * dt * 2.4, -lay.maxY, lay.maxY);
      layoutVideo();
    }
    setTimeLabel();
    if (now - (tick._mm || 0) > 200) {
      tick._mm = now;
      drawMap();
    }
  }

  function onResize() {
    if (!closed) layoutVideo();
  }

  function stickStart(state, el, e) {
    markHintUsed();
    const r = el.getBoundingClientRect();
    state.id = e.pointerId;
    state.cx = r.left + r.width / 2;
    state.cy = r.top + r.height / 2;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    stickMove(state, el, e);
  }
  function stickMove(state, el, e) {
    const R = el.offsetWidth / 2 || 52;
    let dx = (e.clientX - state.cx) / R;
    let dy = (e.clientY - state.cy) / R;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    state.x = dx;
    state.y = dy;
    const knob = el.querySelector(".stick-knob");
    if (knob) knob.style.transform = "translate(" + dx * R * 0.6 + "px," + dy * R * 0.6 + "px)";
  }
  function stickEnd(state, el) {
    state.id = null;
    state.x = 0;
    state.y = 0;
    const knob = el.querySelector(".stick-knob");
    if (knob) knob.style.transform = "";
  }

  function bindStick(el, state) {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      stickStart(state, el, e);
    });
    el.addEventListener("pointermove", (e) => {
      if (state.id === e.pointerId) stickMove(state, el, e);
    });
    const up = (e) => {
      if (state.id === e.pointerId) stickEnd(state, el);
    };
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  }
  bindStick(moveStick, move);
  bindStick(lookStick, lookJoy);

  stage.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    if (look.drag) return;
    if (e.target.closest && e.target.closest("canvas,button,a,input,.stick,.stick-wrap,.videowalk-spots")) return;
    look.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
    markHintUsed();
  });
  stage.addEventListener("pointermove", (e) => {
    if (!look.drag || look.drag.id !== e.pointerId) return;
    e.preventDefault();
    const lay = layoutVideo();
    look.panX = clamp(look.panX + (e.clientX - look.drag.x), -lay.maxX, lay.maxX);
    look.panY = clamp(look.panY + (e.clientY - look.drag.y), -lay.maxY, lay.maxY);
    look.drag.x = e.clientX;
    look.drag.y = e.clientY;
    layoutVideo();
  });
  const endDrag = (e) => {
    if (look.drag && look.drag.id === e.pointerId) look.drag = null;
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);

  mm.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    if (!path.length) return;
    const r = mm.getBoundingClientRect();
    const x = (e.clientX - r.left) * 120 / r.width;
    const y = (e.clientY - r.top) * 120 / r.height;
    let best = path[0], bd = 1e9;
    for (const p of path) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    if (bd < 400) jump(best.t);
  });

  function onKeyDown(e) { keys[e.code] = true; }
  function onKeyUp(e) { keys[e.code] = false; }

  seek.addEventListener("input", () => {
    seeking = true;
    const d = duration || video.duration || 0;
    const t = (Number(seek.value) / 1000) * d;
    timeEl.textContent = fmtTime(t) + " / " + fmtTime(d);
  });
  seek.addEventListener("change", () => {
    const d = duration || video.duration || 0;
    jump((Number(seek.value) / 1000) * d);
    seeking = false;
  });

  exploreBtn?.addEventListener("click", () => {
    if (explorePanel) explorePanel.hidden = !explorePanel.hidden;
  });
  exploreClose?.addEventListener("click", () => { if (explorePanel) explorePanel.hidden = true; });
  goBtn?.addEventListener("click", () => {
    if (explorePanel) explorePanel.hidden = true;
    const d = duration || video.duration || 0;
    jump((Number(seek.value) / 1000) * d);
  });

  creditsBtn?.addEventListener("click", () => {
    if (!detailsEl) return;
    detailsEl.hidden = !detailsEl.hidden;
  });

  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? "Sound on" : "Sound off";
    soundBtn.setAttribute("aria-label", soundOn ? "Sound on" : "Sound off");
    if (soundOn) {
      try { audio.currentTime = (video.currentTime || 0) % (audio.duration || 8); } catch (_) {}
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  closeBtn.addEventListener("click", () => close());
  viewSplatBtn?.addEventListener("click", () => {
    const cb = onViewSplat;
    close({ silent: true });
    if (cb) cb();
  });

  const fullscreen = bindPlayerFullscreen({
    panel,
    button: fsBtn,
    exitButton: root.querySelector("[data-fs-exit]"),
    onLayout: onResize,
  });

  function checkStale() {
    fetch("media/videowalk/ver.txt?" + Date.now(), { cache: "no-store" })
      .then((r) => r.text())
      .then((v) => {
        v = String(v || "").trim();
        if (/^vw\d+[a-z]?$/.test(v) && v !== VER) {
          const u = new URL(location.href);
          if (u.searchParams.get("_vw") !== v) {
            u.searchParams.set("_vw", v);
            location.replace(u);
          }
        }
      })
      .catch(() => {});
  }

  async function open(opts) {
    cfg = opts || {};
    onClose = cfg.onClose || null;
    onViewSplat = cfg.onViewSplat || null;
    titleEl.textContent = cfg.title || "Video walk";
    banner.textContent = cfg.credit || "";
    if (detailsEl) {
      detailsEl.textContent = cfg.creditDetails || "";
      detailsEl.hidden = true;
    }
    if (creditsBtn) creditsBtn.hidden = !(cfg.credit || cfg.creditDetails);
    spots = Array.isArray(cfg.spots) ? cfg.spots : [];
    path = Array.isArray(cfg.path) ? cfg.path : [];
    mm.hidden = !path.length;
    overscale = Number(cfg.overscale) > 1 ? Number(cfg.overscale) : OVERSCALE;
    loopWalk = Boolean(cfg.loop);
    video.loop = loopWalk;
    duration = Number(cfg.duration) || 0;
    const note = root.querySelector("[data-ai-edge-note]");
    if (note) {
      const text = cfg.badge || "";
      note.textContent = text;
      note.hidden = !text;
    }
    soundOn = false;
    soundBtn.textContent = "Sound off";
    soundBtn.setAttribute("aria-label", "Sound off");
    look.panX = 0;
    look.panY = 0;
    usingProgMove = false;
    progMoveX = 0;
    progMoveY = 0;
    rate = 0;
    if (explorePanel) explorePanel.hidden = true;
    if (viewSplatBtn) viewSplatBtn.hidden = true;
    renderSpots();
    checkStale();
    audio.src = cfg.ambience || "media/videowalk/ambience-standin.m4a";
    const src = cfg.src + (cfg.src.includes("?") ? "&" : "?") + "v=" + VER;
    video.pause();
    video.src = src;
    video.load();
    closed = false;
    ready = false;
    shell.hidden = false;
    document.body.classList.add("videowalk-open", "player-open");
    addEventListener("resize", onResize);
    addEventListener("keydown", onKeyDown);
    addEventListener("keyup", onKeyUp);
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error("Video took too long to load.")), 45000);
      const ok = () => { clearTimeout(to); res(); };
      if (video.readyState >= 1) { clearTimeout(to); res(); return; }
      video.addEventListener("loadedmetadata", ok, { once: true });
      video.addEventListener("error", () => { clearTimeout(to); rej(new Error("Video failed to load.")); }, { once: true });
    });
    if (!duration) duration = video.duration || 0;
    const lay = layoutVideo();
    // Landscape stages crop a tall portrait frame; bias slightly upward so
    // storefronts and the clock stay in view instead of mid-bodies only.
    look.panY = lay.maxY * 0.35;
    layoutVideo();
    setTimeLabel();
    drawMap();
    ready = true;
    if (!raf) raf = requestAnimationFrame(tick);
    window.__tgVideoWalk = api;
  }

  function close(opts) {
    const silent = opts && opts.silent;
    if (closed) return;
    closed = true;
    ready = false;
    video.pause();
    audio.pause();
    video.removeAttribute("src");
    video.load();
    shell.hidden = true;
    document.body.classList.remove("videowalk-open", "player-open");
    removeEventListener("resize", onResize);
    removeEventListener("keydown", onKeyDown);
    removeEventListener("keyup", onKeyUp);
    fullscreen.exit(true);
    if (!silent && onClose) onClose();
  }

  const api = {
    open,
    close,
    get ready() { return ready && !closed; },
    get playing() { return ready && !closed && walkSpeed() > 0 && !video.paused; },
    get currentTime() { return video.currentTime || 0; },
    get duration() { return duration || video.duration || 0; },
    get soundOn() { return soundOn; },
    get spots() { return spots.slice(); },
    get exploreOpen() { return true; },
    setMoveAxis(x, y) {
      usingProgMove = true;
      progMoveX = x;
      progMoveY = y;
      if (x === 0 && y === 0) usingProgMove = false;
    },
    setLookAxis(x, y) {
      lookJoy.x = x;
      lookJoy.y = y;
    },
    jump,
    coversStage,
    layout: layoutVideo,
    get pan() { return { x: look.panX, y: look.panY }; },
    get overscale() { return overscale; },
    get loop() { return loopWalk; },
  };
  window.__tgVideoWalk = api;
  return api;
}
