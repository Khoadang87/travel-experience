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

// Flat-video demo: a real Walk of Fame clip shown on a curved screen
// inside the 360 player. Flat footage, not true 360. Pexels License.
export const FLAT = {
  src: "media/walk-of-fame-flat.mp4",
  srcLow: "media/walk-of-fame-flat-low.mp4",
  poster: "media/walk-of-fame-flat-poster.jpg",
  title: "Walk of Fame corner — flat video on a curved screen",
  credit:
    "Flat video demo: people walking the Hollywood Walk of Fame — Dimitri Baret, Pexels License (free to use). Shown on a curved screen; flat footage, not true 360.",
  commons: "https://www.pexels.com/video/walk-of-fame-in-los-angeles-13560787/",
  license: "Pexels License",
  licenseUrl: "https://www.pexels.com/license/",
};

// Example business pin: the same rights-cleared Pexels flat clip as FLAT,
// credited as an example of what a buyer's 60-second pin looks like.
export const FLAT_BUSINESS = {
  src: "media/walk-of-fame-flat.mp4",
  srcLow: "media/walk-of-fame-flat-low.mp4",
  poster: "media/walk-of-fame-flat-poster.jpg",
  title: "Example business pin — your business here",
  credit:
    "EXAMPLE business pin — demo only, not a real listing: this is how a buyer's 60-second clip would appear — the demo clip here is a 30-second excerpt. Same free-to-use Pexels clip (Dimitri Baret, Pexels License) shown on a curved screen; flat footage, not true 360.",
  commons: "https://www.pexels.com/video/walk-of-fame-in-los-angeles-13560787/",
  license: "Pexels License",
  licenseUrl: "https://www.pexels.com/license/",
};


// Placeholder Gaussian splat — a CC0 test room, not a Hollywood location
// and not a capture of the pin's real surroundings.
export const PLACEHOLDER_SPLAT = {
  src: "media/splat/kyoto-room.sog",
  title: "Splat preview (test)",
  credit:
    "Test asset, not the real place. Kyoto room Gaussian splat from SharedTestModels (raymondyfei), CC0 1.0.",
  commons: "https://github.com/raymondyfei/SharedTestModels",
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  // Interior start pose, worked out from the decoded SOG means: drop
  // sparse log-range outliers, take the dense room (about 6.5 × 3.4 × 7.6),
  // floor near y = 0, eye height 1.52, looking toward the +Z wall (the
  // densest mid-height face). A later real capture should set its own
  // splatView / view rather than reuse these numbers.
  view: {
    position: [-0.19, 1.52, -2.56],
    lookAt: [-0.19, 1.4, 1.15],
    boundsMin: [-2.66, 0.9, -5.6],
    boundsMax: [2.96, 2.2, 0.95],
  },
  // Per-pin avatar and path. A later real capture should set its own.
  avatar: {
    // Procedural rounded 3D men's restroom pictogram, typical adult height.
    kind: "simple",
    height: 1.7,
  },
  path: "data/splat-path.json",
};

// Street intersection Gaussian splat — a CC BY 4.0 reconstruction of a
// suburban intersection from dashcam footage, not an official Tesla asset
// and not a capture of the map pin's real surroundings.
export const STREET_SPLAT = {
  src: "media/splat/street-intersection.sog",
  title: "Street intersection (test)",
  credit:
    "Test asset, not the real place and not an official Tesla asset. Street intersection Gaussian splat by cfahlgren1, reconstructed from Tesla FSD dashcam footage, with a 2021 Tesla Model Y (763468712, Sketchfab) placed in the scene. CC BY 4.0. Converted and downsampled for this preview (1,000,000 Gaussians, SOG v2; see media/splat/STREET-ATTRIBUTION.md). No endorsement implied.",
  commons: "https://huggingface.co/datasets/cfahlgren1/tesla-fsd-street-splat",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  view: {
    position: [-8.75, 2.03, -6.75],
    lookAt: [-8.75, 0.78, -1.75],
    boundsMin: [-16.0, 0.4, -20.0],
    boundsMax: [16.0, 8.0, 24.0],
  },
  avatar: {
    kind: "simple",
    height: 1.7,
  },
  path: "data/street-path.json",
};

export function currentPage() {
  const p = location.pathname;
  if (p.endsWith("creator.html")) return "creator";
  if (p.endsWith("admin.html")) return "admin";
  return "map";
}
