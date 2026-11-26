import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBuyerFavorites } from "../../../packages/contracts/src/buyer-favorites";
import { ApiError, type AuthState } from "../src/api/client";
import { readFavorites } from "../src/buyer/favorites";
import { buyerInboxSession } from "../src/buyer/inbox";

const id = "synthetic-campaign";
const row = {
  id: "favorite-id",
  data: { private: true },
  campaign: {
    id,
    slug: id,
    title: "Campanha sintética",
    status: "PUBLISHED",
    numberPrice: 1.2,
    soldPercentage: 5,
    drawDate: null,
    coverImageUrl: `/api/public/campaign-media/${id}/cover`,
    organizer: {
      name: "Organizador de teste",
      verified: true,
      internalId: "never shown",
    },
  },
};
const payload = [row];
const parsed = parseBuyerFavorites(payload);
test("favorites validate published cards and remove internal response fields", () => {
  assert.equal(parsed[0]?.campaign.title, row.campaign.title);
  assert.deepEqual(parsed[0]?.campaign.organizer, {
    name: "Organizador de teste",
    verified: true,
  });
  assert.equal("data" in parsed[0]!, false);
  for (const value of [
    {},
    [row, row],
    [{ ...row, campaign: { ...row.campaign, status: "PAUSED" } }],
    [
      {
        ...row,
        campaign: {
          ...row.campaign,
          coverImageUrl: "https://example.test/unsafe",
        },
      },
    ],
    [{ ...row, campaign: { ...row.campaign, slug: "../not-a-campaign" } }],
  ]) {
    assert.throws(
      () => parseBuyerFavorites(value),
      /lista de favoritos inválida/,
    );
  }
});

function client() {
  const auth: AuthState = {
    status: "signedIn",
    user: {
      name: "Buyer",
      id: "buyer-1",
      email: "synthetic@example.test",
      role: "BUYER",
    },
  };
  const calls: [string, string][] = [];
  let revision = 1;
  return {
    auth,
    calls,
    updateSession: () => {
      revision++;
    },
    client: {
      snapshot: () => auth,
      activeSessionRevision: () => revision,
      request: async <T>(path: string, method = "GET"): Promise<T> => {
        calls.push([method, path]);
        return (method === "GET" ? payload : {}) as T;
      },
    },
  };
}

test("save/remove fetch persisted private list and never fall back to legacy CRM-writing paths", async () => {
  const testCase = client();
  const actual = testCase.client;
  const session = buyerInboxSession(actual)!;
  for (const saved of [true, false])
    assert.deepEqual(
      await readFavorites(actual, session, { campaignId: id, saved }),
      { kind: "ok", items: parsed },
    );
  assert.deepEqual(testCase.calls, [
    ["POST", "/buyer/favorites/private/synthetic-campaign"],
    ["GET", "/buyer/favorites/private"],
    ["DELETE", "/buyer/favorites/private/synthetic-campaign"],
    ["GET", "/buyer/favorites/private"],
  ]);
  const legacy = {
    ...actual,
    request: async <T>(path: string): Promise<T> => {
      assert.equal(path, "/buyer/favorites/private");
      throw new ApiError("not found", 404);
    },
  };
  assert.deepEqual(await readFavorites(legacy, session), {
    kind: "unavailable",
  });
  await assert.rejects(
    readFavorites(actual, session, { campaignId: "../../wrong", saved: true }),
    /inválida/,
  );
});

test("old sessions and organizers do not query or update favorites", async () => {
  const testCase = client();
  const actual = testCase.client;
  const old = buyerInboxSession(actual)!;
  testCase.updateSession();
  assert.deepEqual(
    await readFavorites(actual, old, { campaignId: id, saved: true }),
    { kind: "stale" },
  );
  testCase.auth.user!.role = "ORGANIZER";
  assert.equal(buyerInboxSession(actual), null);
  assert.deepEqual(testCase.calls, []);
});

test("changing accounts during a save never reloads or shows another buyer's list", async () => {
  const testCase = client();
  let finish: ((value: unknown) => void) | undefined;
  const actual = {
    ...testCase.client,
    request: <T>(path: string, method = "GET") => {
      testCase.calls.push([method, path]);
      return new Promise<unknown>((resolve) => {
        finish = resolve;
      }) as Promise<T>;
    },
  };
  const read = readFavorites(actual, buyerInboxSession(actual)!, {
    campaignId: id,
    saved: true,
  });
  testCase.updateSession();
  finish?.({});
  assert.deepEqual(await read, { kind: "stale" });
  assert.deepEqual(testCase.calls, [
    ["POST", "/buyer/favorites/private/synthetic-campaign"],
  ]);
});
