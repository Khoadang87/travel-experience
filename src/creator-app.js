import {
  loadBaseConfig,
  getConfig,
  windowState,
  adsState,
  formatPT,
  formatDuration,
  nowMs,
  normalizeEmail,
  hasUsedTrial,
  markTrialUsed,
  addSubmission,
  getSubmissions,
} from "./shared.js";
import { mountPlayer } from "./player.js";

const player = mountPlayer(document.querySelector("#player-root"));
const form = document.getElementById("submit-form");
const statusEl = document.getElementById("window-status");
const countdownEl = document.getElementById("countdown");
const rangeEl = document.getElementById("window-range");
const notice = document.getElementById("form-notice");
const listEl = document.getElementById("sub-list");

function renderWindow(cfg) {
  const w = windowState(cfg);
  const ads = adsState(cfg);
  rangeEl.textContent = `${formatPT(w.start)} – ${formatPT(w.end)}`;
  if (w.status === "open") {
    statusEl.textContent = "Submission window is OPEN";
    statusEl.dataset.state = "open";
    countdownEl.textContent = "Closes in " + formatDuration(w.msLeft);
    form.querySelectorAll("input, select, textarea, button[type=submit]").forEach((n) => {
      n.disabled = false;
    });
  } else if (w.status === "scheduled") {
    statusEl.textContent = "Submission window is not open yet";
    statusEl.dataset.state = "scheduled";
    countdownEl.textContent = "Opens in " + formatDuration(w.msUntil);
    disableForm();
  } else {
    statusEl.textContent = "Submission window is CLOSED";
    statusEl.dataset.state = "closed";
    countdownEl.textContent = "This one-week call has ended.";
    disableForm();
  }

  const money = document.getElementById("monetization-explainer");
  const share = cfg.revenueSharePercent;
  const shareLabel = cfg.revenueShareLabel || "figure to review";
  if (ads.adsLive) {
    money.innerHTML = `<strong>Ads are on</strong> (mock only — no real ad network). Creators would receive a share of ad revenue. Revenue share is set to <strong>${share}%</strong> (<em>${shareLabel}</em>). Placement fees stay as listed below.`;
  } else {
    money.innerHTML = `<strong>Free-to-start period, no ads.</strong> Ads would start on ${formatPT(ads.adsStart)}. After that, creators would receive a share of ad revenue. The share is a placeholder of <strong>${share}%</strong> (<em>${shareLabel}</em>).`;
  }
}

function disableForm() {
  form.querySelectorAll("input, select, textarea, button[type=submit]").forEach((n) => {
    n.disabled = true;
  });
}

function renderSubs() {
  const rows = getSubmissions();
  if (!rows.length) {
    listEl.innerHTML = "<p class='muted'>No mock submissions yet on this browser.</p>";
    return;
  }
  listEl.innerHTML = rows
    .map(
      (s) => `<article class="sub-card">
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.name)} · ${escapeHtml(s.email)}</p>
        <p>${escapeHtml(s.kind)} · ${escapeHtml(s.pinId)} · ${escapeHtml(s.createdLabel)}</p>
        <p>${s.trialGranted ? "Free trial render granted (once per creator)." : "No trial — this creator already used the free render."}</p>
      </article>`
    )
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function boot() {
  const [base, pinData] = await Promise.all([
    loadBaseConfig(),
    fetch("data/pins.json").then((r) => r.json()),
  ]);
  const cfg = getConfig(base);
  const select = document.getElementById("pinId");
  for (const pin of pinData.pins) {
    const o = document.createElement("option");
    o.value = pin.id;
    o.textContent = pin.name;
    select.append(o);
  }
  document.getElementById("fee-360").textContent = "$" + cfg.fee360;
  document.getElementById("fee-spatial").textContent = "$" + cfg.feeSpatial;
  renderWindow(cfg);
  renderSubs();
  setInterval(() => renderWindow(getConfig(base)), 1000);
  window.__tgCreatorConfig = () => getConfig(base);
  window.__tgWindowState = () => windowState(getConfig(base));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const live = getConfig(base);
    const w = windowState(live);
    if (w.status !== "open") {
      notice.textContent = "The one-week submission window is not open.";
      notice.hidden = false;
      return;
    }
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.license) {
      notice.textContent = "Please agree to the mock license grant.";
      notice.hidden = false;
      return;
    }
    const email = normalizeEmail(data.email);
    const used = hasUsedTrial(email);
    const trialGranted = !used;
    if (trialGranted) markTrialUsed(email);
    addSubmission({
      id: "sub-" + nowMs(),
      name: data.name,
      email,
      title: data.title,
      kind: data.kind,
      pinId: data.pinId,
      trialGranted,
      created: new Date(nowMs()).toISOString(),
      createdLabel: new Date(nowMs()).toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
    });
    notice.hidden = false;
    if (trialGranted) {
      notice.textContent =
        "Submission saved locally (mock). Your one free 45-second watermarked trial render is starting. This is a labeled 360 stand-in (Anıtkabir, Ankara — 360TR, CC BY 3.0), not your upload and not Hollywood footage.";
      const cap = Number(new URLSearchParams(location.search).get("trialCap") || live.trialSeconds || 45);
      player.open({
        title: "Trial render — " + data.title,
        trial: true,
        trialCap: cap,
      });
    } else {
      notice.textContent =
        "Submission saved locally (mock). You already used the one free trial render for this creator email, so no new trial was started.";
    }
    renderSubs();
  });
}

boot().catch((err) => {
  notice.hidden = false;
  notice.textContent = "Error: " + err.message;
});
