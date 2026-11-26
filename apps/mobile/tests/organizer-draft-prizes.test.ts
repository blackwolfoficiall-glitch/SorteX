import assert from "node:assert/strict";
import test from "node:test";
import {
  changeDraftPrize,
  loadDraftPrizes,
  prizeFields,
  toDraftPrize,
  type PrizeApi,
  type PrizeFields,
} from "../src/domain/organizer-draft-prizes";

const fields: PrizeFields = {
  exactNumber: "000091",
  description: " Brinde ",
  value: "12,30",
  type: "PRODUCT",
};
const ctx = { accountId: "owner-1", revision: 2, campaignId: "d-1" };
const campaign = {
  id: "d-1",
  organizerId: "owner-1",
  status: "DRAFT",
  publishedAt: null,
  totalNumbers: 1_000_000,
};
const row = {
  id: "p-1",
  campaignId: "d-1",
  ...fields,
  value: 12.3,
  status: "AVAILABLE",
  updatedAt: "2026-11-26T00:00:00.000Z",
  foundCount: 0,
  reservation: null,
  winnerUserId: null,
  results: [],
};
const prize = toDraftPrize(row, "d-1");

function fixture(payloads: unknown[], after?: (step: number) => void) {
  const calls: Array<{ path: string; method: string; body?: unknown }> = [];
  const user = { id: "owner-1", role: "ORGANIZER" } as NonNullable<
    ReturnType<PrizeApi["snapshot"]>["user"]
  >;
  let revision = 2;
  const client: PrizeApi = {
    snapshot: () => ({ status: "signedIn", user }),
    activeSessionRevision: () => revision,
    request: async <T>(path: string, method = "GET", body?: unknown) => {
      const payload = payloads[calls.length];
      calls.push({ path, method, body });
      after?.(calls.length);
      return payload as T;
    },
  };
  return {
    client,
    calls,
    switchSession: () => {
      revision++;
    },
  };
}

test("draft exact number keeps zeros; price is decimal and independent of title price", () => {
  assert.deepEqual(prizeFields(fields, 1_000_000, false), {
    exactNumber: "000091",
    description: "Brinde",
    value: 12.3,
    type: "PRODUCT",
  });
  assert.throws(
    () => prizeFields({ ...fields, exactNumber: "91" }, 1_000_000, false),
    /6 dígitos/,
  );
  assert.throws(
    () => prizeFields({ ...fields, exactNumber: "999999" }, 600_000, false),
    /6 dígitos/,
  );
  for (const value of ["-3", "", "1,234", "1e2"])
    assert.throws(
      () => prizeFields({ ...fields, value }, 1_000_000, false),
      /valor válido/,
    );
});

test("native list uses existing private web reader for exact campaign and drops sensitive metadata", async () => {
  const f = fixture([
    campaign,
    { items: [{ ...row, instructions: "internal" }], pages: 2 },
  ]);
  const result = await loadDraftPrizes(f.client, ctx, 2);
  assert.equal(result.pages, 2);
  assert.equal(result.prizes[0]?.exactNumber, "000091");
  assert.equal(result.prizes[0]?.editable, true);
  assert.equal("instructions" in result.prizes[0]!, false);
  assert.equal(
    f.calls[1]?.path,
    "/organizer/prize-tickets?campaignId=d-1&page=2&limit=15&sort=number",
  );
  assert.throws(
    () => toDraftPrize({ ...row, campaignId: "other" }, "d-1"),
    /confirmar/,
  );
});

test("an edit preserves the prize ID, exact number and posts the known revision only", async () => {
  const f = fixture([campaign, { id: prize.id }]);
  assert.equal(
    await changeDraftPrize(f.client, ctx, { kind: "edit", prize, fields }),
    prize.id,
  );
  assert.deepEqual(f.calls[1], {
    path: "/campaigns/d-1/draft-prize-tickets/p-1",
    method: "PATCH",
    body: {
      description: "Brinde",
      value: 12.3,
      type: "PRODUCT",
      revision: row.updatedAt,
    },
  });
});

test("a remove is an explicit versioned per-row mutation; found or reserved are not mutable", async () => {
  const f = fixture([campaign, { id: prize.id }]);
  await changeDraftPrize(f.client, ctx, { kind: "remove", prize });
  assert.match(f.calls[1]!.path, /p-1\?revision=/);
  assert.equal(f.calls[1]?.method, "DELETE");
  for (const mixed of [
    { status: "FOUND" },
    { reservation: {} },
    { foundCount: 1 },
    { results: [{}] },
  ])
    assert.equal(toDraftPrize({ ...row, ...mixed }, "d-1").editable, false);
});

test("closed draft or session invalidated during preflight never sends a write", async () => {
  for (const forbidden of [
    { status: "PAUSED" },
    { organizerId: "wrong" },
    { publishedAt: row.updatedAt },
  ]) {
    const f = fixture([{ ...campaign, ...forbidden }]);
    await assert.rejects(
      changeDraftPrize(f.client, ctx, { kind: "create", fields }),
      /nunca publicado/,
    );
    assert.equal(f.calls.length, 1);
  }
  const switched = fixture([campaign], () => switched.switchSession());
  await assert.rejects(
    changeDraftPrize(switched.client, ctx, { kind: "create", fields }),
    /sessão mudou/,
  );
  assert.equal(switched.calls.length, 1);
});
