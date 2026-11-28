import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ApiError, type AuthState } from "../src/api/client";
import {
  canEditMini,
  enabledMiniActions,
  loadMiniCampaigns,
  loadMiniDetail,
  miniFormFromCampaign,
  miniPayload,
  miniSession,
  newMiniForm,
  parseMiniDetail,
  parseMiniEntitlement,
  parseMiniList,
  runMiniAction,
  saveMiniCampaign,
  type MiniClient,
} from "../src/organizer/mini-campaigns";

const at = "2026-11-28T15:00:00.000Z";
const fixture = {
  id: "mini-test",
  organizerId: "org",
  mainCampaignId: "parent",
  mainCampaign: { id: "parent", title: "Campanha fictícia" },
  status: "DRAFT",
  name: "Teste privado",
  description: null,
  prizeType: "PRODUCT",
  prizeDescription: "Prêmio fictício",
  maxTickets: 50,
  ticketPrice: "0.15",
  purchaseLimitPerBuyer: null,
  soldTickets: 0,
  rules: "Regra fictícia segura para teste",
  startsAt: null,
  endsAt: null,
  drawAt: null,
  publishedAt: null,
  result: null,
  slug: "not-exposed",
  imageUrl: "https://not-connected.invalid",
  deletedAt: null,
  grossRevenue: "0",
  _count: { orders: 0, tickets: 0 },
};
const draft = {
  ...newMiniForm(),
  parentId: "parent",
  name: "Rascunho teste",
  prizeType: "OTHER" as const,
  prizeDescription: "Prêmio teste",
  maxTickets: "40",
  ticketPrice: "0,02",
  rules: "Regulamento de teste fictício.",
};
function row(overrides: Record<string, unknown> = {}) {
  const item = parseMiniList([{ ...fixture, ...overrides }], "org")[0];
  assert.ok(item);
  return item;
}
test("Mini list requires exact owner and parent; does not retain public paths / images", () => {
  assert.deepEqual(parseMiniList([], "org"), []);
  const item = row();
  assert.equal(item.ticketPrice, 0.15);
  assert.equal(item.allocated, 0);
  assert.equal("slug" in item, false);
  assert.equal("imageUrl" in item, false);
  assert.equal("grossRevenue" in item, false);
  assert.throws(() => parseMiniList([fixture], "foreign"), /inválidos/);
  assert.throws(
    () => row({ mainCampaign: { id: "foreign", title: "Outra" } }),
    /inválidos/,
  );
});
test("Mini detail distinguishes allocated/reservation vs paid; no personal data or unconfirmed number", () => {
  const order = {
    id: "order-a",
    miniCampaignId: "mini-test",
    code: "MINI-TEST",
    status: "AWAITING_PAYMENT",
    quantity: 2,
    total: "0.30",
    createdAt: at,
    buyer: { name: "omit", city: "omit" },
    buyerId: "omit",
  };
  const result = {
    miniCampaignId: "mini-test",
    winningNumber: 7,
    drawnAt: at,
    confirmedAt: null,
    notes: "omit",
    winner: { name: "omit" },
    auditedData: { private: "omit" },
  };
  const raw = { ...fixture, orders: [order], soldTickets: 2, result };
  const d = parseMiniDetail(raw, "org", "mini-test");
  assert.equal(d.allocated, 2);
  assert.equal(d.orders[0]?.status, "AWAITING_PAYMENT");
  assert.equal(d.orders[0]?.total, 0.3);
  assert.deepEqual(d.result, {
    recordedAt: at,
    confirmedAt: null,
    confirmedNumber: null,
  });
  assert.equal("buyer" in (d.orders[0] ?? {}), false);
  assert.equal(
    parseMiniDetail(
      { ...raw, result: { ...result, confirmedAt: at } },
      "org",
      "mini-test",
    ).result?.confirmedNumber,
    7,
  );
  assert.throws(() => parseMiniDetail(raw, "org", "other"));
  assert.throws(() =>
    parseMiniDetail(
      { ...raw, orders: [{ ...order, miniCampaignId: "other" }] },
      "org",
      "mini-test",
    ),
  );
});
test("only pristine private drafts can edit/delete; published rows can pause but never publish, finish or register result", () => {
  assert.equal(canEditMini(row()), true);
  assert.deepEqual(enabledMiniActions(row()), ["duplicate", "delete"]);
  const active = row({ status: "PUBLISHED", publishedAt: at });
  assert.equal(canEditMini(active), false);
  assert.deepEqual(enabledMiniActions(active), ["pause", "duplicate"]);
  assert.deepEqual(
    enabledMiniActions(row({ status: "DRAFT", _count: { orders: 1 } })),
    ["duplicate"],
  );
  assert.deepEqual(
    enabledMiniActions(row({ status: "PAUSED", publishedAt: at })),
    ["duplicate"],
  );
});
test("Mini editor uses the genuine numeric/date DTO, immutable parent, no public or external assets", () => {
  const payload = miniPayload({
    ...draft,
    startsAt: "28/11/2026 15:00",
    endsAt: "28/11/2026 16:00",
    drawAt: "28/11/2026 17:00",
    purchaseLimit: "2",
  });
  assert.equal(payload.startsAt, at);
  assert.equal(payload.ticketPrice, 0.02);
  assert.equal(payload.purchaseLimitPerBuyer, 2);
  assert.equal("status" in payload, false);
  assert.equal("imageUrl" in payload, false);
  assert.equal("slug" in payload, false);
  assert.throws(() => miniPayload({ ...draft, purchaseLimit: "50" }), /limite/);
  assert.throws(
    () =>
      miniPayload({
        ...draft,
        drawAt: "28/11/2026 14:00",
        endsAt: "28/11/2026 15:00",
      }),
    /apuração/,
  );
  assert.throws(
    () => miniPayload({ ...draft, parentId: "foreign" }, row()),
    /não pode ser alterada/,
  );
  assert.equal(miniFormFromCampaign(row()).parentId, "parent");
});
test("verify campaign state before mutation; active session and ownership fence stale/missing IDs", async () => {
  let revision = 1,
    state = "DRAFT";
  const calls: string[] = [];
  const client: MiniClient = {
    snapshot: () =>
      ({
        status: "signedIn",
        user: { id: "org", role: "ORGANIZER" },
      }) as AuthState,
    activeSessionRevision: () => revision,
    async request<T>(path: string, method = "GET") {
      calls.push(method + " " + path);
      if (path.endsWith("/foreign")) throw new ApiError("Missing", 404);
      if (path === "/mini-campaigns" && method === "GET") return [fixture] as T;
      if (method === "GET")
        return { ...fixture, status: state, orders: [] } as T;
      return {
        ...fixture,
        status: method === "DELETE" ? "CANCELLED" : "DRAFT",
      } as T;
    },
  };
  const session = miniSession(client);
  assert.ok(session);
  assert.equal((await loadMiniCampaigns(client, session)).kind, "ok");
  assert.equal((await saveMiniCampaign(client, session, draft)).kind, "ok");
  assert.equal(
    (await loadMiniDetail(client, session, "foreign")).kind,
    "missing",
  );
  state = "PUBLISHED";
  await assert.rejects(
    runMiniAction(client, session, row(), "delete"),
    /mudou/,
  );
  assert.equal(
    calls.some((v) => v.startsWith("DELETE")),
    false,
  );
  state = "DRAFT";
  assert.equal(
    (await runMiniAction(client, session, row(), "delete")).kind,
    "ok",
  );
  revision++;
  const last = calls.length;
  assert.deepEqual(await loadMiniDetail(client, session, "mini-test"), {
    kind: "stale",
  });
  assert.equal(calls.length, last);
});
test("organizer menu has a native route and the UI never touches public mini endpoints", () => {
  const menu = readFileSync(
    new URL("../src/organizer/premium-navigation.ts", import.meta.url),
    "utf8",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const adapter = readFileSync(
    new URL("../src/organizer/mini-campaigns.ts", import.meta.url),
    "utf8",
  );
  const view = readFileSync(
    new URL(
      "../src/organizer/NativeOrganizerMiniCampaigns.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    menu,
    /title: "Mini campanhas", icon: "🎟️", route: "OrganizerMiniCampaigns"/,
  );
  const owner = app
    .split('{auth.user?.role === "ORGANIZER" && (')
    .find((s) => s.includes('name="OrganizerProfile"'))
    ?.split("</>")[0];
  assert.ok(
    owner?.includes(
      'name="OrganizerMiniCampaigns" component={OrganizerMiniCampaignsScreen}',
    ),
  );
  assert.doesNotMatch(
    adapter + view,
    /public\/mini-campaigns|WebView|Linking[.]/,
  );
});

test("Duplicate requires the exact eligible subscribed plan, not a fallback", () => {
  const eligible = {
    subscription: { organizerId: "org", status: "TRIAL", planId: "plan" },
    plan: { id: "plan", features: [{ key: "miniCampaigns", value: true }] },
  };
  assert.equal(parseMiniEntitlement(eligible, "org"), true);
  assert.equal(parseMiniEntitlement(eligible, "other"), false);
  assert.equal(
    parseMiniEntitlement({ ...eligible, subscription: null }, "org"),
    false,
  );
  assert.equal(
    parseMiniEntitlement(
      {
        ...eligible,
        subscription: { ...eligible.subscription, status: "CANCELLED" },
      },
      "org",
    ),
    false,
  );
  assert.equal(
    parseMiniEntitlement(
      { ...eligible, plan: { ...eligible.plan, id: "fallback" } },
      "org",
    ),
    false,
  );
  assert.deepEqual(enabledMiniActions(row(), false), ["delete"]);
});
