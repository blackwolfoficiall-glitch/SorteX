import { expect, test as setup } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const authFile = ".playwright/auth/organizer.json";

setup("autenticar organizador de homologação", async ({ page }) => {
  const email = process.env.E2E_ORGANIZER_EMAIL;
  const password = process.env.E2E_ORGANIZER_PASSWORD;
  if (!email || !password)
    throw new Error("Defina E2E_ORGANIZER_EMAIL e E2E_ORGANIZER_PASSWORD.");

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await mkdir(".playwright/auth", { recursive: true });
  await page.context().storageState({ path: authFile });
});
