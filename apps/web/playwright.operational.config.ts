import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    /admin-authorization\.spec\.ts/,
    /admin-critical-resources\.spec\.ts/,
    /admin-finance\.spec\.ts/,
    /admin-organizers\.spec\.ts/,
    /admin-phase6\.spec\.ts/,
    /public-campaign-chrome\.spec\.ts/,
  ],
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 180_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "android",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
  ],
});
