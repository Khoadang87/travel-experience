import { bindCredits } from "./shared.js";

bindCredits();
bindMenu();

function bindMenu() {
  const btn = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  const backdrop = document.getElementById("nav-backdrop");
  if (!btn || !nav) return;

  function isOpen() {
    return document.body.classList.contains("nav-open");
  }

  function open() {
    document.body.classList.add("nav-open");
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "Close menu");
    if (backdrop) backdrop.hidden = false;
    const first = nav.querySelector("a, button");
    if (first) first.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    document.body.classList.remove("nav-open");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Open menu");
    if (backdrop) backdrop.hidden = true;
    if (restoreFocus) btn.focus();
  }

  btn.addEventListener("click", () => {
    if (isOpen()) close();
    else open();
  });
  if (backdrop) backdrop.addEventListener("click", () => close());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      // Credits dialog handles Escape when it is open; don't steal it.
      const credits = document.getElementById("credits-dialog");
      if (credits && !credits.hidden) return;
      close();
    }
  });

  nav.querySelectorAll("[data-open-places]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (document.body.dataset.page === "map" && typeof window.__tgOpenPlaces === "function") {
        e.preventDefault();
        close({ restoreFocus: false });
        window.__tgOpenPlaces();
      } else {
        close({ restoreFocus: false });
      }
    });
  });

  nav.querySelectorAll("[data-open-credits]").forEach((el) => {
    el.addEventListener("click", () => {
      close({ restoreFocus: false });
      const opener = document.getElementById("btn-credits");
      if (opener) opener.click();
    });
  });

  nav.querySelectorAll("a").forEach((el) => {
    el.addEventListener("click", () => close({ restoreFocus: false }));
  });
}
