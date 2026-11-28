const STORAGE_SETTINGS = "tg:settings";
const STORAGE_SUBMISSIONS = "tg:submissions";
const STORAGE_TRIALS = "tg:trials";
const TZ = "America/Los_Angeles";

export const TZ_LABEL = "Pacific Time (America/Los_Angeles)";

export async function loadBaseConfig() {
  const res = await fetch("data/config.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load config");
  return res.json();
}

export function readOverrides() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || "{}");
  } catch {
    return {};
  }
}

export function saveOverrides(partial) {
  const next = { ...readOverrides(), ...partial };
  localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(next));
  return next;
}

export function resetOverrides() {
  localStorage.removeItem(STORAGE_SETTINGS);
}

export function getConfig(base) {
  return { ...base, ...readOverrides() };
}

export function nowMs() {
  if (typeof window !== "undefined" && typeof window.__tgNow === "number") {
    return window.__tgNow;
  }
  return Date.now();
}

export function parseStamp(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error("Bad date: " + iso);
  return t;
}

export function formatPT(isoOrMs, opts = {}) {
  const d = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(isoOrMs);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: opts.weekday ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    ...opts,
  }).format(d);
}

export function windowState(config, at = nowMs()) {
  const start = parseStamp(config.submissionWindowStart);
  const end = parseStamp(config.submissionWindowEnd);
  if (at < start) {
    return { status: "scheduled", start, end, msUntil: start - at, msLeft: end - start };
  }
  if (at <= end) {
    return { status: "open", start, end, msUntil: 0, msLeft: end - at };
  }
  return { status: "closed", start, end, msUntil: 0, msLeft: 0 };
}

export function adsState(config, at = nowMs()) {
  const freeStart = parseStamp(config.freePeriodStart);
  const adsStart = parseStamp(config.adsStart);
  const preview = Boolean(config.previewAds);
  const inFree = at >= freeStart && at < adsStart;
  const adsLive = preview || at >= adsStart;
  return { freeStart, adsStart, inFree, adsLive, preview };
}

export function formatDuration(ms) {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(d + "d");
  if (h || d) parts.push(h + "h");
  if (m || h || d) parts.push(m + "m");
  if (!d) parts.push(sec + "s");
  return parts.join(" ");
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function getSubmissions() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_SUBMISSIONS) || "[]");
  } catch {
    return [];
  }
}

export function addSubmission(entry) {
  const list = getSubmissions();
  list.unshift(entry);
  localStorage.setItem(STORAGE_SUBMISSIONS, JSON.stringify(list));
  return list;
}

export function hasUsedTrial(email) {
  const key = normalizeEmail(email);
  if (!key) return false;
  try {
    const map = JSON.parse(localStorage.getItem(STORAGE_TRIALS) || "{}");
    return Boolean(map[key]);
  } catch {
    return false;
  }
}

export function markTrialUsed(email) {
  const key = normalizeEmail(email);
  const map = JSON.parse(localStorage.getItem(STORAGE_TRIALS) || "{}");
  map[key] = new Date(nowMs()).toISOString();
  localStorage.setItem(STORAGE_TRIALS, JSON.stringify(map));
}

export function clearTrialsAndSubmissions() {
  localStorage.removeItem(STORAGE_TRIALS);
  localStorage.removeItem(STORAGE_SUBMISSIONS);
}

// Labeled 360 stand-in only — not Hollywood Walk of Fame, not creator footage.
// Wikimedia Commons, CC BY 3.0. This replaced the unlicensed YouTube test
// clips previously used on the public prototype.
export const SAMPLE_360 = {
  src: "media/sample-360.mp4",
  srcLow: "media/sample-360-low.mp4",
  poster: "media/sample-360-poster.jpg",
  title: "360 stand-in — Anıtkabir, Ankara",
  credit:
    "360 stand-in (not Hollywood Walk of Fame, not creator footage): Anıtkabir, Ankara — 360TR, CC BY 3.0.",
  commons: "https://commons.wikimedia.org/wiki/File:An%C4%B1tkabir_(%20Atat%C3%BCrk%20)_360_Derece_Video_Panorama_Gezinti_-_360_Degree_Video.webm",
  license: "CC BY 3.0",
  licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
};

export const PRIVATE_TEST = false;
export const DEFAULT_360 = SAMPLE_360;

export function currentPage() {
  const p = location.pathname;
  if (p.endsWith("creator.html")) return "creator";
  if (p.endsWith("admin.html")) return "admin";
  return "map";
}


export const SITE_CREDITS_HTML = `
  <p>Map tiles from OpenFreeMap. Map data © OpenStreetMap contributors.</p>
  <h3>Video walks</h3>
  <p>The Grove, Farmers Market, and café counter walks use private test footage at those places in Los Angeles. Audio was omitted because bystanders can be heard.</p>
  <h3>Creator trial preview</h3>
  <p>The free creator-trial preview uses a labeled 360 stand-in of Anıtkabir, Ankara — 360TR, CC BY 3.0. It is not footage from this map and not a creator upload. The same credit is shown whenever that clip plays.</p>
`;

export function bindCredits() {
  const dialog = document.getElementById("credits-dialog");
  const body = document.getElementById("credits-body");
  const openBtn = document.getElementById("btn-credits");
  if (!dialog || !body) return;
  if (!body.innerHTML.trim()) body.innerHTML = SITE_CREDITS_HTML;
  function open() {
    dialog.hidden = false;
    const close = dialog.querySelector("[data-credits-close]");
    if (close) close.focus();
  }
  function close() { dialog.hidden = true; }
  if (openBtn) openBtn.addEventListener("click", open);
  dialog.querySelectorAll("[data-credits-close]").forEach((b) => b.addEventListener("click", close));
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dialog.hidden) close();
  });
}

const LOOK_HINT_KEY = "tg:look-hint-used";

/** Fade the look/walk hint after first stick or look-drag use. */
export function bindFadeHint(el) {
  if (!el) return () => {};
  let used = false;
  try { used = sessionStorage.getItem(LOOK_HINT_KEY) === "1"; } catch (_) {}
  if (used) {
    el.classList.add("is-faded");
    el.setAttribute("aria-hidden", "true");
    return () => {};
  }
  let marked = false;
  return function markHintUsed() {
    if (marked) return;
    marked = true;
    try { sessionStorage.setItem(LOOK_HINT_KEY, "1"); } catch (_) {}
    window.setTimeout(() => {
      el.classList.add("is-faded");
      el.setAttribute("aria-hidden", "true");
    }, 1400);
  };
}
