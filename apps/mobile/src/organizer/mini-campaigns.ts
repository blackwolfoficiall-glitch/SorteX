import { ApiError } from "../api/client";
import {
  loadOrganizerOrderCampaigns,
  organizerOrdersSession,
  sameOrganizerOrdersSession,
  type OrganizerOrdersClient,
  type OrganizerOrdersSession,
} from "./orders";

export type MiniClient = OrganizerOrdersClient;
export type MiniSession = OrganizerOrdersSession;
export const miniSession = organizerOrdersSession;
export const sameMiniSession = sameOrganizerOrdersSession;
export const loadMiniParents = loadOrganizerOrderCampaigns;

export const miniStates = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
  FINISHED: "Finalizada",
  CANCELLED: "Cancelada",
} as const;
export const miniPrizes = {
  MAIN_CAMPAIGN_TICKETS: "Títulos da campanha principal",
  PIX: "Pix",
  PRODUCT: "Produto",
  BONUS: "Bônus",
  OTHER: "Outro",
} as const;
export const miniOrderStates = {
  RESERVED: "Reservado",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
  FAILED: "Falhou",
} as const;
type Status = keyof typeof miniStates;
type Prize = keyof typeof miniPrizes;
type OrderStatus = keyof typeof miniOrderStates;
export type MiniAction = "pause" | "duplicate" | "delete";
export const miniActions = {
  pause: {
    label: "Pausar",
    note: "A mini campanha deixará de aceitar novas reservas. Os pedidos existentes não serão cancelados.",
  },
  duplicate: {
    label: "Duplicar como rascunho",
    note: "A cópia será privada. Pedidos e resultado não serão copiados.",
  },
  delete: {
    label: "Excluir rascunho",
    note: "Somente rascunhos privados e sem pedidos podem ser excluídos pelo aplicativo.",
  },
} as const;
export type MiniCampaign = {
  id: string;
  parent: { id: string; title: string };
  status: Status;
  name: string;
  description: string;
  prizeType: Prize;
  prizeDescription: string;
  maxTickets: number;
  ticketPrice: number;
  purchaseLimit: number | null;
  allocated: number;
  rules: string;
  startsAt: string | null;
  endsAt: string | null;
  drawAt: string | null;
  publishedAt: string | null;
  orderCount: number;
  hasResult: boolean;
};
export type MiniDetail = MiniCampaign & {
  orders: {
    id: string;
    code: string;
    status: OrderStatus;
    quantity: number;
    total: number;
    createdAt: string;
  }[];
  result: {
    recordedAt: string;
    confirmedAt: string | null;
    confirmedNumber: number | null;
  } | null;
};
export type MiniForm = {
  parentId: string;
  name: string;
  description: string;
  prizeType: Prize;
  prizeDescription: string;
  maxTickets: string;
  ticketPrice: string;
  purchaseLimit: string;
  rules: string;
  startsAt: string;
  endsAt: string;
  drawAt: string;
};
export const newMiniForm = (): MiniForm => ({
  parentId: "",
  name: "",
  description: "",
  prizeType: "MAIN_CAMPAIGN_TICKETS",
  prizeDescription: "",
  maxTickets: "",
  ticketPrice: "",
  purchaseLimit: "",
  rules: "",
  startsAt: "",
  endsAt: "",
  drawAt: "",
});
const base = "/mini-campaigns";
const invalid = () =>
  new Error("A API retornou dados inválidos de mini campanhas.");
const obj = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const id = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v);
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const date = (v: unknown): v is string =>
  typeof v === "string" &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const optionalDate = (v: unknown): v is string | null => v === null || date(v);
function wireDecimal(v: unknown) {
  const n =
    typeof v === "string" && /^\d+(\.\d{1,2})?$/.test(v) ? Number(v) : v;
  if (
    typeof n !== "number" ||
    !Number.isFinite(n) ||
    n < 0 ||
    n > Number.MAX_SAFE_INTEGER / 100
  )
    throw invalid();
  return n;
}
function parseCampaign(
  v: unknown,
  owner: string,
  detail = false,
): MiniCampaign {
  const x = obj(v),
    parent = obj(x?.mainCampaign),
    counts = obj(x?._count);
  if (
    !x ||
    x.organizerId !== owner ||
    !id(x.id) ||
    !parent ||
    !id(parent.id) ||
    parent.id !== x.mainCampaignId ||
    !text(parent.title) ||
    !text(x.name) ||
    !text(x.rules) ||
    !text(x.prizeDescription) ||
    typeof x.status !== "string" ||
    !Object.hasOwn(miniStates, x.status) ||
    typeof x.prizeType !== "string" ||
    !Object.hasOwn(miniPrizes, x.prizeType) ||
    !count(x.maxTickets) ||
    x.maxTickets === 0 ||
    !count(x.soldTickets) ||
    (x.purchaseLimitPerBuyer !== null && !count(x.purchaseLimitPerBuyer)) ||
    (x.description !== null && typeof x.description !== "string") ||
    !optionalDate(x.startsAt) ||
    !optionalDate(x.endsAt) ||
    !optionalDate(x.drawAt) ||
    !optionalDate(x.publishedAt) ||
    (x.result !== null && !obj(x.result)) ||
    (!detail && (!counts || !count(counts.orders))) ||
    (detail && !Array.isArray(x.orders))
  )
    throw invalid();
  return {
    id: x.id,
    parent: { id: parent.id, title: parent.title },
    status: x.status as Status,
    name: x.name,
    description: x.description ?? "",
    prizeType: x.prizeType as Prize,
    prizeDescription: x.prizeDescription,
    maxTickets: x.maxTickets,
    ticketPrice: wireDecimal(x.ticketPrice),
    purchaseLimit: x.purchaseLimitPerBuyer,
    allocated: x.soldTickets,
    rules: x.rules,
    startsAt: x.startsAt,
    endsAt: x.endsAt,
    drawAt: x.drawAt,
    publishedAt: x.publishedAt,
    orderCount: detail
      ? (x.orders as unknown[]).length
      : (counts!.orders as number),
    hasResult: x.result !== null,
  };
}
export function parseMiniList(v: unknown, owner: string): MiniCampaign[] {
  if (!Array.isArray(v)) throw invalid();
  const items = v.map((row) => parseCampaign(row, owner));
  if (new Set(items.map((row) => row.id)).size !== items.length)
    throw invalid();
  return items;
}
export function parseMiniDetail(
  v: unknown,
  owner: string,
  expectedId: string,
): MiniDetail {
  const m = parseCampaign(v, owner, true),
    x = obj(v)!;
  if (m.id !== expectedId) throw invalid();
  const orders = (x.orders as unknown[]).map((value) => {
    const o = obj(value);
    if (
      !o ||
      !id(o.id) ||
      o.miniCampaignId !== m.id ||
      !text(o.code) ||
      !count(o.quantity) ||
      o.quantity === 0 ||
      !date(o.createdAt) ||
      typeof o.status !== "string" ||
      !Object.hasOwn(miniOrderStates, o.status)
    )
      throw invalid();
    return {
      id: o.id,
      code: o.code,
      status: o.status as OrderStatus,
      quantity: o.quantity,
      total: wireDecimal(o.total),
      createdAt: o.createdAt,
    };
  });
  if (new Set(orders.map((o) => o.id)).size !== orders.length) throw invalid();
  const r = obj(x.result);
  if (
    r &&
    (r.miniCampaignId !== m.id ||
      !date(r.drawnAt) ||
      !optionalDate(r.confirmedAt) ||
      !count(r.winningNumber))
  )
    throw invalid();
  return {
    ...m,
    orders,
    result: r
      ? {
          recordedAt: r.drawnAt as string,
          confirmedAt: r.confirmedAt as string | null,
          confirmedNumber: r.confirmedAt ? (r.winningNumber as number) : null,
        }
      : null,
  };
}
export function canEditMini(m: MiniCampaign) {
  return (
    m.status === "DRAFT" &&
    m.publishedAt === null &&
    m.allocated === 0 &&
    m.orderCount === 0 &&
    !m.hasResult
  );
}
export function enabledMiniActions(
  m: MiniCampaign,
  allowDuplicate = true,
): MiniAction[] {
  const actions: MiniAction[] = allowDuplicate ? ["duplicate"] : [];
  if (m.status === "PUBLISHED") actions.unshift("pause");
  if (canEditMini(m)) actions.push("delete");
  return actions;
}
export function miniFormFromCampaign(m: MiniCampaign): MiniForm {
  if (!canEditMini(m))
    throw new Error(
      "Somente rascunhos privados sem pedidos podem ser editados nesta tela.",
    );
  return {
    parentId: m.parent.id,
    name: m.name,
    description: m.description,
    prizeType: m.prizeType,
    prizeDescription: m.prizeDescription,
    maxTickets: String(m.maxTickets),
    ticketPrice: String(m.ticketPrice),
    purchaseLimit: m.purchaseLimit === null ? "" : String(m.purchaseLimit),
    rules: m.rules,
    startsAt: m.startsAt ?? "",
    endsAt: m.endsAt ?? "",
    drawAt: m.drawAt ?? "",
  };
}
function required(raw: string, min: number, max: number, label: string) {
  const v = raw.trim();
  if (v.length < min || v.length > max)
    throw new Error(`${label}: use de ${min} a ${max} caracteres.`);
  return v;
}
function integer(v: string) {
  const n = Number(v.trim());
  if (!/^\d+$/.test(v.trim()) || !count(n) || n < 1 || n > 2147483647)
    throw new Error("Informe uma quantidade inteira maior que zero.");
  return n;
}
function formDate(v: string) {
  const clean = v.trim();
  if (!clean) return undefined;
  if (date(clean)) return clean;
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(clean);
  if (!m) throw new Error("Informe datas no formato DD/MM/AAAA HH:MM (UTC).");
  const iso = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00.000Z`;
  if (!date(iso)) throw new Error("Informe uma data válida (UTC).");
  return iso;
}
export function miniPayload(f: MiniForm, edit?: MiniCampaign) {
  if (!id(f.parentId) || !Object.hasOwn(miniPrizes, f.prizeType))
    throw new Error("Escolha a campanha principal e o tipo de prêmio.");
  if (edit && (!canEditMini(edit) || f.parentId !== edit.parent.id))
    throw new Error(
      "A campanha principal deste rascunho não pode ser alterada.",
    );
  const maxTickets = integer(f.maxTickets);
  const purchaseLimitPerBuyer = f.purchaseLimit.trim()
    ? integer(f.purchaseLimit)
    : undefined;
  if (edit?.purchaseLimit != null && purchaseLimitPerBuyer === undefined)
    throw new Error(
      "O limite existente pode ser alterado, mas não removido nesta versão.",
    );
  if (purchaseLimitPerBuyer && purchaseLimitPerBuyer > maxTickets)
    throw new Error(
      "O limite por comprador não pode superar a quantidade de títulos.",
    );
  const clean = f.ticketPrice.trim(),
    ticketPrice = Number(clean.replace(",", "."));
  if (
    !/^\d+([.,]\d{1,2})?$/.test(clean) ||
    !Number.isFinite(ticketPrice) ||
    ticketPrice < 0.01 ||
    ticketPrice > 999999999999.99
  )
    throw new Error("Informe o preço por título, com até duas casas decimais.");
  const startsAt = formDate(f.startsAt),
    endsAt = formDate(f.endsAt),
    drawAt = formDate(f.drawAt);
  if (startsAt && endsAt && startsAt >= endsAt)
    throw new Error("O término deve ser posterior ao início.");
  if (
    (drawAt && endsAt && drawAt < endsAt) ||
    (drawAt && startsAt && drawAt < startsAt)
  )
    throw new Error("A apuração deve ser prevista para depois da vigência.");
  if (f.description.length > 600)
    throw new Error("Use até 600 caracteres na descrição.");
  return {
    name: required(f.name, 3, 100, "Nome"),
    mainCampaignId: f.parentId,
    prizeType: f.prizeType,
    prizeDescription: required(f.prizeDescription, 3, 180, "Prêmio"),
    maxTickets,
    ticketPrice,
    purchaseLimitPerBuyer,
    startsAt,
    endsAt,
    drawAt,
    rules: required(f.rules, 10, 12000, "Regulamento"),
    description: f.description.trim(),
  };
}
async function scoped<T>(
  c: MiniClient,
  s: MiniSession,
  url: string,
  parse: (v: unknown) => T,
  method = "GET",
  body?: unknown,
) {
  if (!sameMiniSession(c, s)) return { kind: "stale" } as const;
  try {
    const value = await c.request<unknown>(url, method, body);
    if (!sameMiniSession(c, s)) return { kind: "stale" } as const;
    return { kind: "ok", data: parse(value) } as const;
  } catch (e) {
    if (!sameMiniSession(c, s)) return { kind: "stale" } as const;
    if (e instanceof ApiError && e.status === 404)
      return { kind: "missing" } as const;
    throw e;
  }
}
function itemPath(value: string) {
  if (!id(value)) throw invalid();
  return base + "/" + encodeURIComponent(value);
}
// The d13 duplicate endpoint does not check the plan. Never expose that
// action unless the same active/trial selected plan permits new mini campaigns.
export function parseMiniEntitlement(raw: unknown, organizerId: string) {
  const envelope = obj(raw),
    subscription = obj(envelope?.subscription),
    plan = obj(envelope?.plan);
  if (
    !subscription ||
    !plan ||
    subscription.organizerId !== organizerId ||
    !["ACTIVE", "TRIAL"].includes(String(subscription.status)) ||
    !id(subscription.planId) ||
    plan.id !== subscription.planId ||
    !Array.isArray(plan.features)
  )
    return false;
  return plan.features.some((rawFeature) => {
    const feature = obj(rawFeature);
    return feature?.key === "miniCampaigns" && feature.value === true;
  });
}
export const loadMiniEntitlement = (c: MiniClient, s: MiniSession) =>
  scoped(c, s, "/plans/me", (raw) => parseMiniEntitlement(raw, s.organizerId));
export const loadMiniCampaigns = (c: MiniClient, s: MiniSession) =>
  scoped(c, s, base, (v) => parseMiniList(v, s.organizerId));
export const loadMiniDetail = (c: MiniClient, s: MiniSession, miniId: string) =>
  scoped(c, s, itemPath(miniId), (v) =>
    parseMiniDetail(v, s.organizerId, miniId),
  );
function confirmMutation(
  response: unknown,
  s: MiniSession,
  expected: {
    status: Status;
    parent: string;
    itemId?: string;
    otherId?: string;
  },
) {
  const r = obj(response);
  if (
    !r ||
    !id(r.id) ||
    r.organizerId !== s.organizerId ||
    r.status !== expected.status ||
    r.mainCampaignId !== expected.parent ||
    (expected.itemId && r.id !== expected.itemId) ||
    (expected.otherId && r.id === expected.otherId)
  )
    throw invalid();
  if (r.status === "DRAFT" && (r.publishedAt !== null || r.soldTickets !== 0))
    throw invalid();
  return { id: r.id, status: expected.status };
}
export async function saveMiniCampaign(
  c: MiniClient,
  s: MiniSession,
  f: MiniForm,
  edit?: MiniCampaign,
) {
  const body = miniPayload(f, edit);
  if (edit) {
    const before = await loadMiniDetail(c, s, edit.id);
    if (before.kind !== "ok") return before;
    if (!canEditMini(before.data) || before.data.parent.id !== edit.parent.id)
      throw new Error("O estado do rascunho mudou. Atualize a lista.");
  }
  return scoped(
    c,
    s,
    edit ? itemPath(edit.id) : base,
    (v) =>
      confirmMutation(v, s, {
        status: "DRAFT",
        parent: body.mainCampaignId,
        itemId: edit?.id,
      }),
    edit ? "PATCH" : "POST",
    body,
  );
}
export async function runMiniAction(
  c: MiniClient,
  s: MiniSession,
  m: MiniCampaign,
  action: MiniAction,
) {
  if (!enabledMiniActions(m).includes(action))
    throw new Error("Esta ação não está disponível para esta mini campanha.");
  const before = await loadMiniDetail(c, s, m.id);
  if (before.kind !== "ok") return before;
  if (
    !enabledMiniActions(before.data).includes(action) ||
    before.data.parent.id !== m.parent.id
  )
    throw new Error("O estado da mini campanha mudou. Atualize a lista.");
  if (action === "duplicate") {
    const eligible = await loadMiniEntitlement(c, s);
    if (eligible.kind !== "ok") return eligible;
    if (!eligible.data)
      throw new ApiError("O plano atual não habilita a duplicação.", 403);
  }
  const next = {
    pause: "PAUSED",
    duplicate: "DRAFT",
    delete: "CANCELLED",
  } as const;
  return scoped(
    c,
    s,
    itemPath(m.id) + (action === "delete" ? "" : "/" + action),
    (v) =>
      confirmMutation(v, s, {
        status: next[action],
        parent: m.parent.id,
        itemId: action === "duplicate" ? undefined : m.id,
        otherId: action === "duplicate" ? m.id : undefined,
      }),
    action === "delete" ? "DELETE" : "POST",
  );
}
