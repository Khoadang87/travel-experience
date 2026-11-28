import { Map, Marker, setWorkerUrl, AttributionControl } from "maplibre-gl";
import { loadCatalog } from "./walks-data.js";

setWorkerUrl("vendor/maplibre-gl-worker.mjs");

const map = new Map({
  container: "hero-map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [-118.3592, 34.07195],
  zoom: 1.8,
  maxPitch: 60,
  attributionControl: false,
  cooperativeGestures: true,
  canvasContextAttributes: { antialias: true },
});
map.addControl(new AttributionControl({ compact: true }), "bottom-right");

function pinSvg() {
  return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2c3.9 0 7 3 7 7 0 5.3-7 13-7 13S5 14.3 5 9c0-4 3.1-7 7-7zm0 4.5A2.5 2.5 0 1 0 12 11a2.5 2.5 0 0 0 0-4.5z"/></svg>`;
}

async function boot() {
  const walks = await loadCatalog();
  function finish() {
    if (window.__tgHomeMapReady) return;
    if (!map.loaded()) return;
    map.setProjection({ type: "globe" });
    for (const walk of walks) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "map-pin kind-videowalk";
      el.setAttribute("aria-label", walk.name);
      el.innerHTML = pinSvg() + "<span>" + walk.name + "</span>";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        location.href = "walk.html?id=" + encodeURIComponent(walk.id);
      });
      new Marker({ element: el, anchor: "bottom" }).setLngLat([walk.lng, walk.lat]).addTo(map);
    }
    window.__tgHomeMapReady = true;
    window.__tgPins = walks;
  }
  map.on("load", finish);
  map.on("idle", finish);
  if (map.loaded()) finish();
}

boot().catch((err) => console.error(err));
