import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const endpoint = "/api/buyer/notifications";
const routeUrl = "/comprador/notificacoes";
const ownUnread = "Aviso fictício não lido";
const ownRead = "Aviso fictício já lido";
const foreign = "Aviso privado de outra conta sintética";
const expired = "Aviso fictício removido";
const region = (page: Page) => page.getByRole("region", { name: "Notificações", exact: true });
type Row = { title: string; createdAt: string; readAt: string | null };

async function signInSynthetic(context: BrowserContext, index: number) {
  const password = process.env.E2E_BUYER_PASSWORD;
  if (!password) throw new Error("Credenciais sintéticas indisponíveis.");
  const signed = await context.request.post("/api/auth/login", {
    data: { email: `buyer${index}@sortex.example.invalid`, password },
  });
  expect(signed.status()).toBe(200);
  const who = await context.request.get("/api/auth/me");
  expect(who.status()).toBe(200);
  expect((await who.json()).role).toBe("BUYER");
}

async function guard(context: BrowserContext, sameOrigin: string) {
  const writes: string[] = [];
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.origin !== sameOrigin) return route.abort("blockedbyclient");
    if (url.pathname.startsWith("/api/") && !["GET", "HEAD"].includes(method)) {
      writes.push(method);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return writes;
}

test.use({ storageState: { cookies: [], origins: [] }, trace: "off", screenshot: "off", video: "off" });

test.describe("notificações Premium do comprador em modo de leitura", () => {
  test.beforeEach(async ({ baseURL }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_NOTIFICATIONS !== "yes", "Requer ambiente local e notificações sintéticas.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Use exclusivamente em loopback.");
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`preserva estado da caixa, teclado e largura no tema ${colorScheme}`, async ({ page, context, baseURL }, info) => {
      await signInSynthetic(context, 1);
      const writes = await guard(context, new URL(baseURL!).origin);
      const beforeResponse = await context.request.get(endpoint);
      expect(beforeResponse.status()).toBe(200);
      const before = (await beforeResponse.json()) as Row[];
      expect(before).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: ownRead, readAt: expect.any(String) }),
        expect.objectContaining({ title: ownUnread, readAt: null }),
      ]));
      expect(before.map(({ title }) => title)).not.toContain(expired);
      expect(before.map(({ title }) => title)).not.toContain(foreign);
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });

      let release = () => {};
      const wait = new Promise<void>((resolve) => { release = resolve; });
      await page.route(`**${endpoint}`, async (route) => {
        await wait;
        await route.continue();
      }, { times: 1 });
      try {
        await page.goto(routeUrl);
        await expect(region(page).getByRole("status")).toContainText("Atualizando notificações…");
      } finally {
        release();
      }
      const panel = region(page);
      await expect(panel).toHaveCSS("color-scheme", colorScheme);
      await expect(panel).toHaveAttribute("aria-busy", "false");
      const list = panel.getByRole("list", { name: "Caixa de notificações" });
      await expect(list.getByRole("listitem")).toHaveCount(before.length);
      await expect(list.getByRole("heading", { name: foreign })).toHaveCount(0);
      await expect(list.getByRole("heading", { name: expired })).toHaveCount(0);
      const item = (title: string) => list.getByRole("listitem").filter({
        has: page.getByRole("heading", { name: title, exact: true }),
      });
      const unread = item(ownUnread);
      await expect(unread.getByText("Não lida", { exact: true })).toBeVisible();
      await expect(item(ownRead).getByText("Lida", { exact: true })).toBeVisible();
      await expect(item(ownRead).getByRole("button")).toHaveCount(0);
      await expect(unread.locator("time")).toHaveAttribute("datetime", before.find(({ title }) => title === ownUnread)!.createdAt);
      const unreadCount = before.filter(({ readAt }) => !readAt).length;
      await expect(panel.getByText(unreadCount === 1 ? "1 não lida" : `${unreadCount} não lidas`, { exact: true })).toBeVisible();
      await expect(panel.getByRole("button", { name: "Marcar todas como lidas" })).toBeEnabled();

      const mark = unread.getByRole("button", { name: `Marcar como lida: ${ownUnread}` });
      const refresh = panel.getByRole("button", { name: "Atualizar notificações" });
      await mark.focus();
      if ((page.viewportSize()?.width ?? 0) <= 320) {
        const tab = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Perfil", exact: true }) });
        const participates = tab.getByRole("link", { name: "Participar", exact: true });
        const tabTop = async () => Math.min((await tab.boundingBox())!.y, (await participates.boundingBox())!.y);
        const buttonBottom = async () => {
          const bound = (await refresh.boundingBox())!;
          return bound.y + bound.height;
        };
        await refresh.evaluate((node, top) => window.scrollBy(0, node.getBoundingClientRect().bottom - top - 12), await tabTop());
        expect(await buttonBottom()).toBeGreaterThan(await tabTop());
        await page.keyboard.press("Tab");
        await expect(refresh).toBeFocused();
        await expect.poll(async () => (await tabTop()) - (await buttonBottom())).toBeGreaterThanOrEqual(4);
      } else {
        await page.keyboard.press("Tab");
        await expect(refresh).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      const refreshed = page.waitForResponse((r) => r.url().endsWith(endpoint) && r.request().method() === "GET");
      await refresh.click();
      expect(await (await refreshed).json()).toEqual(before);
      await expect(panel).toHaveAttribute("aria-busy", "false");
      await expect(unread.getByText("Não lida", { exact: true })).toBeVisible();
      expect(writes).toEqual([]);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/inbox-${info.project.name}-${colorScheme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }

  test("falha e recuperação não misturam usuários nem anunciam caixa vazia por engano", async ({ browser, baseURL, page: viewportSource }) => {
    for (const index of [2, 3]) {
      const local = await browser.newContext({ baseURL, ignoreHTTPSErrors: true, viewport: viewportSource.viewportSize(), storageState: { cookies: [], origins: [] } });
      try {
        await signInSynthetic(local, index);
        const writes = await guard(local, new URL(baseURL!).origin);
        const page = await local.newPage();
        if (index === 2) await page.route(`**${endpoint}`, (route) => route.abort("failed"), { times: 1 });
        await page.goto(routeUrl);
        const panel = region(page);
        if (index === 2) {
          await expect(panel.getByRole("alert")).toContainText("Não foi possível carregar a caixa de notificações.");
          await expect(panel.getByText("Nenhuma notificação.", { exact: true })).toHaveCount(0);
          await panel.getByRole("button", { name: "Tentar novamente" }).click();
          await expect(panel.getByRole("heading", { name: foreign, exact: true })).toBeVisible();
          await expect(panel.getByRole("alert")).toHaveCount(0);
        } else {
          await expect(panel.getByRole("heading", { name: "Nenhuma notificação.", exact: true })).toBeVisible();
          await expect(panel.getByRole("button", { name: "Marcar todas como lidas" })).toHaveCount(0);
        }
        await expect(panel.getByRole("heading", { name: ownUnread, exact: true })).toHaveCount(0);
        expect(writes).toEqual([]);
      } finally {
        await local.close();
      }
    }
  });
});
