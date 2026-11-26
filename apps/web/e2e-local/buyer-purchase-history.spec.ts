import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

test.use({ storageState: { cookies: [], origins: [] } });

const local = process.env.SORTEX_BUYER_HISTORY_LOCAL === "1";
const campaign = "Campanha Piloto de Homologação";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/comprador\/?$/);
}

async function logout(page: Page) {
  await page.getByRole("link", { name: "Perfil", exact: true }).click();
  await page
    .getByRole("button", { name: "Sair da conta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
}

test("histórico, status e títulos só aparecem para o comprador correto", async ({
  page,
  baseURL,
}) => {
  test.skip(
    !local,
    "Requer o seed sintético do banco descartável em loopback.",
  );
  if (!local || !baseURL || new URL(baseURL).hostname !== "127.0.0.1")
    throw new Error("Este cenário aceita apenas a web local em 127.0.0.1.");
  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) throw new Error("Defina a senha sintética do seed local.");

  const owner = "buyer1@sortex.example.invalid";
  const other = "buyer2@sortex.example.invalid";
  const history = "/comprador/meus-numeros";
  const viewHistory = () =>
    page.getByRole("link", { name: "Meus títulos", exact: true }).click();
  const paidPurchase = () =>
    page
      .locator('a[href^="/comprador/compras/"]')
      .filter({ hasText: campaign });
  const empty = page.getByRole("heading", {
    name: "Nenhuma compra nesta categoria",
  });

  await login(page, owner, password);
  await viewHistory();
  await expect(page).toHaveURL(new RegExp(`${history}$`));
  const cancelledFilter = page.getByRole("button", {
    name: "Canceladas",
    exact: true,
  });
  const paidFilter = page.getByRole("button", { name: "Pagas", exact: true });
  await cancelledFilter.click();
  await expect(empty).toBeVisible();
  await cancelledFilter.click();
  await expect(empty).toBeVisible();
  await paidFilter.click();
  await expect(paidPurchase().getByText("Paga", { exact: true })).toBeVisible();
  await expect(paidPurchase().getByText("42", { exact: true })).toBeVisible();
  const detailUrl = await paidPurchase().getAttribute("href");
  expect(detailUrl).toMatch(/^\/comprador\/compras\/[^/]+$/);
  const id = detailUrl!.split("/").at(-1)!;

  const assertDetail = async () => {
    await expect(page).toHaveURL(new RegExp(`${detailUrl}$`));
    const heading = page.getByRole("heading", { name: "Detalhe da compra" });
    await expect(heading).toBeVisible();
    await expect(page.getByRole("heading", { name: campaign })).toBeVisible();
    await expect(page.getByText("Paga", { exact: true })).toBeVisible();
    await expect(page.getByText("Aprovado", { exact: true })).toBeVisible();
    await expect(page.getByText("Pix", { exact: true })).toBeVisible();
    const titles = page.getByRole("region", { name: "Títulos desta compra" });
    await expect(titles.getByText("42", { exact: true })).toBeVisible();
    await expect(titles.getByText("314", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Continuar pagamento" }),
    ).toHaveCount(0);
  };
  await paidPurchase().click();
  await assertDetail();
  await page.reload();
  await assertDetail();
  await page.getByRole("link", { name: "Voltar ao histórico" }).click();
  await expect(paidPurchase()).toBeVisible();

  const endpoints = [
    `/api/purchases/${id}`,
    `/api/payments/purchase/${id}`,
    `/api/purchases/${id}/tickets`,
  ];
  const [ownPurchase, ownPayment, ownTickets] = await Promise.all(
    endpoints.map((url) => page.request.get(url)),
  );
  expect(ownPurchase.status()).toBe(200);
  const own = (await ownPurchase.json()) as {
    id: string;
    campaignId: string;
    status: string;
  };
  expect(own).toMatchObject({ id, status: "PAID", quantity: 2 });
  expect(ownPayment.status()).toBe(200);
  const payment = (await ownPayment.json()) as {
    id: string;
    purchaseId: string;
    status: string;
  };
  expect(payment).toMatchObject({
    purchaseId: id,
    status: "APPROVED",
    method: "PIX",
  });
  expect(ownTickets.status()).toBe(200);
  const tickets = (await ownTickets.json()) as Array<{
    number: number;
    status: string;
  }>;
  expect(tickets.map(({ number, status }) => ({ number, status }))).toEqual([
    { number: 42, status: "SOLD" },
    { number: 314, status: "SOLD" },
  ]);

  await logout(page);
  expect((await page.request.get(endpoints[0])).status()).toBe(401);
  await login(page, other, password);
  await viewHistory();
  await paidFilter.click();
  await expect(empty).toBeVisible();
  await expect(paidPurchase()).toHaveCount(0);
  await page.goto(detailUrl!);
  const denial = page
    .getByRole("alert")
    .filter({ hasText: "Não foi possível abrir esta compra." });
  await expect(denial).toBeVisible();
  await expect(page.getByRole("heading", { name: campaign })).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Títulos desta compra" }),
  ).toHaveCount(0);
  const retryResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === endpoints[0],
  );
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  expect((await retryResponse).status()).toBe(404);
  await expect(denial).toBeVisible();
  const denied = await Promise.all(
    endpoints.map((url) => page.request.get(url)),
  );
  expect(denied.map((response) => response.status())).toEqual([404, 404, 404]);
  for (const response of denied) {
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).not.toHaveProperty("tickets");
    expect(payload).not.toHaveProperty("campaign");
    expect(payload).not.toHaveProperty("amount");
  }
  await page.getByRole("link", { name: "Voltar ao histórico" }).click();
  await paidFilter.click();
  await expect(empty).toBeVisible();

  // Another buyer's own unpaid reservation can be viewed but has no issued titles.
  const hold = await page.request.post("/api/purchases/reserve-random", {
    data: {
      campaignId: own.campaignId,
      quantity: 10,
      idempotencyKey: randomUUID(),
    },
  });
  expect(hold.status()).toBe(201);
  const pending = (await hold.json()) as { id: string; status: string };
  try {
    expect(pending.status).toBe("AWAITING_PAYMENT");
    await page.getByRole("button", { name: "Aguardando", exact: true }).click();
    await page.locator(`a[href="/comprador/compras/${pending.id}"]`).click();
    await expect(
      page.getByText("Aguardando pagamento", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Nenhum pagamento registrado", { exact: true }),
    ).toBeVisible();
    const pendingTitles = page.getByRole("region", {
      name: "Títulos desta compra",
    });
    await expect(
      pendingTitles.getByText("Nenhum título confirmado nesta compra."),
    ).toBeVisible();
    await expect(pendingTitles.getByRole("listitem")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Continuar pagamento" }),
    ).toHaveAttribute("href", `/comprador/checkout/${pending.id}`);
  } finally {
    const cancellation = await page.request.post(
      `/api/purchases/${pending.id}/cancel`,
    );
    expect(cancellation.status()).toBe(201);
  }
  await logout(page);
  await login(page, owner, password);
  await viewHistory();
  await paidPurchase().click();
  await assertDetail();
  console.log(
    `Histórico sintético: compra ${id}, Pix ${payment.id}, 2 títulos, consulta isola a conta.`,
  );
});
