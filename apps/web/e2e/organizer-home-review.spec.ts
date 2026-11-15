import { test, expect } from "@playwright/test";

test("organizer presentation keeps all four core modules and the participant path", async ({
  page,
}) => {
  await page.goto("/");
  for (const name of [
    "Dashboard inteligente",
    "CRM: conheça sua base",
    "IA SorteX: do dado à próxima ação",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }).last(),
    ).toBeVisible();
  await expect(
    page.getByText("O resultado é a referência.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText(/Não existe parceria ou autorização da Caixa/),
  ).toBeVisible();
  await expect(
    page.getByText(/respostas por regras e modelos determinísticos/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Quero participar", exact: true }),
  ).toHaveAttribute("href", "/cadastro/comprador");
});

test("navigation and final CTA open real sections and organizer registration", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Navegação principal" });
  for (const [label, anchor] of [
    ["Recursos", "recursos"],
    ["Como funciona", "como-funciona"],
    ["Planos", "planos"],
  ]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${anchor}$`));
    await expect(page.locator(`#${anchor}`)).toBeInViewport();
  }
  await page
    .locator(".sx-last-call")
    .getByRole("link", { name: "Criar conta de organizador" })
    .click();
  await expect(page).toHaveURL(/\/cadastro\/organizador$/);
  await expect(
    page.getByRole("radio", { name: "Pessoa Física (PF)", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("radio", { name: "Pessoa Jurídica (PJ)", exact: true }),
  ).toBeVisible();
});

test("plan cards disclose pending approval without old prices or percentage claims", async ({
  page,
}) => {
  await page.goto("/#planos");
  const plans = page.locator("#planos");
  await expect(plans.locator("article")).toHaveCount(4);
  for (const name of ["Inicial", "Profissional", "Avançado", "Empresarial"]) {
    const card = plans
      .locator("article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(card).toContainText("A confirmar");
    await expect(card).toContainText(
      "Mensalidade em R$ · periodicidade mensal",
    );
    await expect(card.getByRole("link")).toHaveAttribute(
      "href",
      "/cadastro/organizador",
    );
  }
  expect(await plans.innerText()).not.toMatch(
    /\d\s*%|79[,.]90|149[,.]90|299[,.]90|sem taxas|mais escolhido/i,
  );
  await expect(plans).toContainText("Nenhum plano é ativado por estes botões");
});

test("commercial compositions use crisp HTML/SVG, stay compact and have no fake controls", async ({
  page,
  isMobile,
}) => {
  const captureRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/product\/.*\.png/.test(request.url()))
      captureRequests.push(request.url());
  });
  await page.goto("/");
  const figures = page.locator("figure[data-illustration]");
  await expect(figures).toHaveCount(5);
  for (const type of ["dashboard", "crm", "ai", "lottery"]) {
    const figure = page.locator(`figure[data-illustration="${type}"]`).last();
    await figure.scrollIntoViewIfNeeded();
    await expect(figure).toBeVisible();
    await expect(figure.locator("figcaption")).toHaveText(
      "Ilustração demonstrativa · dados fictícios",
    );
    await expect(
      figure.locator("img, picture, canvas, button, input, a"),
    ).toHaveCount(0);
    if (isMobile) {
      const box = await figure.boundingBox();
      expect(box?.height).toBeLessThan(520);
      expect(
        await figure.evaluate((node) => node.scrollWidth <= node.clientWidth),
      ).toBe(true);
    }
  }
  expect(captureRequests).toEqual([]);
  await expect(
    page.getByRole("link", { name: /Ampliar captura|Ampliar campanhas/ }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("illustrations identify examples and do not imply an executed draw or autonomous messaging", async ({
  page,
}) => {
  await page.goto("/");
  const dashboard = page.locator('[data-illustration="dashboard"]').last();
  await expect(dashboard).toContainText("R$ 48.750");
  await expect(dashboard).toContainText("Vendas no exemplo");
  await expect(page.locator('[data-illustration="ai"]')).toContainText(
    "Conversa ilustrativa",
  );
  await expect(page.locator('[data-illustration="ai"]')).toContainText(
    "Nenhum envio automático",
  );
  await expect(page.locator('[data-illustration="lottery"]')).toContainText(
    "1º prêmio fictício",
  );
  await expect(page.locator('[data-illustration="lottery"]')).toContainText(
    "342",
  );
  await expect(page.locator('[data-illustration="lottery"]')).toContainText(
    "não executa uma apuração",
  );
});
