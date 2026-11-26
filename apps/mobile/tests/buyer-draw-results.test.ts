import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, type AuthState } from "../src/api/client";
import { loadBuyerDrawResults } from "../src/buyer/draw-results";

const organizer = "organizer-a";
const first = "buyer-a";
const second = "buyer-b";
const purchase = (buyerId: string, id: string) => ({
  buyerId,
  campaign: { id, organizerId: organizer },
});
const campaign = (id: string, winningNumber: string, status = "CONFIRMED") => ({
  id,
  title: `Campanha ${id}`,
  draws: [{ status, winningNumber }],
  winners: [
    {
      id: `${id}-winner`,
      prizeName: "Prêmio sintético",
      publicDisplayName: "G. Teste",
      internal: "not rendered",
    },
  ],
});
const organizerResults = {
  organizer: { id: organizer },
  campaigns: [
    campaign("campaign-a", "00091"),
    campaign("campaign-b", "19000"),
    campaign("pending", "20000", "PENDING_CONFIRMATION"),
    campaign("invalidated", "30000", "INVALIDATED"),
  ],
};
function session(id: string): AuthState {
  return {
    status: "signedIn",
    user: { id, name: id, email: `${id}@example.test`, role: "BUYER" },
  };
}
function mockClient() {
  let account = first;
  const requested: string[] = [];
  return {
    requested,
    setAccount: (id: string) => {
      account = id;
    },
    snapshot: () => session(account),
    request: async <T>(path: string) => {
      assert.equal(path, "/purchases/my");
      return [
        purchase(first, "campaign-a"),
        purchase(first, "campaign-a"), // Multiple orders remain one result.
        purchase(first, "pending"),
        purchase(first, "invalidated"),
        purchase(second, "campaign-b"), // Defensively discard other buyer's row.
      ] as T;
    },
    publicRequest: async <T>(path: string) => {
      requested.push(path);
      return organizerResults as T;
    },
  };
}

test("only renders confirmed draws in owned campaigns when an organizer has multiple campaigns", async () => {
  const client = mockClient();
  const firstResults = await loadBuyerDrawResults(client, first);
  assert.deepEqual(firstResults, [
    {
      id: "campaign-a",
      title: "Campanha campaign-a",
      draws: [{ winningNumber: "00091" }],
      winners: [
        {
          id: "campaign-a-winner",
          prizeName: "Prêmio sintético",
          publicDisplayName: "G. Teste",
        },
      ],
    },
  ]);
  assert.deepEqual(client.requested, [
    `/public/campaigns/organizers/${organizer}/profile`,
  ]);
  client.setAccount(second);
  const secondResults = await loadBuyerDrawResults(client, second);
  assert.deepEqual(
    secondResults.map(({ id, draws }) => [id, draws[0]?.winningNumber]),
    [["campaign-b", "19000"]],
  );
});

test("account switch while purchases are in flight discards them before querying public profiles", async () => {
  const client = mockClient();
  const result = loadBuyerDrawResults(client, first);
  client.setAccount(second);
  await assert.rejects(
    result,
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.deepEqual(client.requested, []);
});

test("account switch during public profile readback never emits results for the departed buyer", async () => {
  const client = mockClient();
  let release!: (value: typeof organizerResults) => void;
  let started!: () => void;
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  const pending = new Promise<typeof organizerResults>((resolve) => {
    release = resolve;
  });
  const result = loadBuyerDrawResults(
    {
      ...client,
      publicRequest: async <T>() => {
        started();
        return (await pending) as T;
      },
    },
    first,
  );
  await requested;
  client.setAccount(second);
  release(organizerResults);
  await assert.rejects(
    result,
    (error) => error instanceof ApiError && error.status === 401,
  );
});

test("a profile for the wrong organizer cannot supply owned draw results", async () => {
  const client = mockClient();
  await assert.rejects(
    loadBuyerDrawResults(
      {
        ...client,
        publicRequest: async <T>() =>
          ({
            ...organizerResults,
            organizer: { id: "different-organizer" },
          }) as T,
      },
      first,
    ),
    /não corresponde/,
  );
});

test("empty buyer orders do not request unrelated public profiles", async () => {
  const client = mockClient();
  const result = await loadBuyerDrawResults(
    {
      ...client,
      request: async <T>() => [] as T,
    },
    first,
  );
  assert.deepEqual(result, []);
  assert.deepEqual(client.requested, []);
});
