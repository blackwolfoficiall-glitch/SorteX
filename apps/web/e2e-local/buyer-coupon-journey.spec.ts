import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const campaignTitle = "Campanha Piloto de Homologação";
const campaignSlug = "campanha-piloto-homologacao";

async function login(
  page: Page,
  email: string,
  password: string,
  destination: RegExp,
) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(destination);
}

async function selectSection(page: Page, value: string, label: string) {
  const compact = page.locator('nav[aria-label="Seções de promoções"] select');
  await page.locator('nav[aria-label="Seções de promoções"]').waitFor();
  if (await compact.isVisible()) await compact.selectOption(value);
  else await page.getByRole("button", { name: label, exact: true }).click();
}

test("organizador ativa um cupom e o comprador reserva pelo valor com desconto", async ({
  page: organizer,
  baseURL,
}) => {
  if (
    process.env.SORTEX_COUPON_LOCAL !== "1" ||
    !baseURL ||
    new URL(baseURL).hostname !== "127.0.0.1"
  )
    throw new Error("Este cenário só aceita o seed sintético em loopback.");
  const password = process.env.TEST_SEED_PASSWORD;
  if (!password) throw new Error("Defina a senha sintética do seed local.");
  const code = `QA${randomUUID().slice(0, 8).toUpperCase()}`;
  const name = `Cupom sintético ${code}`;

  await login(
    organizer,
    "organizer1@sortex.example.invalid",
    password,
    /\/dashboard/,
  );
  await organizer.goto("/dashboard/promocoes");
  await organizer
    .getByRole("button", { name: "Criar estratégia", exact: true })
    .click();
  await organizer
    .locator("article")
    .filter({ hasText: "Cupom de desconto" })
    .getByRole("button", { name: "Criar", exact: true })
    .click();
  const next = organizer.getByRole("button", { name: "Avançar", exact: true });
  await organizer
    .getByRole("button", { name: new RegExp(campaignTitle) })
    .click();
  await next.click();
  await next.click();
  await organizer.getByLabel("Nome da estratégia").fill(name);
  await organizer.getByLabel("Código", { exact: true }).fill(code);
  await organizer.getByLabel("Tipo de desconto").selectOption("PERCENTAGE");
  await organizer.getByLabel("Valor", { exact: true }).fill("20");
  await next.click();
  await next.click();
  await organizer.getByLabel("Limite total", { exact: true }).fill("2");
  await organizer.getByLabel("Por comprador", { exact: true }).fill("1");
  await next.click();
  await next.click();
  organizer.once("dialog", (dialog) => dialog.accept());
  await organizer
    .getByRole("button", { name: "Ativar promoção", exact: true })
    .click();
  await expect(
    organizer.getByText("Estratégia ativada com sucesso."),
  ).toBeVisible();
  const card = () => organizer.locator("article").filter({ hasText: name });
  await expect(card()).toBeVisible();
  organizer.once("dialog", (dialog) => dialog.accept());
  await card().getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(organizer.getByText("Estratégia pausada.")).toBeVisible();
  await selectSection(organizer, "paused", "Pausadas");

  // Sequential sign-ins exercise real account boundaries without keeping two
  // mobile renderers alive in the constrained WebKit test environment.
  const buyer = organizer;
  async function logout() {
    expect((await buyer.request.post("/api/auth/logout")).status()).toBe(200);
    expect((await buyer.request.get("/api/auth/me")).status()).toBe(401);
  }
  await logout();
  await login(
    buyer,
    "buyer1@sortex.example.invalid",
    password,
    /\/comprador\/?$/,
  );
  await buyer.goto(`/campanha/${campaignSlug}`);
  await expect(
    buyer.getByRole("heading", { name: campaignTitle }),
  ).toBeVisible();
  const panel = buyer.locator("[data-purchase-panel]");
  const apply = async () => {
    const result = buyer.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/platform/promotion-quote" &&
        response.request().method() === "POST",
    );
    await panel.getByLabel("Código do cupom").fill(code);
    await panel.getByRole("button", { name: "Aplicar", exact: true }).click();
    return result;
  };
  expect((await apply()).status()).toBe(400);
  await expect(
    panel.getByRole("alert").filter({ hasText: "Cupom inválido" }),
  ).toBeVisible();

  await logout();
  await login(
    organizer,
    "organizer1@sortex.example.invalid",
    password,
    /\/dashboard/,
  );
  await organizer.goto("/dashboard/promocoes");
  await selectSection(organizer, "paused", "Pausadas");
  await card().getByRole("button", { name: "Reativar", exact: true }).click();
  await expect(organizer.getByText("Estratégia reativada.")).toBeVisible();
  await organizer.reload();
  await expect(card()).toBeVisible();

  await logout();
  await login(
    buyer,
    "buyer1@sortex.example.invalid",
    password,
    /\/comprador\/?$/,
  );
  await buyer.goto(`/campanha/${campaignSlug}`);
  const preview = await apply();
  expect(preview.status()).toBe(201);
  const quote = (await preview.json()) as {
    subtotal: number;
    discount: number;
    total: number;
    promotionId: string;
  };
  expect(quote).toMatchObject({ subtotal: 1, discount: 0.2, total: 0.8 });
  await expect(
    panel.getByRole("status").filter({ hasText: "Desconto calculado" }),
  ).toBeVisible();
  await expect(panel.getByText("R$ 0,80", { exact: true })).toBeVisible();

  const hold = buyer.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/purchases/reserve-random" &&
      response.request().method() === "POST",
  );
  await panel
    .getByRole("button", { name: "Reservar títulos", exact: true })
    .click();
  const held = await hold;
  expect(held.status()).toBe(201);
  const purchase = (await held.json()) as {
    id: string;
    promotionId: string;
    status: string;
    total: number;
    discount: number;
  };
  expect(purchase).toMatchObject({
    promotionId: quote.promotionId,
    status: "AWAITING_PAYMENT",
    total: 0.8,
    discount: 0.2,
  });
  await expect(buyer).toHaveURL(
    new RegExp(`/comprador/checkout/${purchase.id}$`),
  );
  await expect(
    buyer.getByRole("heading", { name: "Finalize sua participação" }),
  ).toBeVisible();
  await expect(buyer.getByText(/R\$\s*0,80/)).toBeVisible();
  await expect(
    buyer.getByRole("button", { name: "Gerar PIX de teste" }),
  ).toBeDisabled();

  const body = held.request().postDataJSON() as Record<string, unknown>;
  for (const retry of await Promise.all([
    buyer.request.post("/api/purchases/reserve-random", { data: body }),
    buyer.request.post("/api/purchases/reserve-random", { data: body }),
  ])) {
    expect(retry.status()).toBe(201);
    expect(await retry.json()).toMatchObject({
      id: purchase.id,
      discount: 0.2,
      total: 0.8,
    });
  }
  const secondUse = await buyer.request.post("/api/purchases/reserve-random", {
    data: { ...body, idempotencyKey: randomUUID() },
  });
  expect(secondUse.status()).toBe(400);
  expect(await secondUse.json()).toMatchObject({
    message: "Você já atingiu o limite de uso deste cupom.",
  });
  await buyer.reload();
  await expect(buyer.getByText(/R\$\s*0,80/)).toBeVisible();
  console.log(
    `Cupom sintético ${code}, promoção ${quote.promotionId}, reserva ${purchase.id}, R$ 1,00 - 0,20 = 0,80.`,
  );
});
