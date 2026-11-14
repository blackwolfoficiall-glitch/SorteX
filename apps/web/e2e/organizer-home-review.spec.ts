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

test("real capture variants load and can be opened at readable size", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const figures = page.locator(".sx-demo-figure");
  await expect(figures).toHaveCount(3);
  for (const figure of await figures.all()) {
    await figure.scrollIntoViewIfNeeded();
    const image = figure.locator("img");
    await expect
      .poll(() =>
        image.evaluate(
          (node) =>
            (node as HTMLImageElement).complete &&
            (node as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(
      await image.evaluate((node) => (node as HTMLImageElement).currentSrc),
    ).toContain(isMobile ? "-mobile.png" : "_next/image");
    const zoom = figure
      .getByRole("link", { name: "Ampliar captura", exact: true })
      .filter({ visible: true });
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      zoom.click(),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toContain("/product/");
    expect((await popup.request.get(popup.url())).status()).toBe(200);
    await popup.close();
    await expect(figure).toContainText("Demonstração com dados fictícios");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
