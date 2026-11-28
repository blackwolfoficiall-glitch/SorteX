import { ApiError, type SortexClient } from "../api/client";

export const ordersPageSize = 20;
export const orderStatuses = {
  PENDING: "Pendente",
  RESERVED: "Reservado",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
} as const;
export const orderMethods = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
} as const;
export const orderSorts = {
  recent: "Mais recentes",
  value_desc: "Maior valor",
  value_asc: "Menor valor",
  quantity_desc: "Maior quantidade",
  buyer_desc: "Comprador (Z–A)",
} as const;
type Status = keyof typeof orderStatuses;
type Method = keyof typeof orderMethods;
type Sort = keyof typeof orderSorts;

export type OrderFilters = {
  search: string;
  campaignId: string;
  status: "" | Status;
  method: "" | Method;
  from: string;
  to: string;
  minValue: string;
  maxValue: string;
  sort: Sort;
};
export const initialOrderFilters: OrderFilters = {
  search: "",
  campaignId: "",
  status: "",
  method: "",
  from: "",
  to: "",
  minValue: "",
  maxValue: "",
  sort: "recent",
};
export type OrganizerOrdersSession = { organizerId: string; revision: number };
export type OrganizerOrdersClient = Pick<
  SortexClient,
  "request" | "snapshot" | "activeSessionRevision"
>;
export type OrderCampaign = { id: string; title: string };
type Payment = { method: Method; status: string; createdAt: string };
export type OrganizerOrderRow = {
  id: string;
  campaign: OrderCampaign;
  buyerName: string;
  createdAt: string;
  total: number;
  quantity: number;
  status: Status;
  payment: Payment | null;
  affiliate: string | null;
};
export type OrganizerOrderDetail = OrganizerOrderRow & {
  registeredTickets: number | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  approvedAt: string | null;
  events: { type: string; createdAt: string }[];
};
export type OrdersSummary = {
  approvedSales: number;
  pendingReservations: number;
  ordersToday: number;
  periodRevenue: number;
};
export type OrganizerOrdersPage = {
  items: OrganizerOrderRow[];
  page: number;
  pages: number;
  total: number;
  summary: OrdersSummary | null;
};

const object = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(v);
const nonempty = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const amount = (v: unknown): v is number =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= 0 &&
  v <= Number.MAX_SAFE_INTEGER / 100;
const timestamp = (v: unknown): v is string =>
  typeof v === "string" &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const nullableText = (v: unknown): string | null =>
  nonempty(v) ? v.trim() : null;
const invalid = () =>
  new Error("A API não retornou pedidos válidos. Nenhum dado foi exibido.");
const day = (v: string) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
  if (!match) throw new Error("Use DD/MM/AAAA nas datas.");
  const result = `${match[3]}-${match[2]}-${match[1]}`;
  const utc = new Date(result + "T00:00:00.000Z");
  if (
    !Number.isFinite(utc.getTime()) ||
    utc.toISOString().slice(0, 10) !== result
  )
    throw new Error("Informe datas válidas.");
  return result;
};
const moneyFilter = (v: string) => {
  const trimmed = v.trim().replace(",", ".");
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(trimmed))
    throw new Error("Informe valores positivos sem separador de milhar.");
  return Number(trimmed).toFixed(2);
};

export function organizerOrdersPath(
  filters: OrderFilters,
  page: number,
): string {
  if (!Number.isSafeInteger(page) || page < 1) throw invalid();
  const query = new URLSearchParams({
    page: String(page),
    limit: String(ordersPageSize),
  });
  const search = filters.search.trim();
  if (search.length > 120)
    throw new Error("A busca deve ter até 120 caracteres.");
  if (search) query.set("search", search);
  if (filters.campaignId) {
    if (!id(filters.campaignId)) throw invalid();
    query.set("campaignId", filters.campaignId);
  }
  if (filters.status) {
    if (!Object.hasOwn(orderStatuses, filters.status)) throw invalid();
    query.set("status", filters.status);
  }
  if (filters.method) {
    if (!Object.hasOwn(orderMethods, filters.method)) throw invalid();
    query.set("method", filters.method);
  }
  if (!Object.hasOwn(orderSorts, filters.sort)) throw invalid();
  if (filters.sort !== "recent") query.set("sort", filters.sort);
  const from = filters.from.trim() ? day(filters.from) : "";
  const to = filters.to.trim() ? day(filters.to) : "";
  if (from && to && from > to)
    throw new Error("A data inicial não pode ser posterior à final.");
  if (from) query.set("from", from + "T00:00:00.000Z");
  if (to) query.set("to", to + "T23:59:59.999Z");
  const min = filters.minValue.trim() ? moneyFilter(filters.minValue) : "";
  const max = filters.maxValue.trim() ? moneyFilter(filters.maxValue) : "";
  if (min && max && Number(min) > Number(max))
    throw new Error("O mínimo não pode exceder o máximo.");
  if (min) query.set("minValue", min);
  if (max) query.set("maxValue", max);
  // A dot is safe in an encoded query. The client also rejects literal '..'
  // as a path guard, so encode all query dots without weakening that guard.
  return "/organizer/orders?" + query.toString().replace(/\./g, "%2E");
}

export function parseOrderCampaigns(payload: unknown): OrderCampaign[] {
  if (!Array.isArray(payload)) throw invalid();
  const result = payload.map((row: unknown) => {
    const v = object(row);
    if (!v || !id(v.id) || !nonempty(v.title)) throw invalid();
    return { id: v.id, title: v.title };
  });
  if (new Set(result.map((v) => v.id)).size !== result.length) throw invalid();
  return result;
}

function parsePayment(value: unknown): Payment {
  const v = object(value);
  if (
    !v ||
    typeof v.method !== "string" ||
    !Object.hasOwn(orderMethods, v.method) ||
    !nonempty(v.status) ||
    !timestamp(v.createdAt)
  )
    throw invalid();
  return {
    method: v.method as Method,
    status: v.status,
    createdAt: v.createdAt,
  };
}

function parseRow(value: unknown): OrganizerOrderRow {
  const v = object(value),
    campaign = object(v?.campaign),
    buyer = object(v?.buyer);
  if (
    !v ||
    !id(v.id) ||
    !campaign ||
    !id(campaign.id) ||
    !nonempty(campaign.title) ||
    !buyer ||
    !nonempty(buyer.name) ||
    typeof v.status !== "string" ||
    !Object.hasOwn(orderStatuses, v.status) ||
    !amount(v.total) ||
    !count(v.quantity) ||
    v.quantity === 0 ||
    !timestamp(v.createdAt) ||
    !Array.isArray(v.payments)
  )
    throw invalid();
  const payments = v.payments.map(parsePayment);
  const entry = object(v.affiliateConversion)?.affiliate;
  const affiliate = nullableText(
    typeof entry === "string" ? entry : object(entry)?.name,
  );
  return {
    id: v.id,
    campaign: { id: campaign.id, title: campaign.title },
    buyerName: buyer.name,
    status: v.status as Status,
    createdAt: v.createdAt,
    quantity: v.quantity,
    total: v.total,
    payment: payments[0] ?? null,
    affiliate,
  };
}

export function parseOrganizerOrdersPage(
  payload: unknown,
  page: number,
  filters: OrderFilters,
): OrganizerOrdersPage {
  const v = object(payload);
  if (
    !v ||
    v.page !== page ||
    !count(v.total) ||
    !count(v.pages) ||
    v.pages !== Math.ceil(v.total / ordersPageSize) ||
    !Array.isArray(v.items) ||
    v.items.length > ordersPageSize ||
    v.items.length > v.total ||
    (page > v.pages && v.items.length > 0) ||
    (page <= v.pages && !v.items.length)
  )
    throw invalid();
  const items = v.items.map(parseRow);
  if (
    new Set(items.map((o) => o.id)).size !== items.length ||
    items.some(
      (o) =>
        (filters.campaignId && o.campaign.id !== filters.campaignId) ||
        (filters.status && o.status !== filters.status),
    )
  )
    throw invalid();

  const rawSummary = object(v.summary);
  let summary: OrdersSummary | null = null;
  if (v.summary !== undefined) {
    if (
      !rawSummary ||
      !amount(rawSummary.approvedSales) ||
      !count(rawSummary.pendingReservations) ||
      !count(rawSummary.ordersToday) ||
      !amount(rawSummary.periodRevenue)
    )
      throw invalid();
    summary = {
      approvedSales: rawSummary.approvedSales,
      pendingReservations: rawSummary.pendingReservations,
      ordersToday: rawSummary.ordersToday,
      periodRevenue: rawSummary.periodRevenue,
    };
  }
  return { items, summary, page, pages: v.pages, total: v.total };
}

export function parseOrganizerOrderDetail(
  payload: unknown,
  expectedId: string,
): OrganizerOrderDetail {
  const row = parseRow(payload);
  if (row.id !== expectedId) throw invalid();
  const v = object(payload)!;
  const buyer = object(v.buyer)!;
  const totals = object(v._count);
  if (v._count !== undefined && (!totals || !count(totals.tickets)))
    throw invalid();
  const payments = (v.payments as unknown[]).map((value) => object(value)!);
  const events = payments
    .flatMap((payment) => {
      if (payment.events === undefined) return [];
      if (!Array.isArray(payment.events)) throw invalid();
      return payment.events.map((source: unknown) => {
        const e = object(source);
        if (!e || !nonempty(e.eventType) || !timestamp(e.createdAt))
          throw invalid();
        return { type: e.eventType, createdAt: e.createdAt };
      });
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const approvedAt = payments.find(
    (p) => p.status === "APPROVED" && timestamp(p.approvedAt),
  )?.approvedAt;
  // The organizer endpoint reports a relation count, not issued ticket numbers
  // nor payment credentials. Do not project even if an older server includes them.
  return {
    ...row,
    registeredTickets: (totals?.tickets as number | undefined) ?? null,
    buyerEmail: nullableText(buyer.email),
    buyerPhone: nullableText(buyer.phone),
    approvedAt: timestamp(approvedAt) ? approvedAt : null,
    events,
  };
}

export function organizerOrdersSession(
  client: OrganizerOrdersClient,
): OrganizerOrdersSession | null {
  const auth = client.snapshot();
  const revision = client.activeSessionRevision();
  return auth.status === "signedIn" &&
    auth.user?.role === "ORGANIZER" &&
    revision !== null
    ? { organizerId: auth.user.id, revision }
    : null;
}

export function sameOrganizerOrdersSession(
  client: OrganizerOrdersClient,
  expected: OrganizerOrdersSession,
) {
  const active = organizerOrdersSession(client);
  return (
    active?.organizerId === expected.organizerId &&
    active.revision === expected.revision
  );
}

async function scopedRead<T>(
  client: OrganizerOrdersClient,
  expected: OrganizerOrdersSession,
  path: string,
  decode: (value: unknown) => T,
) {
  const same = () => sameOrganizerOrdersSession(client, expected);
  if (!same()) return { kind: "stale" } as const;
  try {
    const payload = await client.request<unknown>(path);
    if (!same()) return { kind: "stale" } as const;
    return { kind: "ok", data: decode(payload) } as const;
  } catch (error) {
    if (!same()) return { kind: "stale" } as const;
    if (error instanceof ApiError && error.status === 404)
      return { kind: "missing" } as const;
    throw error;
  }
}

export function loadOrganizerOrders(
  client: OrganizerOrdersClient,
  expected: OrganizerOrdersSession,
  filters: OrderFilters,
  page: number,
) {
  return scopedRead(client, expected, organizerOrdersPath(filters, page), (v) =>
    parseOrganizerOrdersPage(v, page, filters),
  );
}
export function loadOrganizerOrderDetail(
  client: OrganizerOrdersClient,
  expected: OrganizerOrdersSession,
  orderId: string,
) {
  if (!id(orderId)) throw invalid();
  return scopedRead(
    client,
    expected,
    `/organizer/orders/${encodeURIComponent(orderId)}`,
    (v) => parseOrganizerOrderDetail(v, orderId),
  );
}
export function loadOrganizerOrderCampaigns(
  client: OrganizerOrdersClient,
  expected: OrganizerOrdersSession,
) {
  return scopedRead(client, expected, "/campaigns/my", parseOrderCampaigns);
}
