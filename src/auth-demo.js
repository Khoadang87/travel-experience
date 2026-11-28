import { DEMO_SESSION_KEY, SITE_NOT_SAVED } from "./site-config.js";

export function getDemoSession() {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setDemoSession(partial) {
  const next = {
    email: "",
    handle: "preview.traveler",
    createdAt: new Date().toISOString(),
    preview: true,
    note: SITE_NOT_SAVED,
    ...partial,
  };
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(next));
  return next;
}

export function clearDemoSession() {
  localStorage.removeItem(DEMO_SESSION_KEY);
}

export function isValidEmail(value) {
  const v = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
