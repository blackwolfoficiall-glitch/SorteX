import assert from "node:assert/strict";
import test from "node:test";
import { loadBuyerPrizeList } from "../src/buyer/prizes";

const owner = "synthetic-buyer";
const row = {
  id: "synthetic-prize", buyerId: owner, campaign: { title: "Campanha sintética" },
  winningNumber: "00091", prizeName: "Sorteio sintético", status: "PAYMENT_PENDING",
  confirmationToken: "private-fixture-token",
  instantPrize: { description: "Cota sintética", imageStorageKey: "private-path" },
};
function fixture(value: unknown, paths: string[] = []) {
  return { request: async <T>(path: string): Promise<T> => {
    paths.push(path);
    return value as T;
  } };
}

test("personal prizes use separate authenticated endpoints and discard other response fields", async () => {
  const paths: string[] = [];
  assert.deepEqual(await loadBuyerPrizeList(fixture([row], paths), owner, "draw"), {
    ok: true, items: [{
      id: row.id, campaignTitle: row.campaign.title, prizeName: row.prizeName,
      ticketNumber: "00091", status: "Pagamento do prêmio pendente",
    }],
  });
  assert.deepEqual(await loadBuyerPrizeList(fixture([{ ...row, status: "DELIVERED" }], paths), owner, "instant"), {
    ok: true, items: [{
      id: row.id, campaignTitle: row.campaign.title, prizeName: row.instantPrize.description,
      ticketNumber: "00091", status: "Entrega registrada",
    }],
  });
  assert.deepEqual(paths, ["/winners/my", "/winners/my-instant-prizes"]);
});

test("personal prizes distinguish an empty list, malformed data, another account and transport failure", async () => {
  assert.deepEqual(await loadBuyerPrizeList(fixture([]), owner, "draw"), { ok: true, items: [] });
  for (const bad of [{}, [{ ...row, winningNumber: 91 }], [{ ...row, buyerId: "another-buyer" }]]) {
    assert.deepEqual(await loadBuyerPrizeList(fixture(bad), owner, "draw"), { ok: false });
  }
  assert.deepEqual(await loadBuyerPrizeList({
    request: async () => { throw new Error("private backend diagnostics"); },
  }, owner, "instant"), { ok: false });
});
