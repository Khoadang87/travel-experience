// Shared Full screen control for the walk / 360 / splat players.
// The Full screen button is hidden on phone and coarse-pointer viewports
// (the player is already full-bleed there). This helper is for desktop /
// fine-pointer only. Prefer the native Fullscreen API; if it is missing
// or does not actually enter, fall back to a CSS pseudo-fullscreen so
// the desktop button never no-ops. Never use video.webkitEnterFullscreen.

function nativeElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
}

function nativeRequestFn(el) {
  return (
    el.requestFullscreen ||
    el.webkitRequestFullscreen ||
    el.webkitRequestFullScreen ||
    el.mozRequestFullScreen ||
    el.msRequestFullscreen ||
    null
  );
}

function nativeExitFn() {
  return (
    document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.webkitCancelFullScreen ||
    document.mozCancelFullScreen ||
    document.msExitFullscreen ||
    null
  );
}

function nativeEnabled() {
  if (document.fullscreenEnabled === false) return false;
  if (document.webkitFullscreenEnabled === false) return false;
  return true;
}

export function bindPlayerFullscreen({ panel, button, exitButton, onLayout }) {
  if (!panel || !button) {
    return { enter() {}, exit() {}, toggle() {}, isActive() { return false; }, destroy() {} };
  }

  let cssOn = false;
  let enterTimer = 0;
  const shell = panel.closest(".player-shell") || panel;
  // Keep in sync with the CSS that hides [data-fs] on phone / coarse / short landscape.
  const hideMq = window.matchMedia(
    "(max-width: 700px), (pointer: coarse), (max-height: 500px) and (max-width: 1000px)"
  );

  function isActive() {
    return nativeElement() === panel || cssOn || panel.classList.contains("is-fullscreen");
  }

  function syncButtons() {
    const on = isActive();
    button.textContent = on ? "Exit full screen" : "Full screen";
    button.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
    button.setAttribute("aria-pressed", on ? "true" : "false");
    if (exitButton) exitButton.hidden = !on;
  }

  function layout() {
    if (cssOn) {
      const vv = window.visualViewport;
      shell.style.position = "fixed";
      shell.style.zIndex = "90";
      shell.style.padding = "0";
      shell.style.margin = "0";
      if (vv) {
        shell.style.top = vv.offsetTop + "px";
        shell.style.left = vv.offsetLeft + "px";
        shell.style.right = "auto";
        shell.style.bottom = "auto";
        shell.style.width = vv.width + "px";
        shell.style.height = vv.height + "px";
      } else {
        shell.style.inset = "0";
        shell.style.width = "100%";
        shell.style.height = "100dvh";
      }
    }
    if (typeof onLayout === "function") onLayout();
  }

  function clearShellStyle() {
    ["position", "zIndex", "padding", "margin", "top", "left", "right", "bottom", "width", "height", "inset"].forEach((k) => {
      shell.style[k] = "";
    });
  }

  function lockPage() {
    if (!document.body.classList.contains("player-css-fs-lock")) {
      document.body.dataset.tgFsScroll = String(window.scrollY || window.pageYOffset || 0);
      document.body.classList.add("player-css-fs-lock");
    }
    try { window.scrollTo(0, 0); } catch (_) {}
    requestAnimationFrame(() => {
      try { window.scrollTo(0, 0); } catch (_) {}
    });
  }

  function unlockPage() {
    const y = Number(document.body.dataset.tgFsScroll || 0);
    document.body.classList.remove("player-css-fs-lock");
    delete document.body.dataset.tgFsScroll;
    try { window.scrollTo(0, y); } catch (_) {}
  }

  function enterCss() {
    cssOn = true;
    panel.classList.add("is-fullscreen");
    document.body.classList.add("player-css-fs");
    lockPage();
    syncButtons();
    layout();
  }

  function leaveCss() {
    cssOn = false;
    panel.classList.remove("is-fullscreen");
    document.body.classList.remove("player-css-fs");
    clearShellStyle();
    unlockPage();
    syncButtons();
    layout();
  }

  function enter() {
    if (isActive()) return;
    const fn = nativeEnabled() ? nativeRequestFn(panel) : null;
    if (typeof fn !== "function") {
      enterCss();
      return;
    }
    try {
      const result = fn.call(panel);
      if (result && typeof result.then === "function") {
        result.then(() => {
          if (nativeElement() === panel) {
            panel.classList.add("is-fullscreen");
            syncButtons();
            layout();
          } else if (!isActive()) {
            enterCss();
          }
        }).catch(() => enterCss());
      }
      window.clearTimeout(enterTimer);
      enterTimer = window.setTimeout(() => {
        if (!isActive()) enterCss();
        else syncButtons();
      }, 350);
    } catch (_) {
      enterCss();
    }
    syncButtons();
  }

  function exit(silent) {
    window.clearTimeout(enterTimer);
    if (cssOn) leaveCss();
    if (nativeElement()) {
      const fn = nativeExitFn();
      if (typeof fn === "function") {
        try {
          const result = fn.call(document);
          if (result && typeof result.catch === "function") result.catch(() => {});
        } catch (_) {}
      }
    }
    panel.classList.remove("is-fullscreen");
    if (!silent) syncButtons();
    layout();
  }

  function toggle() {
    if (isActive()) exit();
    else enter();
  }

  function onButton(e) {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  }
  function onExit(e) {
    e.preventDefault();
    e.stopPropagation();
    exit();
  }
  function onKey(e) {
    if (e.key !== "Escape") return;
    if (shell.hidden || !isActive()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    exit();
  }
  function onNativeChange() {
    if (nativeElement() === panel) {
      cssOn = false;
      document.body.classList.remove("player-css-fs");
      clearShellStyle();
      panel.classList.add("is-fullscreen");
    } else if (!cssOn) {
      panel.classList.remove("is-fullscreen");
    }
    syncButtons();
    layout();
  }
  function onViewport() {
    if (isActive()) layout();
  }

  button.addEventListener("click", onButton);
  if (exitButton) exitButton.addEventListener("click", onExit);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("fullscreenchange", onNativeChange);
  document.addEventListener("webkitfullscreenchange", onNativeChange);
  function onHideChrome() {
    if (hideMq.matches && isActive()) exit(true);
  }
  if (hideMq.addEventListener) hideMq.addEventListener("change", onHideChrome);
  else if (hideMq.addListener) hideMq.addListener(onHideChrome);

  window.addEventListener("resize", onViewport);
  if (window.visualViewport) window.visualViewport.addEventListener("resize", onViewport);

  syncButtons();

  return {
    enter,
    exit,
    toggle,
    isActive,
    destroy() {
      window.clearTimeout(enterTimer);
      button.removeEventListener("click", onButton);
      if (exitButton) exitButton.removeEventListener("click", onExit);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", onNativeChange);
      document.removeEventListener("webkitfullscreenchange", onNativeChange);
      window.removeEventListener("resize", onViewport);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", onViewport);
      if (hideMq.removeEventListener) hideMq.removeEventListener("change", onHideChrome);
      else if (hideMq.removeListener) hideMq.removeListener(onHideChrome);
      if (cssOn) leaveCss();
    },
  };
}
