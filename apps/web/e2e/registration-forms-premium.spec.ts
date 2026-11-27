import { expect, test, type Page } from "@playwright/test";

const identification = "Identificação";
const address = "Endereço";
const access = "Acesso";
const goOn = (page: Page) => page.getByRole("button", { name: "Continuar", exact: true });
const back = (page: Page) => page.getByRole("button", { name: "Voltar", exact: true });
const step = (page: Page, label: string) =>
  page.getByRole("navigation", { name: "Etapas do cadastro" }).getByText(label);

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
}

test.use({ storageState: { cookies: [], origins: [] }, trace: "off", screenshot: "off", video: "off" });

test.describe("cadastros padrão Premium de comprador e organizador", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_REGISTRATION_FORMS !== "yes", "Requer a API local com PostgreSQL descartável.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    for (const role of ["comprador", "organizador"] as const) {
      test(`cadastro ${role} no tema ${colorScheme} mantém etapas e validação sem criar conta`, async ({ page, context, baseURL }, info) => {
        const origin = new URL(baseURL!).origin;
        const blockedWrites: string[] = [];
        const blockedCep: string[] = [];
        await context.route("**/*", (route) => {
          const target = new URL(route.request().url());
          const method = route.request().method();
          if (target.origin !== origin) return route.abort("blockedbyclient");
          if (target.pathname.startsWith("/api/location/cep/")) {
            blockedCep.push(method);
            return route.abort("blockedbyclient");
          }
          if (target.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(method)) {
            blockedWrites.push(method);
            return route.abort("blockedbyclient");
          }
          return route.continue();
        });
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(`/cadastro/${role}`);
        const main = page.locator("main.sx-auth");
        await expect(main).toHaveCSS("color-scheme", colorScheme);
        await expect(main.getByRole("heading", { name: `Conta de ${role}`, exact: true })).toBeVisible();
        await expect(main.getByRole("link", { name: "Voltar", exact: true })).toHaveAttribute("href", "/cadastro");
        await expect(main.getByRole("link", { name: "Entrar", exact: true })).toHaveAttribute("href", "/login");
        await expect(step(page, identification)).toHaveAttribute("aria-current", "step");
        await expect(step(page, address)).not.toHaveAttribute("aria-current", "step");
        await expect(step(page, access)).toBeVisible();
        const name = page.getByLabel("Nome completo", { exact: true });
        const cpf = page.getByLabel("CPF", { exact: true });
        const phone = page.getByLabel("Telefone / WhatsApp", { exact: true });
        await expect(name).toHaveValue("");
        await expect(cpf).toHaveValue("");
        await expect(phone).toHaveValue("");
        await fitsViewport(page);
        if (process.env.SORTEX_NAV_CAPTURE_DIR) {
          await page.screenshot({
            path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/signup-${role}-${info.project.name}-${colorScheme}.png`,
            fullPage: true,
            animations: "disabled",
          });
        }

        if (role === "organizador") {
          const pf = page.getByRole("radio", { name: "Pessoa Física (PF)" });
          const pj = page.getByRole("radio", { name: "Pessoa Jurídica (PJ)" });
          await expect(pf).toBeChecked();
          await pj.check();
          await expect(pj).toBeChecked();
          await expect(page.getByLabel("CNPJ", { exact: true })).toHaveValue("");
          await expect(page.getByLabel("Razão social", { exact: true })).toBeVisible();
          await expect(page.getByLabel("CPF do representante legal", { exact: true })).toBeVisible();
          await goOn(page).click();
          await expect(page.locator('input[name="cnpj"]:invalid')).toBeVisible();
          await expect(step(page, identification)).toHaveAttribute("aria-current", "step");
          await fitsViewport(page);
          await pf.check();
          await expect(page.getByLabel("CNPJ", { exact: true })).toHaveCount(0);
        } else {
          await expect(page.getByRole("radio")).toHaveCount(0);
        }

        await name.focus();
        await page.keyboard.press("Tab");
        await expect(cpf).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(phone).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(goOn(page)).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.locator('input[name="name"]:invalid')).toBeVisible();
        await expect(step(page, identification)).toHaveAttribute("aria-current", "step");

        // These values only exercise client step navigation. No identity is sent
        // to the server and the fixture intentionally cannot create an account.
        await name.fill("Pessoa Sintética");
        await cpf.fill("00000000000");
        await phone.fill("00000000000");
        const states = page.waitForResponse((r) => r.url().endsWith("/api/location/states") && r.ok());
        await goOn(page).click();
        await expect(step(page, address)).toHaveAttribute("aria-current", "step");
        expect(await (await states).json()).toEqual(expect.arrayContaining([expect.objectContaining({ code: "BA" })]));
        const state = page.getByRole("combobox", { name: "Estado", exact: true });
        const city = page.getByRole("combobox", { name: "Cidade", exact: true });
        await expect(city).toBeDisabled();
        await state.fill("Bahia");
        await expect(page.getByRole("option", { name: "BA — Bahia" })).toBeVisible();
        const cities = page.waitForResponse((r) => r.url().endsWith("/api/location/states/BA/cities") && r.ok());
        await state.press("Enter");
        expect(await (await cities).json()).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Feira de Santana" })]));
        await city.fill("Feira de Santana");
        await expect(page.getByRole("option", { name: "Feira de Santana", exact: true })).toBeVisible();
        await fitsViewport(page);
        await city.press("Enter");
        await expect(city).toHaveValue("Feira de Santana");

        await goOn(page).click();
        await expect(page.getByLabel("CEP", { exact: true })).toHaveValue("");
        await expect(step(page, address)).toHaveAttribute("aria-current", "step");
        // A short entry satisfies the existing native required check without
        // opening an external 8-digit CEP lookup. Full address validity is not tested.
        await page.getByLabel("CEP", { exact: true }).fill("0");
        await page.getByLabel("Bairro", { exact: true }).fill("Bairro sintético");
        await page.getByLabel("Logradouro", { exact: true }).fill("Rua sintética");
        await page.getByLabel("Número", { exact: true }).fill("0");
        await goOn(page).click();
        await expect(step(page, access)).toHaveAttribute("aria-current", "step");
        await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue("");
        await expect(page.getByLabel("Senha (mínimo 8 caracteres)", { exact: true })).toHaveValue("");
        await expect(page.getByRole("checkbox")).toHaveCount(3);
        if (role === "organizador") await expect(page.locator('input[type="file"]')).toHaveCount(1);
        await fitsViewport(page);
        await page.getByRole("button", { name: "Criar conta", exact: true }).click();
        await expect(page.locator('input[name="email"]:invalid')).toBeVisible();
        await expect(step(page, access)).toHaveAttribute("aria-current", "step");
        await back(page).click();
        await expect(step(page, address)).toHaveAttribute("aria-current", "step");
        await expect(page.getByRole("combobox", { name: "Cidade", exact: true })).toHaveValue("Feira de Santana");
        await back(page).click();
        await expect(step(page, identification)).toHaveAttribute("aria-current", "step");
        await expect(name).toHaveValue("Pessoa Sintética");
        expect(blockedWrites).toEqual([]);
        expect(blockedCep).toEqual([]);
        expect((await page.request.get("/api/auth/me")).status()).toBe(401);
      });
    }
  }
});
