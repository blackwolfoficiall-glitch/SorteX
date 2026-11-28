// Called only by the disposable Nest/PostgreSQL favorites proof.
import { chromium, expect } from "@playwright/test";

const base = process.env.SORTEX_FAVORITES_E2E_WEB_URL ?? "";
const email = process.env.SORTEX_FAVORITES_E2E_BROWSER_EMAIL ?? "";
const password = process.env.SORTEX_FAVORITES_E2E_BROWSER_PASSWORD ?? "";
if (
  !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(base) ||
  !/^sortex-favorites-[a-f0-9-]+@example\.test$/.test(email) ||
  !password
)
  throw new Error("Use only the disposable local favorites fixture.");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.SORTEX_FAVORITES_E2E_CHROMIUM_PATH || undefined,
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8_000);
  await page.goto(base + "/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/comprador\/?$/, { timeout: 8_000 });
  await page.getByRole("link", { name: "Sorteios", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sorteios", exact: true }),
  ).toBeVisible();

  const savedFromApp = "Synthetic Favorite from App";
  const fromWeb = "Synthetic Favorite from Web";
  await expect(
    page.getByRole("button", {
      name: `Remover dos favoritos: ${savedFromApp}`,
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", {
      name: `Salvar nos favoritos: ${fromWeb}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: `Remover dos favoritos: ${fromWeb}`,
      exact: true,
    }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Meus favoritos", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Favoritos", exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("heading", { name: fromWeb, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: savedFromApp, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Synthetic hidden/)).toHaveCount(0);
  await page
    .getByRole("button", {
      name: `Remover dos favoritos: ${savedFromApp}`,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: savedFromApp, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: fromWeb, exact: true }),
  ).toBeVisible();
  console.log(
    "PASS: browser catalog save, private list persistence, and remove.",
  );
} finally {
  await browser.close();
}
