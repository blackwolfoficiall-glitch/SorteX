/** Real HTTP with seeded accounts and a disposable local database; no payment. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Tokens } from "../../../packages/contracts/src/mobile";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import { BuyerPurchases, reservationAttempt } from "../src/buyer/purchases";

if (process.env.SORTEX_NATIVE_COUPON_TEST !== "isolated-synthetic-only")
  throw new Error(
    "Ative explicitamente apenas o teste no ambiente descartável.",
  );
const base = process.env.SORTEX_NATIVE_COUPON_API;
if (base !== "http://127.0.0.1:3435")
  throw new Error("O teste só pode usar a API em loopback na porta 3435.");
const password = process.env.TEST_SEED_PASSWORD;
if (!password)
  throw new Error("Informe a senha sintética do seed descartável.");
const origin = base;
function makeVault(): Vault {
  let saved: Tokens | null = null;
  return {
    read: async () => saved,
    write: async (value) => {
      saved = value;
    },
    clear: async () => {
      saved = null;
    },
  };
}
async function session(email: string) {
  if (!password) throw new Error("Senha sintética ausente.");
  const client = new SortexClient(origin, makeVault());
  await client.login(email, password);
  const user = client.snapshot().user;
  assert.ok(user);
  return { client, user };
}

async function testNativeCoupons() {
  const organizer = await session("organizer1@sortex.example.invalid");
  const first = await session("buyer1@sortex.example.invalid");
  const second = await session("buyer2@sortex.example.invalid");
  const params = { mode: "RANDOM", quantity: 10 } as const;
  for (const [account, percentage] of [
    [first, false],
    [second, true],
  ] as const) {
    const api = new BuyerPurchases(account.client, account.user.id);
    const inventory = await api.availability("campanha-piloto-homologacao");
    const amount = percentage ? 20 : 0.23;
    const discount = percentage ? 0.2 : 0.23;
    const total = percentage ? 0.8 : 0.77;
    const code = `MOBILEQA${randomUUID().slice(0, 8).toUpperCase()}`;
    const promotion = await organizer.client.request<{ id: string }>(
      "/promotions",
      "POST",
      {
        campaignId: inventory.campaignId,
        name: `Cupom sintético ${code}`,
        type: "COUPON",
        status: "ACTIVE",
        totalLimit: 2,
        perBuyerLimit: 1,
        config: {
          code,
          discountType: percentage ? "PERCENTAGE" : "FIXED",
          discountValue: amount,
        },
      },
    );
    const quoted = await api.quoteCoupon(
      inventory,
      params,
      ` ${code.toLowerCase()} `,
    );
    assert.equal(quoted.total, total);
    assert.equal(quoted.discount, discount);
    assert.equal(quoted.subtotal, 1);
    const publicQuote = await account.client.publicRequest<{
      total: number;
      discount: number;
      promotionId: string;
    }>("/promotion-quote", "POST", {
      campaignId: inventory.campaignId,
      quantity: 10,
      couponCode: code,
    });
    assert.equal(publicQuote.promotionId, promotion.id);
    assert.equal(publicQuote.total, quoted.total);
    assert.equal(publicQuote.discount, quoted.discount);
    const attempt = reservationAttempt(
      inventory.campaignId,
      params,
      null,
      randomUUID,
      quoted.code,
    );
    // Send two first requests, then read back the saved price from checkout.
    const submissions = await Promise.all([
      api.reserve(inventory, params, attempt.idempotencyKey, false, quoted),
      api.reserve(inventory, params, attempt.idempotencyKey, true, quoted),
    ]);
    assert.equal(submissions[0].id, submissions[1].id);
    const order = await api.order(submissions[0].id);
    assert.equal(order.total, total);
    assert.equal(order.discount, discount);
    assert.equal(order.status, "AWAITING_PAYMENT");
    await assert.rejects(
      () => api.quoteCoupon(inventory, params, code),
      (error) =>
        error instanceof ApiError &&
        error.status === 400 &&
        /limite de uso/.test(error.message),
    );
    const other = account === first ? second : first;
    const competitor = new BuyerPurchases(other.client, other.user.id);
    assert.equal(
      (await competitor.quoteCoupon(inventory, params, code)).total,
      total,
    );
    await assert.rejects(
      () => competitor.order(order.id),
      (error) => error instanceof ApiError && error.status === 404,
    );
    console.log(
      "Native HTTP",
      code,
      "promo",
      promotion.id,
      "order",
      order.id,
      "quoted/reserved/read back",
      total.toFixed(2),
      "one order; no payment",
    );
  }
  await Promise.all([
    first.client.logout(),
    second.client.logout(),
    organizer.client.logout(),
  ]);
}

void testNativeCoupons().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(
    error instanceof Error ? error.message : "Falha no teste HTTP sintético.",
  );
});
