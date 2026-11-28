import { SITE_NOT_SAVED, DEMO_STORAGE_NOTE } from "./site-config.js";
import { addDemoWalk } from "./walks-data.js";
import { getDemoSession, setDemoSession } from "./auth-demo.js";
import { Map, Marker, setWorkerUrl, AttributionControl } from "maplibre-gl";
import { readVideoLocation } from "./video-gps.js";

setWorkerUrl("vendor/maplibre-gl-worker.mjs");

const LA = { lng: -118.3592, lat: 34.07195, label: "Los Angeles walk area" };
const STEPS = ["Video", "Location", "Details", "Rights", "Review", "Done"];

const form = document.getElementById("upload-form");
const nav = document.getElementById("upload-nav");
const btnBack = document.getElementById("btn-back");
const btnNext = document.getElementById("btn-next");
const stepper = document.getElementById("upload-stepper");
const fileInput = document.getElementById("upload-file");
const preview = document.getElementById("upload-preview");
const videoEl = document.getElementById("upload-video");
const fileName = document.getElementById("upload-file-name");
const fileError = document.getElementById("upload-file-error");
const pinError = document.getElementById("upload-pin-error");
const pinLabel = document.getElementById("upload-pin-label");
const titleInput = document.getElementById("upload-title");
const titleError = document.getElementById("upload-title-error");
const descInput = document.getElementById("upload-desc");
const tagsInput = document.getElementById("upload-tags");
const consentError = document.getElementById("upload-consent-error");
const gpsStep1 = document.getElementById("upload-gps-step1");
const gpsStatus = document.getElementById("upload-gps-status");
const placeEl = document.getElementById("upload-place");
const btnReset = document.getElementById("btn-reset-detected");
const btnLookup = document.getElementById("btn-lookup");
const lookupHint = document.getElementById("lookup-hint");
const latInput = document.getElementById("pin-lat");
const lngInput = document.getElementById("pin-lng");
const coordsError = document.getElementById("pin-coords-error");
const gpsEdit = document.getElementById("gps-edit");
const review = document.getElementById("upload-review");

let step = 1;
let objectUrl = "";
let pin = null;
let map = null;
let marker = null;
// Location read from the picked video, or null. "reading" while in progress.
let detected = null;
let detectState = "idle"; // idle | reading | found | none
let detectToken = 0;
let lookupToken = 0;

function setFieldError(input, errorEl, message) {
  if (errorEl) errorEl.textContent = message || "";
  if (input) {
    input.setAttribute("aria-invalid", message ? "true" : "false");
    const field = input.closest(".field");
    if (field) field.classList.toggle("has-error", Boolean(message));
  }
}

function renderStepper() {
  stepper.innerHTML = "";
  STEPS.forEach((label, i) => {
    const n = i + 1;
    const li = document.createElement("li");
    li.textContent = n + ". " + label;
    if (n === step) {
      li.className = "current";
      li.setAttribute("aria-current", "step");
    } else if (n < step) li.className = "done";
    stepper.appendChild(li);
  });
  document.querySelectorAll(".upload-step").forEach((section) => {
    const n = Number(section.getAttribute("data-step"));
    section.hidden = n !== step;
  });
  nav.hidden = step === 6;
  btnBack.hidden = step === 1 || step === 6;
  btnNext.textContent = step === 5 ? "Submit for review" : "Continue";
}

function coordText(p) {
  return p.lat.toFixed(5) + ", " + p.lng.toFixed(5);
}

function pinSummary(p) {
  const accuracy = p.source === "video" && Number.isFinite(p.accuracy) ? " (about ±" + Math.max(1, Math.round(p.accuracy)) + " m)" : "";
  return p.label + " · " + coordText(p) + accuracy;
}

function renderGpsStatus() {
  gpsStatus.className = "gps-note";
  if (detectState === "reading") {
    gpsStatus.textContent = "Reading the location from your video on this device…";
  } else if (detectState === "found" && pin && pin.source === "video") {
    gpsStatus.classList.add("is-found");
    gpsStatus.textContent = "Location detected from your video. Drag the pin or tap the map to adjust it.";
  } else if (detectState === "found" && pin) {
    gpsStatus.textContent = "You moved the pin. The location from your video is still available to reset to.";
  } else if (detectState === "none" && !pin) {
    gpsStatus.classList.add("is-none");
    gpsStatus.textContent = "No location was found in this video. Some phones remove it when you pick a video from Photos or share it. Tap the map to drop a pin, type coordinates, or use the Los Angeles walk area.";
  } else if (detectState === "none") {
    gpsStatus.textContent = "No location was found in this video, so this pin was placed by you. Drag it or tap the map to adjust it.";
  } else {
    gpsStatus.textContent = "";
  }
  btnReset.hidden = !(detected && (!pin || pin.source !== "video"));
}

function setPin(next) {
  pin = next;
  pinLabel.textContent = next ? "Pin: " + pinSummary(next) : "No pin yet.";
  setFieldError(null, pinError, "");
  setFieldError(null, coordsError, "");
  if (next) {
    latInput.value = next.lat.toFixed(5);
    lngInput.value = next.lng.toFixed(5);
  }
  // A new location makes any earlier place-name lookup out of date.
  lookupToken += 1;
  placeEl.hidden = true;
  placeEl.textContent = "";
  btnLookup.hidden = !next;
  lookupHint.hidden = !next;
  renderGpsStatus();
  if (map && next) {
    if (!marker) {
      marker = new Marker({ color: "#1e5a54", draggable: true })
        .setLngLat([next.lng, next.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        setPin({ lng: ll.lng, lat: ll.lat, label: "Adjusted pin", source: "manual" });
      });
    } else {
      marker.setLngLat([next.lng, next.lat]);
    }
    map.flyTo({
      center: [next.lng, next.lat],
      zoom: Math.max(map.getZoom(), next.source === "video" ? 16 : 14),
      essential: true,
      duration: next.source === "video" ? 0 : 800,
    });
  }
}

function placeDetected() {
  if (!detected) return;
  setPin({
    lng: detected.lng,
    lat: detected.lat,
    accuracy: detected.accuracy,
    label: "Detected from your video",
    source: "video",
  });
}

function ensureMap() {
  if (map) {
    map.resize();
    return;
  }
  map = new Map({
    container: "upload-map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: pin ? [pin.lng, pin.lat] : [LA.lng, LA.lat],
    zoom: pin ? 16 : 13.2,
    attributionControl: false,
  });
  map.addControl(new AttributionControl({ compact: true }), "bottom-right");
  map.on("click", (e) => {
    setPin({ lng: e.lngLat.lng, lat: e.lngLat.lat, label: "Custom pin", source: "manual" });
  });
  window.__tgUploadMap = map;
  if (pin) setPin(pin);
}

function clearLocation() {
  detected = null;
  detectState = "idle";
  detectToken += 1;
  pin = null;
  if (marker) {
    marker.remove();
    marker = null;
  }
  pinLabel.textContent = "No pin yet.";
  placeEl.hidden = true;
  placeEl.textContent = "";
  btnLookup.hidden = true;
  lookupHint.hidden = true;
  latInput.value = "";
  lngInput.value = "";
  gpsStep1.textContent = "";
  gpsStep1.className = "gps-note";
  renderGpsStatus();
}

async function detectLocation(file) {
  const token = ++detectToken;
  detectState = "reading";
  gpsStep1.className = "gps-note";
  gpsStep1.textContent = "Checking the video for a saved location, on this device…";
  renderGpsStatus();
  let found = null;
  try {
    found = await readVideoLocation(file);
  } catch (err) {
    console.warn("Could not read the video's location", err);
  }
  if (token !== detectToken) return; // a newer file was picked
  if (found) {
    detected = found;
    detectState = "found";
    gpsStep1.className = "gps-note is-found";
    gpsStep1.textContent = "Location found in your video. You can check it in the next step.";
    if (!pin) placeDetected();
    else renderGpsStatus();
  } else {
    detected = null;
    detectState = "none";
    gpsStep1.className = "gps-note";
    gpsStep1.textContent = "No location found in this video. You will place a pin in the next step.";
    renderGpsStatus();
  }
  window.__tgUploadDetected = found ? { lat: found.lat, lng: found.lng } : null;
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = "";
  }
  clearLocation();
  window.__tgUploadDetected = undefined;
  if (!file) {
    preview.hidden = true;
    videoEl.removeAttribute("src");
    return;
  }
  objectUrl = URL.createObjectURL(file);
  videoEl.src = objectUrl;
  fileName.textContent = file.name + " — preview only, not uploaded.";
  preview.hidden = false;
  setFieldError(fileInput, fileError, "");
  detectLocation(file);
});

document.getElementById("btn-use-la").addEventListener("click", () => setPin({ ...LA, source: "manual" }));
btnReset.addEventListener("click", placeDetected);

function applyCoords() {
  const lat = Number(String(latInput.value).trim().replace(",", "."));
  const lng = Number(String(lngInput.value).trim().replace(",", "."));
  const ok = String(latInput.value).trim() !== "" && String(lngInput.value).trim() !== "" &&
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  if (!ok) {
    setFieldError(null, coordsError, "Enter a latitude from -90 to 90 and a longitude from -180 to 180, for example 34.07195 and -118.3592.");
    return;
  }
  setPin({ lat, lng, label: "Adjusted pin", source: "manual" });
  if (map) map.resize();
}
document.getElementById("btn-apply-coords").addEventListener("click", applyCoords);
[latInput, lngInput].forEach((el) => el.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    applyCoords();
  }
}));

// Optional place name. Off by default: it sends only the pin's coordinates
// (never the video) to OpenStreetMap's free Nominatim service, and only when asked.
btnLookup.addEventListener("click", async () => {
  if (!pin) return;
  const token = ++lookupToken;
  placeEl.hidden = false;
  placeEl.textContent = "Looking up a place name…";
  try {
    const url = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=" +
      encodeURIComponent(pin.lat.toFixed(6)) + "&lon=" + encodeURIComponent(pin.lng.toFixed(6));
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("lookup " + res.status);
    const data = await res.json();
    if (token !== lookupToken) return;
    const name = data && (data.name || (data.display_name || "").split(",").slice(0, 3).join(",").trim());
    placeEl.textContent = name ? "Near: " + name + ". Place names come from OpenStreetMap contributors." : "No place name found for this spot. The coordinates are still used.";
  } catch (err) {
    if (token !== lookupToken) return;
    placeEl.textContent = "Could not look up a place name right now. The coordinates are still used.";
  }
});

function validateStep() {
  if (step === 1) {
    const file = fileInput.files && fileInput.files[0];
    if (!file) {
      setFieldError(fileInput, fileError, "Choose a video file to preview. It will not be uploaded.");
      fileInput.focus();
      return false;
    }
    return true;
  }
  if (step === 2) {
    if (!pin) {
      setFieldError(null, pinError, "Place a pin first: tap the map, type coordinates, or use the Los Angeles walk area.");
      return false;
    }
    return true;
  }
  if (step === 3) {
    if (!titleInput.value.trim()) {
      setFieldError(titleInput, titleError, "Add a title for this walk.");
      titleInput.focus();
      return false;
    }
    setFieldError(titleInput, titleError, "");
    return true;
  }
  if (step === 4) {
    const filmed = document.getElementById("consent-filmed").checked;
    const people = document.getElementById("consent-people").checked;
    const music = document.getElementById("consent-music").checked;
    if (!filmed || !people || !music) {
      consentError.textContent = "Please confirm all three rights statements before continuing.";
      return false;
    }
    consentError.textContent = "";
    return true;
  }
  return true;
}

function fillReview() {
  const file = fileInput.files[0];
  const rows = [
    ["Video", file ? file.name + " (preview only, not uploaded)" : ""],
    ["Location", pin ? pinSummary(pin) : ""],
    ["Title", titleInput.value.trim()],
    ["Description", descInput.value.trim() || "—"],
    ["Tags", tagsInput.value.trim() || "—"],
    ["Rights", "Filmed by you · faces/voices · no copyrighted music"],
  ];
  review.innerHTML = "";
  for (const [dt, dd] of rows) {
    const div = document.createElement("div");
    const dtEl = document.createElement("dt");
    dtEl.textContent = dt;
    const ddEl = document.createElement("dd");
    ddEl.textContent = dd;
    div.append(dtEl, ddEl);
    review.appendChild(div);
  }
}

function submitPreview() {
  const file = fileInput.files[0];
  const session = getDemoSession() || setDemoSession({ email: "", handle: "preview.traveler" });
  addDemoWalk({
    id: "demo-" + Date.now(),
    title: titleInput.value.trim(),
    description: descInput.value.trim(),
    tags: tagsInput.value.trim(),
    city: "Los Angeles",
    type: "Video walk",
    creatorHandle: session.handle || "preview.traveler",
    lng: pin.lng,
    lat: pin.lat,
    locationSource: pin.source || "manual",
    fileName: file ? file.name : "",
    preview: true,
    notSaved: SITE_NOT_SAVED,
    createdAt: new Date().toISOString(),
  });
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = "";
  }
}

btnNext.addEventListener("click", () => {
  if (!validateStep()) return;
  if (step === 4) fillReview();
  if (step === 5) {
    submitPreview();
    step = 6;
    renderStepper();
    const heading = document.getElementById("step-6-title");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus();
    }
    return;
  }
  step += 1;
  renderStepper();
  if (step === 2) {
    requestAnimationFrame(() => ensureMap());
  }
});

btnBack.addEventListener("click", () => {
  if (step > 1 && step < 6) {
    step -= 1;
    renderStepper();
    if (step === 2) requestAnimationFrame(() => ensureMap());
  }
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  btnNext.click();
});

window.addEventListener("pagehide", () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});

renderStepper();
void DEMO_STORAGE_NOTE;
