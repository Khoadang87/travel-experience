import { SITE_NAME } from "./site-config.js";
import { loadCatalog } from "./walks-data.js";
import { mountVideoWalkPlayer } from "./videowalk-player.js";
import { mountPlayer } from "./player.js";
import { mountSplatPlayer } from "./splat-player.js";

const params = new URLSearchParams(location.search);
const walkId = params.get("id") || "";

const videoWalkPlayer = mountVideoWalkPlayer(document.querySelector("#videowalk-root"));
const player = mountPlayer(document.querySelector("#player-root"));
const splatPlayer = mountSplatPlayer(document.querySelector("#splat-root"));

const article = document.getElementById("walk-article");
const errorEl = document.getElementById("walk-error");
const startBtn = document.getElementById("btn-start-walk");

let currentPin = null;
let currentWalk = null;

function showError(msg) {
  errorEl.hidden = false;
  errorEl.textContent = msg;
  article.hidden = true;
}

function renderSpots(spots) {
  const box = document.getElementById("walk-spots");
  box.innerHTML = "";
  if (!spots || !spots.length) return;
  const h = document.createElement("h2");
  h.textContent = "Explore spots";
  const ul = document.createElement("ul");
  for (const spot of spots) {
    const li = document.createElement("li");
    const label = spot.label || spot.name || "Spot";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "text-btn";
    btn.textContent = label;
    btn.addEventListener("click", () => {
      startWalk();
      const t = typeof spot.t === "number" ? spot.t : 0;
      const ready = () => {
        if (window.__tgVideoWalk && typeof window.__tgVideoWalk.jump === "function") {
          window.__tgVideoWalk.jump(t);
        }
      };
      if (window.__tgVideoWalk && window.__tgVideoWalk.ready) ready();
      else setTimeout(ready, 400);
    });
    li.appendChild(btn);
    ul.appendChild(li);
  }
  box.append(h, ul);
}

function startWalk() {
  if (!currentPin || !currentWalk) return;
  if (window.__tgPlayer) window.__tgPlayer.close({ silent: true });
  if (window.__tgSplatPlayer) window.__tgSplatPlayer.close({ silent: true });
  videoWalkPlayer.open({
    title: currentWalk.title || currentPin.name,
    src: currentWalk.src,
    credit: currentWalk.credit,
    creditDetails: currentWalk.creditDetails,
    duration: currentWalk.duration,
    spots: currentWalk.spots,
    path: currentWalk.path,
    overscale: currentWalk.overscale,
    ambience: "media/videowalk/ambience-standin.m4a",
    onClose() {},
  });
}

window.__tgOpenPin = (id) => {
  if (id && id !== walkId) {
    location.href = "walk.html?id=" + encodeURIComponent(id);
    return;
  }
  startWalk();
};

async function boot() {
  if (!walkId) {
    showError("Choose a walk from the map.");
    return;
  }
  const catalog = await loadCatalog();
  const pin = catalog.find((w) => w.id === walkId);
  if (!pin) {
    showError("That walk is not in this preview.");
    return;
  }
  currentPin = pin;
  document.title = pin.name + " — " + SITE_NAME;
  document.getElementById("walk-title").textContent = pin.name;
  document.getElementById("walk-handle").textContent = "@" + (pin.creatorHandle || "Preview traveler") + " · preview profile";
  const bits = [pin.city, pin.type, pin.durationLabel].filter(Boolean);
  document.getElementById("walk-meta").textContent = bits.join(" · ");
  document.getElementById("walk-blurb").textContent = pin.blurb || "";
  article.hidden = false;

  if (pin.videoWalk) {
    const walk = await fetch(pin.videoWalk, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error("Video walk failed to load");
      return r.json();
    });
    currentWalk = walk;
    renderSpots(walk.spots);
    startBtn.addEventListener("click", startWalk);
    startWalk();
  } else {
    startBtn.addEventListener("click", () => {
      player.open({ title: pin.name, trial: false, onClose() {} });
    });
    startBtn.click();
  }
}

boot().catch((err) => {
  showError(err.message || "Could not open this walk.");
  console.error(err);
});

// Keep test hooks that older map tests expected, when they land on this page.
window.__tgSample360 = null;
void splatPlayer;
