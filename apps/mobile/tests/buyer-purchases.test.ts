import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import {
  BuyerPurchases,
  isActiveReservation,
  parseDigits,
  purchaseLimits,
  reservationAttempt,
  titleNumber,
  type Availability,
} from "../src/buyer/purchases";

const base = "http://127.0.0.1:3338";
const buyer = {
  id: "buyer-a",
  role: "BUYER",
  name: "Conta sintética",
  email: "buyer@example.invalid",
};
const availability: Availability = {
  campaignId: "campaign-a",
  totalNumbers: 1000,
  availableNumbers: 900,
  reservedNumbers: 100,
  soldNumbers: 0,
  reservationSeconds: 900,
  selectionMode: "MANUAL",
  minimumPurchase: 1,
  maximumPurchasePerBuyer: 6,
};
const purchase = {
  id: "order-a",
  quantity: 2,
  campaign: {
    id: "campaign-a",
    title: "Campanha sintética",
    slug: "campanha-a",
  },
  expiresAt: new Date(Date.now() + 900000).toISOString(),
  status: "AWAITING_PAYMENT",
  total: 2,
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
async function clientFor(
  handler: (
    path: string,
    options?: RequestInit,
  ) => Promise<Response> | Response,
) {
  const vault: Vault = {
    read: async () => null,
    write: async () => {},
    clear: async () => {},
  };
  const tokens = {
    accessToken: "synthetic-access",
    refreshToken: "synthetic-refresh",
  };
  const transport = (async (url: string, options?: RequestInit) => {
    const path = url.replace(base, "");
    if (path === "/auth/login")
      return response({ user: buyer, ...tokens }, 201);
    if (path === "/auth/me") return response(buyer);
    if (path === "/auth/logout")
      return response({ message: "Sessão encerrada." }, 201);
    return handler(path, options);
  }) as typeof fetch;
  const client = new SortexClient(base, vault, transport);
  await client.login(buyer.email, "synthetic");
  return { client, model: new BuyerPurchases(client, buyer.id) };
}

test("cota zero, busca com zeros e limite de compra preservam números canônicos", () => {
  assert.equal(titleNumber(0, 1000), "000");
  assert.equal(parseDigits("0091"), 91);
  assert.equal(parseDigits("91\n"), null);
  assert.equal(parseDigits("9007199254740992"), null);
  assert.deepEqual(purchaseLimits({ ...availability, availableNumbers: 4 }), {
    min: 1,
    max: 4,
  });
});

test("reutiliza a mesma chave na mesma ação independentemente da ordem selecionada", () => {
  const first = reservationAttempt(
    "a",
    { mode: "MANUAL", numbers: [91, 0] },
    null,
    () => "key-a",
  );
  assert.equal(
    reservationAttempt(
      "a",
      { mode: "MANUAL", numbers: [0, 91] },
      first,
      () => "different",
    ),
    first,
  );
  assert.equal(
    reservationAttempt(
      "b",
      { mode: "MANUAL", numbers: [0, 91] },
      first,
      () => "key-b",
    ).idempotencyKey,
    "key-b",
  );
});

test("consulta disponibilidade e opções com o contrato público, sem credencial", async () => {
  const { model } = await clientFor((path, options) => {
    assert.equal(new Headers(options?.headers).get("authorization"), null);
    if (path.endsWith("/availability")) return response(availability);
    const route = new URL(base + path);
    assert.equal(route.pathname, "/public/campaigns/campanha-a/numbers");
    assert.deepEqual(Object.fromEntries(route.searchParams), {
      rangeEnd: "999",
      limit: "30",
      page: "1",
      search: "0",
    });
    return response({
      items: [{ number: 0, status: "AVAILABLE" }],
      total: 1,
      page: 1,
      limit: 30,
    });
  });
  assert.equal(
    (await model.availability("campanha-a")).selectionMode,
    "MANUAL",
  );
  assert.equal(
    (await model.numbers("campanha-a", 1000, 1, 0)).items[0]?.number,
    0,
  );
});

test("validação local, reserva manual autenticada e reconciliação idempotente sem cobrança", async () => {
  const calls: unknown[] = [];
  const { model } = await clientFor((path, options) => {
    assert.equal(path, "/purchases/reserve-manual");
    assert.equal(
      new Headers(options?.headers).get("authorization"),
      "Bearer synthetic-access",
    );
    calls.push(JSON.parse(String(options?.body)));
    return response(purchase, 201);
  });
  await assert.rejects(
    model.reserve(availability, { mode: "MANUAL", numbers: [0, 0] }, "a"),
    /repetidos/,
  );
  await assert.rejects(
    model.reserve(availability, { mode: "MANUAL", numbers: [1000] }, "a"),
    /fora/,
  );
  await assert.rejects(
    model.reserve(availability, { mode: "RANDOM", quantity: 2 }, "a"),
    /seleção/,
  );
  const first = await model.reserve(
    availability,
    { mode: "MANUAL", numbers: [91, 0] },
    "a",
  );
  assert.equal(first.status, "AWAITING_PAYMENT");
  await model.reserve(
    { ...availability, availableNumbers: 0 },
    { mode: "MANUAL", numbers: [0, 91] },
    "a",
    true,
  );
  assert.deepEqual(
    calls,
    Array(2).fill({
      campaignId: "campaign-a",
      idempotencyKey: "a",
      numbers: [0, 91],
    }),
  );
});

test("a campanha aleatória usa apenas quantidade e recebe a reserva fornecida pela API", async () => {
  const { model } = await clientFor((path, options) => {
    assert.equal(path, "/purchases/reserve-random");
    assert.deepEqual(JSON.parse(String(options?.body)), {
      campaignId: "campaign-a",
      idempotencyKey: "r",
      quantity: 2,
    });
    return response(purchase, 201);
  });
  const result = await model.reserve(
    { ...availability, selectionMode: "RANDOM" },
    { mode: "RANDOM", quantity: 2 },
    "r",
  );
  assert.equal(isActiveReservation(result), true);
  assert.equal(
    isActiveReservation({ ...result, expiresAt: "2020-01-01" }),
    false,
  );
});

test("pedido pendente não consulta títulos e só apresenta títulos vendidos de pedido pago", async () => {
  const seen: string[] = [];
  let paid = false;
  const { model } = await clientFor((path) => {
    seen.push(path);
    if (path.endsWith("/tickets"))
      return response([
        { number: 0, status: "SOLD" },
        { number: 1, status: "RESERVED" },
      ]);
    return response({
      ...purchase,
      status: paid ? "PAID" : "AWAITING_PAYMENT",
    });
  });
  assert.deepEqual((await model.ticketOrder(purchase.id)).tickets, []);
  assert.deepEqual(seen, ["/purchases/order-a"]);
  paid = true;
  assert.deepEqual(
    (await model.ticketOrder(purchase.id)).tickets.map(
      (ticket) => ticket.number,
    ),
    [0],
  );
  assert.equal(seen.at(-1), "/purchases/order-a/tickets");
});

test("resposta atrasada não atravessa logout para outra sessão", async () => {
  let resolve!: (value: Response) => void;
  const { client, model } = await clientFor(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const call = model.order("order-a");
  await client.logout();
  resolve(response(purchase));
  await assert.rejects(
    call,
    (error) => error instanceof ApiError && error.status === 401,
  );
});
