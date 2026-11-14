import { test, expect, Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
test.skip(
  process.env.SORTEX_PHASE1_E2E !== "1",
  "Use playwright.phase1.config.ts against an isolated local API.",
);
const digits = (size: number) =>
  [...randomBytes(size)].map((n) => n % 10).join("");
function cpf() {
  let d = digits(9);
  for (const size of [9, 10]) {
    const r =
      [...d].reduce((n, c, i) => n + Number(c) * (size + 1 - i), 0) % 11;
    d += r < 2 ? "0" : String(11 - r);
  }
  return d;
}
function cnpj() {
  let d = randomBytes(4).toString("hex").toUpperCase() + "0001";
  for (const size of [12, 13]) {
    const r =
      [...d.slice(0, size)]
        .reverse()
        .reduce((n, c, i) => n + (c.charCodeAt(0) - 48) * (2 + (i % 8)), 0) %
      11;
    d += r < 2 ? "0" : String(11 - r);
  }
  return d;
}
async function address(page: Page) {
  await page.getByLabel("CEP", { exact: true }).fill("44000-000");
  await page.getByRole("combobox", { name: "Estado", exact: true }).fill("bah");
  await expect(page.getByRole("option", { name: "BA — Bahia" })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Estado", exact: true })
    .press("Enter");
  const city = page.getByRole("combobox", { name: "Cidade", exact: true });
  await city.fill("Fe");
  await expect(
    page.getByRole("option", { name: "Feira da Mata", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Feira de Santana", exact: true }),
  ).toBeVisible();
  const firstActive = await city.getAttribute("aria-activedescendant");
  await city.press("ArrowDown");
  await expect(city).not.toHaveAttribute("aria-activedescendant", firstActive!);
  await city.fill("Feira de San");
  await city.press("Enter");
  await city.press("Tab");
  await expect(city).toHaveValue("Feira de Santana");
  await page.getByLabel("Bairro", { exact: true }).fill("Centro");
  await page.getByLabel("Logradouro", { exact: true }).fill("Rua Sintética");
  await page.getByLabel("Número", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}
for (const kind of ["BUYER", "PF", "PJ"]) {
  test(`registers ${kind} through the real local API and database`, async ({
    page,
  }) => {
    await page.route("**/api/location/cep/*", (route) =>
      route.fulfill({ status: 503, json: { message: "offline synthetic" } }),
    );
    await page.goto(
      kind === "BUYER" ? "/cadastro/comprador" : "/cadastro/organizador",
    );
    const company = kind === "PJ";
    if (company) {
      await page.getByLabel("Pessoa Jurídica (PJ)", { exact: true }).check();
      await page.getByLabel("CNPJ", { exact: true }).fill(cnpj());
      await page
        .getByLabel("Razão social", { exact: true })
        .fill("Empresa Sintética E2E");
    } else
      await expect(page.getByLabel("CNPJ", { exact: true })).toHaveCount(0);
    await page
      .getByLabel(
        company ? "Nome completo do representante legal" : "Nome completo",
        { exact: true },
      )
      .fill("Pessoa Sintética E2E");
    await page
      .getByLabel(company ? "CPF do representante legal" : "CPF", {
        exact: true,
      })
      .fill(cpf());
    await page
      .getByLabel("Telefone / WhatsApp", { exact: true })
      .fill("719" + digits(8));
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await address(page);
    await expect(page.getByLabel("Slogan", { exact: true })).toHaveCount(0);
    await page
      .getByLabel("E-mail", { exact: true })
      .fill(`browser-${randomBytes(8).toString("hex")}@example.test`);
    await page
      .getByLabel("Senha (mínimo 8 caracteres)", { exact: true })
      .fill("Synthetic-phase1-password!");
    await page
      .getByLabel("Confirmar senha", { exact: true })
      .fill("Synthetic-phase1-password!");
    for (const checkbox of await page.getByRole("checkbox").all())
      await checkbox.check();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/auth/register") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Criar conta", exact: true })
      .click();
    expect((await response).status()).toBe(201);
    await expect(page).toHaveURL(
      new RegExp(
        kind === "BUYER" ? "sucesso-comprador" : "sucesso-organizador",
      ),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}
test("IBGE and CEP outages use the bundled catalog, keyboard search and UF change clear city", async ({
  page,
}) => {
  await page.route("**/api/location/**", (route) =>
    route.fulfill({ status: 503, json: { message: "offline synthetic" } }),
  );
  await page.goto("/cadastro/comprador");
  await page
    .getByLabel("Nome completo", { exact: true })
    .fill("Pessoa Sintética");
  await page.getByLabel("CPF", { exact: true }).fill(cpf());
  await page
    .getByLabel("Telefone / WhatsApp", { exact: true })
    .fill("71999990000");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const uf = page.getByRole("combobox", { name: "Estado", exact: true });
  await uf.fill("ba");
  await page.getByRole("option", { name: "BA — Bahia", exact: true }).click();
  const city = page.getByRole("combobox", { name: "Cidade", exact: true });
  await city.fill("sAlVaDoR");
  await page.getByRole("option", { name: "Salvador", exact: true }).click();
  await uf.fill("sp");
  await page
    .getByRole("option", { name: "SP — São Paulo", exact: true })
    .click();
  await expect(city).toHaveValue("");
  await city.fill("sao paulo");
  await expect(
    page.getByRole("option", { name: "São Paulo", exact: true }),
  ).toBeVisible();
  await city.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(city).toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("late CEP response does not overwrite manual edits", async ({ page }) => {
  let respond: (() => Promise<void>) | undefined;
  await page.route("**/api/location/cep/*", (route) => {
    respond = () =>
      route.fulfill({
        json: {
          state: "SP",
          city: "São Paulo",
          municipalityCode: "3550308",
          address: "Rua antiga",
          neighborhood: "Bairro antigo",
        },
      });
  });
  await page.goto("/cadastro/comprador");
  await page
    .getByLabel("Nome completo", { exact: true })
    .fill("Pessoa Sintética");
  await page.getByLabel("CPF", { exact: true }).fill(cpf());
  await page
    .getByLabel("Telefone / WhatsApp", { exact: true })
    .fill("71999990000");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("CEP", { exact: true }).fill("44000000");
  await expect.poll(() => Boolean(respond)).toBe(true);
  await page
    .getByLabel("Logradouro", { exact: true })
    .fill("Rua editada durante a consulta");
  await respond!();
  await expect(
    page.getByText("Confira o endereço", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Logradouro", { exact: true })).toHaveValue(
    "Rua editada durante a consulta",
  );
});

test("catalog errors allow retry and never accept a free-text city", async ({
  page,
}) => {
  await page.route("**/api/location/**", (route) =>
    route.fulfill({ status: 503, json: { message: "synthetic offline" } }),
  );
  await page.route("**/data/municipalities.json", (route) =>
    route.fulfill({ status: 503 }),
  );
  await page.goto("/cadastro/comprador");
  await page
    .getByLabel("Nome completo", { exact: true })
    .fill("Pessoa Sintética");
  await page.getByLabel("CPF", { exact: true }).fill(cpf());
  await page
    .getByLabel("Telefone / WhatsApp", { exact: true })
    .fill("71999990000");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Não foi possível carregar os estados" }),
  ).toContainText("Não foi possível carregar os estados");
  await page.unroute("**/data/municipalities.json");
  await page.getByRole("button", { name: "Recarregar municípios" }).click();
  const state = page.getByRole("combobox", { name: "Estado", exact: true });
  await state.fill("DF");
  await page.getByRole("option", { name: "DF — Distrito Federal" }).click();
  const city = page.getByRole("combobox", { name: "Cidade", exact: true });
  await city.fill("Cidade inventada");
  await city.press("Tab");
  await expect(city).toHaveValue("");
  await city.fill("brasilia");
  await page.getByRole("option", { name: "Brasília" }).click();
  await expect(city).toHaveValue("Brasília");
});

test("Configurações → Perfil edits and clears an optional slogan with persistence", async ({
  page,
}) => {
  const email = `profile-${randomBytes(8).toString("hex")}@example.test`;
  const password = "Synthetic-phase1-password!";
  const registration = await page.request.post("/api/auth/register", {
    data: {
      name: "Pessoa Sintética Perfil",
      email,
      password,
      passwordConfirmation: password,
      cpf: cpf(),
      phone: "719" + digits(8),
      role: "ORGANIZER",
      personType: "PF",
      termsAccepted: true,
      privacyAccepted: true,
      dataProcessingAccepted: true,
      postalCode: "44000000",
      state: "BA",
      city: "Feira de Santana",
      municipalityCode: "2910800",
      neighborhood: "Centro",
      address: "Rua Sintética",
      addressNumber: "10",
    },
  });
  expect(registration.status()).toBe(201);
  expect(
    (
      await page.request.post("/api/auth/login", { data: { email, password } })
    ).ok(),
  ).toBe(true);
  await page.goto("/dashboard/configuracoes");
  await page.getByRole("link", { name: /^Perfil Dados da conta/ }).click();
  await expect(page).toHaveURL(/\/perfil$/);
  await page
    .getByLabel("Slogan", { exact: true })
    .fill("Slogan sintético persistido");
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(
    page.getByText("Perfil salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Slogan", { exact: true })).toHaveValue(
    "Slogan sintético persistido",
  );
  await page.getByLabel("Slogan", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Salvar perfil", exact: true })
    .click();
  await expect(
    page.getByText("Perfil salvo com sucesso.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Slogan", { exact: true })).toHaveValue("");
});
