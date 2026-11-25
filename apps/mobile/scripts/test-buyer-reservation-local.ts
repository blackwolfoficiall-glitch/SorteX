import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import { BuyerPurchases, isActiveReservation } from "../src/buyer/purchases";

const base = "http://127.0.0.1:3338";
async function model(email: string, password: string) {
  const vault: Vault = {
    read: async () => null,
    write: async () => {},
    clear: async () => {},
  };
  const client = new SortexClient(base, vault);
  await client.login(email, password);
  const user = client.snapshot().user;
  assert.equal(user?.role, "BUYER");
  return new BuyerPurchases(client, user!.id);
}

async function main() {
  if (process.env.SORTEX_NATIVE_LOCAL_CONFIRM !== "synthetic-loopback-only")
    throw new Error("Confirme somente um ambiente sintético e local.");
  const email = process.env.SORTEX_NATIVE_TEST_BUYER;
  const otherEmail = process.env.SORTEX_NATIVE_TEST_OTHER_BUYER;
  const password = process.env.SORTEX_NATIVE_TEST_PASSWORD;
  const manualSlug = process.env.SORTEX_NATIVE_TEST_MANUAL_CAMPAIGN;
  const randomSlug = process.env.SORTEX_NATIVE_TEST_RANDOM_CAMPAIGN;
  if (
    !email?.endsWith("@example.test") ||
    !otherEmail?.endsWith("@example.test") ||
    email === otherEmail ||
    !password ||
    !manualSlug?.startsWith("synthetic-native-") ||
    !randomSlug?.startsWith("synthetic-native-") ||
    manualSlug === randomSlug
  )
    throw new Error(
      "Informe duas contas @example.test e duas campanhas synthetic-native-* previamente semeadas.",
    );

  const buyer = await model(email, password);
  const other = await model(otherEmail, password);
  const manual = await buyer.availability(manualSlug);
  assert.equal(manual.selectionMode, "MANUAL");
  assert.equal(
    (await buyer.numbers(manualSlug, manual.totalNumbers, 1, 0)).items[0]
      ?.status,
    "AVAILABLE",
  );

  const idempotencyKey = randomUUID();
  const order = await buyer.reserve(
    manual,
    { mode: "MANUAL", numbers: [0, 1] },
    idempotencyKey,
  );
  assert.equal(order.status, "AWAITING_PAYMENT");
  assert.equal(isActiveReservation(order), true);
  assert.equal(order.total, 2);
  const replay = await buyer.reserve(
    manual,
    { mode: "MANUAL", numbers: [0, 1] },
    idempotencyKey,
  );
  assert.equal(replay.id, order.id);
  assert.equal((await buyer.current())?.id, order.id);
  assert.equal(
    (await buyer.orders()).some((item) => item.id === order.id),
    true,
  );
  assert.deepEqual((await buyer.ticketOrder(order.id)).tickets, []);
  assert.equal(
    (await buyer.numbers(manualSlug, manual.totalNumbers, 1, 0)).items[0]
      ?.status,
    "RESERVED",
  );
  await assert.rejects(
    other.order(order.id),
    (error) => error instanceof ApiError && error.status === 404,
  );
  await assert.rejects(
    other.reserve(manual, { mode: "MANUAL", numbers: [0, 1] }, randomUUID()),
    (error) => error instanceof ApiError && error.status === 409,
  );
  assert.equal((await buyer.cancel(order.id)).status, "CANCELLED");
  assert.equal(
    (await buyer.numbers(manualSlug, manual.totalNumbers, 1, 0)).items[0]
      ?.status,
    "AVAILABLE",
  );

  const random = await buyer.availability(randomSlug);
  assert.equal(random.selectionMode, "RANDOM");
  const randomOrder = await buyer.reserve(
    random,
    { mode: "RANDOM", quantity: 3 },
    randomUUID(),
  );
  assert.equal(randomOrder.quantity, 3);
  assert.equal(randomOrder.total, 3);
  assert.equal((await buyer.cancel(randomOrder.id)).status, "CANCELLED");
  console.log(
    JSON.stringify({
      status: "PASS",
      manual: order.id,
      random: randomOrder.id,
      checks: [
        "availability",
        "search-zero",
        "manual",
        "idempotency",
        "current",
        "history",
        "pending-no-tickets",
        "buyer-isolation",
        "occupied-conflict",
        "cancel-release",
        "random",
      ],
      paymentCalls: 0,
    }),
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
