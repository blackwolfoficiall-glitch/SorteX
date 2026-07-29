import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("login apresenta formulário utilizável em português", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Entre na sua conta" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeEditable();
  await expect(page.getByLabel("Senha", { exact: true })).toBeEditable();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
});

for (const route of [
  "/dashboard",
  "/dashboard/crm/contatos?status=LEAD",
  "/dashboard/personalizacao",
  "/dashboard/mini-campanhas",
  "/dashboard/afiliados",
]) {
  test(`rota protegida ${route} preserva proteção de sessão`, async ({
    page,
  }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Entre na sua conta" }),
    ).toBeVisible();
  });
}

test("página inicial não possui overflow horizontal", async ({ page }) => {
  await page.goto("/");
  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});
