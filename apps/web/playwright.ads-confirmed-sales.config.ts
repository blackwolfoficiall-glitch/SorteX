import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4433";
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL))
  throw new Error("O relatório de Ads exige a aplicação de teste em loopback.");

process.env.SORTEX_ADS_LOCAL = "1";

export default defineConfig({
  testDir: "./e2e-local",
  testMatch: "ads-confirmed-sales.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    actionTimeout: 20_000,
    browserName: "chromium",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
        : {}),
    },
  },
});
