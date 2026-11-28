// Short LAX wider-view preview: shares the Tom Bradley circle, loops, wider look.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const shots = path.join(__dirname, "..", "shots");
fs.mkdirSync(shots, { recursive: true });
async function shot(page, name) {
  await page.screenshot({ path: path.join(shots, name), fullPage: false });
}

const WIDE = "lax-bradley-wide-preview";
const FULL = "lax-bradley-walk";
const WIDE_NAME = "Tom Bradley International Terminal, LAX — wider view (AI preview)";
const FULL_NAME = "Tom Bradley International Terminal, LAX";
const BADGE = "Edges extended with AI";

async function openWalk(page, id) {
  await page.goto("/walk.html?id=" + id);
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, null, { timeout: 120000 });
}

test.describe.configure({ mode: "serial" });

test("the wider-view preview shares the LAX circle as a grouped card", async ({ page }) => {
  await page.goto("/explore.html");
  await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__tgMap.jumpTo({ center: [-118.4081, 33.9439], zoom: 16.4, pitch: 0, bearing: 0 });
  });
  await page.waitForTimeout(800);
  const fullDot = page.getByRole("button", { name: FULL_NAME, exact: true });
  const wideDot = page.getByRole("button", { name: WIDE_NAME, exact: true });
  await expect(fullDot).toHaveCount(1);
  await expect(wideDot).toHaveCount(1);
  const a = await fullDot.boundingBox();
  const b = await wideDot.boundingBox();
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(4);
  // The two circles sit on the same point, so a locator click on one is
  // intercepted by the other. Tap the shared centre instead.
  await page.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  const popup = page.locator(".pin-reveal");
  await expect(popup).toBeVisible();
  await expect(popup).toContainText("2 walks near here");
  await expect(popup.getByRole("link", { name: "Open walk: " + FULL_NAME, exact: true })).toBeVisible();
  await expect(popup.getByRole("link", { name: "Open walk: " + WIDE_NAME, exact: true })).toBeVisible();
  await expect(popup).toContainText(BADGE);
  await shot(page, "feat-lax-wide-desktop-group.png");
  await popup.getByRole("link", { name: "Open walk: " + WIDE_NAME, exact: true }).click();
  await page.waitForURL(new RegExp("walk\\.html\\?id=" + WIDE));
  await expect(page.locator("#walk-title")).toHaveText(WIDE_NAME);
  await expect(page.locator("#walk-badge")).toHaveText(BADGE);
  await expect(page.locator("#walk-related")).toContainText("full 2:34 walk");
});

test("the walk page and player label the AI edges, loop the 8 s clip, and allow a wider look", async ({ page }) => {
  await openWalk(page, WIDE);
  await expect(page.locator("#videowalk-root [data-sample-banner]")).toContainText("edges extended with AI");
  await expect(page.locator("#videowalk-root [data-ai-edge-note]")).toHaveText(BADGE);
  await expect(page.locator("#videowalk-root [data-ai-edge-note]")).toBeVisible();
  const info = await page.evaluate(() => {
    const api = window.__tgVideoWalk;
    const lay = api.layout();
    return { overscale: api.overscale, loop: api.loop, maxX: lay.maxX, maxY: lay.maxY, duration: api.duration, covers: api.coversStage() };
  });
  expect(info.loop).toBe(true);
  expect(info.overscale).toBeCloseTo(1.92, 2);
  expect(info.duration).toBeGreaterThan(7.5);
  expect(info.duration).toBeLessThan(8.6);
  expect(info.covers).toBe(true);
  expect(info.maxX, "wider horizontal look").toBeGreaterThan(200);
  expect(info.maxY, "wider vertical look").toBeGreaterThan(200);

  // At full left look the stage stays covered (mostly real frame, no black edge).
  await page.evaluate(() => {
    const api = window.__tgVideoWalk;
    const lay = api.layout();
    api.setLookAxis(1, 0);
  });
  await page.waitForTimeout(2000);
  const atEdge = await page.evaluate(() => {
    const api = window.__tgVideoWalk;
    api.setLookAxis(0, 0);
    const lay = api.layout();
    return { panX: api.pan.x, maxX: lay.maxX, covers: api.coversStage() };
  });
  expect(Math.abs(atEdge.panX)).toBeGreaterThan(atEdge.maxX * 0.85);
  expect(atEdge.covers).toBe(true);
  await shot(page, "feat-lax-wide-desktop-look-left.png");

  // Holding Move past the end loops instead of sticking.
  await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, -1));
  await page.waitForFunction(() => window.__tgVideoWalk.currentTime > 6.2, null, { timeout: 20000 });
  await page.waitForFunction(() => window.__tgVideoWalk.currentTime > 0 && window.__tgVideoWalk.currentTime < 2.5, null, { timeout: 15000 });
  await page.evaluate(() => window.__tgVideoWalk.setMoveAxis(0, 0));
});

test("the full 2:34 LAX walk is unchanged and links to the preview", async ({ page }) => {
  await page.goto("/walk.html?id=" + FULL);
  await expect(page.locator("#walk-title")).toHaveText(FULL_NAME);
  await expect(page.locator("#walk-badge")).toBeHidden();
  await expect(page.locator("#walk-related")).toContainText("wider-view preview");
  await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, null, { timeout: 120000 });
  const info = await page.evaluate(() => {
    const api = window.__tgVideoWalk;
    return { overscale: api.overscale, loop: api.loop, duration: api.duration, badge: document.querySelector("#videowalk-root [data-ai-edge-note]").hidden };
  });
  expect(info.loop).toBe(false);
  expect(info.overscale).toBeCloseTo(1.28, 2);
  expect(info.duration).toBeGreaterThan(150);
  expect(info.badge).toBe(true);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("the 8 s preview is labelled and tappable from the shared LAX circle at 390 px", async ({ page }) => {
    await page.goto("/explore.html");
    await page.waitForFunction(() => window.__tgMapReady === true, null, { timeout: 60000 });
    await page.evaluate(() => {
      window.__tgMap.jumpTo({ center: [-118.4081, 33.9439], zoom: 16.4, pitch: 0, bearing: 0 });
    });
    await page.waitForTimeout(800);
    const box = await page.getByRole("button", { name: FULL_NAME, exact: true }).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    const popup = page.locator(".pin-reveal");
    await expect(popup).toContainText("2 walks near here");
    await expect(popup).toContainText(BADGE);
    await shot(page, "feat-lax-wide-phone-group.png");
    await page.getByRole("link", { name: "Open walk: " + WIDE_NAME, exact: true }).click();
    await page.waitForURL(new RegExp("walk\\.html\\?id=" + WIDE));
    await page.waitForFunction(() => window.__tgVideoWalk && window.__tgVideoWalk.ready === true, null, { timeout: 120000 });
    await expect(page.locator("#videowalk-root [data-ai-edge-note]")).toHaveText(BADGE);
    const lay = await page.evaluate(() => window.__tgVideoWalk.layout());
    expect(lay.maxX).toBeGreaterThan(80);
    expect(await page.evaluate(() => window.__tgVideoWalk.coversStage())).toBe(true);
    await page.evaluate(() => window.__tgVideoWalk.setLookAxis(-1, 0));
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.__tgVideoWalk.setLookAxis(0, 0));
    expect(await page.evaluate(() => window.__tgVideoWalk.coversStage())).toBe(true);
    await shot(page, "feat-lax-wide-phone-look-left.png");
  });
});
