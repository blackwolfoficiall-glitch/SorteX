import { defineConfig, devices } from "@playwright/test";
const preview = "https://sortex-fase1-review.netlify.app";
if (process.env.PLAYWRIGHT_BASE_URL && process.env.PLAYWRIGHT_BASE_URL !== preview) throw new Error("Remote Phase 1 tests are restricted to the isolated preview site.");
process.env.SORTEX_PHASE1_E2E = "1";
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
const proxy = proxyUrl ? new URL(proxyUrl) : undefined;
export default defineConfig({
  testDir: "./e2e",
  testMatch: "registration-phase1.spec.ts",
  globalSetup: "./e2e/preview-phase1-global-setup.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: ".playwright/preview-phase1-results",
  use: {
    baseURL: preview,
    trace: "retain-on-failure",
    ...(proxy ? { proxy: { server: proxy.origin, ...(proxy.username ? { username: decodeURIComponent(proxy.username), password: decodeURIComponent(proxy.password) } : {}) } } : {}),
  },
  projects: [
    { name: "preview-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "preview-iphone-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "preview-android-chromium", use: { ...devices["Pixel 7"], browserName: "chromium" } },
  ],
});
