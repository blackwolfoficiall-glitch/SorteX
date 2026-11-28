import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const url = "/dashboard/configuracoes";
const panel = (page: Page) =>
  page.getByRole("region", { name: "Configurações", exact: true });
const destinations = [
  ["Perfil", "/perfil"],
  ["Meu plano", "/dashboard/configuracoes/plano"],
  ["Central Jurídica", "/dashboard/configuracoes/juridico"],
  ["Personalização", "/dashboard/personalizacao"],
  ["Domínio próprio", "/dashboard/personalizacao/dominio"],
  ["Redes sociais e comunidades", "/dashboard/personalizacao/redes-sociais"],
] as const;

async function prepare(
  context: BrowserContext,
  baseURL: string,
  user: "organizer1" | "organizer2" | "buyer1" | "admin",
) {
  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) throw new Error("Credenciais sintéticas indisponíveis.");
  const login = user === "admin" ? "/api/auth/admin-login" : "/api/auth/login";
  expect(
    (
      await context.request.post(login, {
        data: { email: `${user}@sortex.example.invalid`, password },
      })
    ).status(),
  ).toBe(200);
  const person = await context.request.get("/api/auth/me");
  expect(person.status()).toBe(200);
  const { id, role } = (await person.json()) as { id: string; role: string };
  expect(role).toBe(
    user === "admin"
      ? "ADMIN"
      : user.startsWith("organizer")
        ? "ORGANIZER"
        : "BUYER",
  );
  expect(id).toBeTruthy();
  const prohibited: string[] = [];
  await context.route("**/*", (intercepted) => {
    const target = new URL(intercepted.request().url());
    const method = intercepted.request().method();
    if (
      target.origin !== new URL(baseURL).origin ||
      (target.pathname.startsWith("/api/") &&
        (!["GET", "HEAD"].includes(method) ||
          target.pathname.includes("/oauth/")))
    ) {
      prohibited.push(method);
      return intercepted.abort("blockedbyclient");
    }
    return intercepted.continue();
  });
  return { id, prohibited };
}

test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test.describe("Configurações Premium do organizador, somente leitura", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(
      process.env.SORTEX_DISPOSABLE_ORGANIZER_CONFIG !== "yes",
      "Requer contas sintéticas em ambiente local.",
    );
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1")
      throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`mostra seis destinos originais com teclado no tema ${colorScheme}`, async ({
      page,
      context,
      baseURL,
    }, info) => {
      const { prohibited } = await prepare(context, baseURL!, "organizer1");
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(url);
      const own = panel(page);
      await expect(own).toHaveCSS("color-scheme", colorScheme);
      const sections = own.getByRole("navigation", {
        name: "Seções de configurações",
      });
      await expect(sections.getByRole("link")).toHaveCount(destinations.length);
      for (const [title, href] of destinations) {
        const link = sections.getByRole("link", { name: title, exact: true });
        await expect(link).toHaveAttribute("href", href);
        await expect(link).toHaveAccessibleDescription(/\S/);
      }
      await sections.getByRole("link", { name: "Perfil", exact: true }).focus();
      for (const [title] of destinations.slice(1)) {
        await page.keyboard.press("Tab");
        await expect(
          sections.getByRole("link", { name: title, exact: true }),
        ).toBeFocused();
      }
      if ((page.viewportSize()?.width ?? 0) <= 320) {
        const dock = page.getByRole("navigation", {
          name: "Navegação rápida do organizador",
        });
        const last = sections.getByRole("link", {
          name: "Redes sociais e comunidades",
        });
        await expect
          .poll(async () => {
            const bound = (await last.boundingBox())!;
            return (await dock.boundingBox())!.y - (bound.y + bound.height);
          })
          .toBeGreaterThanOrEqual(4);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      expect(prohibited).toEqual([]);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/organizer-config-${info.project.name}-${colorScheme}.png`,
          animations: "disabled",
        });
      }
    });
  }

  test("acesso preservado para organizadores e bloqueado para perfis sem esse papel", async ({
    browser,
    context,
    page,
    baseURL,
  }) => {
    const owner = await prepare(context, baseURL!, "organizer1");
    for (const user of ["organizer2", "buyer1", "admin"] as const) {
      const other = await browser.newContext({
        baseURL,
        ignoreHTTPSErrors: true,
        viewport: page.viewportSize(),
        storageState: { cookies: [], origins: [] },
      });
      try {
        const session = await prepare(other, baseURL!, user);
        expect(session.id === owner.id).toBe(false);
        const target = await other.newPage();
        await target.goto(url);
        if (user === "organizer2") {
          const sections = panel(target).getByRole("navigation", {
            name: "Seções de configurações",
          });
          await expect(sections.getByRole("link")).toHaveCount(
            destinations.length,
          );
          await sections
            .getByRole("link", { name: "Personalização", exact: true })
            .click();
          await expect(target).toHaveURL(/\/dashboard\/personalizacao$/);
          await expect(
            target.getByRole("heading", {
              name: "Personalização",
              exact: true,
            }),
          ).toBeVisible();
        } else {
          await expect.poll(() => new URL(target.url()).pathname).not.toBe(url);
          await expect(panel(target)).toHaveCount(0);
        }
        expect(session.prohibited).toEqual([]);
      } finally {
        await other.close();
      }
    }
  });
});
