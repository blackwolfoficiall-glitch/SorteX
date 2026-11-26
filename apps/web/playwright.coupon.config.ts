import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4434";
const origin = new URL(baseURL);
if (
  origin.hostname !== "127.0.0.1" ||
  !["http:", "https:"].includes(origin.protocol)
)
  throw new Error("A suíte de cupons exige a web local em loopback.");
process.env.SORTEX_COUPON_LOCAL = "1";

export default defineConfig({
  testDir: "./e2e-local",
  testMatch: "buyer-coupon-journey.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    ignoreHTTPSErrors: origin.protocol === "https:",
  },
  projects: [
    {
      name: "coupon-desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
          ? {
              launchOptions: {
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
                args: ["--no-zygote", "--disable-gpu"],
              },
            }
          : {}),
      },
    },
    { name: "coupon-iphone-webkit", use: { ...devices["iPhone 13"] } },
  ],
});
