import assert from "node:assert/strict";
import test from "node:test";
import type { SortexClient } from "../src/api/client";
import { buyerHistorySession } from "../src/buyer/order-history";
import {
  campaignOrderAmountLabel, readBuyerCampaignTitles,
} from "../src/buyer/campaign-titles";

type Client = Parameters<typeof readBuyerCampaignTitles>[0];
const campaignId = "campaign-a";
const buyerId = "buyer-a";

function fixture(load: () => Promise<unknown>) {
  let revision: number | null = 1;
  let user: { id: string; role: "BUYER" | "ORGANIZER" } | null = { id: buyerId, role: "BUYER" };
  const paths: string[] = [];
  const client: Client = {
    snapshot: () => ({ status: user ? "signedIn" : "signedOut", user }) as ReturnType<SortexClient["snapshot"]>,
    activeSessionRevision: () => revision,
    async request<T>(path: string) {
      paths.push(path);
      return await load() as T;
    },
  };
  return {
    client, paths,
    change: (next: typeof user, nextRevision: number | null) => {
      user = next;
      revision = nextRevision;
    },
  };
}

const paidTicket = {
  purchaseId: "paid", buyerId, campaignId, status: "SOLD", number: 314,
};
const details = { total: 4, quantity: 2, createdAt: "2026-11-26T20:00:00Z" };
const order = {
  id: "paid", buyerId, campaignId, status: "PAID", ...details,
  buyer: { phone: "not projected" },
  tickets: [paidTicket, { ...paidTicket, number: 42 }],
};
const unpaidTicket = { ...paidTicket, purchaseId: "pending", number: 219 };

test("projeta somente pedidos e números pagos da conta e campanha escolhidas", async () => {
  const { client, paths } = fixture(async () => [
    order,
    { ...order, id: "pending", status: "AWAITING_PAYMENT", tickets: [unpaidTicket] },
    { ...order, id: "cancelled", status: "CANCELLED", tickets: [paidTicket] },
    { ...order, id: "expired", status: "EXPIRED", tickets: [paidTicket] },
    { ...order, id: "refunded", status: "REFUNDED", tickets: [paidTicket] },
    { ...order, id: "wrong-campaign", campaignId: "campaign-b" },
    { ...order, id: "wrong-account", buyerId: "buyer-b" },
    { ...order, id: "wrong-scope-tickets", tickets: [
      paidTicket, // not this purchase ID
      { ...paidTicket, purchaseId: "wrong-scope-tickets", campaignId: "campaign-b" },
      { ...paidTicket, purchaseId: "wrong-scope-tickets", buyerId: "buyer-b" },
      { ...paidTicket, purchaseId: "wrong-scope-tickets", status: "RESERVED" },
      { ...paidTicket, purchaseId: "wrong-scope-tickets", number: -1 },
      null,
    ] },
  ]);
  const actual = await readBuyerCampaignTitles(client, buyerHistorySession(client)!, campaignId);
  assert.deepEqual(actual, [
    { id: "paid", status: "PAID", ...details, numbers: [42, 314] },
    { id: "pending", status: "AWAITING_PAYMENT", ...details, numbers: [] },
    { id: "cancelled", status: "CANCELLED", ...details, numbers: [] },
    { id: "expired", status: "EXPIRED", ...details, numbers: [] },
    { id: "refunded", status: "REFUNDED", ...details, numbers: [] },
    { id: "wrong-scope-tickets", status: "PAID", ...details, numbers: [] },
  ]);
  assert.deepEqual(paths, ["/purchases/my"]);
  assert.equal(campaignOrderAmountLabel("PAID"), "Valor pago");
  for (const status of ["AWAITING_PAYMENT", "CANCELLED", "EXPIRED", "REFUNDED", "UNKNOWN"])
    assert.equal(campaignOrderAmountLabel(status), "Valor do pedido");
});

test("zero compras é distinguível de falha e de contrato inválido", async () => {
  const empty = fixture(async () => []);
  assert.deepEqual(await readBuyerCampaignTitles(empty.client, buyerHistorySession(empty.client)!, campaignId), []);
  for (const bad of [null, {}, [{ ...order, total: -1 }], [{ ...order, tickets: undefined }], [{ ...order, createdAt: "invalid" }]]) {
    const { client } = fixture(async () => bad);
    await assert.rejects(readBuyerCampaignTitles(client, buyerHistorySession(client)!, campaignId), /API não retornou/);
  }
  const failure = new Error("Erro de conexão");
  const network = fixture(async () => { throw failure; });
  await assert.rejects(readBuyerCampaignTitles(network.client, buyerHistorySession(network.client)!, campaignId), failure);
});

test("nenhum resultado atrasado atravessa logout, novo login ou troca de papel", async () => {
  const changes = [
    { user: null, revision: null },
    { user: { id: buyerId, role: "BUYER" as const }, revision: 2 },
    { user: { id: "buyer-b", role: "BUYER" as const }, revision: 2 },
    { user: { id: buyerId, role: "ORGANIZER" as const }, revision: 2 },
  ];
  for (const next of changes) {
    let finish!: (value: unknown) => void;
    const response = new Promise((resolve) => { finish = resolve; });
    const { client, paths, change } = fixture(() => response);
    const session = buyerHistorySession(client)!;
    const pending = readBuyerCampaignTitles(client, session, campaignId);
    change(next.user, next.revision);
    finish([order]);
    assert.equal(await pending, null);
    assert.equal(await readBuyerCampaignTitles(client, session, campaignId), null);
    assert.deepEqual(paths, ["/purchases/my"]);
  }
});

test("erro atrasado também não atravessa uma revisão revogada", async () => {
  let reject!: (error: Error) => void;
  const { client, change } = fixture(() => new Promise((_, fail) => { reject = fail; }));
  const pending = readBuyerCampaignTitles(client, buyerHistorySession(client)!, campaignId);
  change(null, null);
  reject(new Error("transport"));
  assert.equal(await pending, null);
});
