import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import {
  campaignOrderAmountLabel, readBuyerCampaignTitles,
} from "../src/buyer/campaign-titles";
import { buyerHistorySession } from "../src/buyer/order-history";

const mainSlug = "campanha-piloto-homologacao";
const otherSlug = "premiacoes-publicas-teste-browser";
const owner = "buyer1@sortex.example.invalid";
const unpaid = "buyer3@sortex.example.invalid";
const unrelated = "buyer4@sortex.example.invalid";
const vault = (): Vault => ({ read: async () => null, write: async () => {}, clear: async () => {} });

async function main() {
  assert.equal(process.env.SORTEX_NATIVE_LOCAL_CONFIRM, "synthetic-loopback-only");
  const origin = process.env.SORTEX_NATIVE_CAMPAIGN_TITLES_API;
  assert.match(origin ?? "", /^http:\/\/127\.0\.0\.1:[1-9][0-9]{3,4}$/);
  const password = process.env.TEST_SEED_PASSWORD;
  assert.ok(password, "Use a senha do seed no banco descartável local.");
  const base = origin!;

  async function signIn(email: string) {
    const client = new SortexClient(base, vault());
    await client.login(email, password!);
    const session = buyerHistorySession(client);
    assert.ok(session);
    return { client, session };
  }

  const buyer = await signIn(owner);
  const [current, other] = await Promise.all([mainSlug, otherSlug].map((slug) =>
    buyer.client.publicRequest<{ id: string; status: string }>(`/public/campaigns/${slug}`)));
  assert.ok(current && other && current.id !== other.id);
  assert.equal(current.status, "PUBLISHED");
  assert.equal(other.status, "PUBLISHED");
  const owned = await readBuyerCampaignTitles(buyer.client, buyer.session, current.id);
  assert.ok(owned);
  const confirmed = owned.find((order) => order.status === "PAID");
  assert.ok(confirmed);
  assert.deepEqual(confirmed.numbers, [42, 314]);
  assert.equal(campaignOrderAmountLabel(confirmed.status), "Valor pago");
  assert.ok(!Object.hasOwn(confirmed, "buyer"));
  assert.deepEqual(await readBuyerCampaignTitles(buyer.client, buyer.session, other.id), []);

  await buyer.client.logout();
  assert.equal(await readBuyerCampaignTitles(buyer.client, buyer.session, current.id), null);

  const applicant = await signIn(unpaid);
  const reserve = (campaignId: string) =>
    applicant.client.request<{ id: string; status: string }>("/purchases/reserve-random", "POST", {
      campaignId, quantity: 13, idempotencyKey: randomUUID(),
    });
  const selected = await reserve(current.id);
  let elsewhere: Awaited<ReturnType<typeof reserve>> | undefined;
  try {
    elsewhere = await reserve(other.id);
    assert.equal(selected.status, "AWAITING_PAYMENT");
    const local = await readBuyerCampaignTitles(applicant.client, applicant.session, current.id);
    assert.ok(local);
    assert.deepEqual(local.map((order) => order.id), [selected.id]);
    assert.deepEqual(local[0]?.numbers, []);
    assert.equal(campaignOrderAmountLabel(local[0]!.status), "Valor do pedido");
    assert.deepEqual(await applicant.client.request(`/purchases/${selected.id}/tickets`), []);
    const remote = await readBuyerCampaignTitles(applicant.client, applicant.session, other.id);
    assert.deepEqual(remote?.map((order) => order.id), [elsewhere.id]);

    const stranger = await signIn(unrelated);
    assert.deepEqual(await readBuyerCampaignTitles(stranger.client, stranger.session, current.id), []);
    await assert.rejects(stranger.client.request(`/purchases/${confirmed.id}/tickets`),
      (error) => error instanceof ApiError && error.status === 404);

    await applicant.client.request(`/purchases/${selected.id}/cancel`, "POST");
    const cancelled = await readBuyerCampaignTitles(applicant.client, applicant.session, current.id);
    assert.deepEqual(cancelled?.map(({ id, status, numbers }) => ({ id, status, numbers })), [
      { id: selected.id, status: "CANCELLED", numbers: [] },
    ]);
    assert.equal(campaignOrderAmountLabel(cancelled[0]!.status), "Valor do pedido");
  } finally {
    await applicant.client.request(`/purchases/${selected.id}/cancel`, "POST").catch(() => {});
    if (elsewhere) await applicant.client.request(`/purchases/${elsewhere.id}/cancel`, "POST").catch(() => {});
    await applicant.client.logout();
  }
  console.log(JSON.stringify({
    scope: "real-disposable-postgresql-and-nest", paidNumbers: [42, 314],
    pendingNumbers: 0, cancelledNumbers: 0, separateCampaign: true,
    separateCustomer: true, clearedSession: true, providerCalls: 0,
  }));
}

void main().catch(() => {
  console.error("Meus títulos: a homologação isolada falhou nas verificações locais.");
  process.exitCode = 1;
});
