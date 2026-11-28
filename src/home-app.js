import { Map, setWorkerUrl, AttributionControl } from "maplibre-gl";
import { loadCatalog } from "./walks-data.js";
import { createPinReveal } from "./pin-reveal.js";

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

async function boot() {
  const walks = await loadCatalog();
  function finish() {
    if (window.__tgHomeMapReady) return;
    if (!map.loaded()) return;
    map.setProjection({ type: "globe" });
    const reveal = createPinReveal(map);
    for (const walk of walks) reveal.addPin(walk);
    window.__tgHomeMapReady = true;
    window.__tgPins = walks;
  }
  map.on("load", finish);
  map.on("idle", finish);
  if (map.loaded()) finish();
}

boot().catch((err) => console.error(err));
