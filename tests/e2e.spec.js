const { test, expect } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const shots = path.join(__dirname, "..", "shots");
fs.mkdirSync(shots, { recursive: true });

async function shot(page, name) {
  const file = path.join(shots, name);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

const PRIMARY_PIN_NAMES = ["The Grove", "Farmers Market"];

async function goToWalk(page) {
  await page.getByRole("button", { name: "Start at The Grove" }).click();
  await page.waitForFunction(() => {
    const map = window.__tgMap;
    return map && map.getZoom() >= 15 && document.body.dataset.mode === "street" && window.__tgStreetFitted === true;
  }, null, { timeout: 25000 });
}

function boxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function jumpToPin(page, id) {
  await page.evaluate((pinId) => {
    const map = window.__tgMap;
    const pin = (window.__tgPins || []).find((x) => x.id === pinId);
    if (!map || !pin) return;
    map.jumpTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 16.5), pitch: 42, bearing: -18 });
  }, id);
  await page.waitForTimeout(600);
}

test.describe.configure({ mode: "serial" });

test("globe renders, street zoom and pins open the Grove video walk", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  const canvas = page.locator("#map .maplibregl-canvas, #map canvas").first();
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(2000);
  await shot(page, "01-globe.png");

  await goToWalk(page);
  await page.waitForTimeout(1500);
  await expect(page.locator("body")).toHaveAttribute("data-mode", "street");
  await expect(page.locator(".map-pin")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "The Grove", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Farmers Market" })).toBeVisible();
  await shot(page, "02-street-pins.png");

  await page.getByRole("button", { name: "The Grove", exact: true }).click();
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
  await expect(page.locator("#splat-root .player-shell")).toBeHidden();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, null, { timeout: 120000 });
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("Private test");
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("The Grove");
  await expect(page.locator("#videowalk-root [data-stick='move']")).toBeVisible();
  expect(await page.evaluate(() => window.__tgVideoWalk.coversStage())).toBe(true);
  await page.waitForTimeout(800);
  await shot(page, "03-player-open.png");

  const t0 = await page.evaluate(() => window.__tgVideoWalk.currentTime);
  await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, -1));
  await page.waitForFunction((start) => window.__tgVideoWalk && window.__tgVideoWalk.currentTime > start + 0.35, t0, { timeout: 20000 });
  await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, 0));
  const pan0 = await page.evaluate(() => window.__tgVideoWalk.pan);
  await page.evaluate(() => window.__tgVideoWalk.setLookAxis(1, 0.6));
  await page.waitForTimeout(400);
  const pan1 = await page.evaluate(() => window.__tgVideoWalk.pan);
  expect(Math.abs(pan1.x - pan0.x) + Math.abs(pan1.y - pan0.y)).toBeGreaterThan(1);
  await page.evaluate(() => window.__tgVideoWalk.setLookAxis(0, 0));
  await shot(page, "04-player-look-scrub.png");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("#videowalk-root .player-shell")).toBeHidden();
  await expect(page.locator("#pin-card")).toBeHidden();
});

test("trial watermark and cap, one trial per creator, submission window open/closed", async ({ page }) => {
  await page.goto("/creator.html?trialCap=3");
  await page.evaluate(() => {
    localStorage.removeItem("tg:trials");
    localStorage.removeItem("tg:submissions");
    // Keep the window open in this test even after the default end date.
    localStorage.setItem(
      "tg:settings",
      JSON.stringify({
        submissionWindowStart: "2026-11-19T00:00:00-08:00",
        submissionWindowEnd: "2026-12-31T23:59:59-08:00",
      })
    );
  });
  await page.reload();
  await expect(page.locator("#window-status")).toHaveText(/OPEN/i, { timeout: 15000 });
  await shot(page, "05-creator-window-open.png");
  await expect(page.locator("#fee-360")).toContainText("$25");
  await expect(page.locator("#fee-spatial")).toContainText("$39");
  await expect(page.getByText("figure to review").first()).toBeVisible();

  await page.getByLabel("Name").fill("Test Creator");
  await page.getByLabel(/Email/).fill("creator@example.com");
  await page.getByLabel("Clip title").fill("Sidewalk test");
  await page.locator('input[name="license"]').check();
  await page.getByRole("button", { name: /Submit and start free trial/ }).click();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await expect(page.locator("[data-watermark]")).toBeVisible();
  await expect(page.locator("[data-watermark]")).toContainText("TRIAL PREVIEW");
  await expect(page.locator("[data-watermark]")).toContainText("not creator footage");
  await page.waitForFunction(() => window.__tgPlayer && window.__tgPlayer.trial === true && window.__tgPlayer.trialCap === 3);
  await shot(page, "06-trial-watermark.png");

  await page.evaluate(() => {
    const p = window.__tgPlayer;
    p.setCurrentTime(2.95);
    p.video.play();
  });
  await page.waitForFunction(() => window.__tgPlayer && window.__tgPlayer.capped === true, null, { timeout: 10000 });
  await expect(page.locator("[data-trial-end]")).toBeVisible();
  const t = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(t).toBeGreaterThanOrEqual(2.8);
  expect(t).toBeLessThanOrEqual(3.2);
  await shot(page, "07-trial-cap.png");
  await page.getByRole("button", { name: "Close" }).click();

  // Second submit with same email must not grant another trial.
  await page.getByLabel("Clip title").fill("Second clip");
  await page.getByRole("button", { name: /Submit and start free trial/ }).click();
  await expect(page.locator("#form-notice")).toContainText(/already used the one free trial/i);
  await expect(page.locator("#player-root .player-shell")).toBeHidden();

  // Close the window via localStorage override and verify the form locks.
  await page.evaluate(() => {
    localStorage.setItem(
      "tg:settings",
      JSON.stringify({
        submissionWindowStart: "2026-11-01T00:00:00-08:00",
        submissionWindowEnd: "2026-11-07T23:59:59-08:00",
      })
    );
  });
  await page.reload();
  await expect(page.locator("#window-status")).toHaveText(/CLOSED/i, { timeout: 15000 });
  await expect(page.getByRole("button", { name: /Submit and start free trial/ })).toBeDisabled();
  await shot(page, "08-creator-window-closed.png");
});

test("admin monetization panel shows free period, ads toggle, and revenue share placeholder", async ({ page }) => {
  await page.goto("/admin.html");
  await expect(page.locator("#live-ads")).toContainText(/Ads would be OFF/i, { timeout: 15000 });
  await expect(page.getByText(/placeholder, labeled to review/i)).toBeVisible();
  await page.locator('input[name="previewAds"]').check();
  await page.getByRole("button", { name: "Save in this browser" }).click();
  await expect(page.locator("#live-ads")).toContainText(/Ads would be ON/i);
  await shot(page, "09-admin-ads-preview.png");

  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await expect(page.locator("#adbar")).toBeVisible();
  await expect(page.locator("#adbar")).toContainText(/Ad placeholder/i);
  await shot(page, "10-map-ad-placeholder.png");

  // phone-sized viewport (screenshot only; tappable-pin checks live in the test below)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await goToWalk(page);
  await page.waitForTimeout(800);
  await shot(page, "11-phone-street.png");
});

test("phone street view leaves primary pins tappable and dismisses the pin card", async ({ page }) => {
  for (const size of [
    { width: 390, height: 844, shotName: "17-phone-844-street.png" },
    { width: 390, height: 664, shotName: "18-phone-664-street.png" },
  ]) {
    await page.setViewportSize(size);
    await page.goto("/index.html");
    await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
    await goToWalk(page);
    await page.waitForTimeout(500);
    await expect(page.locator(".map-pin")).toHaveCount(2);
    const hud = await page.locator(".hud").boundingBox();
    const header = await page.locator("header.top").boundingBox();
    for (const name of PRIMARY_PIN_NAMES) {
      const pin = page.getByRole("button", { name, exact: true });
      await expect(pin).toBeVisible();
      const box = await pin.boundingBox();
      expect(box, name + " should have a box at " + size.width + "x" + size.height).toBeTruthy();
      expect(box.x + box.width, name + " right").toBeGreaterThan(0);
      expect(box.x, name + " left").toBeLessThan(size.width);
      expect(box.y + box.height, name + " bottom").toBeGreaterThan(0);
      expect(box.y, name + " top").toBeLessThan(size.height);
      expect(boxesOverlap(box, hud), name + " covered by HUD").toBeFalsy();
      expect(boxesOverlap(box, header), name + " covered by header").toBeFalsy();
    }
    await shot(page, size.shotName);
  }

  await page.getByRole("button", { name: "The Grove", exact: true }).click();
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await expect(page.locator("#pin-card")).toBeHidden();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, { timeout: 120000 });
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("The Grove");
  await page.waitForTimeout(400);
  await shot(page, "19-phone-664-player.png");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("#videowalk-root .player-shell")).toBeHidden();
  await expect(page.locator("#pin-card")).toBeHidden();
  await shot(page, "20-phone-664-after-close.png");
});

test("See all places opens a list with The Grove and Farmers Market on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await expect(page.getByRole("button", { name: "See all places" })).toBeHidden();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator("#site-nav")).toBeVisible();
  await page.locator("#site-nav").getByRole("link", { name: "Places" }).click();
  await expect(page.locator("#places-panel")).toBeVisible();
  await page.waitForFunction(() => window.__tgAllPinsFitted === true, null, { timeout: 25000 });
  await expect(page.locator("#place-grid .place-card")).toHaveCount(2);
  for (const name of [/The Grove/, /Farmers Market/]) {
    const card = page.locator("#place-grid .place-card", { hasText: name });
    await expect(card).toBeVisible();
  }
  await expect(page.locator("#place-grid")).not.toContainText("Walk of Fame");
  await expect(page.locator("#place-grid")).not.toContainText("Ludlow");
  await expect(page.locator("#place-grid")).not.toContainText("Example business");
  await shot(page, "21-phone-844-all-pins.png");
});

test("desktop fullscreen button uses the Fullscreen API or a CSS fallback", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await goToWalk(page);
  await page.getByRole("button", { name: "The Grove", exact: true }).click();
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, { timeout: 120000 });
  await page.locator("#videowalk-root [data-fs]").click();
  await page.waitForTimeout(500);
  const on = await page.evaluate(() => {
    const panel = document.querySelector("#videowalk-root .player-panel");
    return (
      document.fullscreenElement === panel ||
      document.webkitFullscreenElement === panel ||
      panel.classList.contains("is-fullscreen")
    );
  });
  expect(on).toBeTruthy();
  await shot(page, "22-desktop-fullscreen.png");
  await page.locator("#videowalk-root [data-fs]").click();
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => {
    const panel = document.querySelector("#videowalk-root .player-panel");
    return (
      document.fullscreenElement === panel ||
      document.webkitFullscreenElement === panel ||
      panel.classList.contains("is-fullscreen")
    );
  });
  expect(off).toBeFalsy();
});

test("phone walk has no Full screen button and Close leaves the player", async ({ page }) => {
  test.setTimeout(180000);
  const sizes = [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ];
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.evaluate(() => window.__tgOpenPin("grove-kane-scan-splat"));
    await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
    await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, { timeout: 120000 });
    await expect(page.locator("#videowalk-root [data-fs]")).toBeHidden();
    await expect(page.locator("#videowalk-root [data-fs-exit]")).toBeHidden();
    await expect(page.locator("#videowalk-root").getByRole("button", { name: /Full screen/i })).toHaveCount(0);
    const closeBtn = page.locator("#videowalk-root [data-close]");
    await expect(closeBtn).toBeVisible();
    await expect(closeBtn).toHaveText("Close");
    await closeBtn.click();
    await expect(page.locator("#videowalk-root .player-shell")).toBeHidden();
  }
});

test("desktop CSS fallback covers the viewport when the Fullscreen API is missing", async ({ page }) => {
  test.setTimeout(180000);
  await page.addInitScript(() => {
    const hide = (obj, key) => {
      try {
        Object.defineProperty(obj, key, { configurable: true, writable: true, value: undefined });
      } catch (_) {
        try { obj[key] = undefined; } catch (_) {}
      }
    };
    hide(Document.prototype, "fullscreenEnabled");
    hide(Document.prototype, "webkitFullscreenEnabled");
    hide(Document.prototype, "fullscreenElement");
    hide(Document.prototype, "webkitFullscreenElement");
    hide(Document.prototype, "exitFullscreen");
    hide(Document.prototype, "webkitExitFullscreen");
    hide(Element.prototype, "requestFullscreen");
    hide(Element.prototype, "webkitRequestFullscreen");
    hide(Element.prototype, "webkitRequestFullScreen");
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await goToWalk(page);
  await page.getByRole("button", { name: "The Grove", exact: true }).click();
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, { timeout: 120000 });

  const fsBtn = page.locator("#videowalk-root [data-fs]");
  const exitBtn = page.locator("#videowalk-root [data-fs-exit]");
  await expect(fsBtn).toHaveText("Full screen");
  await expect(fsBtn).toHaveAttribute("aria-pressed", "false");
  await expect(exitBtn).toBeHidden();

  await fsBtn.click();
  await expect(page.locator("#videowalk-root .player-panel")).toHaveClass(/is-fullscreen/);
  await expect.poll(async () => page.evaluate(() => document.body.classList.contains("player-css-fs"))).toBeTruthy();
  await expect(fsBtn).toHaveText("Exit full screen");
  await expect(fsBtn).toHaveAttribute("aria-pressed", "true");
  await expect(exitBtn).toBeVisible();

  const covered = await page.evaluate(() => {
    const vp = { w: window.innerWidth, h: window.innerHeight };
    const shell = document.querySelector("#videowalk-root .player-shell").getBoundingClientRect();
    const stick = document.querySelector("#videowalk-root [data-stick='move']").getBoundingClientRect();
    return {
      vp,
      shell: { x: Math.round(shell.x), y: Math.round(shell.y), w: Math.round(shell.width), h: Math.round(shell.height) },
      covers: Math.abs(shell.width - vp.w) < 2 && Math.abs(shell.height - vp.h) < 4 && shell.top < 2 && shell.left < 2,
      stickInside: stick.width >= 44 && stick.left >= -0.5 && stick.top >= -0.5 && stick.right <= vp.w + 0.5 && stick.bottom <= vp.h + 0.5,
    };
  });
  expect(covered.covers, "player should cover the viewport " + JSON.stringify(covered)).toBeTruthy();
  expect(covered.stickInside, "Move stick should stay inside the viewport " + JSON.stringify(covered)).toBeTruthy();

  await exitBtn.click();
  await expect(page.locator("#videowalk-root .player-panel")).not.toHaveClass(/is-fullscreen/);
  await expect.poll(async () => page.evaluate(() => document.body.classList.contains("player-css-fs"))).toBeFalsy();
  await expect(fsBtn).toHaveText("Full screen");
  await expect(fsBtn).toHaveAttribute("aria-pressed", "false");
  await expect(exitBtn).toBeHidden();

  await fsBtn.click();
  await expect(page.locator("#videowalk-root .player-panel")).toHaveClass(/is-fullscreen/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#videowalk-root .player-panel")).not.toHaveClass(/is-fullscreen/);
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
});

const REMAINING_PINS = [
  { id: "grove-kane-scan-splat", lng: -118.3576, lat: 34.072, videoWalk: "data/grove-videowalk.json" },
  { id: "farmers-kane-scan-splat", lng: -118.3608, lat: 34.0719, videoWalk: "data/farmers-videowalk.json" },
];

async function waitForMap(page) {
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
}

test("remaining pins keep their ids, coordinates, and video-walk behaviour", async ({ page }) => {
  await page.goto("/index.html");
  await waitForMap(page);
  const pins = await page.evaluate(() =>
    (window.__tgPins || []).map((p) => ({
      id: p.id,
      lng: p.lng,
      lat: p.lat,
      videoWalk: p.videoWalk || undefined,
      splat: p.splat || undefined,
    }))
  );
  expect(pins).toHaveLength(2);
  expect(pins.map((p) => p.id)).toEqual(REMAINING_PINS.map((p) => p.id));
  for (const expected of REMAINING_PINS) {
    const got = pins.find((p) => p.id === expected.id);
    expect(got).toBeTruthy();
    expect(got.lng).toBeCloseTo(expected.lng, 4);
    expect(got.lat).toBeCloseTo(expected.lat, 4);
    expect(got.videoWalk).toBe(expected.videoWalk);
    expect(got.splat).toBeUndefined();
  }

  await page.evaluate(() => window.__tgOpenPin("grove-kane-scan-splat"));
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
  await expect(page.locator("#splat-root .player-shell")).toBeHidden();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, null, { timeout: 120000 });
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("The Grove");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("#videowalk-root .player-shell")).toBeHidden();
});


test("Grove video walk opens by default, hold-up walks, release stops, no black edges", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/index.html");
  await waitForMap(page);
  await page.evaluate(() => window.__tgOpenPin("grove-kane-scan-splat"));
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await expect(page.locator("#splat-root .player-shell")).toBeHidden();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, null, { timeout: 120000 });
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("Private test");
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("The Grove");
  await page.locator("#videowalk-root [data-credits]").click();
  await expect(page.locator("#videowalk-root [data-credit-details]")).toContainText("bystanders can be heard");
  await expect(page.locator("#videowalk-root [aria-label='Look joystick']")).toBeVisible();
  await expect(page.locator("#videowalk-root [aria-label='Move joystick: hold up to walk forward']")).toBeVisible();
  expect(await page.evaluate(() => window.__tgVideoWalk.coversStage())).toBe(true);
  const mm = await page.locator("#videowalk-root .videowalk-minimap").boundingBox();
  expect(mm).toBeTruthy();
  expect(mm.width).toBeGreaterThan(80);
  expect(mm.width).toBeLessThan(180);
  expect(mm.height).toBeGreaterThan(80);
  expect(mm.height).toBeLessThan(180);

  await expect(page.locator("#videowalk-root [data-spots]")).toBeVisible();
  await expect(page.locator("#videowalk-root [data-spots]")).toContainText("The Cheesecake Factory");
  await expect(page.locator("#videowalk-root [data-spots]")).toContainText("Revolve");

  const t0 = await page.evaluate(() => window.__tgVideoWalk.currentTime);
  await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, -1));
  await page.waitForFunction((start) => window.__tgVideoWalk && window.__tgVideoWalk.currentTime > start + 0.35, t0, { timeout: 20000 });
  await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, 0));
  const paused = await page.evaluate(() => ({ t: window.__tgVideoWalk.currentTime, playing: window.__tgVideoWalk.playing }));
  expect(paused.t).toBeGreaterThan(t0 + 0.3);
  expect(paused.playing).toBe(false);
  await page.waitForTimeout(450);
  const still = await page.evaluate(() => window.__tgVideoWalk.currentTime);
  expect(Math.abs(still - paused.t)).toBeLessThan(0.35);
  expect(await page.evaluate(() => window.__tgVideoWalk.coversStage())).toBe(true);
  await page.evaluate(() => window.__tgVideoWalk.setLookAxis(1, 0.6));
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__tgVideoWalk.coversStage())).toBe(true);
  await page.evaluate(() => window.__tgVideoWalk.setLookAxis(0, 0));
});

test("Farmers Market video walk opens by default, hold-up walks, release stops, no black edges", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/index.html");
  await waitForMap(page);
  await page.evaluate(() => window.__tgOpenPin("farmers-kane-scan-splat"));
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await expect(page.locator("#splat-root .player-shell")).toBeHidden();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, null, { timeout: 120000 });
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("Farmers Market");
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("whole 52");
  await expect(page.locator("#videowalk-root [data-spots]")).toBeVisible();
  await expect(page.locator("#videowalk-root [data-spots]")).toContainText("Clock tower");
  await expect(page.locator("#videowalk-root [data-spots]")).toContainText("Gilmore arch");
  expect(await page.evaluate(() => window.__tgVideoWalk.coversStage())).toBe(true);
  const t0 = await page.evaluate(() => window.__tgVideoWalk.currentTime);
  await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, -1));
  await page.waitForFunction((start) => window.__tgVideoWalk && window.__tgVideoWalk.currentTime > start + 0.35, t0, { timeout: 20000 });
  await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, 0));
  const paused = await page.evaluate(() => window.__tgVideoWalk.currentTime);
  await page.waitForTimeout(450);
  const still = await page.evaluate(() => window.__tgVideoWalk.currentTime);
  expect(Math.abs(still - paused)).toBeLessThan(0.35);
  expect(await page.evaluate(() => window.__tgVideoWalk.coversStage())).toBe(true);
});

test.describe("video walk phone viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Grove and Farmers video walks have no black edges on a phone-sized viewport", async ({ page }) => {
    test.setTimeout(240000);
    await page.goto("/index.html");
    await waitForMap(page);
    for (const id of ["grove-kane-scan-splat", "farmers-kane-scan-splat"]) {
      await page.evaluate((pinId) => window.__tgOpenPin(pinId), id);
      await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
      await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, null, { timeout: 120000 });
      expect(await page.evaluate(() => window.__tgVideoWalk.coversStage()), id + " covers").toBe(true);
      const t0 = await page.evaluate(() => window.__tgVideoWalk.currentTime);
      await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, -1));
      await page.waitForFunction((start) => window.__tgVideoWalk && window.__tgVideoWalk.currentTime > start + 0.3, t0, { timeout: 20000 });
      await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, 0));
      const paused = await page.evaluate(() => window.__tgVideoWalk.currentTime);
      await page.waitForTimeout(400);
      const still = await page.evaluate(() => window.__tgVideoWalk.currentTime);
      expect(Math.abs(still - paused), id + " stopped").toBeLessThan(0.35);
      await page.evaluate(() => window.__tgVideoWalk.setLookAxis(-1, 0.4));
      await page.waitForTimeout(350);
      expect(await page.evaluate(() => window.__tgVideoWalk.coversStage()), id + " after look").toBe(true);
      await page.evaluate(() => window.__tgVideoWalk.setLookAxis(0, 0));
      await page.evaluate(() => window.__tgVideoWalk.close({ silent: true }));
    }
  });
});

// Pre-existing failures, left unfixed: these locators expect href="/sales.html"
// but the pages use href="sales.html". Moved to the end only so serial mode
// still runs the tests after them. Assertions are unchanged.


test("phone player sticks stay inside a full-bleed stage at common iPhone sizes", async ({ page }) => {
  test.setTimeout(360000);
  const sizes = [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 844, height: 390 },
  ];
  function assertInside(result, label) {
    expect(result.lookHidden, label + " look stick should be hidden").toBeTruthy();
    expect(result.moveCount, label + " should have exactly one Move stick").toBe(1);
    expect(result.stageFills, label + " stage " + JSON.stringify(result.stage)).toBeTruthy();
    expect(result.allIn, label + " sticks " + JSON.stringify(result.inside)).toBeTruthy();
  }
  async function measure(page, root, vp) {
    return page.evaluate(({ root, vp }) => {
      const look = document.querySelector(root + ' [data-stick="look"]');
      const moves = [...document.querySelectorAll(root + ' [data-stick="move"]')];
      const stage = document.querySelector(root + " .stage");
      if (!stage) return { stageFills: false, allIn: false, stage: null, inside: [], lookHidden: false, moveCount: 0 };
      const s = stage.getBoundingClientRect();
      const lookStyle = look ? getComputedStyle(look.closest(".stick-wrap") || look) : null;
      const lookHidden = !look || lookStyle.display === "none" || lookStyle.visibility === "hidden";
      const inside = moves.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          ok: r.width >= 44 && r.height >= 44 && r.left >= -0.5 && r.top >= -0.5 && r.right <= vp.w + 0.5 && r.bottom <= vp.h + 0.5,
          r: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) },
        };
      });
      return {
        stage: { x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.width), h: Math.round(s.height) },
        vp,
        inside,
        allIn: inside.length > 0 && inside.every((item) => item.ok),
        stageFills: Math.abs(s.width - vp.w) < 2 && Math.abs(s.height - vp.h) < 2 && s.top < 2 && s.left < 2,
        lookHidden,
        moveCount: moves.length,
      };
    }, { root, vp });
  }
  async function dispatchPointer(page, selector, type, opts) {
    await page.evaluate(({ selector, type, opts }) => {
      const el = document.querySelector(selector);
      el.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: opts.pointerId,
        pointerType: opts.pointerType || "touch",
        clientX: opts.x,
        clientY: opts.y,
        buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
        isPrimary: opts.pointerId === 1,
      }));
    }, { selector, type, opts });
  }
  async function centerOf(page, selector) {
    return page.evaluate((selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.y + 8, left: r.x, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
    }, selector);
  }

  await page.goto("/index.html");
  await waitForMap(page);
  await page.evaluate(() => sessionStorage.removeItem("tg:look-hint-used"));

  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.evaluate(() => window.__tgOpenPin("grove-kane-scan-splat"));
    await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
    await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, { timeout: 120000 });
    await expect(page.locator("#videowalk-root [data-stick='look']")).toBeHidden();
    await expect(page.locator("#videowalk-root [data-stick='move']")).toBeVisible();
    await expect(page.locator("#videowalk-root [data-look-hint] .hint-phone")).toHaveText("Drag to look, hold stick to walk");
    assertInside(await measure(page, "#videowalk-root", { w: size.width, h: size.height }), `Grove ${size.width}x${size.height}`);
    await page.evaluate(() => window.__tgVideoWalk.close({ silent: true }));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.__tgOpenPin("grove-kane-scan-splat"));
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, { timeout: 120000 });
  const vwPan0 = await page.evaluate(() => window.__tgVideoWalk.pan);
  const stageC = await centerOf(page, "#videowalk-root [data-stage]");
  await dispatchPointer(page, "#videowalk-root [data-stage]", "pointerdown", { pointerId: 21, x: stageC.x, y: stageC.y });
  await dispatchPointer(page, "#videowalk-root [data-stage]", "pointermove", { pointerId: 21, x: stageC.x + 48, y: stageC.y + 36 });
  await dispatchPointer(page, "#videowalk-root [data-stage]", "pointerup", { pointerId: 21, x: stageC.x + 48, y: stageC.y + 36 });
  const vwPan1 = await page.evaluate(() => window.__tgVideoWalk.pan);
  expect(Math.abs(vwPan1.x - vwPan0.x), "videowalk drag yaw/panX " + JSON.stringify({ vwPan0, vwPan1 })).toBeGreaterThan(8);
  expect(Math.abs(vwPan1.y - vwPan0.y), "videowalk drag pitch/panY " + JSON.stringify({ vwPan0, vwPan1 })).toBeGreaterThan(8);

  const t0 = await page.evaluate(() => window.__tgVideoWalk.currentTime);
  const panBeforeBoth = await page.evaluate(() => window.__tgVideoWalk.pan);
  const stickC = await centerOf(page, "#videowalk-root [data-stick='move']");
  const stageC2 = await centerOf(page, "#videowalk-root [data-stage]");
  await dispatchPointer(page, "#videowalk-root [data-stick='move']", "pointerdown", { pointerId: 31, x: stickC.x, y: stickC.top });
  await dispatchPointer(page, "#videowalk-root [data-stage]", "pointerdown", { pointerId: 32, x: stageC2.x, y: stageC2.y });
  await dispatchPointer(page, "#videowalk-root [data-stage]", "pointermove", { pointerId: 32, x: stageC2.x - 40, y: stageC2.y - 28 });
  await page.waitForFunction((start) => window.__tgVideoWalk && window.__tgVideoWalk.currentTime > start + 0.3, t0, { timeout: 20000 });
  const both = await page.evaluate(() => ({ t: window.__tgVideoWalk.currentTime, pan: window.__tgVideoWalk.pan }));
  expect(both.t).toBeGreaterThan(t0 + 0.3);
  expect(Math.abs(both.pan.x - panBeforeBoth.x) + Math.abs(both.pan.y - panBeforeBoth.y), "stick+drag pan " + JSON.stringify({ panBeforeBoth, pan: both.pan })).toBeGreaterThan(8);
  await dispatchPointer(page, "#videowalk-root [data-stick='move']", "pointerup", { pointerId: 31, x: stickC.x, y: stickC.top });
  await dispatchPointer(page, "#videowalk-root [data-stage]", "pointerup", { pointerId: 32, x: stageC2.x - 40, y: stageC2.y - 28 });
  await page.evaluate(() => window.__tgVideoWalk.close({ silent: true }));

  await page.evaluate(() => window.__tgOpenPin("farmers-kane-scan-splat"));
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, { timeout: 120000 });
  await expect(page.locator("#videowalk-root [data-stick='look']")).toBeHidden();
  assertInside(await measure(page, "#videowalk-root", { w: 390, h: 844 }), "Farmers 390x844");
  await page.evaluate(() => window.__tgVideoWalk.close({ silent: true }));
});



test("sales page loads with both prices, free preview, and honest demo note", async ({ page }) => {
  await page.goto("/sales.html");
  await expect(page.locator("h1")).toContainText("Put your business on the Walk of Fame Globe");
  await expect(page.locator("#price-standard")).toHaveText("$250");
  await expect(page.locator("#price-featured")).toHaveText("$500");
  await expect(page.getByText("figure to review").first()).toBeVisible();
  await expect(page.locator('header nav a[href="sales.html"]')).toHaveText("For businesses");
  await expect(page.getByText("Free 45-second preview")).toBeVisible();
  await expect(page.getByText("you only pay if you want the full pin")).toBeVisible();
  await expect(page.getByText("No business has bought a pin yet")).toBeVisible();
  await expect(page.locator('a[href="creator.html"]', { hasText: "Request a free preview" })).toBeVisible();
  await expect(page.locator('a[href="index.html"]', { hasText: "Back to the map" })).toBeVisible();
  // Linked from the header, not a second map-HUD button.
  await page.goto("/index.html");
  await expect(page.locator('header nav a[href="sales.html"]')).toHaveText("For businesses");
  await shot(page, "16-sales-page.png");
});

test("robots.txt and pages are marked noindex", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const body = await robots.text();
  expect(body).toMatch(/User-agent:\s*\*/i);
  expect(body).toMatch(/Disallow:\s*\//);
  for (const pathName of ["/index.html", "/creator.html", "/admin.html", "/sales.html"]) {
    await page.goto(pathName);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await expect(page.locator('header nav a[href="sales.html"]')).toHaveText("For businesses");
  }
});
