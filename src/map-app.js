import { Map, Marker, setWorkerUrl, AttributionControl } from "maplibre-gl";
import { adsState, loadBaseConfig, getConfig, formatPT, SAMPLE_360 } from "./shared.js";

import { mountPlayer } from "./player.js";
import { mountSplatPlayer } from "./splat-player.js";
import { mountVideoWalkPlayer } from "./videowalk-player.js";

setWorkerUrl("vendor/maplibre-gl-worker.mjs");

const STREET_ZOOM = 12.6;
const STREET_EXIT = 12.15;
const STREET_PITCH = 42;
const STREET_BEARING = -18;
// The LA walks sit next to each other; fit them all so they stay
// tappable together on a phone.
const PRIMARY_PIN_IDS = [
  "grove-kane-scan-splat",
  "farmers-kane-scan-splat",
  "cafe-first-street-walk",
];

const isExplore = document.body.dataset.page === "explore";
const player = (!isExplore && document.querySelector("#player-root"))
  ? mountPlayer(document.querySelector("#player-root"))
  : null;
const splatPlayer = (!isExplore && document.querySelector("#splat-root"))
  ? mountSplatPlayer(document.querySelector("#splat-root"))
  : null;
const videoWalkPlayer = (!isExplore && document.querySelector("#videowalk-root"))
  ? mountVideoWalkPlayer(document.querySelector("#videowalk-root"))
  : null;

const map = new Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [-118.3592, 34.07195],
  zoom: 1.65,
  maxPitch: 85,
  attributionControl: false,
  canvasContextAttributes: { antialias: true },
});
map.addControl(
  new AttributionControl({ compact: window.matchMedia("(max-width: 700px)").matches }),
  "bottom-right",
);

let mode = "globe";
let pins = [];
const markers = [];

function setPinVisibility() {
  const showAllZooms = document.body.dataset.page === "explore";
  for (const marker of markers) {
    const el = marker.getElement();
    const hiddenByFilter = el.dataset.filtered === "1";
    const hiddenByMode = !showAllZooms && mode !== "street";
    el.style.display = hiddenByFilter || hiddenByMode ? "none" : "";
  }
}

function setMode(next) {
  if (next === mode) return;
  mode = next;
  if (next === "street") {
    map.setProjection({ type: "mercator" });
  } else {
    map.setProjection({ type: "globe" });
  }
  document.getElementById("mode-badge").textContent = next === "street" ? "Street map" : "Globe";
  document.body.dataset.mode = next;
  const back = document.getElementById("btn-globe");
  if (back) back.hidden = next !== "street";
  setPinVisibility();
}

function syncMode() {
  const z = map.getZoom();
  if (z >= STREET_ZOOM) setMode("street");
  else if (z < STREET_EXIT) setMode("globe");
}

function addPins() {
  for (const marker of markers) marker.remove();
  markers.length = 0;
  for (const pin of pins) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "map-pin kind-" + pin.kind;
    el.dataset.pinId = pin.id;
    el.setAttribute("aria-label", pin.name);
    el.innerHTML =
      (pin.kind === "star-segment" ? starSvg() : pin.kind === "business" ? businessSvg() : pinSvg()) +
      "<span>" + escapeHtml(pin.label || pin.name) + "</span>";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      openPin(pin);
    });
    const marker = new Marker({ element: el, anchor: "bottom" })
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);
    markers.push(marker);
  }
  setPinVisibility();
}

function starSvg() {
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2.2l2.6 6.3 6.9.6-5.3 4.5 1.7 6.7L12 16.8 5.9 20.3l1.7-6.7L2.3 9.1l6.9-.6z"/></svg>`;
}
function pinSvg() {
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2c3.9 0 7 3 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-4 3.1-7 7-7zm0 4.5A2.5 2.5 0 1 0 12 11a2.5 2.5 0 0 0 0-4.5z"/></svg>`;
}
// Gold marker for the example business pin: it shows what a featured
// (gold) pin looks like, and its label says Example, never a real
// business name.
function businessSvg() {
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2c3.9 0 7 3 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-4 3.1-7 7-7zm0 4.5A2.5 2.5 0 1 0 12 11a2.5 2.5 0 0 0 0-4.5z"/></svg>`;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hidePinCard() {
  const card = document.getElementById("pin-card");
  if (card) card.hidden = true;
}

function closeViewers(opts) {
  if (window.__tgVideoWalk) window.__tgVideoWalk.close(opts);
  if (window.__tgSplatPlayer) window.__tgSplatPlayer.close(opts);
  if (window.__tgPlayer) window.__tgPlayer.close(opts);
}


function openSplatPin(pin) {
  // Shared splat player stays mounted, but this preview has no splat pins.
  if (!pin || !pin.splat) return;
  if (window.__tgPlayer) window.__tgPlayer.close({ silent: true });
  if (window.__tgVideoWalk) window.__tgVideoWalk.close({ silent: true });
  splatPlayer.open({
    title: pin.name,
    src: pin.splat,
    credit: {
      credit: pin.sourceName || "",
      commons: pin.sourceUrl || "",
      license: "",
      licenseUrl: "",
    },
    view: pin.splatView,
    avatar: pin.splatAvatar,
    path: pin.splatPath,
    onClose: hidePinCard,
    onFallback(note) {
      player.open({
        title: pin.name,
        fallbackNote: note,
        onClose: hidePinCard,
      });
    },
    onView360() {
      player.open({
        title: pin.name,
        onClose: hidePinCard,
      });
    },
  });
}

function openPin(pin) {
  if (document.body.dataset.page === "explore" && pin && pin.id) {
    location.href = "walk.html?id=" + encodeURIComponent(pin.id);
    return;
  }
  hidePinCard();
  closePlaces();
  document.getElementById("pin-name").textContent = pin.name;
  document.getElementById("pin-blurb").textContent = pin.blurb;
  const src = document.getElementById("pin-source");
  if (pin.sourceUrl) {
    src.href = pin.sourceUrl;
    src.textContent = pin.sourceName || pin.sourceUrl;
  } else {
    src.removeAttribute("href");
    src.textContent = pin.sourceName || "";
  }
  if (pin.videoWalk) {
    if (window.__tgPlayer) window.__tgPlayer.close({ silent: true });
    if (window.__tgSplatPlayer) window.__tgSplatPlayer.close({ silent: true });
    fetch(pin.videoWalk, { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw new Error("Video walk failed to load");
        return r.json();
      })
      .then((walk) => {
        videoWalkPlayer.open({
          title: walk.title || pin.name,
          src: walk.src,
          credit: walk.credit,
          creditDetails: walk.creditDetails,
          duration: walk.duration,
          spots: walk.spots,
          path: walk.path,
          overscale: walk.overscale,
          ambience: "media/videowalk/ambience-standin.m4a",
          onClose: hidePinCard,
        });
      })
      .catch((err) => {
        document.getElementById("map-status").textContent = "Error: " + err.message;
      });
    return;
  }
  if (pin.splat) {
    openSplatPin(pin);
    return;
  }
  if (window.__tgSplatPlayer) window.__tgSplatPlayer.close({ silent: true });
  if (window.__tgVideoWalk) window.__tgVideoWalk.close({ silent: true });
  player.open({
    title: pin.name,
    trial: false,
    flat: Boolean(pin.flat),
    clip: pin.clip,
    offer: Boolean(pin.demo),
    onClose: hidePinCard,
  });
}

function hudPadding() {
  const header = document.querySelector("header.top");
  const hud = document.querySelector(".hud");
  const sheet = document.querySelector("#explore-panel");
  const top = Math.ceil((header ? header.getBoundingClientRect().height : 48) + 10);
  const phone = window.matchMedia("(max-width: 800px)").matches;
  let bottom = Math.ceil((hud ? hud.getBoundingClientRect().height : 160) + 12);
  let left = 28;
  if (sheet && document.body.dataset.page === "explore") {
    if (phone) bottom = Math.max(bottom, Math.ceil(sheet.getBoundingClientRect().height + 20));
    else left = Math.max(left, 420);
  }
  return {
    top: Math.max(44, top),
    bottom: Math.max(88, bottom),
    left,
    right: 28,
  };
}

function flyToPrimaryPins() {
  const pts = (pins || []).filter((p) => PRIMARY_PIN_IDS.includes(p.id));
  if (!pts.length || !map) return;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const p of pts) {
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }
  const padLng = (maxLng - minLng) * 0.18 || 0.0008;
  const padLat = (maxLat - minLat) * 0.18 || 0.0008;
  window.__tgStreetFitted = false;
  map.fitBounds(
    [
      [minLng - padLng, minLat - padLat],
      [maxLng + padLng, maxLat + padLat],
    ],
    {
      padding: hudPadding(),
      pitch: STREET_PITCH,
      bearing: STREET_BEARING,
      duration: 1800,
      essential: true,
      maxZoom: 16.8,
    }
  );
  map.once("moveend", () => {
    syncMode();
    window.__tgStreetFitted = true;
  });
}

function flyToPinSet(ids, { all = false, maxZoom = 17.4, markAll = false } = {}) {
  const pts = all ? (pins || []).slice() : (pins || []).filter((p) => ids.includes(p.id));
  if (!pts.length || !map) return;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const p of pts) {
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
  }
  const padLng = (maxLng - minLng) * 0.12 || 0.0008;
  const padLat = (maxLat - minLat) * 0.18 || 0.0008;
  window.__tgStreetFitted = false;
  window.__tgAllPinsFitted = false;
  map.fitBounds(
    [
      [minLng - padLng, minLat - padLat],
      [maxLng + padLng, maxLat + padLat],
    ],
    {
      padding: hudPadding(),
      pitch: STREET_PITCH,
      bearing: STREET_BEARING,
      duration: 1800,
      essential: true,
      maxZoom,
    }
  );
  map.once("moveend", () => {
    syncMode();
    window.__tgStreetFitted = true;
    if (all || markAll) window.__tgAllPinsFitted = true;
  });
}

function flyToAllPins() {
  flyToPinSet((pins || []).map((p) => p.id), { all: true, markAll: true, maxZoom: 16.8 });
}

async function boot() {
  const [pinData, base] = await Promise.all([
    fetch("data/pins.json").then((r) => r.json()),
    loadBaseConfig(),
  ]);
  pins = pinData.pins;
  window.__tgPins = pins;
  const cfg = getConfig(base);
  const ads = adsState(cfg);
  const adbar = document.getElementById("adbar");
  if (adbar && ads.adsLive && document.body.dataset.page !== "explore") {
    adbar.hidden = false;
    adbar.textContent =
      "Ad placeholder (not a real ad network). Ads would turn on after the free-to-start period, on " +
      formatPT(ads.adsStart) +
      ". This bar is a mock.";
  } else if (adbar) {
    adbar.hidden = true;
  }

  function finishMap() {
    if (window.__tgMapReady) return;
    if (!map.loaded()) return;
    map.setProjection({ type: "globe" });
    addPins();
    syncMode();
    const status = document.getElementById("map-status");
    if (status) status.textContent = "Map ready";
    window.__tgMapReady = true;
    window.__tgMap = map;
    collapseAttribution();
    if (document.body.dataset.page === "explore") {
      setupExploreList();
      flyToPrimaryPins();
    }
    if (location.hash === "#places") showAllPlaces();
  }
  map.on("load", finishMap);
  map.on("idle", finishMap);
  if (map.loaded()) finishMap();
  map.on("zoom", syncMode);
  map.on("zoomend", syncMode);
}


function placeKindLabel(pin) {
  if (pin.videoWalk) return "Video walk";
  if (pin.splat) return "3D preview";
  if (pin.demo) return "Example";
  if (pin.flat) return "Video";
  return "360 preview";
}

function closePlaces() {
  const panel = document.getElementById("places-panel");
  if (panel) panel.hidden = true;
}

function openPlaces() {
  const panel = document.getElementById("places-panel");
  const grid = document.getElementById("place-grid");
  if (!panel || !grid) return;
  grid.innerHTML = "";
  for (const pin of pins || []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "place-card";
    const img = document.createElement("img");
    img.src = pin.thumb || "media/sample-360-poster.jpg";
    img.alt = "";
    const body = document.createElement("div");
    body.className = "place-body";
    const kind = document.createElement("span");
    kind.className = "place-kind";
    kind.textContent = placeKindLabel(pin);
    const h = document.createElement("h3");
    h.textContent = pin.name;
    const p = document.createElement("p");
    const blurb = pin.blurb || "";
    p.textContent = blurb.split(/(?<=\.)\s/)[0] || blurb;
    body.append(kind, h, p);
    btn.append(img, body);
    btn.addEventListener("click", () => {
      closePlaces();
      hidePinCard();
      closeViewers();
      if (map) {
        map.flyTo({
          center: [pin.lng, pin.lat],
          zoom: Math.max(STREET_ZOOM + 3.6, 16.2),
          pitch: 42,
          bearing: 0,
          essential: true,
          duration: 1200,
        });
      }
      openPin(pin);
    });
    grid.appendChild(btn);
  }
  panel.hidden = false;
  const close = document.getElementById("places-close");
  if (close) close.focus();
}


function setupExploreList() {
  if (window.__tgExploreReady) return;
  const citySel = document.getElementById("filter-city");
  const typeSel = document.getElementById("filter-type");
  const list = document.getElementById("explore-list");
  const empty = document.getElementById("explore-empty");
  const sheet = document.getElementById("explore-panel");
  const toggle = document.getElementById("sheet-toggle");
  if (!citySel || !typeSel || !list) return;

  const cities = [...new Set(pins.map((p) => p.city).filter(Boolean))].sort();
  const types = [...new Set(pins.map((p) => p.type || placeKindLabel(p)).filter(Boolean))].sort();
  for (const city of cities) {
    const opt = document.createElement("option");
    opt.value = city;
    opt.textContent = city;
    citySel.appendChild(opt);
  }
  for (const type of types) {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    typeSel.appendChild(opt);
  }

  function visiblePins() {
    const city = citySel.value;
    const type = typeSel.value;
    return (pins || []).filter((p) => {
      if (city && p.city !== city) return false;
      if (type && (p.type || placeKindLabel(p)) !== type) return false;
      return true;
    });
  }

  function render() {
    const shown = visiblePins();
    const shownIds = new Set(shown.map((p) => p.id));
    list.innerHTML = "";
    for (const pin of shown) {
      const a = document.createElement("a");
      a.className = "walk-card";
      a.href = "walk.html?id=" + encodeURIComponent(pin.id);
      const img = document.createElement("img");
      img.src = pin.thumb || "";
      img.alt = "";
      const body = document.createElement("div");
      body.className = "walk-card-body";
      const h = document.createElement("h3");
      h.textContent = pin.name;
      const meta = document.createElement("p");
      meta.textContent = [pin.city, pin.type || placeKindLabel(pin), pin.durationLabel].filter(Boolean).join(" · ");
      const handle = document.createElement("p");
      handle.textContent = pin.creatorHandle ? "@" + pin.creatorHandle : "";
      body.append(h, meta, handle);
      a.append(img, body);
      list.appendChild(a);
    }
    if (empty) empty.hidden = shown.length > 0;
    for (const marker of markers) {
      const id = marker.getElement().dataset.pinId;
      marker.getElement().dataset.filtered = shownIds.has(id) ? "0" : "1";
    }
    setPinVisibility();
    if (toggle) {
      const phone = window.matchMedia("(max-width: 800px)").matches;
      toggle.hidden = !phone;
      toggle.textContent = sheet && sheet.classList.contains("sheet-open") ? "Show fewer walks" : "Show more walks";
    }
  }

  citySel.addEventListener("change", render);
  typeSel.addEventListener("change", render);
  if (toggle && sheet) {
    toggle.addEventListener("click", () => {
      sheet.classList.toggle("sheet-open");
      toggle.textContent = sheet.classList.contains("sheet-open") ? "Show fewer walks" : "Show more walks";
    });
  }
  render();
  window.__tgExploreList = list;
  window.__tgExploreReady = true;
}

document.getElementById("btn-wof")?.addEventListener("click", () => {
  hidePinCard();
  closePlaces();
  flyToPrimaryPins();
});

function collapseAttribution() {
  if (!window.matchMedia("(max-width: 700px)").matches) return;
  const el = document.querySelector(".maplibregl-ctrl-attrib");
  if (!el) return;
  el.removeAttribute("open");
  el.classList.remove("maplibregl-compact-show");
}

function showAllPlaces() {
  hidePinCard();
  closeViewers();
  flyToAllPins();
  openPlaces();
}

document.getElementById("btn-all-pins")?.addEventListener("click", showAllPlaces);

document.getElementById("btn-globe")?.addEventListener("click", () => {
  hidePinCard();
  closeViewers();
  closePlaces();
  map.flyTo({ center: [-40, 20], zoom: 1.5, pitch: 0, bearing: 0, essential: true, duration: 1400 });
});

document.getElementById("places-close")?.addEventListener("click", closePlaces);
document.getElementById("places-panel")?.addEventListener("click", (e) => {
  if (e.target && e.target.id === "places-panel") closePlaces();
});


boot().catch((err) => {
  document.getElementById("map-status").textContent = "Error: " + err.message;
  console.error(err);
});

document.getElementById("pin-card-close")?.addEventListener("click", (e) => {
  e.stopPropagation();
  hidePinCard();
  closeViewers();
});

window.__tgOpenFirstPin = () => {
  if (pins[0]) openPin(pins[0]);
};
window.__tgOpenPin = (id) => {
  const pin = (pins || []).find((p) => p.id === id);
  if (pin) openPin(pin);
};
window.__tgOpenSplatPin = (id) => {
  const pin = (pins || []).find((p) => p.id === id);
  if (pin) openSplatPin(pin);
};
window.__tgOpenPlaces = showAllPlaces;
window.addEventListener("hashchange", () => {
  if (location.hash === "#places") showAllPlaces();
});
window.__tgSample360 = SAMPLE_360;
