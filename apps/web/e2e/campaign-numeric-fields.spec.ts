import { expect, test } from "@playwright/test";

const testPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64",
);

type Campaign = {
  id: string;
  slug: string;
  status: string;
  totalNumbers: number;
  salesStartAt?: string | null;
};

test("campos numéricos, início das vendas e controles de compra persistem", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const response = await page.request.get("/api/campaigns/my");
  expect(response.ok()).toBeTruthy();
  const campaigns = (await response.json()) as Campaign[];
  let campaign = campaigns.find((item) => item.status === "DRAFT");
  const publicCampaign = campaigns.find((item) => item.status === "PUBLISHED");
  if (!campaign) {
    const created = await page.request.post("/api/campaigns", {
      data: {
        title: "Campanha numérica de homologação",
        slug: `campanha-numerica-homologacao-${Date.now()}`,
        category: "OTHER",
        regulation: "Regulamento exclusivo para homologação.",
        mainPrizeName: "Prêmio de homologação",
        mainPrizeDescription: "Prêmio fictício exclusivo para homologação.",
        totalNumbers: 1000,
        numberPrice: 1,
        minimumPurchase: 1,
        maximumPurchasePerBuyer: 500,
        numberSelectionMode: "RANDOM",
        drawDate: "2026-07-28",
        drawTime: "20:00",
        drawBasis: "LOTERIA_FEDERAL",
        salesStartAt: "2026-07-20T12:00:00.000Z",
      },
    });
    expect(created.ok()).toBeTruthy();
    campaign = (await created.json()) as Campaign;
  }

  await page.goto(`/dashboard/campanhas/${campaign.id}/editar`);
  await expect(page.getByRole("heading", { name: "Dados da rifa" })).toBeVisible();

  const prizeDescription = page.getByLabel("Descrição do prêmio");
  if ((await prizeDescription.inputValue()).trim() === "")
    await prizeDescription.fill("Prêmio fictício exclusivo para homologação.");
  const regulation = page.getByLabel("Regulamento");
  if ((await regulation.inputValue()).trim() === "")
    await regulation.fill("Regulamento exclusivo da campanha de homologação.");
  if (await page.getByText("0 imagens").isVisible()) {
    await page.getByLabel("Selecionar imagens do prêmio").setInputFiles({
      name: "premio-homologacao.png",
      mimeType: "image/png",
      buffer: testPng,
    });
  }

  const salesStart = page.getByLabel("Início das vendas");
  const originalStart = await salesStart.inputValue();
  const nextStart = originalStart.endsWith(":15")
    ? `${originalStart.slice(0, -2)}16`
    : `${originalStart.slice(0, -2)}15`;
  expect(nextStart).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  await salesStart.fill(nextStart);
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("heading", { name: "Configuração" })).toBeVisible();

  const total = page.getByLabel("Quantidade personalizada");
  await total.fill("");
  await expect(total).toHaveValue("");
  const nextTotal = campaign.totalNumbers === 1001 ? 1002 : 1001;
  await total.fill(String(nextTotal));
  await expect(total).toHaveValue(String(nextTotal));
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("heading", { name: "Prêmios" })).toBeVisible();

  const prizeCount = page.getByLabel("Quantidade de cotas");
  await prizeCount.fill("");
  await expect(prizeCount).toHaveValue("");
  await prizeCount.fill("2");
  await expect(prizeCount).toHaveValue("2");
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByRole("heading", { name: "Promoções" })).toBeVisible();

  const purchased = page.getByLabel("Quantidade comprada").first();
  await purchased.fill("");
  await expect(purchased).toHaveValue("");
  await purchased.fill("125");
  await expect(purchased).toHaveValue("125");

  const persistedResponse = await page.request.get(`/api/campaigns/${campaign.id}`);
  expect(persistedResponse.ok()).toBeTruthy();
  const persisted = (await persistedResponse.json()) as Campaign;
  expect(persisted.totalNumbers).toBe(nextTotal);
  expect(new Date(persisted.salesStartAt ?? "").getTime()).toBe(
    new Date(nextStart).getTime(),
  );

  await page.reload();
  await expect(page.getByLabel("Início das vendas")).toHaveValue(nextStart);
  await page.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByLabel("Quantidade personalizada")).toHaveValue(String(nextTotal));

  if (publicCampaign) {
    await page.goto(`/campanha/${publicCampaign.slug}`);
    const quantity = page.getByLabel("Quantidade");
    const minimum = Number(await quantity.inputValue());
    await quantity.fill("");
    await expect(quantity).toHaveValue("");
    await quantity.fill(String(minimum + 2));
    await page.getByRole("button", { name: "Aumentar" }).click();
    await expect(quantity).toHaveValue(String(minimum + 3));
    await page.getByRole("button", { name: "Diminuir" }).click();
    await expect(quantity).toHaveValue(String(minimum + 2));
  }
});
