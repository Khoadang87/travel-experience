import { SITE_NOT_SAVED, DEMO_STORAGE_NOTE } from "./site-config.js";
import { addDemoWalk } from "./walks-data.js";
import { getDemoSession, setDemoSession } from "./auth-demo.js";
import { Map, Marker, setWorkerUrl, AttributionControl } from "maplibre-gl";

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
const review = document.getElementById("upload-review");

let step = 1;
let objectUrl = "";
let pin = null;
let map = null;
let marker = null;

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

function setPin(next) {
  pin = next;
  pinLabel.textContent = next
    ? "Pin: " + next.label + " (" + next.lat.toFixed(5) + ", " + next.lng.toFixed(5) + ")"
    : "No pin yet.";
  setFieldError(null, pinError, "");
  if (map && next) {
    if (!marker) {
      marker = new Marker({ color: "#1e5a54", draggable: true })
        .setLngLat([next.lng, next.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        setPin({ lng: ll.lng, lat: ll.lat, label: "Custom pin" });
      });
    } else {
      marker.setLngLat([next.lng, next.lat]);
    }
    map.flyTo({ center: [next.lng, next.lat], zoom: Math.max(map.getZoom(), 14), essential: true, duration: 800 });
  }
}

function ensureMap() {
  if (map) {
    map.resize();
    return;
  }
  map = new Map({
    container: "upload-map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [LA.lng, LA.lat],
    zoom: 13.2,
    attributionControl: false,
  });
  map.addControl(new AttributionControl({ compact: true }), "bottom-right");
  map.on("click", (e) => {
    setPin({ lng: e.lngLat.lng, lat: e.lngLat.lat, label: "Custom pin" });
  });
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = "";
  }
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
});

document.getElementById("btn-use-la").addEventListener("click", () => setPin({ ...LA }));

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
      setFieldError(null, pinError, "Drop a pin on the map, or use the Los Angeles walk area.");
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
    ["Location", pin ? pin.label + " · " + pin.lat.toFixed(5) + ", " + pin.lng.toFixed(5) : ""],
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
