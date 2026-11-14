import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.SORTEX_REVIEW_BASE_URL || "http://127.0.0.1:3108";
const remote = baseURL === "https://sortex-fase1-review.netlify.app";
if (!remote && baseURL !== "http://127.0.0.1:3108")
  throw new Error(
    "Review tests are restricted to the isolated preview or local review server.",
  );
process.env.SORTEX_PHASE1_E2E = "1";
const proxy =
  remote && process.env.HTTPS_PROXY ? new URL(process.env.HTTPS_PROXY) : null;
export default defineConfig({
  testDir: "./e2e",
  testMatch: [
    "registration-phase1.spec.ts",
    "integrated-access-review.spec.ts",
    "organizer-home-review.spec.ts",
  ],
  ...(remote ? { globalSetup: "./e2e/preview-phase1-global-setup.ts" } : {}),
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: ".playwright/integrated-review-results",
  use: {
    baseURL,
    trace: "retain-on-failure",
    contextOptions: { reducedMotion: "reduce" },
    ...(proxy
      ? {
          proxy: {
            server: proxy.origin,
            ...(proxy.username
              ? {
                  username: decodeURIComponent(proxy.username),
                  password: decodeURIComponent(proxy.password),
                }
              : {}),
          },
        }
      : {}),
  },
  projects: [
    { name: "review-desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "review-iphone-chromium",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "review-android-chromium",
      use: { ...devices["Pixel 7"], browserName: "chromium" },
    },
  ],
});
