// Called only by the disposable Nest/PostgreSQL inbox integration test.
import { chromium, expect } from "@playwright/test";

const base = process.env.SORTEX_INBOX_E2E_WEB_URL ?? "";
const email = process.env.SORTEX_INBOX_E2E_BROWSER_EMAIL ?? "";
const password = process.env.SORTEX_INBOX_E2E_BROWSER_PASSWORD ?? "";
if (
  !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(base) ||
  !/^sortex-inbox-[a-f0-9-]+@example\.test$/.test(email) ||
  !password
)
  throw new Error("Use only the disposable local inbox fixture.");

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.SORTEX_INBOX_E2E_CHROMIUM_PATH || undefined,
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8_000);
  await page.goto(base + "/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/comprador\/?$/, { timeout: 8_000 });
  await page.getByRole("link", { name: "Notificações" }).click();
  await expect(
    page.getByRole("heading", { name: "Notificações", exact: true }),
  ).toBeVisible();

  const row = (title) =>
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: title }) });
  const second = "Second synthetic",
    third = "Third synthetic";
  await expect(row("First synthetic").getByText(/^Lida ·/)).toBeVisible();
  await expect(row(second).getByText(/^Não lida ·/)).toBeVisible();
  await expect(row(third).getByText(/^Não lida ·/)).toBeVisible();
  await expect(page.getByText("Another buyer")).toHaveCount(0);
  await expect(page.getByText("Deleted fixture")).toHaveCount(0);

  await page
    .getByRole("button", { name: `Marcar como lida: ${second}` })
    .click();
  await expect(row(second).getByText(/^Lida ·/)).toBeVisible();
  await expect(row(third).getByText(/^Não lida ·/)).toBeVisible();
  await page.getByRole("button", { name: "Marcar todas como lidas" }).click();
  await expect(row(third).getByText(/^Lida ·/)).toBeVisible();
  await page.reload();
  await expect(row(second).getByText(/^Lida ·/)).toBeVisible();
  await expect(row(third).getByText(/^Lida ·/)).toBeVisible();
  console.log(
    "PASS: browser Home → inbox, single/bulk mark, persisted after reload.",
  );
} finally {
  await browser.close();
}
