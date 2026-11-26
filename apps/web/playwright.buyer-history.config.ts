import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4433";
const origin = new URL(baseURL);
if (
  origin.hostname !== "127.0.0.1" ||
  !["http:", "https:"].includes(origin.protocol)
)
  throw new Error("A suíte de histórico exige a web local em loopback.");

process.env.SORTEX_BUYER_HISTORY_LOCAL = "1";

export default defineConfig({
  testDir: "./e2e-local",
  testMatch: "buyer-purchase-history.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 12_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    ignoreHTTPSErrors: origin.protocol === "https:",
  },
  projects: [
    {
      name: "desktop-chromium-history",
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
    { name: "iphone-webkit-history", use: { ...devices["iPhone 13"] } },
  ],
});
