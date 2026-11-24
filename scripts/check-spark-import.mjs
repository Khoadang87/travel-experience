#!/usr/bin/env node
// Headless check: vendored three r187 + Spark 2.4.0 import together,
// SparkRenderer and SplatMesh are constructors, detectWebGL2() runs.
// This script is not copied onto the GitHub Pages site.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script type="importmap">
  {
    "imports": {
      "three": "./vendor/three.module.js",
      "three/addons/": "./vendor/three/addons/",
      "@sparkjsdev/spark": "./vendor/spark.module.js"
    }
  }
  </script>
</head>
<body>
<script type="module">
  import * as THREE from "three";
  import { SparkRenderer, SplatMesh } from "@sparkjsdev/spark";
  import { detectWebGL2 } from "./src/webgl2.js";
  const ok = {
    threeRevision: THREE.REVISION,
    sparkRenderer: typeof SparkRenderer,
    splatMesh: typeof SplatMesh,
    webgl2: detectWebGL2(),
  };
  window.__sparkCheck = ok;
</script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/" || url.pathname === "/check.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }
  const rel = path.normalize(url.pathname).replace(/^\/+/, "");
  if (rel.includes("..")) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  const file = path.join(root, rel);
  if (!existsSync(file)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { "content-type": mime[ext] || "application/octet-stream" });
  res.end(await readFile(file));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
await page.goto(`http://127.0.0.1:${port}/check.html`, { waitUntil: "networkidle" });
const result = await page.waitForFunction(() => window.__sparkCheck, { timeout: 30_000 });
const ok = await result.jsonValue();
await browser.close();
server.close();

if (errors.length) {
  console.error("Page errors:", errors);
  process.exit(1);
}
if (ok.threeRevision !== "187") {
  console.error("Unexpected THREE.REVISION", ok);
  process.exit(1);
}
if (ok.sparkRenderer !== "function" || ok.splatMesh !== "function") {
  console.error("Spark constructors missing", ok);
  process.exit(1);
}
console.log(JSON.stringify(ok, null, 2));
console.log("Spark import check passed.");
