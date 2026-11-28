import { expect, test, type Page } from "@playwright/test";

const stages = [
  "Dados da campanha", "Configuração", "Prêmios", "Promoções",
  "Regra do sorteio", "Personalização", "Revisão",
];
const draftTitle = "Rascunho sintético do Wizard Premium";
const publicationTitle = "Campanha Piloto de Homologação";

async function ownerCampaignId(page: Page, title: string) {
  const response = await page.request.get("/api/campaigns/my");
  expect(response.status()).toBe(200);
  const records = (await response.json()) as { id: string; title: string }[];
  const record = records.find((campaign) => campaign.title === title);
  if (!record) throw new Error("Campanha sintética indisponível.");
  return record.id;
}

test.describe("chrome Premium do formulário de campanhas", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_CAMPAIGN_WIZARD !== "yes", "Requer banco sintético descartável.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
      throw new Error("Use este teste exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`abre criação e edição, preservando formulário e foco no tema ${colorScheme}`, async ({ page }, testInfo) => {
      const writeAttempts: string[] = [];
      await page.route("**/api/campaigns/**", (route) => {
        const method = route.request().method();
        if (["GET", "HEAD"].includes(method)) return route.continue();
        writeAttempts.push(method);
        return route.abort("blockedbyclient");
      });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/dashboard/campanhas/nova");
      const wizard = page.getByRole("region", { name: "Criar nova rifa" });
      const title = wizard.getByRole("heading", { name: "Criar nova rifa" });
      const footer = wizard.locator('footer[aria-label="Ações da etapa"]');
      const saveAndContinue = footer.getByRole("button", { name: "Salvar e continuar", exact: true });
      const titleInput = wizard.getByRole("textbox", { name: "Título", exact: true });
      await expect(title).toBeVisible();
      await expect(title).toHaveCSS("color-scheme", colorScheme);
      await expect(titleInput).toHaveValue("");
      await expect(footer).toHaveCSS("color-scheme", colorScheme);
      const legacyInput = await titleInput.evaluate((node) => {
        const computed = getComputedStyle(node);
        const pixel = document.createElement("canvas").getContext("2d")!;
        pixel.fillStyle = computed.color;
        pixel.fillRect(0, 0, 1, 1);
        const [r, g, b] = pixel.getImageData(0, 0, 1, 1).data;
        const linear = (channel: number) => {
          const s = channel / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        const luminosity = linear(r) * .2126 + linear(g) * .7152 + linear(b) * .0722;
        return {
          theme: node.closest(".sx-premium") !== null,
          background: computed.backgroundColor,
          contrastAgainstWhite: 1.05 / (luminosity + .05),
        };
      });
      expect(legacyInput.theme).toBe(false);
      expect(legacyInput.background).toBe("rgb(255, 255, 255)");
      expect(legacyInput.contrastAgainstWhite).toBeGreaterThanOrEqual(4.5);
      await expect(wizard.getByRole("heading", { name: "Dados da rifa" })).toBeVisible();
      const progress = wizard.getByRole("progressbar", { name: "Etapas da campanha" });
      await expect(progress).toHaveAttribute("aria-valuenow", "1");
      await expect(progress).toHaveAttribute("aria-valuemax", "7");
      const list = wizard.getByRole("list", { name: "Etapas do formulário" });
      const items = list.getByRole("listitem");
      await expect(items).toHaveCount(stages.length);
      for (const [index, stage] of stages.entries()) await expect(items.nth(index)).toContainText(stage);
      await expect(items.first()).toHaveAttribute("aria-current", "step");
      await expect(wizard.getByRole("button", { name: "Salvar rascunho", exact: true })).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));

      const quickTabs = page.getByRole("navigation", { name: "Navegação rápida do organizador" });
      if (await quickTabs.isVisible()) {
        if (page.viewportSize()?.width === 320)
          expect(await list.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(2);
        // Start with the action actually hidden by the bar, then use real Tab.
        await wizard.locator('input[type="file"][accept="video/mp4,video/webm"]').focus();
        const tabTop = async () => (await quickTabs.boundingBox())!.y;
        const actionBottom = async () => {
          const bounds = (await saveAndContinue.boundingBox())!;
          return bounds.y + bounds.height;
        };
        await saveAndContinue.evaluate((node, top) => {
          window.scrollBy(0, node.getBoundingClientRect().bottom - top - 12);
        }, await tabTop());
        expect(await actionBottom()).toBeGreaterThan(await tabTop());
        await page.keyboard.press("Tab");
        await expect(saveAndContinue).toBeFocused();
        await expect.poll(async () => (await tabTop()) - (await actionBottom())).toBeGreaterThanOrEqual(4);
      }
      // Empty required fields must hit the existing client validation, not a write.
      await saveAndContinue.click();
      await expect(wizard.getByRole("alert")).toHaveText("Informe o título da campanha.");
      await expect(progress).toHaveAttribute("aria-valuenow", "1");
      expect(writeAttempts).toEqual([]);

      const id = await ownerCampaignId(page, draftTitle);
      await page.goto(`/dashboard/campanhas/${id}/editar`);
      const edit = page.getByRole("region", { name: "Editar rifa" });
      await expect(edit.getByRole("textbox", { name: "Título", exact: true })).toHaveValue(draftTitle);
      await expect(edit.getByRole("textbox", { name: "Descrição curta (opcional)" })).toHaveValue("Descrição sintética já persistida.");
      await expect(edit.getByRole("button", { name: "Salvar rascunho", exact: true })).toBeEnabled();
      await expect(edit.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
      expect(writeAttempts).toEqual([]);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/wizard-${testInfo.project.name}-${colorScheme}.png`,
          animations: "disabled",
          fullPage: true,
        });
      }

      const published = await ownerCampaignId(page, publicationTitle);
      await page.goto(`/dashboard/campanhas/${published}/editar`);
      await expect(edit.getByRole("textbox", { name: "Título", exact: true })).toHaveValue(publicationTitle);
      await expect(edit.getByText("Campanha publicada:", { exact: true })).toBeVisible();
      await expect(edit.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
      expect(writeAttempts).toEqual([]);
    });
  }

  test("outra conta não recebe dados do rascunho", async ({ page, browser, baseURL }) => {
    const id = await ownerCampaignId(page, draftTitle);
    const email = process.env.E2E_SECOND_ORGANIZER_EMAIL;
    const password = process.env.E2E_SECOND_ORGANIZER_PASSWORD;
    if (!email || !password) throw new Error("Segunda sessão sintética indisponível.");
    const context = await browser.newContext({
      baseURL, ignoreHTTPSErrors: true, viewport: page.viewportSize(),
      storageState: { cookies: [], origins: [] },
    });
    try {
      expect((await context.request.post("/api/auth/login", { data: { email, password } })).status()).toBe(200);
      expect((await context.request.get(`/api/campaigns/${id}`)).status()).toBe(403);
      const visitor = await context.newPage();
      await visitor.goto(`/dashboard/campanhas/${id}/editar`);
      const wizard = visitor.getByRole("region", { name: "Editar rifa" });
      await expect(wizard.getByRole("alert")).toBeVisible();
      await expect(wizard.getByRole("textbox", { name: "Título", exact: true })).toHaveValue("");
      await expect(wizard.getByRole("textbox", { name: "Descrição curta (opcional)" })).toHaveValue("");
    } finally {
      await context.close();
    }
  });
});
