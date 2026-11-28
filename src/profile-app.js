import { DEMO_STORAGE_NOTE, SITE_NOT_SAVED } from "./site-config.js";
import { getDemoSession, setDemoSession, clearDemoSession } from "./auth-demo.js";
import { loadDemoWalks, addDemoWalk, clearDemoWalks, loadCatalog } from "./walks-data.js";

const signedOut = document.getElementById("profile-signed-out");
const signedIn = document.getElementById("profile-signed-in");
const hello = document.getElementById("profile-hello");
const list = document.getElementById("profile-walks");
const empty = document.getElementById("profile-empty-walks");

function render() {
  const session = getDemoSession();
  if (!session) {
    signedOut.hidden = false;
    signedIn.hidden = true;
    return;
  }
  signedOut.hidden = true;
  signedIn.hidden = false;
  hello.textContent =
    "Signed in as a preview session" +
    (session.email ? " for " + session.email : "") +
    " (@" + (session.handle || "preview.traveler") + "). " +
    DEMO_STORAGE_NOTE +
    " " +
    SITE_NOT_SAVED +
    ".";
  const walks = loadDemoWalks();
  list.innerHTML = "";
  empty.hidden = walks.length > 0;
  for (const walk of walks) {
    const card = document.createElement("article");
    card.className = "walk-mini";
    const body = document.createElement("div");
    body.className = "walk-card-body";
    const h = document.createElement("h3");
    h.textContent = walk.title || "Untitled walk";
    const p = document.createElement("p");
    p.textContent = (walk.city || "Location set") + " · " + SITE_NOT_SAVED;
    body.append(h, p);
    card.appendChild(body);
    list.appendChild(card);
  }
}

document.getElementById("btn-demo-profile").addEventListener("click", async () => {
  setDemoSession({ email: "demo@example.com", handle: "preview.traveler" });
  if (!loadDemoWalks().length) {
    const catalog = await loadCatalog();
    const first = catalog[0];
    addDemoWalk({
      id: "demo-sample",
      title: "Demo walk (not a real upload)",
      city: first ? first.city : "Los Angeles",
      type: "Video walk",
      preview: true,
      notSaved: SITE_NOT_SAVED,
      createdAt: new Date().toISOString(),
    });
  }
  render();
});

document.getElementById("btn-clear-demo").addEventListener("click", () => {
  clearDemoSession();
  clearDemoWalks();
  render();
});

render();
