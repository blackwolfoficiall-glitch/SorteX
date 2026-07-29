import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("organizador aprovado pode seguir para o Dashboard", async ({ page }) => {
  await page.goto("/organizador/verificacao");
  await expect(page.getByRole("heading", { name: "Cadastro aprovado!" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ir para o Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver meu perfil" })).toHaveAttribute("href", "/perfil");
  await page.getByRole("button", { name: "Ir para o Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("enquadramento persiste e roleta ativa aparece na campanha pública", async ({ page }) => {
  const suffix = Date.now();
  const slug = `homologacao-enquadramento-roleta-${suffix}`;
  const now = new Date();
  const draw = new Date(now.getTime() + 7 * 86400000);
  const response = await page.context().request.post("/api/campaigns", { data: {
    title: `Homologação enquadramento e roleta ${suffix}`,
    slug,
    regulation: "Campanha exclusiva de homologação automatizada.",
    category: "AUTOMOBILE",
    mainPrizeName: "Prêmio de homologação",
    mainPrizeDescription: "Imagem e roleta usadas somente para validação.",
    estimatedPrizeValue: 1000,
    totalNumbers: 1000,
    numberPrice: 1,
    minimumPurchase: 1,
    maximumPurchasePerBuyer: 1000,
    numberSelectionMode: "RANDOM",
    drawDate: draw.toISOString(),
    drawTime: "20:00",
    drawBasis: "MANUAL_RESULT",
    salesStartAt: now.toISOString(),
    customization: { useOrganizerDefaults: true },
  }});
  expect(response.ok(), await response.text()).toBeTruthy();
  const campaign = await response.json() as { id: string };
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zt9sAAAAASUVORK5CYII=", "base64");
  const upload = await page.context().request.post(`/api/campaigns/${campaign.id}/images`, { multipart: { target: "COVER", files: { name: "homologacao.png", mimeType: "image/png", buffer: png } } });
  expect(upload.ok(), await upload.text()).toBeTruthy();

  await page.goto(`/dashboard/campanhas/${campaign.id}/editar`);
  await page.getByRole("button", { name: "Ajustar imagem" }).click();
  await page.getByLabel("Zoom da imagem").fill("1.2");
  await page.getByRole("button", { name: "Celular" }).click();
  await page.getByLabel("Zoom da imagem").fill("1.35");
  await page.getByRole("button", { name: "Aplicar enquadramento" }).click();
  await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/campanhas\?status=DRAFT/);

  const savedResponse = await page.context().request.get(`/api/campaigns/${campaign.id}`);
  const saved = await savedResponse.json() as { customization?: { configuration?: Record<string, unknown> } };
  expect(saved.customization?.configuration).toMatchObject({ heroImage: { desktop: { zoom: 1.2 }, mobile: { zoom: 1.35 } } });
  const customization = { ...(saved.customization?.configuration || {}), roulette: { enabled: true, name: "Roleta de Homologação", rules: [{ id: "r1", minQuantity: 100, rounds: 1 }, { id: "r2", minQuantity: 200, rounds: 2 }], items: [{ id: "p1", name: "Vale homologação", type: "GIFT_CARD", quantity: 2, probability: 100, isActive: true }] } };
  const update = await page.context().request.patch(`/api/campaigns/${campaign.id}`, { data: { customization } });
  expect(update.ok(), await update.text()).toBeTruthy();
  const publish = await page.context().request.post(`/api/campaigns/${campaign.id}/publish`);
  expect(publish.ok(), await publish.text()).toBeTruthy();

  const publicResponse = await page.context().request.get(`/api/public/campaigns/${slug}`);
  expect(publicResponse.ok(), await publicResponse.text()).toBeTruthy();
  const publicCampaign = await publicResponse.json() as { customization?: { configuration?: { roulette?: Record<string, unknown> } } };
  const publicRoulette = publicCampaign.customization?.configuration?.roulette;
  expect(publicRoulette).toMatchObject({ enabled: true, rules: [{ minQuantity: 100, rounds: 1 }, { minQuantity: 200, rounds: 2 }] });
  expect(publicRoulette).not.toHaveProperty("items");
  expect(JSON.stringify(publicRoulette)).not.toContain("Vale homologação");
  expect(JSON.stringify(publicRoulette)).not.toContain("probability");

  await page.goto(`/campanha/${slug}`);
  await expect(page.getByTestId("public-campaign-header")).toBeVisible();
  await expect(page.getByTestId("public-campaign-header").getByRole("button", { name: "Meus Títulos" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu da campanha" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "Meus títulos" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Campanhas" })).toHaveAttribute("href", "/");
  await expect(menu.getByRole("button", { name: "Consultar pedidos" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Regulamento" })).toHaveAttribute("href", "#regulamento");
  await expect(menu.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute("href", /\/privacidade\?returnTo=/);
  await expect(menu.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", /\/termos\?returnTo=/);
  await page.getByRole("button", { name: "Fechar menu" }).last().click();
  await page.getByTestId("public-campaign-header").getByRole("button", { name: "Meus Títulos" }).click();
  await expect(page.getByRole("dialog", { name: "Meus Títulos" })).toBeVisible();
  await expect(page.getByText("Entre para consultar seus títulos nesta campanha.")).toBeVisible();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Roletas instantâneas" })).toBeVisible();
  await expect(page.getByText("2 prêmios disponíveis")).toHaveCount(0);
  await expect(page.getByText("Vale homologação")).toHaveCount(0);
  const combo = page.getByRole("button", { name: "Combo de 100 títulos com 1 giro" });
  await expect(combo).toBeVisible();
  await combo.click();
  await expect(combo).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("roulette-purchase-summary")).toContainText("100 títulos");
  await expect(page.getByTestId("roulette-purchase-summary")).toContainText("1 giro");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByText("Powered by SorteX")).toBeVisible();
  await page.getByRole("button", { name: "Informações" }).click();
  await expect(page.getByRole("link", { name: "Excluir dados" })).toHaveAttribute("href", /\/privacidade\?returnTo=.*#exclusao-de-dados/);
  await expect(page.getByRole("button", { name: "Voltar ao topo" })).toBeVisible();
});
