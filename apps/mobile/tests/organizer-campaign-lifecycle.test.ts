import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, type AuthState } from "../src/api/client";
import {
  organizerLifecycleOptions,
  runOrganizerLifecycle,
  type OrganizerCampaignState,
} from "../src/domain/organizer-campaign-lifecycle";

const owner = "synthetic-organizer-a";
const draft: OrganizerCampaignState = {
  id: "synthetic-campaign",
  title: "Campanha sintética",
  status: "DRAFT",
  organizerId: owner,
  publicationBlocked: false,
};

function fixture() {
  const requested: string[] = [];
  let accountId = owner;
  let status = "DRAFT";
  let block = false;
  let lastResponseStatus: string | undefined;
  let beforeResponse: () => void = () => {};
  return {
    requested,
    switchAccount: (value: string) => {
      accountId = value;
    },
    setStatus: (value: string) => {
      status = value;
    },
    setBlock: (value: boolean) => {
      block = value;
    },
    setUnexpected: (value: string) => {
      lastResponseStatus = value;
    },
    beforeResponse: (next: () => void) => {
      beforeResponse = next;
    },
    snapshot: (): AuthState => ({
      status: "signedIn",
      user: {
        id: accountId,
        role: "ORGANIZER",
        name: "Conta sintética",
        email: "synthetic@example.test",
      },
    }),
    request: async <T>(path: string, method = "GET") => {
      requested.push(`${method} ${path}`);
      if (method === "POST") {
        status = path.endsWith("/publish")
          ? "PUBLISHED"
          : path.endsWith("/pause")
            ? "PAUSED"
            : "FINISHED";
      }
      beforeResponse();
      return {
        ...draft,
        status: method === "POST" ? (lastResponseStatus ?? status) : status,
        publicationBlocked: block,
      } as T;
    },
  };
}

test("only presents supported actions, keeping pause and closure for restricted containment", () => {
  assert.deepEqual(organizerLifecycleOptions(draft).actions, ["publish"]);
  assert.deepEqual(
    organizerLifecycleOptions({
      ...draft,
      status: "PUBLISHED",
      publicationBlocked: true,
    }).actions,
    ["pause", "finish"],
  );
  assert.deepEqual(
    organizerLifecycleOptions({ ...draft, status: "PAUSED" }).actions,
    ["reactivate", "finish"],
  );
  assert.deepEqual(
    organizerLifecycleOptions({
      ...draft,
      status: "PAUSED",
      publicationBlocked: true,
    }).actions,
    ["finish"],
  );
  for (const status of [
    "PENDING_REVIEW",
    "FINISHED",
    "SOLD_OUT",
    "CANCELLED",
    "DRAWN",
    "OTHER",
  ])
    assert.deepEqual(
      organizerLifecycleOptions({ ...draft, status }).actions,
      [],
    );
  for (const restricted of [
    { ...draft, publicationBlocked: undefined },
    { ...draft, publicationBlocked: true },
    { ...draft, adminReviewStatus: "REJECTED" },
    { ...draft, adminReviewStatus: "CHANGES_REQUESTED" },
  ])
    assert.deepEqual(organizerLifecycleOptions(restricted).actions, []);
});

test("calls existing endpoint for each confirmed command and trusts only the expected response", async () => {
  const client = fixture();
  const published = await runOrganizerLifecycle(
    client,
    owner,
    draft,
    "publish",
  );
  const paused = await runOrganizerLifecycle(client, owner, published, "pause");
  const reactivated = await runOrganizerLifecycle(
    client,
    owner,
    paused,
    "reactivate",
  );
  const finished = await runOrganizerLifecycle(
    client,
    owner,
    reactivated,
    "finish",
  );
  assert.equal(finished.status, "FINISHED");
  assert.deepEqual(
    client.requested.filter((item) => item.startsWith("POST")),
    [
      "POST /campaigns/synthetic-campaign/publish",
      "POST /campaigns/synthetic-campaign/pause",
      "POST /campaigns/synthetic-campaign/publish",
      "POST /campaigns/synthetic-campaign/finish",
    ],
  );
  client.setStatus("PUBLISHED");
  client.setUnexpected("PUBLISHED");
  await assert.rejects(
    runOrganizerLifecycle(client, owner, published, "pause"),
    (error) => error instanceof ApiError && error.status === 409,
  );
});

test("rejects non-ownership, changed status/flag and an account switch before submitting", async () => {
  const client = fixture();
  await assert.rejects(
    runOrganizerLifecycle(
      client,
      owner,
      { ...draft, organizerId: "other" },
      "publish",
    ),
    (error) => error instanceof ApiError && error.status === 403,
  );
  assert.equal(client.requested.length, 0);
  client.setBlock(true);
  await assert.rejects(
    runOrganizerLifecycle(client, owner, draft, "publish"),
    (error) => error instanceof ApiError && error.status === 409,
  );
  client.setBlock(false);
  client.setStatus("PAUSED");
  await assert.rejects(
    runOrganizerLifecycle(client, owner, draft, "publish"),
    (error) => error instanceof ApiError && error.status === 409,
  );
  client.setStatus("DRAFT");
  client.beforeResponse(() => client.switchAccount("other"));
  await assert.rejects(
    runOrganizerLifecycle(client, owner, draft, "publish"),
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.ok(client.requested.every((item) => item.startsWith("GET")));
});
