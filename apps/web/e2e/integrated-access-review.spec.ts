import { test, expect } from "@playwright/test";
test("explicit linking displays both identities and requires confirmation (UI fixture only)", async ({
  page,
}) => {
  await page.route("**/api/auth/social/pending", (route) =>
    route.fulfill({
      json: {
        provider: "google",
        email: "synthetic-provider@example.test",
        name: null,
        linkRequired: true,
      },
    }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "synthetic-existing",
        name: "Conta Sintética",
        email: "synthetic-existing@example.test",
        role: "BUYER",
      },
    }),
  );
  await page.goto("/cadastro/completar");
  await expect(
    page.getByText("synthetic-provider@example.test", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("synthetic-existing@example.test", { exact: true }),
  ).toBeVisible();
  const confirm = page.getByRole("button", {
    name: "Confirmar vínculo",
    exact: true,
  });
  await expect(confirm).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(confirm).toBeEnabled();
});
test("institutional page presents the real product and working account paths", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /Sua campanha,\s*em outro nível\./,
  );
  await expect(
    page.getByRole("link", { name: "Quero organizar" }),
  ).toHaveAttribute("href", "/cadastro/organizador");
  await expect(
    page.getByRole("link", { name: "Quero participar" }),
  ).toHaveAttribute("href", "/cadastro/comprador");
  for (const src of [
    "/product/dashboard-preview.png",
    "/product/campaigns-preview.png",
  ])
    expect((await page.request.get(src)).status()).toBe(200);
  await page.getByText("O que posso fazer na SorteX?", { exact: true }).click();
  await expect(page.locator("details[open]")).toContainText(
    "Organizadores encontram ferramentas",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("social entry reflects the actual provider availability and keeps email access", async ({
  page,
}) => {
  const response = await page.request.get("/api/auth/social/providers");
  expect(response.status()).toBe(200);
  const providers = await response.json();
  await page.goto("/login");
  await expect(page.getByText("Verificando opções de acesso…")).toHaveCount(0);
  for (const provider of ["google", "apple"]) {
    const name = `Continuar com ${provider === "google" ? "Google" : "Apple"}`;
    if (providers[provider].enabled)
      await expect(
        page.getByRole("link", { name, exact: true }),
      ).toHaveAttribute("href", `/api/auth/social/${provider}/start`);
    else
      await expect(
        page.getByRole("button", { name, exact: true }),
      ).toBeDisabled();
  }
  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("login failures are clear and do not pretend to authenticate", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill("nonexistent-review@example.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("Wrong-synthetic-password!");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "inválidos",
  );
  await expect(page).toHaveURL(/\/login$/);
});
test("social mutations reject a foreign Origin without touching a session", async ({
  request,
}) => {
  for (const path of ["/api/auth/social/complete", "/api/auth/social/link"]) {
    const r = await request.post(path, {
      headers: { Origin: "https://attacker.example" },
      data: {},
    });
    expect(r.status()).toBe(403);
  }
});
test("missing or expired social registration does not create accounts", async ({
  page,
}) => {
  await page.goto("/cadastro/completar");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Inicie o acesso",
  );
  await expect(page.getByLabel("Senha", { exact: true })).toHaveCount(0);
});
test("social completion UI prefills provider data without requesting a password (UI fixture only)", async ({
  page,
}) => {
  await page.route("**/api/auth/social/pending", (route) =>
    route.fulfill({
      json: {
        provider: "apple",
        email: "synthetic@privaterelay.appleid.com",
        name: "Pessoa Sintética Provedor",
        linkRequired: false,
      },
    }),
  );
  await page.goto("/cadastro/completar");
  await page
    .getByRole("button", { name: /Organizador Criar e administrar/ })
    .click();
  await expect(page.getByLabel("Nome completo", { exact: true })).toHaveValue(
    "Pessoa Sintética Provedor",
  );
  await expect(
    page.getByText("Não é necessário criar uma senha.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Pessoa Jurídica (PJ)", { exact: true }).check();
  await expect(page.getByLabel("CNPJ", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Slogan", { exact: true })).toHaveCount(0);
});
test("an email collision offers explicit linking and never a silent merge (UI fixture only)", async ({
  page,
}) => {
  await page.route("**/api/auth/social/pending", (route) =>
    route.fulfill({
      json: {
        provider: "google",
        email: "synthetic-existing@example.test",
        name: null,
        linkRequired: true,
      },
    }),
  );
  await page.goto("/cadastro/completar");
  await expect(
    page.getByText("Nenhuma conta foi unida.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Entrar na conta existente" }),
  ).toHaveAttribute("href", "/login?next=%2Fcadastro%2Fcompletar");
});
test("an existing user may explicitly request linking even with a different provider email (UI fixture only)", async ({
  page,
}) => {
  await page.route("**/api/auth/social/pending", (route) =>
    route.fulfill({
      json: {
        provider: "apple",
        email: "synthetic@privaterelay.appleid.com",
        name: null,
        linkRequired: false,
      },
    }),
  );
  await page.goto("/cadastro/completar");
  await page
    .getByRole("button", {
      name: "Já tenho uma conta — quero vincular esta identidade",
    })
    .click();
  await expect(
    page.getByText("Você escolheu vincular à sua conta existente", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Entrar na conta existente" }),
  ).toBeVisible();
});
