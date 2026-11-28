import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ApiError, type AuthState } from "../src/api/client";
import {
  editablePromotion,
  enabledPromotionActions,
  initialPromotionFilters,
  loadPromotionHistory,
  loadPromotionList,
  newPromotionForm,
  parsePromotionHistory,
  parsePromotionPage,
  parsePromotionReport,
  parsePromotionSummary,
  promotionFormFromItem,
  promotionListPath,
  promotionPayload,
  promotionsSession,
  runPromotionAction,
  savePromotion,
  type PromotionsClient,
} from "../src/organizer/promotions";

const when = "2026-11-28T09:00:00.000Z";
const fixture = {
  id: "promo-test",
  campaignId: "campaign-test",
  campaign: { id: "campaign-test", title: "Campanha fictícia" },
  name: "Cupom fictício",
  type: "COUPON",
  status: "PAUSED",
  description: null,
  startsAt: null,
  endsAt: null,
  numberQuantity: 1,
  packagePrice: 0,
  usageCount: 0,
  totalLimit: 5,
  perBuyerLimit: 1,
  coupons: [
    {
      code: "SEMENTE",
      discountType: "PERCENTAGE",
      discountValue: "10",
      minimumAmount: "0",
    },
  ],
  config: { legacy: { keep: true }, discountValue: 10 },
  stackRules: { legacy: true },
};
function item(edit: Record<string, unknown> = {}) {
  const value = parsePromotionPage(
    { items: [{ ...fixture, ...edit }], total: 1, pages: 1, page: 1 },
    initialPromotionFilters,
    1,
  ).items[0];
  assert.ok(value);
  return value;
}
const form = {
  ...newPromotionForm(),
  campaignId: "campaign-test",
  name: "Cupom de teste",
  couponCode: "seed-123",
  value: "10",
  totalLimit: "3",
  perBuyerLimit: "1",
};

test("Promoções filter by actual owner server query, no route injection or fake zero", () => {
  const route = promotionListPath(
    {
      search: "alvo .. teste",
      type: "COUPON",
      status: "SCHEDULED",
      campaignId: "campaign-test",
    },
    2,
  );
  const url = new URL(route, "https://sortex.invalid");
  assert.equal(url.pathname, "/promotions");
  assert.equal(route.includes(".."), false);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    page: "2",
    limit: "20",
    campaignId: "campaign-test",
    type: "COUPON",
    status: "SCHEDULED",
    search: "alvo .. teste",
  });
  const zero = { items: [], page: 1, pages: 0, total: 0 };
  assert.deepEqual(parsePromotionPage(zero, initialPromotionFilters, 1), zero);
  assert.throws(() =>
    parsePromotionPage(
      { items: [fixture], page: 1, pages: 1, total: 1 },
      { ...initialPromotionFilters, campaignId: "foreign" },
      1,
    ),
  );
  assert.throws(() => parsePromotionSummary({}), /inválidos/);
});
test("Promoções create only explicit draft and validate coupon discounts/wrong limits/dates", () => {
  const payload = promotionPayload({
    ...form,
    startsAt: "28/11/2026 09:00",
    endsAt: "28/11/2026 11:00",
  });
  assert.equal(payload.status, "DRAFT");
  assert.equal(payload.startsAt, when);
  assert.equal(payload.config.code, "SEED-123");
  assert.equal(payload.config.discountValue, 10);
  assert.throws(
    () => promotionPayload({ ...form, value: "100" }),
    /valor a pagar/,
  );
  assert.throws(
    () => promotionPayload({ ...form, perBuyerLimit: "4" }),
    /limite/,
  );
  assert.throws(
    () => promotionPayload({ ...form, startsAt: "31/11/2026 09:00" }),
    /data/,
  );
  assert.throws(
    () =>
      promotionPayload({
        ...form,
        endsAt: "28/11/2026 08:00",
        startsAt: "28/11/2026 09:00",
      }),
    /término/,
  );
});
test("Package creation accepts real price/size; metadata edit keeps stored pricing and does not set unsupported caps", () => {
  const pkg = {
    ...form,
    type: "PACKAGE" as const,
    quantity: "50",
    value: "3,99",
  };
  assert.deepEqual(promotionPayload(pkg).config, {
    quantity: 50,
    promotionalPrice: 3.99,
  });
  assert.equal(promotionPayload(pkg).perBuyerLimit, undefined);
  const current = item({
    type: "PACKAGE",
    coupons: [],
    numberQuantity: 50,
    packagePrice: 3.99,
    config: { quantity: 50, promotionalPrice: 3.99, legacy: true },
  });
  const edit = promotionPayload(
    {
      ...promotionFormFromItem(current),
      name: "Nome alterado",
      quantity: "10",
      value: "20",
    },
    current,
  );
  assert.deepEqual(edit.config, {
    quantity: 50,
    promotionalPrice: 3.99,
    legacy: true,
  });
  assert.equal(edit.totalLimit, current.totalLimit);
  const coupon = item();
  const updated = promotionPayload(
    { ...promotionFormFromItem(coupon), value: "12" },
    coupon,
  );
  assert.deepEqual(updated.config.legacy, { keep: true });
  assert.deepEqual(updated.stackRules, { legacy: true });
  assert.throws(
    () =>
      promotionPayload(
        { ...promotionFormFromItem(coupon), totalLimit: "" },
        coupon,
      ),
    /removido/,
  );
});
test("Only effective promo types can activate; used or active items cannot delete; active cannot edit", () => {
  assert.equal(
    enabledPromotionActions(item({ type: "BONUS", coupons: [] })).includes(
      "activate",
    ),
    false,
  );
  assert.equal(
    enabledPromotionActions(item({ status: "ACTIVE" })).includes("delete"),
    false,
  );
  assert.equal(editablePromotion(item({ status: "ACTIVE" })), false);
  assert.equal(
    enabledPromotionActions(item({ usageCount: 1 })).includes("delete"),
    false,
  );
  assert.equal(
    enabledPromotionActions(item({ status: "ENDED" })).includes("activate"),
    false,
  );
  assert.equal(enabledPromotionActions(item()).includes("activate"), true);
});
test("Promotion reports preserve real zero and scoped ID; history never copies actor/snapshots", () => {
  const report = {
    promotion: { id: "promo-test" },
    usages: 0,
    uniqueBuyers: 0,
    revenue: 0,
    averageTicket: 0,
    grantedDiscount: 0,
    daily: [],
  };
  assert.equal(parsePromotionReport(report, "promo-test").usages, 0);
  assert.throws(() => parsePromotionReport(report, "foreign"));
  assert.deepEqual(
    parsePromotionHistory([
      {
        id: "event",
        action: "PROMOTION_CREATED",
        createdAt: when,
        actorUserId: "omit",
        newData: "omit",
      },
    ]),
    [{ id: "event", action: "Promoção criada", createdAt: when }],
  );
});
test("Mutation uses exact scoped action, confirms draft and needs actual published campaign", async () => {
  let revision = 1;
  let campaign = "DRAFT";
  const routeLog: string[] = [];
  const client: PromotionsClient = {
    snapshot: () =>
      ({
        status: "signedIn",
        user: { id: "organizer-test", role: "ORGANIZER" },
      }) as AuthState,
    activeSessionRevision: () => revision,
    async request<T>(path: string, method = "GET", data?: unknown) {
      routeLog.push(method + " " + path);
      if (path === "/campaigns/campaign-test")
        return { id: "campaign-test", status: campaign } as T;
      if (path === "/promotions/foreign/history")
        throw new ApiError("Missing", 404);
      if (path.startsWith("/promotions?")) throw new ApiError("Offline", 503);
      if (path === "/promotions")
        assert.equal((data as { status: string }).status, "DRAFT");
      return {
        ...fixture,
        status: path.endsWith("/activate") ? "ACTIVE" : "DRAFT",
      } as T;
    },
  };
  const s = promotionsSession(client);
  assert.ok(s);
  assert.equal((await savePromotion(client, s, form)).kind, "ok");
  await assert.rejects(
    runPromotionAction(client, s, item(), "activate"),
    /publicadas/,
  );
  assert.deepEqual(routeLog, [
    "POST /promotions",
    "GET /campaigns/campaign-test",
  ]);
  campaign = "PUBLISHED";
  const active = await runPromotionAction(client, s, item(), "activate");
  assert.equal(active.kind, "ok");
  assert.deepEqual(routeLog.slice(-2), [
    "GET /campaigns/campaign-test",
    "POST /promotions/promo-test/activate",
  ]);
  assert.deepEqual(await loadPromotionHistory(client, s, "foreign"), {
    kind: "missing",
  });
  await assert.rejects(
    loadPromotionList(client, s, initialPromotionFilters, 1),
    /Offline/,
  );
  revision++;
  const expected = routeLog.length;
  assert.deepEqual(await savePromotion(client, s, form), { kind: "stale" });
  assert.equal(routeLog.length, expected);
});
test("Mais opens a native promotion screen exclusively in organizer stack", () => {
  const menu = readFileSync(
    new URL("../src/organizer/premium-navigation.ts", import.meta.url),
    "utf8",
  );
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  assert.match(
    menu,
    /title: "Promoções", icon: "🏷️", route: "OrganizerPromotions"/,
  );
  const owner = app
    .split('{auth.user?.role === "ORGANIZER" && (')
    .find((s) => s.includes('name="OrganizerProfile"'))
    ?.split("</>")[0];
  assert.ok(
    owner?.includes(
      'name="OrganizerPromotions" component={OrganizerPromotionsScreen}',
    ),
  );
});
