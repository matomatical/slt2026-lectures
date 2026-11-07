// Run after `make`, with Playwright available to Node (including via NODE_PATH):
//   node tools/test_ink_preview.mjs
// Uses an isolated browser context; no existing drawings are changed.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../build/", import.meta.url));
const contentTypes = {
  ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml",
};
const server = http.createServer(async (request, response) => {
  try {
    let pathname = decodeURI(new URL(request.url, "http://localhost").pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    const data = await fs.readFile(file);
    const type = contentTypes[path.extname(file)];
    if (type) response.setHeader("Content-Type", type);
    response.end(data);
  } catch {
    response.writeHead(404).end();
  }
});

async function waitPixel(frame, canvas, x, y, visible) {
  await frame.waitForFunction(({ canvas, x, y, visible }) => {
    const element = document.querySelector(canvas);
    if (!element) return false;
    const alpha = element.getContext("2d").getImageData(
      Math.round(x / 1280 * element.width),
      Math.round(y / 720 * element.height), 1, 1,
    ).data[3];
    return visible ? alpha > 0 : alpha === 0;
  }, { canvas, x, y, visible }, { timeout: 5000 });
}

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.setDefaultTimeout(5000);
  await page.goto(`http://127.0.0.1:${server.address().port}/demo/#/board-example`);
  await page.waitForFunction(async () => {
    const { default: Reveal } = await import("/vendor/reveal.js/reveal.mjs");
    return Reveal.isReady();
  });
  const popupPromise = page.waitForEvent("popup");
  await page.keyboard.press("s");
  const speaker = await popupPromise;
  speaker.on("pageerror", (error) => errors.push(error.message));
  await speaker.locator("#current-slide iframe").waitFor();
  const iframe = await speaker.locator("#current-slide iframe").elementHandle();
  const preview = await iframe.contentFrame();
  await preview.locator(".ink-overlay").waitFor();
  await preview.locator(".presenter-slide-boundary").waitFor();
  assert.equal(await page.locator(".presenter-slide-boundary").count(), 0,
    "the boundary is presenter-only");
  const boundary = await preview.evaluate(() => {
    const element = document.querySelector(".presenter-slide-boundary");
    const box = element.getBoundingClientRect();
    const ink = document.querySelector(".ink-layer").getBoundingClientRect();
    return {
      error: Math.max(...["left", "right", "top", "bottom"].map(key => Math.abs(box[key] - ink[key]))),
      pointerEvents: getComputedStyle(element).pointerEvents,
    };
  });
  assert.ok(boundary.error < 0.1, "preview boundary matches the drawing area");
  assert.equal(boundary.pointerEvents, "none", "boundary does not intercept drawing");

  async function move(x, y, steps = 1) {
    const box = await page.locator(".ink-overlay").boundingBox();
    await page.mouse.move(box.x + x / 1280 * box.width, box.y + y / 720 * box.height, { steps });
  }

  await page.keyboard.press("c");
  await move(100, 100);
  await waitPixel(preview, ".ink-overlay", 100, 100, true);
  console.log("Cursor mirrors.");

  await page.mouse.down();
  await move(300, 100, 10);
  await waitPixel(preview, ".ink-canvas", 200, 100, true);
  assert.equal(await page.evaluate(() => localStorage.getItem("ink:/demo/:board-example")), null,
    "unfinished stroke is not persisted");
  console.log("Stroke mirrors before release.");

  await preview.goto(preview.url());
  await preview.locator(".ink-overlay").waitFor();
  await waitPixel(preview, ".ink-canvas", 200, 100, true);
  console.log("Preview opening/reloading mid-stroke receives current state.");
  await page.mouse.up();

  await page.keyboard.press("e");
  await move(200, 100);
  await page.mouse.down();
  await move(220, 100, 5);
  await waitPixel(preview, ".ink-canvas", 200, 100, false);
  assert.equal(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("ink:/demo/:board-example")).length), 1,
  "eraser is still in progress");
  console.log("Live erasing mirrors.");
  await page.mouse.up();

  await page.keyboard.press("Control+z");
  await waitPixel(preview, ".ink-canvas", 200, 100, true);
  await page.keyboard.press("Control+Shift+z");
  await waitPixel(preview, ".ink-canvas", 200, 100, false);
  console.log("Undo and redo mirror.");

  await page.keyboard.press("l");
  await move(400, 200);
  await page.mouse.down();
  await move(500, 200, 8);
  await page.mouse.up();
  await page.mouse.move(1, 1);
  await waitPixel(preview, ".ink-overlay", 450, 200, true);
  await waitPixel(preview, ".ink-overlay", 450, 200, false);
  console.log("Laser trace mirrors and fades.");

  await page.keyboard.press("Delete");
  await waitPixel(preview, ".ink-canvas", 120, 100, false);
  await page.keyboard.press("Control+z");
  await waitPixel(preview, ".ink-canvas", 120, 100, true);
  await page.evaluate(async () => {
    const { default: Reveal } = await import("/vendor/reveal.js/reveal.mjs");
    Reveal.slide(1, 0);
  });
  await waitPixel(preview, ".ink-overlay", 500, 200, false);
  await waitPixel(preview, ".ink-canvas", 120, 100, false);
  assert.equal(await preview.locator(".ink-toolbar").count(), 0, "preview remains read-only");
  console.log("Clear, undo, slide isolation, and read-only preview passed.");
  assert.deepEqual(errors, []);
} finally {
  await browser?.close();
  server.close();
}
