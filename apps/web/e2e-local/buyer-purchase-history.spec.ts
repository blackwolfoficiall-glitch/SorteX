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

test("Meus Títulos volta à mesma campanha após entrar e só mostra números emitidos", async ({
  page,
  baseURL,
}, testInfo) => {
  if (!local || !baseURL || new URL(baseURL).hostname !== "127.0.0.1")
    throw new Error("Este cenário aceita apenas a web local em 127.0.0.1.");
  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) throw new Error("Defina a senha sintética do seed local.");
  const localOrigin = new URL(baseURL).origin;
  await page.route(/^https?:/, (route) =>
    new URL(route.request().url()).origin === localOrigin
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  const campaignPath = "/campanha/campanha-piloto-homologacao";
  const destination = `${campaignPath}?view=meus-titulos`;
  const otherCampaignSlug = "premiacoes-publicas-teste-browser";
  const ownerEmail = "buyer1@sortex.example.invalid";
  // Keep reservation/cancellation fixtures separate from the existing history case.
  const unpaidEmail = "buyer3@sortex.example.invalid";
  const otherEmail = "buyer4@sortex.example.invalid";
  // Both browsers use the same disposable DB; earlier cancelled rows persist.
  const currentQuantity = testInfo.project.name.startsWith("iphone-") ? 14 : 13;
  const dialog = page.getByRole("dialog", { name: "Meus Títulos", exact: true });
  const enterPanel = async (email: string) => {
    await page.goto(campaignPath);
    await page.getByRole("button", { name: "Meus Títulos", exact: true }).click();
    await expect(dialog.getByText("Entre para consultar seus títulos nesta campanha.")).toBeVisible();
    await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/login?next=${encodeURIComponent(destination)}`);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}${destination}`);
    await expect(page.getByRole("heading", { name: campaign, exact: true })).toBeVisible();
    await expect(dialog).toBeVisible();
  };

  await enterPanel(ownerEmail);
  const paid = dialog.locator("article").filter({
    has: page.getByText("Pago", { exact: true }),
  });
  await expect(paid.getByText("Valor pago", { exact: true })).toBeVisible();
  await paid.getByText("Ver números (2)", { exact: true }).click();
  await expect(paid.getByText("42", { exact: true })).toBeVisible();
  await expect(paid.getByText("314", { exact: true })).toBeVisible();

  const ownerResponse = await page.request.get("/api/purchases/my");
  expect(ownerResponse.status()).toBe(200);
  const purchases = (await ownerResponse.json()) as Array<{
    id: string; campaignId: string; status: string;
  }>;
  const ownPaid = purchases.find((order) => order.status === "PAID");
  expect(ownPaid).toBeDefined();
  const otherCampaignResponse = await page.request.get(
    `/api/public/campaigns/${otherCampaignSlug}`,
  );
  expect(otherCampaignResponse.status()).toBe(200);
  const otherCampaign = (await otherCampaignResponse.json()) as { id: string };
  expect(otherCampaign.id).not.toBe(ownPaid!.campaignId);
  const reserve = async (campaignId: string, quantity: number) => {
    const response = await page.request.post("/api/purchases/reserve-random", {
      data: { campaignId, quantity, idempotencyKey: randomUUID() },
    });
    expect(response.status()).toBe(201);
    const order = (await response.json()) as { id: string; status: string };
    expect(order.status).toBe("AWAITING_PAYMENT");
    return order.id;
  };

  // Revoke the browser session while the paid order is still on screen.
  expect((await page.request.post("/api/auth/logout")).status()).toBe(200);
  await page.evaluate(() => window.dispatchEvent(new Event("sortex:purchase-updated")));
  await expect(dialog.getByText("Entre para consultar seus títulos nesta campanha.")).toBeVisible();
  await expect(dialog.locator("article")).toHaveCount(0);
  await enterPanel(unpaidEmail);
  const currentId = await reserve(ownPaid!.campaignId, currentQuantity);
  let otherId: string | undefined;
  let currentCancelled = false;
  try {
    otherId = await reserve(otherCampaign.id, 17);
    await page.reload();
    const unpaid = dialog.locator("article").filter({
      has: page.getByText(`Compra de ${currentQuantity} títulos`, { exact: true }),
    });
    await expect(unpaid.getByText("Aguardando pagamento", { exact: true })).toBeVisible();
    await expect(unpaid.getByText("Valor do pedido", { exact: true })).toBeVisible();
    await expect(unpaid.getByText("Valor pago", { exact: true })).toHaveCount(0);
    await expect(unpaid.getByText("Nenhum título confirmado nesta compra.")).toBeVisible();
    await expect(unpaid.locator("summary")).toHaveCount(0);
    await expect(dialog.getByText("Pago", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Compra de 17 títulos", { exact: true })).toHaveCount(0);
    const cancel = await page.request.post(`/api/purchases/${currentId}/cancel`);
    expect(cancel.status()).toBe(201);
    currentCancelled = true;
    await page.reload();
    await expect(unpaid.getByText("Cancelada", { exact: true })).toBeVisible();
    await expect(unpaid.getByText("Valor do pedido", { exact: true })).toBeVisible();
    await expect(unpaid.locator("summary")).toHaveCount(0);
  } finally {
    if (!currentCancelled)
      await page.request.post(`/api/purchases/${currentId}/cancel`);
    if (otherId)
      await page.request.post(`/api/purchases/${otherId}/cancel`);
  }
  await page.goto("/comprador");
  await logout(page);
  await enterPanel(otherEmail);
  await expect(dialog.getByText("Você ainda não possui títulos nesta campanha.")).toBeVisible();
  await expect(dialog.locator("article")).toHaveCount(0);
  expect((await page.request.get(`/api/purchases/${ownPaid!.id}`)).status()).toBe(404);

  // An external destination must be ignored by the same password login handler.
  await page.goto("/comprador");
  await logout(page);
  await page.goto(`/login?next=${encodeURIComponent("https://example.invalid/")}`);
  await page.getByLabel("E-mail").fill(otherEmail);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/comprador`);
});
