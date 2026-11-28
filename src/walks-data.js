import { DEMO_WALKS_KEY } from "./site-config.js";

export function formatDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + String(r).padStart(2, "0");
}

export function typeLabel(walk) {
  return walk.type || (walk.videoWalk ? "Video walk" : "Walk");
}

export async function loadCatalog() {
  const res = await fetch("data/pins.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load walks");
  const data = await res.json();
  return (data.pins || []).map((pin) => ({
    ...pin,
    city: pin.city || "Los Angeles",
    type: pin.type || typeLabel(pin),
    creatorHandle: pin.creatorHandle || "Preview traveler",
    durationLabel: pin.durationLabel || "",
    preview: false,
  }));
}

export function loadDemoWalks() {
  try {
    const list = JSON.parse(localStorage.getItem(DEMO_WALKS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveDemoWalks(list) {
  localStorage.setItem(DEMO_WALKS_KEY, JSON.stringify(list));
  return list;
}

export function addDemoWalk(entry) {
  const list = loadDemoWalks();
  list.unshift(entry);
  return saveDemoWalks(list);
}

export function clearDemoWalks() {
  localStorage.removeItem(DEMO_WALKS_KEY);
}

export function uniqueCities(walks) {
  return [...new Set(walks.map((w) => w.city).filter(Boolean))].sort();
}

export function uniqueTypes(walks) {
  return [...new Set(walks.map((w) => typeLabel(w)).filter(Boolean))].sort();
}

export function filterWalks(walks, { city = "", type = "" } = {}) {
  return walks.filter((w) => {
    if (city && w.city !== city) return false;
    if (type && typeLabel(w) !== type) return false;
    return true;
  });
}
