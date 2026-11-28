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
  if (!page.url().includes("explore.html")) {
    await page.goto("/explore.html");
  }
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await page.waitForFunction(() => window.__tgStreetFitted === true, null, { timeout: 25000 });
}

async function openWalk(page, id = "grove-kane-scan-splat") {
  await page.goto("/walk.html?id=" + id);
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, { timeout: 120000 });
}

async function visibleKane(page) {
  return page.evaluate(() => {
    const hits = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent || "";
      if (/kane/i.test(text)) {
        const parent = walker.currentNode.parentElement;
        const style = parent ? getComputedStyle(parent) : null;
        const hidden = !parent || style.display === "none" || style.visibility === "hidden" || parent.hidden || parent.closest("[hidden]");
        if (!hidden) hits.push(text.trim().slice(0, 160));
      }
    }
    return hits;
  });
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

test("explore map fits the walks and pins open the Grove video walk", async ({ page }) => {
  await goToWalk(page);
  const canvas = page.locator("#map .maplibregl-canvas, #map canvas").first();
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator("body")).toHaveAttribute("data-mode", "street");
  await expect(page.locator(".map-pin")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "The Grove", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Farmers Market" })).toBeVisible();
  await shot(page, "02-street-pins.png");

  await page.getByRole("button", { name: "The Grove", exact: true }).click();
  await page.waitForURL(/walk\.html\?id=/);
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

test("home page uses the interim brand, featured walks, and how-it-works", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.locator("header .brand")).toContainText("LA Walks Preview");
  await expect(page.locator("h1")).toHaveText("Walk real streets, filmed by real travelers");
  await expect(page.getByRole("link", { name: "Explore the map" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Share your walk" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Featured walks" })).toBeVisible();
  await expect(page.locator("#featured-row")).toContainText("The Grove");
  await expect(page.locator("#featured-row")).toContainText("Farmers Market");
  await expect(page.getByRole("heading", { name: "How it works" })).toBeVisible();
  await expect(page.locator("footer")).toContainText("About");
  await expect(page.locator("footer")).toContainText("Guidelines");
  await expect(page.locator("footer")).toContainText("Privacy");
  await expect(page.locator("footer")).toContainText("Terms");
  await expect(page.locator("body")).not.toContainText("Walk of Fame Globe");
  expect(await visibleKane(page)).toEqual([]);
  await page.waitForFunction(() => window.__tgHomeMapReady === true, null, { timeout: 40000 });
  await shot(page, "01-home.png");
});

test("admin monetization panel shows free period, ads toggle, and revenue share placeholder", async ({ page }) => {
  await page.goto("/admin.html");
  await expect(page.locator("#live-ads")).toContainText(/Ads would be OFF/i, { timeout: 15000 });
  await expect(page.getByText(/placeholder, labeled to review/i)).toBeVisible();
  await page.locator('input[name="previewAds"]').check();
  await page.getByRole("button", { name: "Save in this browser" }).click();
  await expect(page.locator("#live-ads")).toContainText(/Ads would be ON/i);
  await shot(page, "09-admin-ads-preview.png");

  await page.setViewportSize({ width: 390, height: 844 });
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
    await goToWalk(page);
    await page.waitForTimeout(500);
    await expect(page.locator(".map-pin")).toHaveCount(2);
    const hud = await page.locator("#explore-panel").boundingBox();
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
  await page.waitForURL(/walk\.html\?id=/);
  await expect(page.locator("#videowalk-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, { timeout: 120000 });
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("The Grove");
  await page.waitForTimeout(400);
  await shot(page, "19-phone-664-player.png");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("#videowalk-root .player-shell")).toBeHidden();
  await expect(page.getByRole("heading", { name: "The Grove" })).toBeVisible();
  await shot(page, "20-phone-664-after-close.png");
});

test("explore list on a phone shows The Grove and Farmers Market and filters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await goToWalk(page);
  await expect(page.locator("#explore-list .walk-card")).toHaveCount(2);
  for (const name of [/The Grove/, /Farmers Market/]) {
    const card = page.locator("#explore-list .walk-card", { hasText: name });
    await expect(card).toBeVisible();
  }
  await expect(page.locator("#explore-list")).not.toContainText("Walk of Fame");
  await expect(page.locator("#explore-list")).not.toContainText("Ludlow");
  await expect(page.locator("#explore-list")).not.toContainText("Example business");
  await expect(page.locator("#filter-city")).toContainText("Los Angeles");
  await expect(page.locator("#filter-type")).toContainText("Video walk");
  await page.locator("#filter-city").selectOption("Los Angeles");
  await expect(page.locator("#explore-list .walk-card")).toHaveCount(2);
  await shot(page, "21-phone-844-all-pins.png");
});

test("desktop fullscreen button uses the Fullscreen API or a CSS fallback", async ({ page }) => {
  await openWalk(page);
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
  for (const size of sizes) {
    await page.setViewportSize(size);
    await openWalk(page);
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
  await openWalk(page);

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
  await goToWalk(page);
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

  await openWalk(page, "grove-kane-scan-splat");
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
  await expect(page.locator("#splat-root .player-shell")).toBeHidden();
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("The Grove");
  await expect(page.locator("#walk-handle")).toContainText("@la.walker");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("#videowalk-root .player-shell")).toBeHidden();
});


test("Grove video walk opens by default, hold-up walks, release stops, no black edges", async ({ page }) => {
  test.setTimeout(180000);
  await openWalk(page, "grove-kane-scan-splat");
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
  await openWalk(page, "farmers-kane-scan-splat");
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
    for (const id of ["grove-kane-scan-splat", "farmers-kane-scan-splat"]) {
      await openWalk(page, id);
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

  await page.setViewportSize(sizes[0]);
  await openWalk(page, "grove-kane-scan-splat");
  await page.evaluate(() => sessionStorage.removeItem("tg:look-hint-used"));

  for (const size of sizes) {
    await page.setViewportSize(size);
    if (size != sizes[0]) await openWalk(page, "grove-kane-scan-splat");
    await expect(page.locator("#videowalk-root [data-stick='look']")).toBeHidden();
    await expect(page.locator("#videowalk-root [data-stick='move']")).toBeVisible();
    await expect(page.locator("#videowalk-root [data-look-hint] .hint-phone")).toHaveText("Drag to look, hold stick to walk");
    assertInside(await measure(page, "#videowalk-root", { w: size.width, h: size.height }), `Grove ${size.width}x${size.height}`);
    await page.evaluate(() => window.__tgVideoWalk.close({ silent: true }));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await openWalk(page, "grove-kane-scan-splat");
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

  await openWalk(page, "farmers-kane-scan-splat");
  await expect(page.locator("#videowalk-root [data-stick='look']")).toBeHidden();
  assertInside(await measure(page, "#videowalk-root", { w: 390, h: 844 }), "Farmers 390x844");
  await page.evaluate(() => window.__tgVideoWalk.close({ silent: true }));
});

test("sign up validates fields and shows a preview-not-saved success", async ({ page }) => {
  await page.goto("/signup.html");
  await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Continue with Apple/i })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Continue with Google/i })).toContainText(/Coming soon/i);
  await page.getByRole("button", { name: "Create preview session" }).click();
  await expect(page.locator("#signup-email-error")).toContainText("Enter your email");
  await page.locator("#signup-email").fill("not-an-email");
  await page.locator("#signup-password").fill("short");
  await page.getByRole("button", { name: "Create preview session" }).click();
  await expect(page.locator("#signup-email-error")).toContainText("valid email");
  await expect(page.locator("#signup-password-error")).toContainText("8 characters");
  await page.locator("#signup-email").fill("preview@example.com");
  await page.locator("#signup-password").fill("password1");
  await page.getByRole("button", { name: "Create preview session" }).click();
  await expect(page.locator("#signup-success")).toBeVisible();
  await expect(page.locator("#signup-success")).toContainText("Preview: not saved");
  expect(await visibleKane(page)).toEqual([]);
  await shot(page, "30-signup-success.png");
});

test("upload flow previews a local file and ends as preview not saved", async ({ page }) => {
  test.setTimeout(120000);
  await page.goto("/upload.html");
  const video = require("path").join(__dirname, "..", "media", "sample-360.mp4");
  await page.locator("#upload-file").setInputFiles(video);
  await expect(page.locator("#upload-preview")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Use the Los Angeles walk area" }).click();
  await expect(page.locator("#upload-pin-label")).toContainText("Los Angeles");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#upload-title").fill("Morning market walk");
  await page.locator("#upload-desc").fill("A preview clip that stays on this device.");
  await page.locator("#upload-tags").fill("Los Angeles, market");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator("#consent-filmed").check();
  await page.locator("#consent-people").check();
  await page.locator("#consent-music").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.locator("#upload-review")).toContainText("Morning market walk");
  await expect(page.locator("#upload-review")).toContainText("not uploaded");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.locator("#upload-success")).toContainText("Submitted for review (preview, not saved)");
  await shot(page, "31-upload-success.png");
});

test("my walks shows empty and demo states", async ({ page }) => {
  await page.goto("/me.html");
  await page.evaluate(() => {
    localStorage.removeItem("tg:demo-session");
    localStorage.removeItem("tg:demo-walks");
  });
  await page.reload();
  await expect(page.getByText("No preview session in this browser yet.")).toBeVisible();
  await page.getByRole("button", { name: "Show a demo profile" }).click();
  await expect(page.locator("#profile-hello")).toContainText("preview session");
  await expect(page.locator("#profile-walks")).toContainText("Preview: not saved");
  await page.getByRole("button", { name: "Clear demo state in this browser" }).click();
  await expect(page.getByText("No preview session in this browser yet.")).toBeVisible();
});

test("retired creator and sales pages point to the new official flows", async ({ page }) => {
  await page.goto("/creator.html", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/upload\.html/);
  await expect(page.locator("h1")).toContainText("Share your walk");
  await page.goto("/sales.html", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/about\.html/);
  await expect(page.locator("h1")).toHaveText("About");
  await expect(page.locator(".draft-flag")).toHaveText("Draft");
});

test("robots.txt and pages are marked noindex", async ({ page, request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const body = await robots.text();
  expect(body).toMatch(/User-agent:\s*\*/i);
  expect(body).toMatch(/Disallow:\s*\//);
  const pages = [
    "/index.html",
    "/explore.html",
    "/walk.html?id=grove-kane-scan-splat",
    "/signup.html",
    "/login.html",
    "/upload.html",
    "/me.html",
    "/about.html",
    "/guidelines.html",
    "/privacy.html",
    "/terms.html",
    "/creator.html",
    "/sales.html",
    "/admin.html",
  ];
  for (const pathName of pages) {
    await page.goto(pathName);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
    const text = await page.locator("body").innerText();
    expect(text, pathName + " should not use the old site name").not.toContain("Walk of Fame Globe");
  }
});
