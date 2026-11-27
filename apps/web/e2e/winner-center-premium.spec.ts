import { expect, test, type Page } from "@playwright/test";

const pilot = "Campanha Piloto de Homologação";
const archive = "Campanha sintética de histórico alternativo";
const url = "/dashboard/campanhas/ganhadores";
const historyPath = (id: string) => `/api/draws/campaigns/${id}/winner-lookup/history`;

async function campaignId(page: Page, title: string) {
  const response = await page.request.get("/api/campaigns/my");
  expect(response.status()).toBe(200);
  const records = (await response.json()) as { id: string; title: string }[];
  const record = records.find((campaign) => campaign.title === title);
  if (!record) throw new Error("Campanha sintética indisponível.");
  return record.id;
}

test.describe("Ganhadores Premium somente leitura", () => {
  test.beforeEach(async ({ baseURL, page }) => {
    test.skip(process.env.SORTEX_DISPOSABLE_WINNER_CENTER !== "yes", "Requer fixtures sintéticas em banco descartável.");
    if (!baseURL || new URL(baseURL).hostname !== "127.0.0.1") throw new Error("Use exclusivamente em loopback.");
    await page.route("**/api/draws/**", (route) => {
      if (!["GET", "HEAD"].includes(route.request().method())) return route.abort("blockedbyclient");
      return route.continue();
    });
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`exibe auditoria persistida e protege a navegação a 320px no tema ${colorScheme}`, async ({ page }, testInfo) => {
      const pilotId = await campaignId(page, pilot);
      const auditPath = historyPath(pilotId);
      const earlier = await page.request.get(auditPath);
      expect(earlier.status()).toBe(200);
      const before = await earlier.json();
      expect(before).toHaveLength(1);
      expect(before[0]).toMatchObject({
        action: "WINNER_LOOKUP_AUTOMATIC",
        newData: { informedNumber: "00314", resolvedNumber: 314, found: true },
      });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(url);
      const panel = page.getByRole("region", { name: "Ganhadores", exact: true });
      const history = panel.getByRole("region", { name: "Histórico de consultas" });
      await expect(panel).toHaveCSS("color-scheme", colorScheme);
      const campaign = panel.getByRole("combobox", { name: "Campanha", exact: true });
      await campaign.selectOption(pilotId);
      await expect(history.getByText("00314", { exact: true })).toBeVisible();
      await expect(history.getByText("314", { exact: true })).toBeVisible();
      await expect(history.getByText("Localizado", { exact: true })).toBeVisible();
      await expect(history.getByText("Organizador Alfa", { exact: true })).toBeVisible();
      expect(await history.locator("time").getAttribute("datetime")).toBe(before[0].createdAt);
      await expect(panel.getByRole("heading", { name: "Pronto para localizar o ganhador" })).toBeVisible();
      await expect(panel.getByRole("button", { name: /Resultado automático/ })).toHaveAttribute("aria-pressed", "true");

      await panel.getByRole("button", { name: /Resultado manual/ }).click();
      const input = panel.getByRole("textbox", { name: "Número vencedor" });
      const resolve = panel.getByRole("button", { name: "Ver ganhador", exact: true });
      await expect(resolve).toBeDisabled();
      await input.fill("00A314");
      await expect(input).toHaveValue("00314");
      await expect(resolve).toBeEnabled();
      const tabs = page.getByRole("navigation", { name: "Navegação rápida do organizador" });
      if (await tabs.isVisible()) {
        await input.focus();
        const tabTop = async () => (await tabs.boundingBox())!.y;
        const buttonBottom = async () => {
          const rect = (await resolve.boundingBox())!;
          return rect.y + rect.height;
        };
        await resolve.evaluate((node, top) => {
          window.scrollBy(0, node.getBoundingClientRect().bottom - top - 12);
        }, await tabTop());
        expect(await buttonBottom()).toBeGreaterThan(await tabTop());
        await page.keyboard.press("Tab");
        await expect(resolve).toBeFocused();
        await expect.poll(async () => (await tabTop()) - (await buttonBottom())).toBeGreaterThanOrEqual(4);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      const after = await page.request.get(auditPath);
      expect(await after.json()).toEqual(before);
      if (process.env.SORTEX_NAV_CAPTURE_DIR) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.SORTEX_NAV_CAPTURE_DIR}/winners-${testInfo.project.name}-${colorScheme}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    });
  }

  test("distingue falhas de carregamento e não utiliza histórico atrasado de outra campanha", async ({ page }) => {
    const pilotId = await campaignId(page, pilot);
    const archiveId = await campaignId(page, archive);
    await page.route("**/api/campaigns/my", (route) => route.abort("failed"), { times: 1 });
    await page.goto(url);
    const panel = page.getByRole("region", { name: "Ganhadores", exact: true });
    const history = panel.getByRole("region", { name: "Histórico de consultas" });
    const campaign = panel.getByRole("combobox", { name: "Campanha", exact: true });
    await expect(panel.getByRole("alert")).toContainText("Não foi possível carregar suas campanhas.");
    await expect(panel.getByRole("heading", { name: "Nenhuma campanha disponível" })).toHaveCount(0);
    await panel.getByRole("button", { name: "Tentar novamente", exact: true }).click();
    await campaign.selectOption(archiveId);
    await expect(history.getByText("00999", { exact: true })).toBeVisible();

    await page.route(`**${historyPath(pilotId)}`, (route) => route.abort("failed"), { times: 1 });
    await campaign.selectOption(pilotId);
    await expect(history.getByRole("alert")).toContainText("Não foi possível carregar o histórico.");
    await expect(history.getByText("00999", { exact: true })).toHaveCount(0);
    await history.getByRole("button", { name: "Tentar novamente", exact: true }).click();
    await expect(history.getByText("00314", { exact: true })).toBeVisible();
    await campaign.selectOption(archiveId);
    await expect(history.getByText("00999", { exact: true })).toBeVisible();

    let resume = () => {};
    const delayed = new Promise<void>((resolve) => { resume = resolve; });
    await page.route(`**${historyPath(pilotId)}`, async (route) => {
      await delayed;
      await route.continue();
    }, { times: 1 });
    try {
      const receivedOld = page.waitForResponse((response) => response.url().endsWith(historyPath(pilotId)) && response.ok());
      await campaign.selectOption(pilotId);
      await expect(history.getByRole("status")).toHaveText("Carregando histórico…");
      await campaign.selectOption(archiveId);
      await expect(history.getByText("00999", { exact: true })).toBeVisible();
      resume();
      const older = await receivedOld;
      await older.finished();
      await expect(history.getByText("00314", { exact: true })).toHaveCount(0);
      await expect(history.getByText("Não localizado", { exact: true })).toBeVisible();
    } finally {
      resume();
    }
  });

  test("apuração verificada e histórico ficam restritos ao organizador dono", async ({ page, browser, baseURL }) => {
    const id = await campaignId(page, pilot);
    const drawPath = `/api/draws/campaigns/${id}/draw`;
    const approved = await page.request.get(drawPath);
    expect(approved.status()).toBe(200);
    expect(await approved.json()).toMatchObject({
      status: "CONFIRMED", normalizedWinningNumber: "00314", auditHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      lotteryDraw: { extractionNumber: "TEST-0001", status: "VERIFIED", firstPrize: "00314", secondPrize: "12345", thirdPrize: "00042" },
      winners: expect.arrayContaining([expect.objectContaining({ winningNumber: "00314", prizeName: "Prêmio fictício" })]),
    });
    const email = process.env.E2E_SECOND_ORGANIZER_EMAIL;
    const password = process.env.E2E_SECOND_ORGANIZER_PASSWORD;
    if (!email || !password) throw new Error("Segunda sessão sintética indisponível.");
    const other = await browser.newContext({ baseURL, ignoreHTTPSErrors: true, storageState: { cookies: [], origins: [] } });
    try {
      expect((await other.request.post("/api/auth/login", { data: { email, password } })).status()).toBe(200);
      expect((await other.request.get(drawPath)).status()).toBe(403);
      expect((await other.request.get(historyPath(id))).status()).toBe(403);
      const visitor = await other.newPage();
      await visitor.goto(url);
      const campaign = visitor.getByRole("combobox", { name: "Campanha", exact: true });
      await expect(campaign.locator("option")).toHaveText(["Rascunho Homologação"]);
      await expect(visitor.getByText("Nenhuma consulta registrada para esta campanha.", { exact: true })).toBeVisible();
      await expect(visitor.getByText("00314", { exact: true })).toHaveCount(0);
    } finally {
      await other.close();
    }
  });
});
