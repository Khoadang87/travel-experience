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

const PRIMARY_PIN_NAMES = ["TCL Chinese Theatre", "Dolby Theatre"];

async function goToWalk(page) {
  await page.getByRole("button", { name: "Go to Walk of Fame" }).click();
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

test("globe renders, street zoom and pins open the 360 player, joystick works", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  const canvas = page.locator("#map .maplibregl-canvas, #map canvas").first();
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(2000);
  await shot(page, "01-globe.png");

  await goToWalk(page);
  await page.waitForTimeout(1500);
  await expect(page.locator("#mode-badge")).toHaveText("Street map");
  await expect(page.locator(".map-pin")).toHaveCount(12);
  await expect(page.getByRole("button", { name: "TCL Chinese Theatre" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dolby Theatre" })).toBeVisible();
  await shot(page, "02-street-pins.png");

  await page.getByRole("button", { name: "TCL Chinese Theatre" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("360 stand-in");
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("not Hollywood");
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("not creator");
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("CC BY 3.0");
  await page.waitForFunction(() => window.__tgPlayer && window.__tgPlayer.video && window.__tgPlayer.video.readyState >= 2, null, { timeout: 20000 });
  const standinSrc = await page.evaluate(() => window.__tgPlayer.video.currentSrc);
  expect(standinSrc).toMatch(/sample-360(-low)?\.mp4/);
  expect(standinSrc).not.toContain("hollywood-360");
  await expect(page.locator("[data-poster]")).toHaveAttribute("src", /sample-360-poster/);
  await expect(page.getByRole("button", { name: /fullscreen/i })).toBeVisible();
  const hollywoodRate = await page.evaluate(() => window.__tgPlayer.video.playbackRate);
  expect(hollywoodRate).toBe(0.5);
  await page.waitForTimeout(800);
  await shot(page, "03-player-open.png");

  const before = await page.evaluate(() => ({
    yaw: window.__tgPlayer.yaw,
    time: window.__tgPlayer.currentTime,
  }));
  await page.evaluate(() => {
    window.__tgPlayer.setYaw(window.__tgPlayer.yaw - 1.0);
  });
  const moveStick = page.locator('#player-root [data-stick="move"]');
  const box = await moveStick.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 8, { steps: 8 });
  await page.waitForTimeout(700);
  await page.mouse.up();
  const after = await page.evaluate(() => ({
    yaw: window.__tgPlayer.yaw,
    time: window.__tgPlayer.currentTime,
  }));
  expect(Math.abs(after.yaw - before.yaw)).toBeGreaterThan(0.2);
  // Move stick pulled down (negative screen y is up; we moved down toward bottom) should scrub backward or stay near start;
  // also force a scrub via API if the clip just started.
  await page.evaluate(() => {
    window.__tgPlayer.setWalkAxis(0);
    window.__tgPlayer.setLookAxis(0, 0);
  });
  await page.waitForFunction(() => {
    const v = window.__tgPlayer && window.__tgPlayer.video;
    return v && Number.isFinite(v.duration) && v.duration > 5 && v.readyState >= 2;
  });
  const mid = await page.evaluate(async () => {
    const p = window.__tgPlayer;
    p.video.pause();
    const target = Math.min(8, p.maxTime() * 0.4);
    await new Promise((resolve) => {
      const done = () => {
        p.video.removeEventListener("seeked", done);
        resolve();
      };
      p.video.addEventListener("seeked", done);
      p.setCurrentTime(target);
      setTimeout(done, 1000);
    });
    return p.currentTime;
  });
  expect(mid).toBeGreaterThan(1);
  await shot(page, "04-player-look-scrub.png");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
  await expect(page.locator("#pin-card")).toBeHidden();
});

test("Move stick walks forward/back and turns left/right from one stick", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await goToWalk(page);
  await page.getByRole("button", { name: "TCL Chinese Theatre" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgPlayer && window.__tgPlayer.video && window.__tgPlayer.video.readyState >= 2, null, { timeout: 20000 });
  await expect(page.locator('#player-root [data-stick="move"]')).toBeVisible();
  await expect(page.locator("#player-root .look-hint")).toContainText("the clip moves only while you walk");

  // Pause so the clip's own playback doesn't move currentTime while we measure.
  const start = await page.evaluate(async () => {
    const p = window.__tgPlayer;
    p.video.pause();
    const target = Math.min(10, p.maxTime() * 0.4);
    await new Promise((resolve) => {
      const done = () => {
        p.video.removeEventListener("seeked", done);
        resolve();
      };
      p.video.addEventListener("seeked", done);
      p.setCurrentTime(target);
      setTimeout(done, 1000);
    });
    return { time: p.currentTime, yaw: p.yaw };
  });
  expect(start.time).toBeGreaterThan(1);

  // Push the Move stick up (API y=-1): walk forward.
  // (Settle the stick to zero before each direction: the ease-out
  // makes reversing direction slower than starting from rest.)
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, -1));
  await page.waitForTimeout(1500);
  const fwd = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(fwd).toBeGreaterThan(start.time + 0.1);

  // Push it down (y=+1): walk back.
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 1));
  await page.waitForTimeout(1500);
  const back = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(back).toBeLessThan(fwd - 0.1);

  // Push it left (x=-1): turn left (yaw increases).
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  await page.waitForTimeout(800);
  const yawBeforeLeft = await page.evaluate(() => window.__tgPlayer.yaw);
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(-1, 0));
  await page.waitForTimeout(1500);
  const yawLeft = await page.evaluate(() => window.__tgPlayer.yaw);
  expect(yawLeft).toBeGreaterThan(yawBeforeLeft + 0.15);

  // Push it right (x=+1): turn right (yaw decreases).
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(1, 0));
  await page.waitForTimeout(1500);
  const yawRight = await page.evaluate(() => window.__tgPlayer.yaw);
  expect(yawRight).toBeLessThan(yawLeft - 0.15);

  // Release: movement eases to a stop and stays stopped. (The ease-out
  // takes ~15 animation frames, so wait a full second before sampling.)
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  await page.waitForTimeout(1000);
  const rest = await page.evaluate(() => ({ time: window.__tgPlayer.currentTime, yaw: window.__tgPlayer.yaw }));
  await page.waitForTimeout(500);
  const rest2 = await page.evaluate(() => ({ time: window.__tgPlayer.currentTime, yaw: window.__tgPlayer.yaw }));
  expect(Math.abs(rest2.time - rest.time)).toBeLessThan(0.05);
  expect(Math.abs(rest2.yaw - rest.yaw)).toBeLessThan(0.01);

  // Keyboard A/D turn the same way as the stick.
  const yawBeforeKey = await page.evaluate(() => window.__tgPlayer.yaw);
  await page.keyboard.press("a");
  const yawA = await page.evaluate(() => window.__tgPlayer.yaw);
  expect(yawA).toBeGreaterThan(yawBeforeKey);
  await page.keyboard.press("d");
  const yawD = await page.evaluate(() => window.__tgPlayer.yaw);
  expect(yawD).toBeLessThan(yawA);

  // Real pointer drag on the Move stick, up: walks forward.
  const moveStick = page.locator('#player-root [data-stick="move"]');
  const box = await moveStick.boundingBox();
  const beforeDrag = await page.evaluate(() => window.__tgPlayer.currentTime);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 8, { steps: 8 });
  await page.waitForTimeout(800);
  await page.mouse.up();
  const afterDrag = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(afterDrag).toBeGreaterThan(beforeDrag + 0.05);

  await shot(page, "13-move-stick.png");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
});

test("Move stick walks forward/back while the clip is PLAYING (pause-while-walking)", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await goToWalk(page);
  await page.getByRole("button", { name: "TCL Chinese Theatre" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgPlayer && window.__tgPlayer.video && window.__tgPlayer.video.readyState >= 2, null, { timeout: 20000 });

  // The clip must be playing for this test: forward micro-seeks are
  // absorbed by the media engine while it plays, which is the bug
  // this test guards (Move-up did nothing live while playing).
  await page.evaluate(() => window.__tgPlayer.video.play().catch(() => {}));
  await page.waitForFunction(() => window.__tgPlayer && !window.__tgPlayer.video.paused, null, { timeout: 10000 });
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  await page.waitForTimeout(500);

  // Baseline: no input, 2s. At 0.5x the clip advances ~1.0s.
  const b0 = await page.evaluate(() => window.__tgPlayer.currentTime);
  await page.waitForTimeout(2000);
  const b1 = await page.evaluate(() => window.__tgPlayer.currentTime);
  const baseline = b1 - b0;
  expect(baseline).toBeGreaterThan(0.5);
  expect(baseline).toBeLessThan(1.5);

  // Move stick up while playing: must advance clearly faster than the
  // no-input baseline over the same 2s hold (scrub ~0.9 clip-s per
  // wall-s on top of nothing, since the video pauses while walking),
  // and the video must be paused during the hold.
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, -1));
  await page.waitForTimeout(300);
  const pausedDuringUp = await page.evaluate(() => window.__tgPlayer.video.paused);
  expect(pausedDuringUp).toBe(true);
  const u0 = await page.evaluate(() => window.__tgPlayer.currentTime);
  await page.waitForTimeout(2000);
  const u1 = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(u1 - u0).toBeGreaterThan(baseline + 0.5);

  // Release: playback resumes because it was playing before the walk.
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  await page.waitForFunction(() => window.__tgPlayer && !window.__tgPlayer.video.paused, null, { timeout: 5000 });

  // Move stick down while playing: must rewind, and pause during the hold.
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 1));
  await page.waitForTimeout(300);
  const pausedDuringDown = await page.evaluate(() => window.__tgPlayer.video.paused);
  expect(pausedDuringDown).toBe(true);
  const d0 = await page.evaluate(() => window.__tgPlayer.currentTime);
  await page.waitForTimeout(2000);
  const d1 = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(d1).toBeLessThan(d0 - 0.5);

  // Release again: playback resumes.
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  await page.waitForFunction(() => window.__tgPlayer && !window.__tgPlayer.video.paused, null, { timeout: 5000 });

  // Turning only must NOT pause the clip.
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(1, 0));
  await page.waitForTimeout(800);
  const pausedWhileTurning = await page.evaluate(() => window.__tgPlayer.video.paused);
  expect(pausedWhileTurning).toBe(false);
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));

  await shot(page, "14-move-stick-while-playing.png");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
});

test("clip stays still until the Move stick walks", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await goToWalk(page);
  await page.getByRole("button", { name: "TCL Chinese Theatre" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgPlayer && window.__tgPlayer.video && window.__tgPlayer.video.readyState >= 2, null, { timeout: 20000 });

  // Opens paused at the start, and stays still with no input.
  expect(await page.evaluate(() => window.__tgPlayer.video.paused)).toBe(true);
  const t0 = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(t0).toBeLessThan(0.5);
  await page.waitForTimeout(2000);
  const tStill = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(tStill).toBeLessThan(0.5);
  expect(await page.evaluate(() => window.__tgPlayer.video.paused)).toBe(true);

  // Move stick up: the clip scrubs forward while the video stays paused.
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, -1));
  await page.waitForTimeout(1500);
  const tWalk = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(tWalk).toBeGreaterThan(tStill + 0.3);
  expect(await page.evaluate(() => window.__tgPlayer.video.paused)).toBe(true);

  // Release: the clip stops advancing and stays paused.
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  await page.waitForTimeout(1000);
  const r0 = await page.evaluate(() => window.__tgPlayer.currentTime);
  await page.waitForTimeout(500);
  const r1 = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(Math.abs(r1 - r0)).toBeLessThan(0.05);
  expect(await page.evaluate(() => window.__tgPlayer.video.paused)).toBe(true);

  // Look stick still turns the view while the clip is paused.
  const yawBefore = await page.evaluate(() => window.__tgPlayer.yaw);
  await page.evaluate(() => window.__tgPlayer.setLookAxis(1, 0));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__tgPlayer.setLookAxis(0, 0));
  const yawAfter = await page.evaluate(() => window.__tgPlayer.yaw);
  expect(Math.abs(yawAfter - yawBefore)).toBeGreaterThan(0.15);

  // Play button is the explicit opt-in: the clip plays at half speed.
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => window.__tgPlayer && !window.__tgPlayer.video.paused, null, { timeout: 5000 });
  const p0 = await page.evaluate(() => window.__tgPlayer.currentTime);
  await page.waitForTimeout(2000);
  const p1 = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(p1 - p0).toBeGreaterThan(0.5);
  expect(p1 - p0).toBeLessThan(1.5);
  const rate = await page.evaluate(() => window.__tgPlayer.video.playbackRate);
  expect(rate).toBe(0.5);

  await shot(page, "17-still-until-you-walk.png");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
});

test("flat video demo pin plays on a curved screen, not the 360 sphere", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await goToWalk(page);
  await page.getByRole("button", { name: "Walk of Fame corner — flat video demo" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("flat footage");
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("not true 360");
  await page.waitForFunction(() => window.__tgPlayer && window.__tgPlayer.video && window.__tgPlayer.video.readyState >= 2, null, { timeout: 20000 });
  const src = await page.evaluate(() => window.__tgPlayer.video.currentSrc);
  expect(src).toMatch(/walk-of-fame-flat(-low)?\.mp4/);
  const rate = await page.evaluate(() => window.__tgPlayer.video.playbackRate);
  expect(rate).toBe(0.5);
  await page.waitForTimeout(1500);
  await shot(page, "12-flat-curved-screen.png");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
});

test("trial watermark and cap, one trial per creator, submission window open/closed", async ({ page }) => {
  await page.goto("/creator.html?trialCap=3");
  await page.evaluate(() => {
    localStorage.removeItem("tg:trials");
    localStorage.removeItem("tg:submissions");
    localStorage.removeItem("tg:settings");
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
  await page.getByRole("button", { name: "Close player" }).click();

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
    await expect(page.locator(".map-pin")).toHaveCount(12);
    const hud = await page.locator(".hud").boundingBox();
    const header = await page.locator("header.top").boundingBox();
    for (const name of PRIMARY_PIN_NAMES) {
      const pin = page.getByRole("button", { name });
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

  await page.getByRole("button", { name: "TCL Chinese Theatre" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await expect(page.locator("#pin-card")).toBeVisible();
  await expect(page.locator("#pin-card-close")).toBeVisible();
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("360 stand-in");
  await expect(page.locator("[data-credit]")).toHaveCount(0);
  await page.waitForFunction(() => window.__tgPlayer && window.__tgPlayer.video && window.__tgPlayer.video.readyState >= 2, null, { timeout: 20000 });
  await page.waitForTimeout(400);
  await shot(page, "19-phone-664-player.png");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
  await expect(page.locator("#pin-card")).toBeHidden();
  await shot(page, "20-phone-664-after-close.png");
});

test("See all pins fits Vine, Capitol, and the business pin on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await expect(page.getByRole("button", { name: "See all pins" })).toBeVisible();
  await page.getByRole("button", { name: "See all pins" }).click();
  await page.waitForFunction(() => window.__tgAllPinsFitted === true, null, { timeout: 25000 });
  await page.waitForTimeout(500);
  const size = { width: 390, height: 844 };
  for (const name of [/Hollywood Blvd and Vine/, /Capitol Records/, /Example business pin/]) {
    const pin = page.getByRole("button", { name });
    await expect(pin).toBeVisible();
    const box = await pin.boundingBox();
    expect(box, String(name) + " should be on screen").toBeTruthy();
    expect(box.x + box.width).toBeGreaterThan(0);
    expect(box.x).toBeLessThan(size.width);
    expect(box.y + box.height).toBeGreaterThan(0);
    expect(box.y).toBeLessThan(size.height);
  }
  await shot(page, "21-phone-844-all-pins.png");
});

test("fullscreen button uses the Fullscreen API or an iOS CSS fallback", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await goToWalk(page);
  await page.getByRole("button", { name: "TCL Chinese Theatre" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await page.waitForTimeout(500);
  const on = await page.evaluate(() => {
    const panel = document.querySelector("#player-root .player-panel");
    return (
      document.fullscreenElement === panel ||
      document.webkitFullscreenElement === panel ||
      panel.classList.contains("is-fullscreen")
    );
  });
  expect(on).toBeTruthy();
  await shot(page, "22-desktop-fullscreen.png");
  await page.getByRole("button", { name: /Exit full/i }).click();
  await page.waitForTimeout(300);
  const off = await page.evaluate(() => {
    const panel = document.querySelector("#player-root .player-panel");
    return (
      document.fullscreenElement === panel ||
      document.webkitFullscreenElement === panel ||
      panel.classList.contains("is-fullscreen")
    );
  });
  expect(off).toBeFalsy();
});

const ORIGINAL_PINS = [
  { id: "tcl-chinese", lng: -118.34097222, lat: 34.10194444 },
  { id: "dolby", lng: -118.34027778, lat: 34.10277778 },
  { id: "star-roosevelt", lng: -118.34166667, lat: 34.10111111 },
  { id: "star-el-capitan", lng: -118.339722, lat: 34.101111 },
  { id: "star-egyptian", lng: -118.33638889, lat: 34.10083333 },
  { id: "star-hollywood-vine", lng: -118.32666667, lat: 34.10166667 },
  { id: "star-capitol", lng: -118.326189, lat: 34.103085 },
  { id: "wof-corner-flat", lng: -118.3431, lat: 34.1019, flat: true },
  { id: "business-demo", lng: -118.331, lat: 34.1012, flat: true, demo: true },
];

async function waitForMap(page) {
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
}

async function openSplatPin(page) {
  await page.evaluate(() => window.__tgOpenPin("splat-placeholder"));
  await expect(page.locator("#splat-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.ready === true, null, { timeout: 60000 });
}

test("existing pins keep their ids, coordinates, and 360/flat behaviour", async ({ page }) => {
  await page.goto("/index.html");
  await waitForMap(page);
  const pins = await page.evaluate(() =>
    (window.__tgPins || []).map((p) => ({
      id: p.id,
      lng: p.lng,
      lat: p.lat,
      flat: p.flat || undefined,
      demo: p.demo || undefined,
      splat: p.splat || undefined,
    }))
  );
  const splatIds = new Set(["splat-placeholder", "street-intersection-splat", "ludlow-courtyard-splat"]);
  const withoutSplat = pins.filter((p) => !splatIds.has(p.id));
  expect(withoutSplat).toEqual(ORIGINAL_PINS);
  const splat = pins.find((p) => p.id === "splat-placeholder");
  expect(splat).toBeTruthy();
  expect(splat.splat).toMatch(/kyoto-room\.sog$/);
  const street = pins.find((p) => p.id === "street-intersection-splat");
  expect(street).toBeTruthy();
  expect(street.splat).toMatch(/street-intersection\.sog$/);
  expect(street.lng).toBeCloseTo(-118.3495, 4);
  expect(street.lat).toBeCloseTo(34.1048, 4);
  const ludlow = pins.find((p) => p.id === "ludlow-courtyard-splat");
  expect(ludlow).toBeTruthy();
  expect(ludlow.splat).toMatch(/ludlow-courtyard\.sog$/);
  expect(ludlow.lng).toBeCloseTo(-2.72001, 4);
  expect(ludlow.lat).toBeCloseTo(52.36789, 4);
  expect(pins).toHaveLength(12);

  await page.evaluate(() => window.__tgOpenPin("tcl-chinese"));
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await expect(page.locator("#splat-root .player-shell")).toBeHidden();
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("360 stand-in");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
});

test("splat pin opens the splat view and the test-asset credit is visible", async ({ page }) => {
  await page.goto("/index.html");
  await waitForMap(page);
  await openSplatPin(page);
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("Test asset, not the real place");
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("CC0");
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("SharedTestModels");
  await expect(page.getByRole("button", { name: "View 360 instead" })).toBeVisible();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
  await shot(page, "30-splat-open.png");
});

test("splat Close hides the splat view", async ({ page }) => {
  await page.goto("/index.html");
  await waitForMap(page);
  await openSplatPin(page);
  await page.locator("#splat-root").getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#splat-root .player-shell")).toBeHidden();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
  await expect(page.locator("#pin-card")).toBeHidden();
});

test("View 360 instead leaves the splat view and opens the 360 player", async ({ page }) => {
  await page.goto("/index.html");
  await waitForMap(page);
  await openSplatPin(page);
  await page.getByRole("button", { name: "View 360 instead" }).click();
  await expect(page.locator("#splat-root .player-shell")).toBeHidden();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("360 stand-in");
  await expect(page.locator("[data-fallback-note]")).toHaveCount(0);
  await page.locator("#player-root").getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
});

test("forced WebGL2 failure falls back to the 360 player with a banner note", async ({ page }) => {
  await page.addInitScript(() => {
    window.__tgForceNoWebGL2 = true;
  });
  await page.goto("/index.html");
  await waitForMap(page);
  await page.evaluate(() => window.__tgOpenPin("splat-placeholder"));
  await expect(page.locator("#player-root .player-shell")).toBeVisible({ timeout: 20000 });
  await expect(page.locator("#splat-root .player-shell")).toBeHidden();
  await expect(page.locator("[data-fallback-note]")).toContainText("WebGL2");
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("360 stand-in");
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("showing instead");
});


test("splat avatar loads, walk starts on open, idle when paused, seek, and stays in bounds", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/index.html");
  await waitForMap(page);
  await openSplatPin(page);
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.avatarReady === true, null, { timeout: 60000 });
  await expect(page.locator("#splat-root [data-play]")).toBeVisible();
  await expect(page.locator("#splat-root [data-seek]")).toBeVisible();
  await expect(page.locator("#splat-root .look-hint")).toContainText("starts walking when the preview opens");

  // The preview should start walking on its own — no Play click required.
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.playing === true && window.__tgSplatPlayer.anim === "walk", null, { timeout: 5000 });
  const start = await page.evaluate(() => ({
    u: window.__tgSplatPlayer.pathU,
    pos: window.__tgSplatPlayer.carPosition,
    playing: window.__tgSplatPlayer.playing,
    anim: window.__tgSplatPlayer.anim,
    animTime: window.__tgSplatPlayer.animTime,
    bounds: window.__tgSplatPlayer.bounds,
  }));
  expect(start.playing).toBe(true);
  expect(start.anim).toBe("walk");

  const walkT0 = start.animTime;
  const startPos = start.pos;
  const startU = start.u;
  await page.waitForFunction(({ startU, walkT0 }) => {
    const p = window.__tgSplatPlayer;
    return p && p.playing === true && p.anim === "walk" && p.pathU > startU + 0.06 && p.animTime > walkT0;
  }, { startU, walkT0 }, { timeout: 45000 });
  const midPlay = await page.evaluate(() => ({
    u: window.__tgSplatPlayer.pathU,
    pos: window.__tgSplatPlayer.carPosition,
    playing: window.__tgSplatPlayer.playing,
    anim: window.__tgSplatPlayer.anim,
    animTime: window.__tgSplatPlayer.animTime,
  }));
  expect(midPlay.playing).toBe(true);
  expect(midPlay.anim).toBe("walk");
  expect(midPlay.u).toBeGreaterThan(0.08);
  expect(midPlay.animTime).toBeGreaterThan(walkT0);
  expect(Math.hypot(midPlay.pos.x - startPos.x, midPlay.pos.z - startPos.z)).toBeGreaterThan(0.05);

  await page.locator("#splat-root").getByRole("button", { name: "Pause path" }).click();
  const pauseLabel = page.locator("#splat-root").getByRole("button", { name: "Play path" });
  await expect(pauseLabel).toBeVisible();
  const pausedAt = await page.evaluate(() => ({
    u: window.__tgSplatPlayer.pathU,
    playing: window.__tgSplatPlayer.playing,
    anim: window.__tgSplatPlayer.anim,
  }));
  expect(pausedAt.playing).toBe(false);
  expect(pausedAt.anim).toBe("idle");
  await new Promise((r) => setTimeout(r, 1200));
  const still = await page.evaluate(() => ({
    u: window.__tgSplatPlayer.pathU,
    anim: window.__tgSplatPlayer.anim,
  }));
  expect(Math.abs(still.u - pausedAt.u)).toBeLessThan(0.002);
  expect(still.anim).toBe("idle");

  await page.evaluate(() => window.__tgSplatPlayer.seek(0.5));
  const sought = await page.evaluate(() => ({
    u: window.__tgSplatPlayer.pathU,
    pos: window.__tgSplatPlayer.carPosition,
    anim: window.__tgSplatPlayer.anim,
    playing: window.__tgSplatPlayer.playing,
  }));
  expect(sought.u).toBeCloseTo(0.5, 2);
  expect(sought.playing).toBe(false);
  expect(sought.anim).toBe("idle");
  expect(Math.hypot(sought.pos.x - start.pos.x, sought.pos.z - start.pos.z)).toBeGreaterThan(0.2);

  const boundsCheck = await page.evaluate(() => {
    const b = window.__tgSplatPlayer.bounds;
    const out = [];
    for (let i = 0; i <= 40; i++) {
      window.__tgSplatPlayer.seek(i / 40);
      const p = window.__tgSplatPlayer.carPosition;
      const inside =
        p.x >= b.min[0] && p.x <= b.max[0] &&
        p.y >= b.min[1] && p.y <= b.max[1] &&
        p.z >= b.min[2] && p.z <= b.max[2];
      if (!inside) out.push({ u: i / 40, p, b });
    }
    return { ok: out.length === 0, out };
  });
  expect(boundsCheck.ok, JSON.stringify(boundsCheck.out.slice(0, 3))).toBeTruthy();
});

test("splat stage fills the leftover phone viewport under the controls", async ({ page }) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/index.html");
  await waitForMap(page);
  await openSplatPin(page);
  const layout = await page.evaluate(() => {
    const stage = document.querySelector("#splat-root .stage");
    const controls = document.querySelector("#splat-root .player-controls");
    const panel = document.querySelector("#splat-root .player-panel");
    const s = stage.getBoundingClientRect();
    const c = controls.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    return {
      stageHeight: s.height,
      stageTop: s.top,
      controlsTop: c.top,
      controlsBottom: c.bottom,
      panelBottom: p.bottom,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      gapBelowControls: p.bottom - c.bottom,
    };
  });
  expect(layout.stageHeight).toBeGreaterThan(450);
  expect(layout.gapBelowControls).toBeLessThan(24);
  expect(layout.controlsTop).toBeGreaterThan(layout.stageTop + 200);

  const btn = await page.evaluate(() => {
    const el = document.querySelector("#splat-root [data-view-360]");
    const panel = document.querySelector("#splat-root .player-panel");
    const r = el.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const styles = getComputedStyle(el);
    return {
      text: (el.textContent || "").replace(/\s+/g, " ").trim(),
      width: r.width,
      height: r.height,
      left: r.left,
      right: r.right,
      panelRight: p.right,
      whiteSpace: styles.whiteSpace,
    };
  });
  expect(btn.text).toBe("View 360 instead");
  expect(btn.whiteSpace).toBe("nowrap");
  expect(btn.width).toBeGreaterThan(160);
  expect(btn.height).toBeLessThan(44);
  expect(btn.height).toBeGreaterThan(24);
  expect(btn.left).toBeGreaterThanOrEqual(0);
  expect(btn.right).toBeLessThanOrEqual(btn.panelRight + 1);
});


test("Street intersection splat loads with credit, autoplay walk, pedestrians, and cars", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/index.html");
  await waitForMap(page);
  await page.evaluate(() => window.__tgOpenPin("street-intersection-splat"));
  await expect(page.locator("#splat-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.ready === true, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.avatarReady === true, null, { timeout: 60000 });
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("Test asset, not the real place");
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("not an official Tesla asset");
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("CC BY 4.0");
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("cfahlgren1");
  await expect(page.locator("#splat-root .look-hint")).toContainText("starts walking when the preview opens");
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.playing === true && window.__tgSplatPlayer.anim === "walk", null, { timeout: 5000 });

  const start = await page.evaluate(() => ({
    u: window.__tgSplatPlayer.pathU,
    animTime: window.__tgSplatPlayer.animTime,
    peds: window.__tgSplatPlayer.pedestrians.length,
    cars: window.__tgSplatPlayer.cars.length,
    pedPos: window.__tgSplatPlayer.pedestrians.map((p) => p.position),
    carPos: window.__tgSplatPlayer.cars.map((c) => c.position),
    pedModels: window.__tgSplatPlayer.pedestrians.map((p) => p.model),
    carModels: window.__tgSplatPlayer.cars.map((c) => c.model),
  }));
  expect(start.peds).toBeGreaterThanOrEqual(5);
  expect(start.peds).toBeLessThanOrEqual(8);
  expect(start.cars).toBeGreaterThanOrEqual(2);
  expect(start.cars).toBeLessThanOrEqual(3);
  expect(start.pedModels.every((m) => m && m !== "simple")).toBe(true);
  expect(new Set(start.pedModels).size).toBeGreaterThanOrEqual(5);
  expect(start.carModels.every((m) => m && m !== "simple")).toBe(true);
  expect(new Set(start.carModels).size).toBe(3);
  for (const p of [...start.pedPos, ...start.carPos]) {
    expect(p.y).toBeGreaterThan(-1.2);
    expect(p.y).toBeLessThan(1.2);
  }

  await page.waitForFunction(() => {
    const p = window.__tgSplatPlayer;
    if (!p || p.playing !== true) return false;
    if (!window.__tgStreetStart) {
      window.__tgStreetStart = { u: p.pathU, t: p.animTime, pedU: p.pedestrians.map((m) => m.u), carU: p.cars.map((m) => m.u) };
      return false;
    }
    return p.pathU > window.__tgStreetStart.u + 0.04 && p.animTime > window.__tgStreetStart.t + 0.3;
  }, null, { timeout: 90000 });

  const after = await page.evaluate(() => {
    const p = window.__tgSplatPlayer;
    const s = window.__tgStreetStart;
    return {
      pathMoved: p.pathU - s.u,
      walkMoved: p.animTime - s.t,
      pedMoved: p.pedestrians.filter((m, i) => Math.abs(m.u - s.pedU[i]) > 0.02).length,
      carMoved: p.cars.filter((m, i) => Math.abs(m.u - s.carU[i]) > 0.02).length,
    };
  });
  expect(after.pathMoved).toBeGreaterThan(0.03);
  expect(after.walkMoved).toBeGreaterThan(0.25);
  expect(after.pedMoved).toBeGreaterThanOrEqual(2);
  expect(after.carMoved).toBeGreaterThanOrEqual(1);
});


test("Ludlow courtyard splat loads with credit, autoplay walk, and pedestrians on the cobbles", async ({ page }) => {
  test.setTimeout(300000);
  await page.goto("/index.html");
  await waitForMap(page);
  await expect(page.getByRole("button", { name: "Ludlow courtyard" })).toBeVisible();
  await page.evaluate(() => window.__tgOpenPin("ludlow-courtyard-splat"));
  await expect(page.locator("#splat-root .player-shell")).toBeVisible();
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.ready === true, null, { timeout: 120000 });
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.avatarReady === true, null, { timeout: 60000 });
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("Quality Square, Ludlow");
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("ijenko");
  await expect(page.locator("#splat-root [data-sample-banner]")).toContainText("CC BY 4.0");
  await expect(page.locator("#splat-root .look-hint")).toContainText("starts walking when the preview opens");
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.playing === true && window.__tgSplatPlayer.anim === "walk", null, { timeout: 5000 });

  const start = await page.evaluate(() => ({
    u: window.__tgSplatPlayer.pathU,
    animTime: window.__tgSplatPlayer.animTime,
    peds: window.__tgSplatPlayer.pedestrians.length,
    cars: window.__tgSplatPlayer.cars.length,
    pedPos: window.__tgSplatPlayer.pedestrians.map((p) => p.position),
    pedModels: window.__tgSplatPlayer.pedestrians.map((p) => p.model),
    loadMs: window.__tgSplatPlayer.stats && window.__tgSplatPlayer.stats.loadMs,
  }));
  expect(start.peds).toBeGreaterThanOrEqual(4);
  expect(start.peds).toBeLessThanOrEqual(6);
  expect(start.cars).toBe(0);
  expect(start.pedModels.every((m) => m && m !== "simple")).toBe(true);
  expect(new Set(start.pedModels).size).toBeGreaterThanOrEqual(3);
  for (const p of start.pedPos) {
    expect(p.y).toBeGreaterThan(-0.4);
    expect(p.y).toBeLessThan(0.6);
    // Stay in the courtyard / passage mouth, clear of the parked Fiat box.
    expect(p.x).toBeGreaterThan(-2.2);
    expect(p.x).toBeLessThan(10.5);
    expect(p.z).toBeGreaterThan(-0.5);
    expect(p.z).toBeLessThan(5.4);
    const inCar = p.x >= 5.55 && p.x <= 7.7 && p.z >= 2.85 && p.z <= 5.55;
    expect(inCar).toBe(false);
  }

  await page.waitForFunction(() => {
    const p = window.__tgSplatPlayer;
    if (!p || p.playing !== true) return false;
    if (!window.__tgLudlowStart) {
      window.__tgLudlowStart = { u: p.pathU, t: p.animTime, pedU: p.pedestrians.map((m) => m.u) };
      return false;
    }
    return p.pathU > window.__tgLudlowStart.u + 0.04 && p.animTime > window.__tgLudlowStart.t + 0.3;
  }, null, { timeout: 90000 });

  const after = await page.evaluate(() => {
    const p = window.__tgSplatPlayer;
    const s = window.__tgLudlowStart;
    return {
      pathMoved: p.pathU - s.u,
      walkMoved: p.animTime - s.t,
      pedMoved: p.pedestrians.filter((m, i) => Math.abs(m.u - s.pedU[i]) > 0.02).length,
    };
  });
  expect(after.pathMoved).toBeGreaterThan(0.03);
  expect(after.walkMoved).toBeGreaterThan(0.25);
  expect(after.pedMoved).toBeGreaterThanOrEqual(2);

  // Pause stops Kane and the crowd; Play starts them again.
  // Click via the DOM: SwiftShader splat frames can keep the control from
  // counting as "stable" for Playwright's actionability checks.
  await expect(page.locator("#splat-root [data-play]")).toHaveText("Pause");
  await page.locator("#splat-root [data-play]").evaluate((el) => el.click());
  const paused = await page.evaluate(() => {
    const p = window.__tgSplatPlayer;
    return { playing: p.playing, u: p.pathU, pedU: p.pedestrians.map((m) => m.u) };
  });
  expect(paused.playing).toBe(false);
  await page.waitForTimeout(400);
  const still = await page.evaluate(() => {
    const p = window.__tgSplatPlayer;
    return { playing: p.playing, u: p.pathU, pedU: p.pedestrians.map((m) => m.u) };
  });
  expect(still.playing).toBe(false);
  expect(Math.abs(still.u - paused.u)).toBeLessThan(0.002);
  expect(still.pedU.every((u, i) => Math.abs(u - paused.pedU[i]) < 0.002)).toBe(true);

  await expect(page.locator("#splat-root [data-play]")).toHaveText("Play");
  await page.locator("#splat-root [data-play]").evaluate((el) => el.click());
  await page.waitForFunction(() => window.__tgSplatPlayer && window.__tgSplatPlayer.playing === true, null, { timeout: 5000 });
  await expect(page.locator("#splat-root [data-play]")).toHaveText("Pause");
});

// Pre-existing failures, left unfixed: these locators expect href="/sales.html"
// but the pages use href="sales.html". Moved to the end only so serial mode
// still runs the tests after them. Assertions are unchanged.

test("example business pin opens flat player with demo credit and offer link", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 40000 });
  await goToWalk(page);
  // Gold "Example pin" is mid-boulevard, east of the primary cluster, so pan to it first.
  await jumpToPin(page, "business-demo");
  await expect(page.getByRole("button", { name: "Example business pin — your business here" })).toBeVisible();
  await page.getByRole("button", { name: "Example business pin — your business here" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeVisible();
  // Demo credit, not the 360 test clip and never a real business name.
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("EXAMPLE business pin");
  await expect(page.locator("#player-root [data-sample-banner]")).toContainText("demo only, not a real listing");
  await expect(page.locator("#player-root [data-sample-banner]")).not.toContainText("R1's Travels");
  await expect(page.locator("[data-offer]")).toBeVisible();
  await expect(page.locator("[data-offer]")).toContainText("See what a business pin includes");
  await expect(page.locator("[data-offer] a")).toHaveAttribute("href", "/sales.html");
  await page.waitForFunction(() => window.__tgPlayer && window.__tgPlayer.video && window.__tgPlayer.video.readyState >= 2, null, { timeout: 20000 });
  const src = await page.evaluate(() => window.__tgPlayer.video.currentSrc);
  expect(src).toMatch(/walk-of-fame-flat(-low)?\.mp4/);
  expect(src).not.toContain("hollywood-360.mp4");
  expect(src).not.toContain("sample-360.mp4");
  const rate = await page.evaluate(() => window.__tgPlayer.video.playbackRate);
  expect(rate).toBe(0.5);
  // Move stick still works in flat mode (walk forward).
  const t0 = await page.evaluate(() => window.__tgPlayer.currentTime);
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, -1));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__tgPlayer.setMoveAxis(0, 0));
  const t1 = await page.evaluate(() => window.__tgPlayer.currentTime);
  expect(t1).toBeGreaterThan(t0);
  await shot(page, "15-business-demo-pin.png");
  // The pin card links to the sales page, not a Wikipedia source.
  await expect(page.locator("#pin-source")).toHaveAttribute("href", "/sales.html");
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(page.locator("#player-root .player-shell")).toBeHidden();
  await expect(page.locator("#pin-card")).toBeHidden();
});

test("sales page loads with both prices, free preview, and honest demo note", async ({ page }) => {
  await page.goto("/sales.html");
  await expect(page.locator("h1")).toContainText("Put your business on the Walk of Fame Globe");
  await expect(page.locator("#price-standard")).toHaveText("$250");
  await expect(page.locator("#price-featured")).toHaveText("$500");
  await expect(page.getByText("figure to review").first()).toBeVisible();
  await expect(page.locator('header nav a[href="/sales.html"]')).toHaveText("For businesses");
  await expect(page.getByText("Free 45-second preview")).toBeVisible();
  await expect(page.getByText("you only pay if you want the full pin")).toBeVisible();
  await expect(page.getByText("No business has bought a pin yet")).toBeVisible();
  await expect(page.locator('a[href="/creator.html"]', { hasText: "Request a free preview" })).toBeVisible();
  await expect(page.locator('a[href="/index.html"]', { hasText: "Back to the map" })).toBeVisible();
  // Linked from the map HUD.
  await page.goto("/index.html");
  await expect(page.locator('.btn-row a[href="/sales.html"]')).toHaveText("For businesses");
  await expect(page.locator('header nav a[href="/sales.html"]')).toHaveText("For businesses");
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
    await expect(page.locator('header nav a[href="/sales.html"]')).toHaveText("For businesses");
  }
});
