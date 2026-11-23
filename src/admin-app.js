import {
  loadBaseConfig,
  getConfig,
  saveOverrides,
  resetOverrides,
  windowState,
  adsState,
  formatPT,
  clearTrialsAndSubmissions,
  getSubmissions,
} from "./shared.js";

const form = document.getElementById("admin-form");
const status = document.getElementById("admin-status");

function isoToLocalInput(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${g.year}-${g.month}-${g.day}T${g.hour}:${g.minute}`;
}

function localInputToIso(value) {
  // Treat the datetime-local value as Pacific Time (PST/PDT).
  // November–January dates in this prototype are PST (UTC-8).
  return value + ":00-08:00";
}

function fill(cfg) {
  form.submissionWindowStart.value = isoToLocalInput(cfg.submissionWindowStart);
  form.submissionWindowEnd.value = isoToLocalInput(cfg.submissionWindowEnd);
  form.freePeriodStart.value = isoToLocalInput(cfg.freePeriodStart);
  form.adsStart.value = isoToLocalInput(cfg.adsStart);
  form.revenueSharePercent.value = cfg.revenueSharePercent;
  form.previewAds.checked = Boolean(cfg.previewAds);
  document.getElementById("fee-360").textContent = "$" + cfg.fee360;
  document.getElementById("fee-spatial").textContent = "$" + cfg.feeSpatial;
  const w = windowState(cfg);
  const ads = adsState(cfg);
  document.getElementById("live-window").textContent =
    `Window is ${w.status} · ${formatPT(w.start)} – ${formatPT(w.end)}`;
  document.getElementById("live-ads").textContent = ads.adsLive
    ? `Ads would be ON (mock)${ads.preview ? " — preview override" : ""}.`
    : `Ads would be OFF until ${formatPT(ads.adsStart)} (about two months of free-to-start, no ads).`;
  document.getElementById("sub-count").textContent = String(getSubmissions().length);
}

async function boot() {
  const base = await loadBaseConfig();
  fill(getConfig(base));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    saveOverrides({
      submissionWindowStart: localInputToIso(form.submissionWindowStart.value),
      submissionWindowEnd: localInputToIso(form.submissionWindowEnd.value),
      freePeriodStart: localInputToIso(form.freePeriodStart.value),
      adsStart: localInputToIso(form.adsStart.value),
      revenueSharePercent: Number(form.revenueSharePercent.value),
      previewAds: form.previewAds.checked,
    });
    fill(getConfig(base));
    status.textContent = "Saved in this browser only (localStorage). No live backend.";
  });

  document.getElementById("btn-reset").addEventListener("click", () => {
    resetOverrides();
    fill(getConfig(base));
    status.textContent = "Restored default dates from config.json.";
  });

  document.getElementById("btn-clear-subs").addEventListener("click", () => {
    clearTrialsAndSubmissions();
    fill(getConfig(base));
    status.textContent = "Cleared mock submissions and trial-used flags in this browser.";
  });
}

boot();
