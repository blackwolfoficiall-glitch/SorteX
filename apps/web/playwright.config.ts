import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // Os testes autenticados compartilham a mesma conta de homologação e
  // validam persistência real. Executá-los em paralelo cria disputa entre
  // alterações de onboarding, campanha e personalização.
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".playwright/auth/organizer.json",
      },
    },
    {
      name: "mobile",
      dependencies: ["setup"],
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        storageState: ".playwright/auth/organizer.json",
      },
    },
    {
      name: "android",
      dependencies: ["setup"],
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        storageState: ".playwright/auth/organizer.json",
      },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      API_URL:
        process.env.PLAYWRIGHT_API_URL ||
        process.env.API_URL ||
        "http://127.0.0.1:3333",
      API_INTERNAL_URL:
        process.env.PLAYWRIGHT_API_URL ||
        process.env.API_INTERNAL_URL ||
        "http://127.0.0.1:3333",
    },
  },
});
