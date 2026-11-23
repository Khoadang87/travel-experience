const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://127.0.0.1:8765",
    browserName: "chromium",
    launchOptions: {
      executablePath: "/usr/bin/google-chrome-stable",
      args: [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--ignore-gpu-blocklist",
      ],
    },
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "bash scripts/build-site.sh && python3 serve.py --bind 127.0.0.1 --port 8765 --dir site",
    port: 8765,
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
