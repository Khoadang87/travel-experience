import { SITE_NOT_SAVED, DEMO_STORAGE_NOTE } from "./site-config.js";
import { isValidEmail, setDemoSession } from "./auth-demo.js";

const signupForm = document.getElementById("signup-form");
const loginForm = document.getElementById("login-form");

function setError(input, errorEl, message) {
  const field = input.closest(".field");
  errorEl.textContent = message || "";
  input.setAttribute("aria-invalid", message ? "true" : "false");
  if (message) input.setAttribute("aria-describedby", errorEl.id);
  else input.removeAttribute("aria-describedby");
  if (field) field.classList.toggle("has-error", Boolean(message));
}

function validate(emailInput, passwordInput, emailError, passwordError) {
  let ok = true;
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email) {
    setError(emailInput, emailError, "Enter your email.");
    ok = false;
  } else if (!isValidEmail(email)) {
    setError(emailInput, emailError, "Enter a valid email, like name@example.com.");
    ok = false;
  } else {
    setError(emailInput, emailError, "");
  }
  if (!password) {
    setError(passwordInput, passwordError, "Enter a password.");
    ok = false;
  } else if (password.length < 8) {
    setError(passwordInput, passwordError, "Use at least 8 characters.");
    ok = false;
  } else {
    setError(passwordInput, passwordError, "");
  }
  return ok;
}

function finish(form, success, email) {
  form.hidden = true;
  success.hidden = false;
  const handle = String(email.split("@")[0] || "preview.traveler").replace(/[^a-zA-Z0-9._-]/g, "") || "preview.traveler";
  setDemoSession({ email, handle });
  const note = document.createElement("p");
  note.textContent = DEMO_STORAGE_NOTE + " " + SITE_NOT_SAVED + ".";
  success.appendChild(note);
  const heading = success.querySelector("h2");
  if (heading) heading.focus();
}

if (signupForm) {
  const email = document.getElementById("signup-email");
  const password = document.getElementById("signup-password");
  const emailError = document.getElementById("signup-email-error");
  const passwordError = document.getElementById("signup-password-error");
  const success = document.getElementById("signup-success");
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(email, password, emailError, passwordError)) {
      (email.getAttribute("aria-invalid") === "true" ? email : password).focus();
      return;
    }
    finish(signupForm, success, email.value.trim());
  });
}

if (loginForm) {
  const email = document.getElementById("login-email");
  const password = document.getElementById("login-password");
  const emailError = document.getElementById("login-email-error");
  const passwordError = document.getElementById("login-password-error");
  const success = document.getElementById("login-success");
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validate(email, password, emailError, passwordError)) {
      (email.getAttribute("aria-invalid") === "true" ? email : password).focus();
      return;
    }
    finish(loginForm, success, email.value.trim());
  });
}
