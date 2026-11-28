import { ApiError } from "../api/client";
import {
  loadOrganizerOrderCampaigns,
  organizerOrdersSession,
  sameOrganizerOrdersSession,
  type OrganizerOrdersClient,
  type OrganizerOrdersSession,
} from "./orders";

export type PrizeTicketsClient = OrganizerOrdersClient;
export type PrizeTicketsSession = OrganizerOrdersSession;
export const prizeTicketsSession = organizerOrdersSession;
export const isPrizeTicketsSession = sameOrganizerOrdersSession;
export const loadPrizeTicketCampaigns = loadOrganizerOrderCampaigns;
export const prizeTicketsPageSize = 20;
export const prizeTicketStates = {
  available: "Disponível",
  reserved: "Reservada",
  found: "Identificada",
  paused: "Pausada",
  delivered: "Entregue",
} as const;
export const prizeTicketTypes = {
  PIX: "Pix",
  PRODUCT: "Produto",
  GIFT_CARD: "Vale-presente",
  OTHER: "Outro",
} as const;
export const prizeTicketSorts = {
  recent: "Mais recentes",
  oldest: "Mais antigas",
  number: "Número da cota",
} as const;
export const prizeTicketIndicators = {
  all: "Total de cotas",
  ...prizeTicketStates,
  expired: "Reservas expiradas (registros)",
} as const;
type State = keyof typeof prizeTicketStates;
type Type = keyof typeof prizeTicketTypes;
type Sort = keyof typeof prizeTicketSorts;
export type PrizeTicketFilters = {
  campaignId: string;
  search: string;
  status: "" | State;
  type: "" | Type;
  sort: Sort;
};
export const initialPrizeTicketFilters: PrizeTicketFilters = {
  campaignId: "",
  search: "",
  status: "",
  type: "",
  sort: "recent",
};
export type OrganizerPrizeTicket = {
  id: string;
  campaign: { id: string; title: string };
  number: string | null;
  description: string;
  value: number;
  quantity: number;
  foundCount: number;
  type: Type;
  state: State;
  createdAt: string;
  reservation: { expiresAt: string } | null;
  result: {
    status: "IDENTIFIED" | "DELIVERED" | "CANCELLED" | "DISPUTED";
    identifiedAt: string;
    deliveredAt: string | null;
  } | null;
};
export type PrizeTicketPage = {
  items: OrganizerPrizeTicket[];
  total: number;
  page: number;
  pages: number;
};
export type PrizeTicketSummary = Record<
  keyof typeof prizeTicketIndicators,
  number
>;
export type PrizeTicketEvent = {
  id: string;
  action: string;
  createdAt: string;
};
const route = "/organizer/prize-tickets";
const invalid = () =>
  new Error("A API retornou dados inválidos de cotas premiadas.");
const obj = (v: unknown) =>
  typeof v === "object" && !!v && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const safeId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(v);
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const amount = (v: unknown): v is number =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= 0 &&
  v <= Number.MAX_SAFE_INTEGER / 100;
const label = (v: unknown): v is string => typeof v === "string" && !!v.trim();
function campaignQuery(campaignId: string) {
  if (!campaignId) return "";
  if (!safeId(campaignId)) throw invalid();
  return "?" + new URLSearchParams({ campaignId });
}
export function prizeTicketsPath(filters: PrizeTicketFilters, page: number) {
  if (
    !count(page) ||
    page < 1 ||
    !Object.hasOwn(prizeTicketSorts, filters.sort)
  )
    throw invalid();
  const q = new URLSearchParams({
    page: String(page),
    limit: String(prizeTicketsPageSize),
    sort: filters.sort,
  });
  if (filters.campaignId) {
    if (!safeId(filters.campaignId)) throw invalid();
    q.set("campaignId", filters.campaignId);
  }
  const search = filters.search.trim();
  if (search.length > 120)
    throw new Error("A busca deve ter até 120 caracteres.");
  if (search) q.set("search", search);
  if (filters.status) {
    if (!Object.hasOwn(prizeTicketStates, filters.status)) throw invalid();
    q.set("status", filters.status);
  }
  if (filters.type) {
    if (!Object.hasOwn(prizeTicketTypes, filters.type)) throw invalid();
    q.set("type", filters.type);
  }
  return route + "?" + q.toString().replace(/\./g, "%2E");
}
const states = {
  AVAILABLE: "available",
  FOUND: "found",
  DELIVERED: "delivered",
  CANCELLED: "paused",
} as const;
const resultStates = {
  IDENTIFIED: true,
  DELIVERED: true,
  CANCELLED: true,
  DISPUTED: true,
} as const;
function prizeTicket(value: unknown): OrganizerPrizeTicket {
  const v = obj(value);
  const campaign = obj(v?.campaign);
  if (
    !v ||
    !safeId(v.id) ||
    !campaign ||
    !safeId(campaign.id) ||
    campaign.id !== v.campaignId ||
    !label(campaign.title) ||
    !label(v.description) ||
    !amount(v.value) ||
    !count(v.quantity) ||
    v.quantity === 0 ||
    !count(v.foundCount) ||
    !date(v.createdAt) ||
    !(
      v.exactNumber === null ||
      (typeof v.exactNumber === "string" && /^\d{1,16}$/.test(v.exactNumber))
    ) ||
    typeof v.type !== "string" ||
    !Object.hasOwn(prizeTicketTypes, v.type) ||
    typeof v.status !== "string" ||
    !Object.hasOwn(states, v.status) ||
    !Array.isArray(v.results) ||
    v.results.length > 1
  )
    throw invalid();
  const reservation = obj(v.reservation);
  if (v.reservation !== null && (!reservation || !date(reservation.expiresAt)))
    throw invalid();
  const recentResult = obj(v.results[0]);
  if (
    v.results.length &&
    (!recentResult ||
      typeof recentResult.status !== "string" ||
      !Object.hasOwn(resultStates, recentResult.status) ||
      !date(recentResult.identifiedAt) ||
      (recentResult.deliveredAt !== null && !date(recentResult.deliveredAt)))
  )
    throw invalid();
  const state = states[v.status as keyof typeof states];
  return {
    id: v.id,
    campaign: { id: campaign.id, title: campaign.title },
    number: v.exactNumber,
    description: v.description,
    value: v.value,
    quantity: v.quantity,
    foundCount: v.foundCount,
    type: v.type as Type,
    state: reservation && state === "available" ? "reserved" : state,
    createdAt: v.createdAt,
    reservation: reservation
      ? { expiresAt: reservation.expiresAt as string }
      : null,
    result: recentResult
      ? {
          status: recentResult.status as keyof typeof resultStates,
          identifiedAt: recentResult.identifiedAt as string,
          deliveredAt: recentResult.deliveredAt as string | null,
        }
      : null,
  };
}
export function parsePrizeTicketPage(
  payload: unknown,
  page: number,
  filters: PrizeTicketFilters,
): PrizeTicketPage {
  const v = obj(payload);
  if (
    !v ||
    !count(v.total) ||
    v.page !== page ||
    v.pages !== Math.max(1, Math.ceil(v.total / prizeTicketsPageSize)) ||
    !Array.isArray(v.items) ||
    v.items.length > prizeTicketsPageSize ||
    v.items.length > v.total ||
    (page > v.pages && v.items.length) ||
    (v.total > 0 && page <= v.pages && !v.items.length)
  )
    throw invalid();
  const items = v.items.map(prizeTicket);
  if (
    new Set(items.map((item) => item.id)).size !== items.length ||
    items.some(
      (item) =>
        (filters.campaignId && item.campaign.id !== filters.campaignId) ||
        (filters.type && item.type !== filters.type),
    )
  )
    throw invalid();
  return { items, total: v.total, page, pages: v.pages };
}
export function parsePrizeTicketSummary(payload: unknown): PrizeTicketSummary {
  const v = obj(payload);
  const keys = Object.keys(
    prizeTicketIndicators,
  ) as (keyof PrizeTicketSummary)[];
  if (!v || !keys.every((key) => count(v[key]))) throw invalid();
  return Object.fromEntries(
    keys.map((key) => [key, v[key]]),
  ) as PrizeTicketSummary;
}
const auditLabels: Record<string, string> = {
  INSTANT_PRIZES_CREATED: "Cota cadastrada",
  INSTANT_PRIZE_UPDATED: "Cota atualizada",
  INSTANT_PRIZE_REMOVED: "Cota removida",
  INSTANT_PRIZE_PAUSE: "Cota pausada",
  INSTANT_PRIZE_REACTIVATE: "Cota reativada",
  INSTANT_PRIZE_DELIVER: "Entrega registrada",
};
export function parsePrizeTicketHistory(payload: unknown): PrizeTicketEvent[] {
  if (!Array.isArray(payload)) throw invalid();
  const events = payload.map((value) => {
    const v = obj(value);
    if (!v || !safeId(v.id) || !date(v.createdAt) || !label(v.action))
      throw invalid();
    const action = Object.hasOwn(auditLabels, v.action)
      ? (auditLabels[v.action] ?? "Evento de cota registrado")
      : "Evento de cota registrado";
    return { id: v.id, action, createdAt: v.createdAt };
  });
  if (new Set(events.map((event) => event.id)).size !== events.length)
    throw invalid();
  return events;
}
async function scoped<T>(
  client: PrizeTicketsClient,
  session: PrizeTicketsSession,
  path: string,
  parse: (payload: unknown) => T,
) {
  if (!isPrizeTicketsSession(client, session))
    return { kind: "stale" } as const;
  try {
    const payload = await client.request<unknown>(path);
    if (!isPrizeTicketsSession(client, session))
      return { kind: "stale" } as const;
    return { kind: "ok", data: parse(payload) } as const;
  } catch (err) {
    if (!isPrizeTicketsSession(client, session))
      return { kind: "stale" } as const;
    if (err instanceof ApiError && err.status === 404)
      return { kind: "missing" } as const;
    throw err;
  }
}
export function loadPrizeTicketPage(
  client: PrizeTicketsClient,
  session: PrizeTicketsSession,
  filters: PrizeTicketFilters,
  page: number,
) {
  return scoped(client, session, prizeTicketsPath(filters, page), (v) =>
    parsePrizeTicketPage(v, page, filters),
  );
}
export function loadPrizeTicketSummary(
  client: PrizeTicketsClient,
  session: PrizeTicketsSession,
  campaignId: string,
) {
  return scoped(
    client,
    session,
    route + "/summary" + campaignQuery(campaignId),
    parsePrizeTicketSummary,
  );
}
export function loadPrizeTicketHistory(
  client: PrizeTicketsClient,
  session: PrizeTicketsSession,
  ticketId: string,
) {
  if (!safeId(ticketId)) throw invalid();
  return scoped(
    client,
    session,
    route + "/" + encodeURIComponent(ticketId) + "/history",
    parsePrizeTicketHistory,
  );
}
