// Tap-to-reveal map circles and GPS auto-detect in the upload flow.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { makeVideo } = require("./gps-fixtures");

const shots = path.join(__dirname, "..", "shots");
fs.mkdirSync(shots, { recursive: true });
async function shot(page, name) {
  await page.screenshot({ path: path.join(shots, name), fullPage: false });
}

const FOOTAGE = "/workspace/user-footage";
const REAL = [
  { file: "new-walk-airport.mov", lat: 33.9439, lng: -118.4081, label: "airport (LAX Tom Bradley)" },
  { file: "new-walk-a.mov", lat: 34.0725, lng: -118.3598, label: "café counter" },
  { file: "new-walk-d.mov", lat: 34.0723, lng: -118.3595, label: "Grove trolley street" },
  { file: "clip1.mov", lat: 34.072, lng: -118.3577, label: "Grove clip" },
  { file: "clip2.mov", lat: 34.0724, lng: -118.3604, label: "Farmers Market clip" },
];

test.describe.configure({ mode: "serial" });

async function exploreReady(page) {
  await page.goto("/explore.html");
  await page.waitForFunction(() => window.__tgMapReady === true && window.__tgStreetFitted === true, null, { timeout: 60000 });
  await page.waitForTimeout(600);
}

async function centerOf(locator) {
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

// ---------------------------------------------------------------- reveal ----

test("explore circles show no name until tapped; tap reveals, tap elsewhere hides", async ({ page }) => {
  await exploreReady(page);
  const dots = page.locator(".map-dot");
  await expect(dots).toHaveCount(6);
  await expect(page.locator(".map-pin")).toHaveCount(0);
  for (let i = 0; i < 6; i++) {
    const el = dots.nth(i);
    expect((await el.innerText()).trim(), "dot " + i + " has no visible text").toBe("");
    expect(await el.getAttribute("aria-label")).toBeTruthy();
    expect(await el.getAttribute("aria-expanded")).toBe("false");
  }
  await expect(page.locator(".pin-reveal")).toHaveCount(0);

  const grove = page.getByRole("button", { name: "The Grove", exact: true });
  await grove.click();
  const popup = page.locator(".pin-reveal");
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("The Grove");
  await expect(popup.getByRole("link", { name: "Open walk: The Grove", exact: true })).toBeVisible();
  await expect(grove).toHaveAttribute("aria-expanded", "true");
  await shot(page, "feat-explore-desktop-reveal.png");

  // Tapping the same circle again hides it.
  await grove.click();
  await expect(page.locator(".pin-reveal")).toHaveCount(0);
  await expect(grove).toHaveAttribute("aria-expanded", "false");

  // Tapping empty map hides it.
  await grove.click();
  await expect(page.locator(".pin-reveal")).toBeVisible();
  await page.mouse.click(1000, 120);
  await expect(page.locator(".pin-reveal")).toHaveCount(0);

  // Tapping the page header hides it.
  await grove.click();
  await expect(page.locator(".pin-reveal")).toBeVisible();
  await page.locator("header.top .brand").hover();
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator(".pin-reveal")).toHaveCount(0);
});

test("circles work from the keyboard: Enter reveals, Escape hides and returns focus", async ({ page }) => {
  await exploreReady(page);
  const farmers = page.getByRole("button", { name: "Farmers Market", exact: true });
  await farmers.focus();
  await expect(farmers).toBeFocused();
  await page.keyboard.press("Enter");
  const popup = page.locator(".pin-reveal");
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("Farmers Market");
  // A keyboard user lands on the Open walk button.
  await expect(popup.getByRole("link", { name: "Open walk: Farmers Market", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pin-reveal")).toHaveCount(0);
  await expect(farmers).toBeFocused();
  // Enter on Open walk opens the walk.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.waitForURL(/walk\.html\?id=farmers-kane-scan-splat/);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("circles have 44 px hit areas; close pins list both walks; each opens its own walk", async ({ page }) => {
    await exploreReady(page);
    const dots = page.locator(".map-dot");
    await expect(dots).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      const box = await dots.nth(i).boundingBox();
      expect(box.width, "dot " + i + " width").toBeGreaterThanOrEqual(44);
      expect(box.height, "dot " + i + " height").toBeGreaterThanOrEqual(44);
    }
    await shot(page, "feat-explore-phone-dots.png");

    // The café and trolley circles are closer than one hit area. Tap the café circle's centre.
    const cafe = await centerOf(page.getByRole("button", { name: "Café counter, 1st Street", exact: true }));
    const trolley = await centerOf(page.getByRole("button", { name: "The Grove, trolley street", exact: true }));
    expect(Math.hypot(cafe.x - trolley.x, cafe.y - trolley.y)).toBeLessThan(44);
    await page.touchscreen.tap(cafe.x, cafe.y);
    const popup = page.locator(".pin-reveal");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("2 walks near here");
    await expect(popup.getByRole("link", { name: "Open walk: Café counter, 1st Street", exact: true })).toBeVisible();
    await expect(popup.getByRole("link", { name: "Open walk: The Grove, trolley street", exact: true })).toBeVisible();
    await shot(page, "feat-explore-phone-close-pins.png");

    // The popup stays clear of the page header.
    const header = await page.locator("header.top").boundingBox();
    const pbox = await popup.boundingBox();
    expect(pbox.y).toBeGreaterThanOrEqual(header.y + header.height - 1);

    // Tapping elsewhere hides it.
    await page.touchscreen.tap(340, 200);
    await expect(page.locator(".pin-reveal")).toHaveCount(0);

    // Choose the café from the list.
    await page.touchscreen.tap(trolley.x, trolley.y);
    await expect(page.locator(".pin-reveal")).toContainText("2 walks near here");
    await page.getByRole("link", { name: "Open walk: Café counter, 1st Street", exact: true }).click();
    await page.waitForURL(/walk\.html\?id=cafe-first-street-walk/);
    await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  });

  test("a single walk away from the others shows just its own title", async ({ page }) => {
    await exploreReady(page);
    const grove = await centerOf(page.getByRole("button", { name: "The Grove", exact: true }));
    await page.touchscreen.tap(grove.x, grove.y);
    const popup = page.locator(".pin-reveal");
    await expect(popup).toContainText("The Grove");
    await expect(popup).not.toContainText("walks near here");
    await expect(popup.getByRole("link")).toHaveCount(1);
  });
});

test("globe zoom on explore: circles stack, one tap lists every walk", async ({ page }) => {
  await exploreReady(page);
  await page.evaluate(() => window.__tgMap.jumpTo({ center: [-118.3, 34], zoom: 1.6, pitch: 0, bearing: 0 }));
  await expect(page.locator("body")).toHaveAttribute("data-mode", "globe");
  await page.waitForTimeout(500);
  const dot = page.locator(".map-dot").last();
  const c = await centerOf(dot);
  await page.mouse.click(c.x, c.y);
  const popup = page.locator(".pin-reveal");
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("6 walks near here");
  await expect(popup.getByRole("link", { name: /^Open walk:/ })).toHaveCount(6);
  await shot(page, "feat-explore-desktop-globe.png");
  await popup.getByRole("link", { name: "Open walk: Tom Bradley International Terminal, LAX", exact: true }).click();
  await page.waitForURL(/walk\.html\?id=lax-bradley-walk/);
});

test("home globe uses the same tap-to-reveal circles", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgHomeMapReady === true, null, { timeout: 60000 });
  const dots = page.locator("#hero-map .map-dot");
  await expect(dots).toHaveCount(6);
  expect((await dots.first().innerText()).trim()).toBe("");
  await page.locator("#hero-map").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const c = await centerOf(dots.last());
  await page.mouse.click(c.x, c.y);
  const popup = page.locator("#hero-map .pin-reveal");
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("walks near here");
  // The card stays inside the map frame (the list scrolls instead of being cut off).
  const frame = await page.locator("#hero-map").boundingBox();
  const card = await page.locator("#hero-map .pin-reveal-popup .maplibregl-popup-content").boundingBox();
  expect(card.y).toBeGreaterThanOrEqual(frame.y - 1);
  expect(card.y + card.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
  await shot(page, "feat-home-desktop-reveal.png");
  await page.mouse.click(c.x - 150, c.y + 5);
  await expect(page.locator(".pin-reveal")).toHaveCount(0);
  await dots.last().click();
  await page.getByRole("link", { name: "Open walk: Café counter, 1st Street", exact: true }).click();
  await page.waitForURL(/walk\.html\?id=cafe-first-street-walk/);
});

// ---------------------------------------------------------------- upload ----

async function pickFile(page, file) {
  await page.goto("/upload.html");
  await page.locator("#upload-file").setInputFiles(file);
  await expect(page.locator("#upload-preview")).toBeVisible();
}

async function toStep2(page) {
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#step-2-title")).toBeVisible();
  await page.waitForFunction(() => !!window.__tgUploadMap, null, { timeout: 30000 });
}

function near(a, b, tol = 1e-4) {
  expect(Math.abs(a - b)).toBeLessThan(tol);
}

test("iPhone-style clip (moov at the end) places the pin and says it was detected", async ({ page }) => {
  const buffer = makeVideo({ iso6709: "+33.9439-118.4081+073.561/", accuracy: 5.502897 });
  await pickFile(page, { name: "airport-synthetic.mov", mimeType: "video/quicktime", buffer });
  await expect(page.locator("#upload-gps-step1")).toContainText("Location found in your video");
  await toStep2(page);
  await expect(page.locator("#upload-gps-status")).toContainText("Location detected from your video");
  await expect(page.locator("#upload-pin-label")).toContainText("Detected from your video");
  await expect(page.locator("#upload-pin-label")).toContainText("33.94390, -118.40810");
  await expect(page.locator("#upload-pin-label")).toContainText("±6 m");
  await expect(page.locator("#btn-reset-detected")).toBeHidden();
  const c = await page.evaluate(() => window.__tgUploadMap.getCenter());
  near(c.lat, 33.9439);
  near(c.lng, -118.4081);
  await expect(page.locator("#upload-map .maplibregl-marker")).toBeVisible();
});

test("detected pin can be adjusted by typing coordinates and reset to the detected spot", async ({ page }) => {
  const buffer = makeVideo({ iso6709: "+34.0725-118.3598+059.157/", isoMeta: true });
  await pickFile(page, { name: "cafe-synthetic.mov", mimeType: "video/quicktime", buffer });
  await toStep2(page);
  await expect(page.locator("#upload-pin-label")).toContainText("34.07250, -118.35980");
  await page.locator("#gps-edit summary").click();
  await expect(page.locator("#pin-lat")).toHaveValue("34.07250");
  await page.locator("#pin-lat").fill("34.0800");
  await page.locator("#pin-lng").fill("-118.3500");
  await page.getByRole("button", { name: "Move pin here" }).click();
  await expect(page.locator("#upload-pin-label")).toContainText("Adjusted pin");
  await expect(page.locator("#upload-pin-label")).toContainText("34.08000, -118.35000");
  await expect(page.locator("#btn-reset-detected")).toBeVisible();
  await page.getByRole("button", { name: "Reset to detected location" }).click();
  await expect(page.locator("#upload-pin-label")).toContainText("Detected from your video");
  await expect(page.locator("#upload-pin-label")).toContainText("34.07250, -118.35980");
  await expect(page.locator("#btn-reset-detected")).toBeHidden();
  // Bad coordinates are rejected with a message and leave the pin alone.
  await page.locator("#pin-lat").fill("123");
  await page.getByRole("button", { name: "Move pin here" }).click();
  await expect(page.locator("#pin-coords-error")).toContainText("latitude from -90 to 90");
  await expect(page.locator("#upload-pin-label")).toContainText("34.07250, -118.35980");
});

test("dragging the detected pin moves it and marks it adjusted", async ({ page }) => {
  const buffer = makeVideo({ iso6709: "+34.0725-118.3598/" });
  await pickFile(page, { name: "drag.mov", mimeType: "video/quicktime", buffer });
  await toStep2(page);
  await expect(page.locator("#upload-pin-label")).toContainText("Detected from your video");
  await page.waitForTimeout(1200);
  const marker = page.locator("#upload-map .maplibregl-marker");
  const box = await marker.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 30, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator("#upload-pin-label")).toContainText("Adjusted pin");
  await expect(page.locator("#btn-reset-detected")).toBeVisible();
  await expect(page.locator("#upload-gps-status")).toContainText("You moved the pin");
});

test("MP4 location atom (©xyz) is read too", async ({ page }) => {
  const buffer = makeVideo({ xyz: "+51.5007-000.1246+10.0/", moovFirst: true });
  await pickFile(page, { name: "android.mp4", mimeType: "video/mp4", buffer });
  await toStep2(page);
  await expect(page.locator("#upload-pin-label")).toContainText("Detected from your video");
  await expect(page.locator("#upload-pin-label")).toContainText("51.50070, -0.12460");
});

test("no GPS in the video falls back to manual pinning with a clear message", async ({ page }) => {
  const buffer = makeVideo({});
  await pickFile(page, { name: "no-gps.mp4", mimeType: "video/mp4", buffer });
  await expect(page.locator("#upload-gps-step1")).toContainText("No location found in this video");
  await toStep2(page);
  await expect(page.locator("#upload-gps-status")).toContainText("No location was found in this video");
  await expect(page.locator("#upload-gps-status")).toContainText("Photos");
  await expect(page.locator("#upload-pin-label")).toHaveText("No pin yet.");
  await expect(page.locator("#btn-reset-detected")).toBeHidden();
  await expect(page.locator("#btn-lookup")).toBeHidden();
  await shot(page, "feat-upload-desktop-no-gps.png");
  // Continuing without a pin explains what to do.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#upload-pin-error")).toContainText("Place a pin first");
  // Tap the map to place one.
  await page.locator("#upload-map").click({ position: { x: 120, y: 100 } });
  await expect(page.locator("#upload-pin-label")).toContainText("Custom pin");
  await expect(page.locator("#btn-lookup")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#step-3-title")).toBeVisible();
});

test("picking a different video replaces the detected location", async ({ page }) => {
  await pickFile(page, { name: "first.mov", mimeType: "video/quicktime", buffer: makeVideo({ iso6709: "+33.9439-118.4081/" }) });
  await toStep2(page);
  await expect(page.locator("#upload-pin-label")).toContainText("33.94390");
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator("#upload-file").setInputFiles({ name: "second.mp4", mimeType: "video/mp4", buffer: makeVideo({}) });
  await expect(page.locator("#upload-gps-step1")).toContainText("No location found");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#upload-pin-label")).toHaveText("No pin yet.");
  await expect(page.locator("#upload-map .maplibregl-marker")).toHaveCount(0);
});

test("the video never leaves the device: only GETs, no upload, lookup is opt-in", async ({ page }) => {
  const requests = [];
  page.on("request", (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData() }));
  let nominatim = [];
  await page.route("https://nominatim.openstreetmap.org/**", (route) => {
    nominatim.push(route.request().url());
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ name: "Tom Bradley International Terminal", display_name: "Tom Bradley International Terminal, World Way, Los Angeles" }),
    });
  });
  const buffer = makeVideo({ iso6709: "+33.9439-118.4081/", accuracy: 5 });
  await pickFile(page, { name: "private-clip-name.mov", mimeType: "video/quicktime", buffer });
  await toStep2(page);
  await page.waitForTimeout(1500);
  expect(nominatim, "no place lookup until asked").toHaveLength(0);

  await expect(page.locator("#lookup-hint")).toContainText("only the pin's coordinates");
  await page.getByRole("button", { name: "Look up place name" }).click();
  await expect(page.locator("#upload-place")).toContainText("Near: Tom Bradley International Terminal");
  expect(nominatim).toHaveLength(1);
  expect(nominatim[0]).toContain("lat=33.943900");
  expect(nominatim[0]).toContain("lon=-118.408100");
  expect(nominatim[0]).not.toContain("private-clip-name");

  // Finish the flow: still "Preview: not saved".
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#upload-title").fill("Terminal walk");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#consent-filmed").check();
  await page.locator("#consent-people").check();
  await page.locator("#consent-music").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#upload-review")).toContainText("Detected from your video");
  await expect(page.locator("#upload-review")).toContainText("not uploaded");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.locator("#upload-success")).toContainText("Preview: not saved");
  await expect(page.locator("#upload-success")).toContainText("was not uploaded");
  const demo = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  expect(demo).toContain("locationSource");
  expect(demo).toContain("video");

  for (const r of requests) {
    expect(r.method, r.url).toBe("GET");
    expect(r.body, r.url).toBeNull();
    expect(r.url, "file name never in a URL").not.toContain("private-clip-name");
  }
  const hosts = new Set(requests.map((r) => new URL(r.url).host));
  for (const h of hosts) {
    expect(["127.0.0.1:8765", "tiles.openfreemap.org", "nominatim.openstreetmap.org"], "unexpected host " + h).toContain(h);
  }
});

for (const clip of REAL) {
  test("real clip auto-detects: " + clip.label, async ({ page }) => {
    const file = path.join(FOOTAGE, clip.file);
    test.skip(!fs.existsSync(file), file + " is not on this machine");
    test.setTimeout(120000);
    await page.goto("/upload.html");
    await page.locator("#upload-file").setInputFiles(file);
    await page.waitForFunction(() => window.__tgUploadDetected !== undefined, null, { timeout: 60000 });
    const got = await page.evaluate(() => window.__tgUploadDetected);
    expect(got, clip.file + " has a location").toBeTruthy();
    near(got.lat, clip.lat);
    near(got.lng, clip.lng);
    await expect(page.locator("#upload-gps-step1")).toContainText("Location found in your video");
    if (clip.file === "new-walk-airport.mov") {
      await toStep2(page);
      await expect(page.locator("#upload-pin-label")).toContainText("33.94390, -118.40810");
      await expect(page.locator("#upload-pin-label")).toContainText("±6 m");
      await expect(page.locator("#upload-gps-status")).toContainText("Location detected from your video");
      await page.waitForTimeout(1500);
      await shot(page, "feat-upload-desktop-airport-detected.png");
    }
  });
}

test("a real clip with its GPS stripped (transcoded walk) falls back to manual", async ({ page }) => {
  const file = path.join(__dirname, "..", "media", "videowalk", "cafe-counter-walk.mp4");
  await page.goto("/upload.html");
  await page.locator("#upload-file").setInputFiles(file);
  await page.waitForFunction(() => window.__tgUploadDetected !== undefined, null, { timeout: 30000 });
  expect(await page.evaluate(() => window.__tgUploadDetected)).toBeNull();
  await expect(page.locator("#upload-gps-step1")).toContainText("No location found");
});

test.describe("phone upload", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("detected location and the manual fallback read clearly at 390 px", async ({ page }) => {
    await pickFile(page, { name: "ph.mov", mimeType: "video/quicktime", buffer: makeVideo({ iso6709: "+33.9439-118.4081/", accuracy: 5.5 }) });
    await toStep2(page);
    await page.waitForTimeout(1500);
    await expect(page.locator("#upload-pin-label")).toContainText("Detected from your video");
    for (const sel of ["#btn-use-la", "#btn-lookup", "#gps-edit summary"]) {
      const box = await page.locator(sel).boundingBox();
      expect(box.height, sel).toBeGreaterThanOrEqual(44);
    }
    await shot(page, "feat-upload-phone-detected.png");
    await page.getByRole("button", { name: "Back" }).click();
    await page.locator("#upload-file").setInputFiles({ name: "nogps.mp4", mimeType: "video/mp4", buffer: makeVideo({}) });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("#upload-gps-status")).toContainText("No location was found");
    await page.waitForTimeout(800);
    await shot(page, "feat-upload-phone-no-gps.png");
  });
});
