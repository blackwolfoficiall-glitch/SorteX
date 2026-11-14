import { defineConfig, devices } from "@playwright/test";
const api = process.env.PLAYWRIGHT_API_URL || "http://127.0.0.1:3336";
const parsed = new URL(api);
if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname))
  throw new Error("Phase 1 browser tests require a local isolated API.");
process.env.SORTEX_PHASE1_E2E = "1";
export default defineConfig({
  testDir: "./e2e",
  testMatch: "registration-phase1.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: ".playwright/phase1-results",
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  projects: [
    { name: "phase1-desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phase1-mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    timeout: 120000,
    env: { API_URL: api, API_INTERNAL_URL: api },
  },
});
