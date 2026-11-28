import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import { BuyerPurchases, isActiveReservation } from "../src/buyer/purchases";
import { buyerHistorySession, readBuyerOrderHistory } from "../src/buyer/order-history";

const base = "http://127.0.0.1:3338";
async function signIn(email: string, password: string) {
  const vault: Vault = { read: async () => null, write: async () => {}, clear: async () => {} };
  const client = new SortexClient(base, vault);
  await client.login(email, password);
  const session = buyerHistorySession(client);
  assert.ok(session);
  return { client, session, purchases: new BuyerPurchases(client, session.buyerId) };
}

async function main() {
  if (process.env.SORTEX_NATIVE_LOCAL_CONFIRM !== "synthetic-loopback-only")
    throw new Error("Histórico requer ambiente sintético e local.");
  const email = process.env.SORTEX_NATIVE_TEST_BUYER;
  const otherEmail = process.env.SORTEX_NATIVE_TEST_OTHER_BUYER;
  const password = process.env.SORTEX_NATIVE_TEST_PASSWORD;
  const slug = process.env.SORTEX_NATIVE_TEST_MANUAL_CAMPAIGN;
  if (!email?.endsWith("@example.test") || !otherEmail?.endsWith("@example.test") ||
    email === otherEmail || !password || !slug?.startsWith("synthetic-native-"))
    throw new Error("Informe duas contas sintéticas distintas e uma campanha sintética.");
  const buyer = await signIn(email, password);
  const other = await signIn(otherEmail, password);
  const elsewhere = await signIn(email, password);
  const availability = await buyer.purchases.availability(slug);
  assert.equal(availability.selectionMode, "MANUAL");
  const order = await buyer.purchases.reserve(
    availability, { mode: "MANUAL", numbers: [0] }, randomUUID(),
  );
  assert.ok(isActiveReservation(order));
  const history = () => readBuyerOrderHistory(buyer.client, buyer.session);
  const active = (await history())?.find(({ id }) => id === order.id);
  assert.equal(active?.status, "AWAITING_PAYMENT");
  assert.deepEqual(await buyer.client.request(`/purchases/${order.id}/tickets`), []);
  assert.deepEqual(await readBuyerOrderHistory(other.client, other.session), []);
  await assert.rejects(other.purchases.order(order.id),
    (error) => error instanceof ApiError && error.status === 404);
  assert.equal((await elsewhere.purchases.cancel(order.id)).status, "CANCELLED");
  const cancelled = (await history())?.find(({ id }) => id === order.id);
  assert.equal(cancelled?.id, active?.id);
  assert.equal(cancelled?.status, "CANCELLED");
  assert.deepEqual(await buyer.client.request(`/purchases/${order.id}/tickets`), []);
  assert.equal((await buyer.purchases.numbers(slug, availability.totalNumbers, 1, 0)).items[0]?.status, "AVAILABLE");
  console.log(JSON.stringify({ id: order.id, first: active?.status, refreshed: cancelled?.status, soldTitles: 0, paymentCalls: 0 }));
}
void main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : "Falhou o teste de histórico local.");
  process.exitCode = 1;
});
