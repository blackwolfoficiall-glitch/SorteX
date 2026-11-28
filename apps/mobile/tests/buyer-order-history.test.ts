import assert from "node:assert/strict";
import test from "node:test";
import type { SortexClient } from "../src/api/client";
import {
  buyerHistorySession,
  buyerOrderStatus,
  readBuyerOrderHistory,
} from "../src/buyer/order-history";

const buyer = {
  id: "buyer-a", role: "BUYER" as const, name: "Comprador sintético", email: "buyer-a@example.test",
};
const entry = {
  id: "synthetic-purchase", quantity: 2, total: 8, status: "AWAITING_PAYMENT",
  createdAt: "2026-11-26T14:00:00Z",
  campaign: { id: "campaign", title: "Campanha de teste", internal: "ignored" },
  buyer: { email: buyer.email, phone: "+551111111111" }, tickets: [{ ignored: true }],
};
type ClientDouble = Parameters<typeof readBuyerOrderHistory>[0];
function buildClient(read: () => Promise<unknown>) {
  let user = buyer;
  let revision = 1;
  const paths: string[] = [];
  const client: ClientDouble = {
    snapshot: () => ({ status: "signedIn", user }) as ReturnType<SortexClient["snapshot"]>,
    activeSessionRevision: () => revision,
    async request<T>(path: string) {
      paths.push(path);
      return await read() as T;
    },
  };
  return {
    client, paths,
    switchBuyer(id: string) { user = { ...buyer, id }; revision++; },
  };
}

test("cada releitura busca a API e mantém só campos usados no pedido", async () => {
  let status = "AWAITING_PAYMENT";
  const { client, paths } = buildClient(async () => [{ ...entry, status }]);
  const session = buyerHistorySession(client)!;
  assert.deepEqual(await readBuyerOrderHistory(client, session), [{
    id: entry.id,
    campaignTitle: "Campanha de teste",
    status,
    quantity: 2,
    total: 8,
    createdAt: entry.createdAt,
  }]);
  status = "CANCELLED";
  const updated = await readBuyerOrderHistory(client, session);
  assert.equal(updated?.[0]?.id, entry.id);
  assert.equal(updated?.[0]?.status, "CANCELLED");
  assert.deepEqual(paths, ["/purchases/my", "/purchases/my"]);
  assert.equal(buyerOrderStatus("AWAITING_PAYMENT"), "Aguardando pagamento");
  assert.equal(buyerOrderStatus("CANCELLED"), "Cancelado");
  assert.equal(buyerOrderStatus("unknown"), "Status indisponível");
});

test("lista vazia válida é distinta de erro de rede ou contrato inválido", async () => {
  const { client } = buildClient(async () => []);
  assert.deepEqual(await readBuyerOrderHistory(client, buyerHistorySession(client)!), []);
  for (const sample of [null, {}, [{ ...entry, createdAt: "invalid" }], [{ ...entry, quantity: 0 }]]) {
    const bad = buildClient(async () => sample).client;
    await assert.rejects(
      readBuyerOrderHistory(bad, buyerHistorySession(bad)!),
      /não retornou um histórico de pedidos válido/,
    );
  }
  const failure = new Error("Sem conexão");
  const network = buildClient(async () => { throw failure; }).client;
  await assert.rejects(readBuyerOrderHistory(network, buyerHistorySession(network)!), failure);
});

for (const nextBuyer of [buyer.id, "buyer-b"]) {
  test(`retorno atrasado da sessão anterior não chega à conta ${nextBuyer}`, async () => {
    let finish!: (value: unknown) => void;
    const response = new Promise((resolve) => { finish = resolve; });
    const { client, paths, switchBuyer } = buildClient(() => response);
    const previous = buyerHistorySession(client)!;
    const inflight = readBuyerOrderHistory(client, previous);
    switchBuyer(nextBuyer);
    finish([entry]);
    assert.equal(await inflight, null);
    assert.equal(await readBuyerOrderHistory(client, previous), null);
    assert.deepEqual(paths, ["/purchases/my"]);
  });
}

test("erro atrasado da sessão anterior não invade a conta nova", async () => {
  let fail!: (reason: Error) => void;
  const response = new Promise((_, reject) => { fail = reject; });
  const { client, switchBuyer } = buildClient(() => response);
  const task = readBuyerOrderHistory(client, buyerHistorySession(client)!);
  switchBuyer("buyer-b");
  fail(new Error("Erro da sessão anterior"));
  assert.equal(await task, null);
});
