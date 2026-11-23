import { Map, Marker, setWorkerUrl } from "maplibre-gl";
import { adsState, loadBaseConfig, getConfig, formatPT, SAMPLE_360, FLAT_BUSINESS } from "./shared.js";

import { mountPlayer } from "./player.js";

setWorkerUrl("vendor/maplibre-gl-worker.mjs");

const STREET_ZOOM = 12.6;
const STREET_EXIT = 12.15;
const WOF_PITCH = 42;
const WOF_BEARING = -18;
// Primary cluster: TCL / Dolby / nearby star segments and the flat demo.
// Vine, Capitol, and the mid-boulevard business pin stay on the map but
// may sit off-screen until the visitor pans — the phone viewport cannot
// show the whole Walk at a tappable size.
const PRIMARY_PIN_IDS = [
  "tcl-chinese",
  "dolby",
  "star-roosevelt",
  "star-el-capitan",
  "wof-corner-flat",
];

const player = mountPlayer(document.querySelector("#player-root"));

const map = new Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [-118.25, 34.05],
  zoom: 1.65,
  maxPitch: 85,
  attributionControl: true,
  canvasContextAttributes: { antialias: true },
});

let mode = "globe";
let pins = [];
const markers = [];

function setPinVisibility() {
  for (const marker of markers) {
    marker.getElement().style.display = mode === "street" ? "" : "none";
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

function openPin(pin) {
  document.getElementById("pin-card").hidden = false;
  document.getElementById("pin-name").textContent = pin.name;
  document.getElementById("pin-blurb").textContent = pin.blurb;
  const src = document.getElementById("pin-source");
  if (pin.demo) {
    // The demo pin is not a Wikipedia landmark: its card links to the
    // sales page instead of a coordinates source.
    src.href = "sales.html";
    src.textContent = "Example pin — see what a business pin includes and what it costs";
  } else {
    src.href = pin.sourceUrl;
    src.textContent = "Coordinates: Wikipedia — " + pin.sourceName;
  }
  player.open({
    title: pin.name,
    trial: false,
    flat: Boolean(pin.flat),
    // Demo pin only: rights-cleared flat clip with demo credit, plus
    // the offer line pointing at the sales page. Never the 360 stand-in.
    clip: pin.demo ? FLAT_BUSINESS : undefined,
    offer: Boolean(pin.demo),
    onClose: hidePinCard,
  });
}

function hudPadding() {
  const header = document.querySelector("header.top");
  const hud = document.querySelector(".hud");
  const top = Math.ceil((header ? header.getBoundingClientRect().height : 48) + 10);
  const bottom = Math.ceil((hud ? hud.getBoundingClientRect().height : 160) + 12);
  return {
    top: Math.max(44, top),
    bottom: Math.max(88, bottom),
    left: 28,
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
      pitch: WOF_PITCH,
      bearing: WOF_BEARING,
      duration: 1800,
      essential: true,
      maxZoom: 17.4,
    }
  );
  map.once("moveend", () => {
    syncMode();
    window.__tgStreetFitted = true;
  });
}

function flyToPinSet(ids, { all = false, maxZoom = 17.4 } = {}) {
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
      pitch: WOF_PITCH,
      bearing: WOF_BEARING,
      duration: 1800,
      essential: true,
      maxZoom,
    }
  );
  map.once("moveend", () => {
    syncMode();
    window.__tgStreetFitted = true;
    if (all) window.__tgAllPinsFitted = true;
  });
}

function flyToAllPins() {
  // Vine, Capitol, and the business pin sit east of the primary cluster.
  // This wider fit is a separate control so the default "Go to Walk of
  // Fame" view can stay zoomed in enough for TCL/Dolby to stay tappable.
  flyToPinSet([], { all: true, maxZoom: 16.2 });
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
  if (ads.adsLive) {
    adbar.hidden = false;
    adbar.textContent =
      "Ad placeholder (not a real ad network). Ads would turn on after the free-to-start period, on " +
      formatPT(ads.adsStart) +
      ". This bar is a mock.";
  } else {
    adbar.hidden = true;
  }

  function finishMap() {
    if (window.__tgMapReady) return;
    if (!map.loaded()) return;
    map.setProjection({ type: "globe" });
    addPins();
    syncMode();
    document.getElementById("map-status").textContent = "Globe ready";
    window.__tgMapReady = true;
    window.__tgMap = map;
  }
  map.on("load", finishMap);
  map.on("idle", finishMap);
  if (map.loaded()) finishMap();
  map.on("zoom", syncMode);
  map.on("zoomend", syncMode);
}

document.getElementById("btn-wof").addEventListener("click", () => {
  hidePinCard();
  flyToPrimaryPins();
});

document.getElementById("btn-all-pins").addEventListener("click", () => {
  hidePinCard();
  if (window.__tgPlayer) window.__tgPlayer.close();
  flyToAllPins();
});

document.getElementById("btn-globe").addEventListener("click", () => {
  hidePinCard();
  if (window.__tgPlayer) window.__tgPlayer.close();
  map.flyTo({ center: [-40, 20], zoom: 1.5, pitch: 0, bearing: 0, essential: true, duration: 1400 });
});

boot().catch((err) => {
  document.getElementById("map-status").textContent = "Error: " + err.message;
  console.error(err);
});

document.getElementById("pin-card-close").addEventListener("click", (e) => {
  e.stopPropagation();
  hidePinCard();
  if (window.__tgPlayer) window.__tgPlayer.close();
});

window.__tgOpenFirstPin = () => {
  if (pins[0]) openPin(pins[0]);
};
window.__tgSample360 = SAMPLE_360;
