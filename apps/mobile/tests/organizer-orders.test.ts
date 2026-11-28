import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/api/client";
import {
  initialOrderFilters,
  loadOrganizerOrderCampaigns,
  loadOrganizerOrderDetail,
  loadOrganizerOrders,
  organizerOrdersPath,
  organizerOrdersSession,
  parseOrganizerOrderDetail,
  parseOrganizerOrdersPage,
  type OrganizerOrdersClient,
} from "../src/organizer/orders";

const date = "2026-11-27T15:00:00.000Z";
const summary = {
  approvedSales: 0,
  pendingReservations: 0,
  ordersToday: 0,
  periodRevenue: 0,
};
const row = {
  id: "order-qa",
  campaign: { id: "campaign-qa", title: "Campanha sintética" },
  buyer: { name: "Comprador sintético" },
  createdAt: date,
  total: 2.5,
  quantity: 2,
  status: "PAID",
  payments: [{ method: "PIX", status: "APPROVED", createdAt: date }],
  affiliateConversion: { affiliate: { name: "Afiliado fictício" } },
};
const response = { page: 1, pages: 1, total: 1, items: [row], summary };
const session = { organizerId: "org-qa", revision: 7 };

function controlled(value: unknown | (() => Promise<unknown>)) {
  let revision: number | null = session.revision;
  let role: "ORGANIZER" | "BUYER" = "ORGANIZER";
  const calls: string[] = [];
  const client: OrganizerOrdersClient = {
    activeSessionRevision: () => revision,
    snapshot: () => ({
      status: "signedIn",
      user: {
        id: session.organizerId,
        role,
        name: "Conta sintética",
        email: "synthetic@example.invalid",
      },
    }),
    async request<T>(path: string) {
      calls.push(path);
      return (typeof value === "function" ? await value() : value) as T;
    },
  };
  return {
    client,
    calls,
    setRevision: (v: number | null) => {
      revision = v;
    },
    changeRole: () => {
      role = "BUYER";
    },
  };
}

test("filters use direct existing endpoint, d13 enums and inclusive UTC day bounds", () => {
  const path = organizerOrdersPath(
    {
      ...initialOrderFilters,
      search: " nome..sintético @example.invalid ",
      campaignId: "campaign-qa",
      from: "27/11/2026",
      to: "27/11/2026",
      minValue: "0,25",
      maxValue: "10",
      method: "CREDIT_CARD",
      status: "PAID",
      sort: "quantity_desc",
    },
    2,
  );
  const url = new URL(path, "http://127.0.0.1");
  assert.equal(url.pathname, "/organizer/orders");
  assert.ok(!path.includes(".."));
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    page: "2",
    limit: "20",
    search: "nome..sintético @example.invalid",
    campaignId: "campaign-qa",
    from: "2026-11-27T00:00:00.000Z",
    to: "2026-11-27T23:59:59.999Z",
    minValue: "0.25",
    maxValue: "10.00",
    method: "CREDIT_CARD",
    status: "PAID",
    sort: "quantity_desc",
  });
  assert.throws(() =>
    organizerOrdersPath({ ...initialOrderFilters, from: "31/02/2026" }, 1),
  );
  assert.throws(() =>
    organizerOrdersPath(
      { ...initialOrderFilters, from: "28/11/2026", to: "27/11/2026" },
      1,
    ),
  );
  assert.throws(() =>
    organizerOrdersPath(
      { ...initialOrderFilters, minValue: "3", maxValue: "2" },
      1,
    ),
  );
  assert.throws(() =>
    organizerOrdersPath({ ...initialOrderFilters, method: "CARD" } as never, 1),
  );
});

test("only successful empty results produce zero; absence and malformed data aren't converted to zero", () => {
  assert.equal(
    parseOrganizerOrdersPage(
      { ...response, total: 0, pages: 0, items: [] },
      1,
      initialOrderFilters,
    ).total,
    0,
  );
  assert.deepEqual(
    parseOrganizerOrdersPage(response, 1, initialOrderFilters).summary,
    summary,
  );
  assert.equal(
    parseOrganizerOrdersPage(
      { ...response, summary: undefined },
      1,
      initialOrderFilters,
    ).summary,
    null,
  );
  assert.throws(() =>
    parseOrganizerOrdersPage(
      { ...response, summary: { approvedSales: 0 } },
      1,
      initialOrderFilters,
    ),
  );
  assert.throws(() =>
    parseOrganizerOrdersPage(
      { ...response, items: [] },
      1,
      initialOrderFilters,
    ),
  );
  assert.throws(() =>
    parseOrganizerOrdersPage(response, 1, {
      ...initialOrderFilters,
      campaignId: "other-campaign",
    }),
  );
  assert.throws(() =>
    parseOrganizerOrdersPage(response, 1, {
      ...initialOrderFilters,
      status: "REFUNDED",
    }),
  );
  assert.throws(() =>
    parseOrganizerOrdersPage(
      { ...response, items: [row, row], total: 2 },
      1,
      initialOrderFilters,
    ),
  );
});

test("detail preserves real recorded title count, affiliate/timeline and drops unrelated payment/ticket data", () => {
  const result = parseOrganizerOrderDetail(
    {
      ...row,
      buyer: {
        name: row.buyer.name,
        email: "synthetic@example.invalid",
        phone: null,
        opaque: "not projected",
      },
      affiliateConversion: { affiliate: "Outro afiliado fictício" },
      _count: { tickets: 2 },
      tickets: [{ number: "042" }],
      payments: [
        {
          ...row.payments[0],
          approvedAt: date,
          events: [{ eventType: "PAYMENT_APPROVED", createdAt: date }],
          pixCopyPaste: "opaque sentinel",
          metadata: { opaque: true },
          cardLastFour: "0000",
        },
      ],
    },
    "order-qa",
  );
  assert.equal(result.registeredTickets, 2);
  assert.equal(result.affiliate, "Outro afiliado fictício");
  assert.equal(result.approvedAt, date);
  assert.deepEqual(result.events, [
    { type: "PAYMENT_APPROVED", createdAt: date },
  ]);
  assert.ok(!JSON.stringify(result).includes("opaque"));
  assert.ok(!JSON.stringify(result).includes("042"));
  assert.equal(
    parseOrganizerOrderDetail(row, "order-qa").registeredTickets,
    null,
  );
  assert.throws(() => parseOrganizerOrderDetail(row, "other-order"));
});

test("list, detail and campaign filters reuse organizer-scoped reads", async () => {
  const list = controlled(response),
    details = controlled({ ...row, _count: { tickets: 2 } }),
    campaigns = controlled([
      {
        id: "campaign-qa",
        title: "Campanha sintética",
        ignored: "additional fields",
      },
    ]);
  assert.equal(
    (await loadOrganizerOrders(list.client, session, initialOrderFilters, 1))
      .kind,
    "ok",
  );
  assert.equal(
    (await loadOrganizerOrderDetail(details.client, session, "order-qa")).kind,
    "ok",
  );
  assert.deepEqual(
    await loadOrganizerOrderCampaigns(campaigns.client, session),
    {
      kind: "ok",
      data: [{ id: "campaign-qa", title: "Campanha sintética" }],
    },
  );
  assert.deepEqual(list.calls, ["/organizer/orders?page=1&limit=20"]);
  assert.deepEqual(details.calls, ["/organizer/orders/order-qa"]);
  assert.deepEqual(campaigns.calls, ["/campaigns/my"]);
});

test("missing doesn't become empty and stale signed-out/same-user relogin responses are discarded", async () => {
  const missing = controlled(async () => {
    throw new ApiError("Não encontrado", 404);
  });
  assert.deepEqual(
    await loadOrganizerOrderDetail(missing.client, session, "order-qa"),
    { kind: "missing" },
  );
  const role = controlled(response);
  role.changeRole();
  assert.equal(organizerOrdersSession(role.client), null);
  assert.deepEqual(
    await loadOrganizerOrders(role.client, session, initialOrderFilters, 1),
    { kind: "stale" },
  );
  assert.deepEqual(role.calls, []);
  for (const revision of [null, 8]) {
    let release = (_value: unknown) => {};
    const delayed = controlled(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const request = loadOrganizerOrders(
      delayed.client,
      session,
      initialOrderFilters,
      1,
    );
    delayed.setRevision(revision);
    release(response);
    assert.deepEqual(await request, { kind: "stale" });
  }
  const denied = controlled(async () => {
    throw new ApiError("Não permitido", 403);
  });
  await assert.rejects(
    loadOrganizerOrderDetail(denied.client, session, "order-qa"),
  );
});
