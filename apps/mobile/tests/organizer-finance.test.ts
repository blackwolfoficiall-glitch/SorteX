import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, SortexClient } from "../src/api/client";
import {
  type FinanceBalance,
  type FinanceClient,
  formatFinanceMoney,
  ledgerStatuses,
  ledgerTypes,
  loadOrganizerFinance,
  organizerFinanceSession,
  parseBalance,
  parseStatement,
  statementPageNavigation,
} from "../src/organizer/finance";

const organizer = {
  id: "synthetic-organizer",
  role: "ORGANIZER" as const,
  name: "Organizador",
  email: "organizer@example.test",
};
const balance: FinanceBalance = {
  currency: "BRL",
  accountExists: true,
  gross: "90.00",
  net: "72.40",
  available: "20.40",
  pending: "50.00",
  blocked: "2.00",
  platformFees: "12.00",
  gatewayFees: "5.60",
};
const row = {
  id: "synthetic-ledger",
  type: "GATEWAY_FEE",
  direction: "DEBIT",
  status: "BLOCKED",
  currency: "BRL",
  amount: "5.60",
  createdAt: "2026-11-26T12:12:00.000Z",
  campaignTitle: "Campanha sintética",
};
const statement = {
  data: [row],
  pagination: { page: 1, limit: 15, total: 16, pages: 2 },
};
const zero = Object.fromEntries(
  Object.keys(balance).map((key) => [key, "0.00"]),
);
const missing = { ...zero, currency: "BRL", accountExists: false };

test("financial snapshot preserves exact BRL cents, rejects wrong currencies and never defaults malformed values to zero", () => {
  assert.deepEqual(
    parseBalance({ ...balance, sourceAccount: "not exposed" }),
    balance,
  );
  assert.equal(parseBalance(missing).accountExists, false);
  assert.equal(
    formatFinanceMoney("9999999999999999.99"),
    "R$ 9.999.999.999.999.999,99",
  );
  assert.equal(formatFinanceMoney("12.09", "DEBIT"), "−R$ 12,09");
  assert.equal(formatFinanceMoney("1.02", "CREDIT"), "+R$ 1,02");
  assert.equal(formatFinanceMoney("-1.02"), "−R$ 1,02");
  for (const result of [
    {},
    { ...balance, currency: "USD" },
    { ...balance, pending: 0 },
    { ...balance, blocked: "1.099" },
    { ...balance, platformFees: "1e+3" },
    { ...missing, pending: "1.00" },
  ])
    assert.throws(() => parseBalance(result), /dados financeiros inválidos/);
});

test("statement reflects ledger direction and internal statuses, and rejects contradictory records and pagination", () => {
  assert.deepEqual(
    parseStatement(
      { ...statement, data: [{ ...row, metadata: "not rendered" }] },
      1,
      15,
    ),
    statement,
  );
  assert.equal(
    ledgerTypes.PAYOUT_COMPLETED,
    "Baixa interna da solicitação de saque",
  );
  assert.equal(ledgerStatuses.AVAILABLE, "Disponível no saldo interno");
  for (const data of [
    [{ ...row, amount: "-5.60" }],
    [{ ...row, type: "EXTERNAL_SPLIT" }],
    [{ ...row, status: "TRANSFERRED" }],
    [{ ...row, createdAt: "invalid" }],
    [row, row],
  ])
    assert.throws(
      () => parseStatement({ ...statement, data }, 1, 15),
      /dados financeiros inválidos/,
    );
  assert.throws(
    () => parseStatement(statement, 2, 15),
    /dados financeiros inválidos/,
  );
  assert.throws(
    () =>
      parseStatement(
        { ...statement, pagination: { ...statement.pagination, pages: 1 } },
        1,
        15,
      ),
    /dados financeiros inválidos/,
  );
});

function stub(error?: Error) {
  const routes: string[] = [];
  const state: ReturnType<FinanceClient["snapshot"]> = {
    status: "signedIn",
    user: organizer,
  };
  let revision: number | null = 1;
  const client: FinanceClient = {
    snapshot: () => state,
    activeSessionRevision: () => revision,
    request: async <T>(route: string) => {
      routes.push(route);
      if (error) throw error;
      return (route.includes("balance") ? balance : statement) as T;
    },
  };
  return {
    routes,
    client,
    state,
    change: () => {
      revision = 2;
    },
  };
}

test("native client only requests the two snapshot endpoints; old servers fail closed without using legacy side-effecting routes", async () => {
  const old = stub(new ApiError("not found", 404));
  const current = stub();
  const expected = organizerFinanceSession(current.client)!;
  assert.deepEqual(await loadOrganizerFinance(current.client, expected, 1), {
    kind: "ok",
    balance,
    statement,
  });
  assert.deepEqual(await loadOrganizerFinance(old.client, expected, 1), {
    kind: "unavailable",
  });
  assert.deepEqual(current.routes, [
    "/finance/balance/snapshot",
    "/finance/statement/snapshot?page=1&limit=15",
  ]);
  assert.deepEqual(old.routes, current.routes);
});

test("buyers and unauthenticated states do not make any finance requests", async () => {
  const fake = stub();
  const expected = organizerFinanceSession(fake.client)!;
  fake.state.user = { ...organizer, role: "BUYER" };
  assert.equal(organizerFinanceSession(fake.client), null);
  assert.deepEqual(await loadOrganizerFinance(fake.client, expected, 1), {
    kind: "stale",
  });
  fake.state.status = "signedOut";
  fake.state.user = organizer;
  assert.equal(organizerFinanceSession(fake.client), null);
  assert.deepEqual(fake.routes, []);
});

test("an in-flight response from a previous authentication is ignored even for the same organizer", async () => {
  const pending: Array<() => void> = [];
  const client = new SortexClient(
    "https://api.example.test",
    {
      read: async () => null,
      write: async () => {},
      clear: async () => {},
    },
    async (input) => {
      const route = new URL(String(input)).pathname;
      if (route === "/auth/me") return Response.json(organizer);
      if (route === "/auth/login")
        return Response.json({
          user: organizer,
          accessToken: "access",
          refreshToken: "refresh",
        });
      if (route === "/auth/logout") return Response.json({});
      const payload = route.endsWith("/balance/snapshot") ? balance : statement;
      return new Promise((resolve) =>
        pending.push(() => resolve(Response.json(payload))),
      );
    },
  );
  await client.login(organizer.email, "synthetic");
  const first = organizerFinanceSession(client)!;
  const stale = loadOrganizerFinance(client, first, 1);
  assert.equal(pending.length, 2);
  const second = client.login(organizer.email, "synthetic");
  assert.equal(organizerFinanceSession(client), null);
  await second;
  assert.notEqual(organizerFinanceSession(client)?.revision, first.revision);
  pending.splice(0).forEach((respond) => respond());
  assert.deepEqual(await stale, { kind: "stale" });

  const auth = organizerFinanceSession(client)!;
  const logoutRead = loadOrganizerFinance(client, auth, 1);
  const logout = client.logout();
  assert.equal(organizerFinanceSession(client), null);
  pending.splice(0).forEach((respond) => respond());
  assert.deepEqual(await logoutRead, { kind: "stale" });
  await logout;
});

test("finance pagination distinguishes an empty first page and a page that disappeared", () => {
  const nav = (page: number, total: number) =>
    statementPageNavigation({
      page,
      total,
      pages: Math.ceil(total / 15),
      limit: 15,
    });
  assert.deepEqual(nav(1, 0), {
    page: 1,
    last: 1,
    total: 0,
    pastEnd: false,
    previous: null,
    next: null,
  });
  assert.deepEqual(nav(1, 16), {
    page: 1,
    last: 2,
    total: 16,
    pastEnd: false,
    previous: null,
    next: 2,
  });
  assert.deepEqual(nav(2, 16), {
    page: 2,
    last: 2,
    total: 16,
    pastEnd: false,
    previous: 1,
    next: null,
  });
  assert.deepEqual(nav(4, 16), {
    page: 4,
    last: 2,
    total: 16,
    pastEnd: true,
    previous: 2,
    next: null,
  });
  assert.deepEqual(nav(2, 0), {
    page: 2,
    last: 1,
    total: 0,
    pastEnd: true,
    previous: 1,
    next: null,
  });
});
