import { expect, test, type BrowserContext } from "@playwright/test";

const draft = "qa-prize-draft";
const blocked = "qa-prize-blocked";
const publishedPage = (id: string) => `/dashboard/campanhas/${id}/publicada`;
const edit = (id: string) => `/dashboard/campanhas/${id}/editar`;
const api = (id: string) => `/api/campaigns/${id}`;

async function signIn(
  context: BrowserContext,
  user: "organizer1" | "organizer2",
) {
  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) throw new Error("Credenciais sintéticas indisponíveis.");
  const result = await context.request.post("/api/auth/login", {
    data: { email: `${user}@sortex.example.invalid`, password },
  });
  expect(result.status()).toBe(200);
}

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe("prêmios e confirmação de campanha do organizador", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(
      process.env.SORTEX_DISPOSABLE_ORGANIZER_PRIZE_PUBLICATION !== "yes",
      "Requer campanhas fictícias em banco descartável.",
    );
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
      throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`campos de prêmios e divulgação fiel ao estado no tema ${colorScheme}`, async ({
      page,
      context,
      browser,
      baseURL,
    }, info) => {
      await signIn(context, "organizer1");
      const forbidden: string[] = [];
      const localWrites: string[] = [];
      let navigatingDraft = true;
      const origin = new URL(baseURL!).origin;
      await context.route("**/*", (intercepted) => {
        const target = new URL(intercepted.request().url());
        const method = intercepted.request().method();
        if (
          target.origin === origin &&
          navigatingDraft &&
          method === "PATCH" &&
          target.pathname === api(draft)
        ) {
          localWrites.push(method);
          return intercepted.continue();
        }
        if (
          target.origin !== origin ||
          (target.pathname.startsWith("/api/") &&
            !["GET", "HEAD"].includes(method))
        ) {
          forbidden.push(method);
          return intercepted.abort("blockedbyclient");
        }
        return intercepted.continue();
      });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      const list = await context.request.get("/api/campaigns/my");
      expect(list.status()).toBe(200);
      const published = (
        (await list.json()) as { id: string; slug: string }[]
      ).find(({ slug }) => slug === "campanha-piloto-homologacao");
      if (!published)
        throw new Error("Campanha publicada sintética indisponível.");
      await page.goto(edit(draft));
      for (const step of ["Configuração", "Prêmios"]) {
        const save = page.waitForResponse(
          (r) =>
            r.url().endsWith(api(draft)) && r.request().method() === "PATCH",
        );
        await page
          .getByRole("button", { name: "Salvar e continuar", exact: true })
          .click();
        const saved = await save;
        if (!saved.ok()) {
          const failure = (await saved.json()) as {
            message?: string | string[];
          };
          throw new Error(
            `Falha ao salvar apenas rascunho sintético: ${Array.isArray(failure.message) ? failure.message.join("; ") : (failure.message ?? saved.status())}`,
          );
        }
        expect(saved.status()).toBe(200);
        await expect(
          page.getByRole("heading", { name: step, exact: true }),
        ).toBeVisible();
      }
      navigatingDraft = false;
      const prizes = page.getByRole("region", {
        name: "Gerenciamento de prêmios",
      });
      await expect(prizes).toHaveCSS("color-scheme", colorScheme);
      await expect(
        prizes.getByRole("heading", { name: "Prêmio principal", exact: true }),
      ).toBeVisible();
      await expect(
        prizes.getByText(/Prêmio principal sintético/),
      ).toBeVisible();
      await expect(
        prizes.getByRole("heading", { name: "Cotas premiadas", exact: true }),
      ).toBeVisible();
      await expect(
        prizes.getByRole("textbox", { name: "Número", exact: true }),
      ).toHaveValue("042");
      await expect(
        prizes.getByRole("textbox", { name: "Nome do prêmio" }).first(),
      ).toHaveValue("Cota sintética");
      await expect(
        prizes.getByRole("heading", { name: "Prêmios por Meta", exact: true }),
      ).toBeVisible();
      await expect(
        prizes.getByRole("button", { name: "Adicionar meta" }),
      ).toBeVisible();
      const mode = prizes.getByRole("combobox", { name: "Forma de escolha" });
      const count = prizes.getByLabel("Quantidade de cotas");
      await mode.focus();
      await page.keyboard.press("Tab");
      await expect(count).toBeFocused();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await prizes
          .getByRole("heading", { name: "Prêmio principal" })
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/prizes-${info.project.name}-${colorScheme}.png`,
          animations: "disabled",
        });
      }
      const ownDraft = await context.request.get(api(draft));
      expect(ownDraft.status()).toBe(200);
      expect(await ownDraft.json()).toMatchObject({
        status: "DRAFT",
        publishedAt: null,
        instantPrizes: [{ exactNumber: "042" }],
      });

      for (const id of [draft, blocked]) {
        await page.goto(publishedPage(id));
        const section = page.getByRole("region", {
          name: "Publicação da campanha",
        });
        await expect(
          section.getByRole("heading", {
            name: "Campanha indisponível para divulgação",
          }),
        ).toBeVisible();
        await expect(
          section.getByRole("link", { name: "Abrir campanha" }),
        ).toHaveCount(0);
        await expect(
          section.getByRole("button", { name: "Compartilhar campanha" }),
        ).toHaveCount(0);
        await expect(
          section.getByRole("textbox", { name: "Link público da campanha" }),
        ).toHaveCount(0);
      }
      await page.goto(publishedPage(published.id));
      const section = page.getByRole("region", {
        name: "Publicação da campanha",
      });
      await expect(section).toHaveCSS("color-scheme", colorScheme);
      await expect(
        section.getByRole("heading", {
          name: "Campanha publicada com sucesso",
        }),
      ).toBeVisible();
      const publicLink = `${origin}/campanha/${published.slug}`;
      const linkInput = section.getByRole("textbox", {
        name: "Link público da campanha",
      });
      await expect(linkInput).toHaveValue(publicLink);
      await expect(
        section.getByRole("link", { name: "Abrir campanha" }),
      ).toHaveAttribute("href", publicLink);
      await expect(
        section.getByRole("link", { name: "Editar campanha" }),
      ).toHaveAttribute("href", edit(published.id));
      await linkInput.focus();
      await page.keyboard.press("Tab");
      await expect(
        section.getByRole("button", { name: "Copiar link", exact: true }),
      ).toBeFocused();
      const share = section.getByRole("button", {
        name: "Compartilhar campanha",
      });
      await share.click();
      await expect(section.getByText("Divulgar campanha")).toBeVisible();
      await expect(
        section.getByRole("link", { name: "WhatsApp" }),
      ).toHaveAttribute("href", /^https:\/\/wa\.me\//);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      await share.click();
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/published-${info.project.name}-${colorScheme}.png`,
          animations: "disabled",
        });
      }
      expect(localWrites).toEqual(["PATCH", "PATCH"]);
      expect(forbidden).toEqual([]);

      if (colorScheme === "light" && info.project.name === "desktop") {
        const other = await browser.newContext({
          baseURL,
          ignoreHTTPSErrors: true,
        });
        try {
          await signIn(other, "organizer2");
          expect((await other.request.get(api(published.id))).status()).toBe(
            403,
          );
          const visitor = await other.newPage();
          await visitor.goto(publishedPage(published.id));
          const denied = visitor.getByRole("region", {
            name: "Publicação da campanha",
          });
          await expect(denied.getByRole("alert")).toBeVisible();
          await expect(
            denied.getByRole("link", { name: "Abrir campanha" }),
          ).toHaveCount(0);
          await expect(
            denied.getByRole("heading", {
              name: "Campanha publicada com sucesso",
            }),
          ).toHaveCount(0);
        } finally {
          await other.close();
        }
      }
    });
  }
});
