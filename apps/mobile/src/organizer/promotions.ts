import { ApiError } from "../api/client";
import {
  loadOrganizerOrderCampaigns,
  organizerOrdersSession,
  sameOrganizerOrdersSession,
  type OrganizerOrdersClient,
  type OrganizerOrdersSession,
} from "./orders";

export type PromotionsClient = OrganizerOrdersClient;
export type PromotionsSession = OrganizerOrdersSession;
export const promotionsSession = organizerOrdersSession;
export const samePromotionsSession = sameOrganizerOrdersSession;
export const loadPromotionCampaigns = loadOrganizerOrderCampaigns;

export const promotionTypes = {
  PACKAGE: "Pacote de cotas",
  COUPON: "Cupom de desconto",
  INSTANT_PRIZE: "Cota premiada",
  FLASH: "Oferta relâmpago",
  BONUS: "Bônus por quantidade",
  QUANTITY_DISCOUNT: "Desconto por quantidade",
  CASHBACK: "Cashback",
} as const;
export const promotionStatuses = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ENDED: "Encerrada",
  EXPIRED: "Expirada",
} as const;
type PromotionType = keyof typeof promotionTypes;
type PromotionStatus = keyof typeof promotionStatuses;
export type SupportedPromotion = "COUPON" | "PACKAGE";
export type PromotionAction =
  "activate" | "pause" | "end" | "duplicate" | "delete";
export const promotionActions = {
  activate: {
    label: "Ativar",
    note: "Este benefício poderá alterar o preço de novas compras.",
  },
  pause: { label: "Pausar", note: "Os usos anteriores serão preservados." },
  end: {
    label: "Encerrar",
    note: "A promoção deixará de estar disponível para novas compras.",
  },
  duplicate: {
    label: "Duplicar como rascunho",
    note: "A cópia não ficará ativa. Se for um cupom, o código muda.",
  },
  delete: {
    label: "Excluir",
    note: "Somente promoções sem usos registrados podem ser excluídas.",
  },
} as const;

type JsonObject = Record<string, unknown>;
export type Promotion = {
  id: string;
  campaign: { id: string; title: string };
  type: PromotionType;
  status: PromotionStatus;
  name: string;
  description: string;
  startsAt: string | null;
  endsAt: string | null;
  quantity: number;
  packagePrice: number;
  usageCount: number;
  totalLimit: number | null;
  perBuyerLimit: number | null;
  coupon: {
    code: string;
    discountType: "PERCENTAGE" | "FIXED";
    discountValue: number;
    minimumAmount: number;
  } | null;
  // Persist existing server config on metadata edits without exposing it to the UI.
  edit: { config: JsonObject; stackRules: JsonObject } | null;
};
export type PromotionFilters = {
  search: string;
  campaignId: string;
  type: "" | PromotionType;
  status: "" | PromotionStatus;
};
export const initialPromotionFilters: PromotionFilters = {
  search: "",
  campaignId: "",
  type: "",
  status: "",
};
export type PromotionPageData = {
  items: Promotion[];
  page: number;
  pages: number;
  total: number;
};
export type PromotionSummary = {
  active: number;
  draft: number;
  paused: number;
  scheduled: number;
  ended: number;
  expired: number;
  usages: number;
  revenue: number;
  discount: number;
};
export type PromotionReport = {
  usages: number;
  uniqueBuyers: number;
  revenue: number;
  averageTicket: number;
  grantedDiscount: number;
  daily: { date: string; usages: number; revenue: number }[];
};
export type PromotionEvent = { id: string; action: string; createdAt: string };
export type PromotionForm = {
  campaignId: string;
  type: SupportedPromotion;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  totalLimit: string;
  perBuyerLimit: string;
  couponCode: string;
  discountType: "PERCENTAGE" | "FIXED";
  value: string;
  minimumAmount: string;
  quantity: string;
};
export const newPromotionForm = (): PromotionForm => ({
  campaignId: "",
  type: "COUPON",
  name: "",
  description: "",
  startsAt: "",
  endsAt: "",
  totalLimit: "",
  perBuyerLimit: "",
  couponCode: "",
  discountType: "PERCENTAGE",
  value: "",
  minimumAmount: "",
  quantity: "",
});

const path = "/promotions";
const pageSize = 20;
const invalid = () => new Error("A API retornou dados inválidos de promoções.");
const obj = (v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as JsonObject) : null;
const safeId = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(v);
const count = (v: unknown): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const amount = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;
const timestamp = (v: unknown): v is string =>
  typeof v === "string" &&
  Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString() === v;
const status = (v: unknown): v is PromotionStatus =>
  typeof v === "string" && Object.hasOwn(promotionStatuses, v);
const type = (v: unknown): v is PromotionType =>
  typeof v === "string" && Object.hasOwn(promotionTypes, v);
const text = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;
export const isSupportedPromotion = (v: unknown): v is SupportedPromotion =>
  v === "PACKAGE" || v === "COUPON";

export function promotionListPath(filters: PromotionFilters, page: number) {
  if (!count(page) || page === 0) throw invalid();
  const q = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  });
  if (filters.campaignId) {
    if (!safeId(filters.campaignId)) throw invalid();
    q.set("campaignId", filters.campaignId);
  }
  if (filters.type) {
    if (!type(filters.type)) throw invalid();
    q.set("type", filters.type);
  }
  if (filters.status) {
    if (!status(filters.status)) throw invalid();
    q.set("status", filters.status);
  }
  if (filters.search.trim().length > 120)
    throw new Error("Use até 120 caracteres na busca.");
  if (filters.search.trim()) q.set("search", filters.search.trim());
  return path + "?" + q.toString().replace(/\./g, "%2E");
}
const decimalFromWire = (v: unknown) => {
  if (amount(v)) return v;
  if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v) && amount(Number(v)))
    return Number(v);
  throw invalid();
};
function parsePromotion(value: unknown): Promotion {
  const v = obj(value);
  const c = obj(v?.campaign);
  if (
    !v ||
    !safeId(v.id) ||
    !c ||
    !safeId(c.id) ||
    c.id !== v.campaignId ||
    !text(c.title) ||
    !text(v.name) ||
    !type(v.type) ||
    !status(v.status) ||
    !count(v.numberQuantity) ||
    v.numberQuantity < 1 ||
    !amount(v.packagePrice) ||
    !count(v.usageCount) ||
    (v.description !== null && typeof v.description !== "string") ||
    (v.startsAt !== null && !timestamp(v.startsAt)) ||
    (v.endsAt !== null && !timestamp(v.endsAt)) ||
    (v.totalLimit !== null && !count(v.totalLimit)) ||
    (v.perBuyerLimit !== null && !count(v.perBuyerLimit)) ||
    !Array.isArray(v.coupons)
  )
    throw invalid();
  const x =
    v.type === "COUPON" && v.coupons.length === 1 ? obj(v.coupons[0]) : null;
  let coupon: Promotion["coupon"] = null;
  if (
    x &&
    text(x.code) &&
    (x.discountType === "FIXED" || x.discountType === "PERCENTAGE")
  ) {
    coupon = {
      code: x.code,
      discountType: x.discountType,
      discountValue: decimalFromWire(x.discountValue),
      minimumAmount: decimalFromWire(x.minimumAmount),
    };
  }
  const config = obj(v.config);
  const stackRules = obj(v.stackRules);
  const editable =
    isSupportedPromotion(v.type) &&
    (v.type !== "COUPON" || coupon) &&
    (v.config === null || config) &&
    (v.stackRules === null || stackRules);
  return {
    id: v.id,
    campaign: { id: c.id, title: c.title },
    type: v.type,
    status: v.status,
    name: v.name,
    description: v.description ?? "",
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    quantity: v.numberQuantity,
    packagePrice: v.packagePrice,
    usageCount: v.usageCount,
    totalLimit: v.totalLimit,
    perBuyerLimit: v.perBuyerLimit,
    coupon,
    edit: editable
      ? { config: config ?? {}, stackRules: stackRules ?? {} }
      : null,
  };
}
export function parsePromotionPage(
  payload: unknown,
  filters: PromotionFilters,
  page: number,
): PromotionPageData {
  const v = obj(payload);
  if (
    !v ||
    !count(v.total) ||
    v.page !== page ||
    v.pages !== Math.ceil(v.total / pageSize) ||
    !Array.isArray(v.items) ||
    v.items.length > pageSize ||
    v.items.length > v.total ||
    (page > v.pages && v.items.length > 0) ||
    (page <= v.pages && !v.items.length)
  )
    throw invalid();
  const items = v.items.map(parsePromotion);
  if (
    new Set(items.map((r) => r.id)).size !== items.length ||
    items.some(
      (r) =>
        (filters.campaignId && r.campaign.id !== filters.campaignId) ||
        (filters.status && r.status !== filters.status) ||
        (filters.type && r.type !== filters.type),
    )
  )
    throw invalid();
  return { items, page, pages: v.pages, total: v.total };
}
export function parsePromotionSummary(raw: unknown): PromotionSummary {
  const v = obj(raw);
  if (
    !v ||
    !count(v.active) ||
    !count(v.draft) ||
    !count(v.paused) ||
    !count(v.scheduled) ||
    !count(v.ended) ||
    !count(v.expired) ||
    !count(v.usages) ||
    !amount(v.revenue) ||
    !amount(v.discount)
  )
    throw invalid();
  return {
    active: v.active,
    draft: v.draft,
    paused: v.paused,
    scheduled: v.scheduled,
    ended: v.ended,
    expired: v.expired,
    usages: v.usages,
    revenue: v.revenue,
    discount: v.discount,
  };
}
export function parsePromotionReport(
  raw: unknown,
  promotionId: string,
): PromotionReport {
  const v = obj(raw);
  if (
    !v ||
    obj(v.promotion)?.id !== promotionId ||
    !count(v.usages) ||
    !count(v.uniqueBuyers) ||
    !amount(v.revenue) ||
    !amount(v.averageTicket) ||
    !amount(v.grantedDiscount) ||
    !Array.isArray(v.daily)
  )
    throw invalid();
  const daily = v.daily.map((row) => {
    const d = obj(row);
    if (
      !d ||
      typeof d.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ||
      !count(d.usages) ||
      !amount(d.revenue)
    )
      throw invalid();
    return { date: d.date, usages: d.usages, revenue: d.revenue };
  });
  return {
    usages: v.usages,
    uniqueBuyers: v.uniqueBuyers,
    revenue: v.revenue,
    averageTicket: v.averageTicket,
    grantedDiscount: v.grantedDiscount,
    daily,
  };
}
const events: Record<string, string> = {
  PROMOTION_CREATED: "Promoção criada",
  PROMOTION_UPDATED: "Promoção editada",
  PROMOTION_ACTIVATE: "Promoção ativada",
  PROMOTION_PAUSE: "Promoção pausada",
  PROMOTION_END: "Promoção encerrada",
  PROMOTION_DUPLICATED: "Promoção duplicada",
};
export function parsePromotionHistory(raw: unknown): PromotionEvent[] {
  if (!Array.isArray(raw)) throw invalid();
  return raw.map((value) => {
    const row = obj(value);
    if (
      !row ||
      !safeId(row.id) ||
      !text(row.action) ||
      !timestamp(row.createdAt)
    )
      throw invalid();
    return {
      id: row.id,
      action:
        (Object.hasOwn(events, row.action) ? events[row.action] : undefined) ??
        "Evento de promoção registrado",
      createdAt: row.createdAt,
    };
  });
}

export function editablePromotion(p: Promotion) {
  return (
    !!p.edit &&
    (p.status === "DRAFT" || p.status === "PAUSED" || p.status === "SCHEDULED")
  );
}
export function enabledPromotionActions(p: Promotion): PromotionAction[] {
  const supported =
    p.type === "PACKAGE"
      ? p.packagePrice > 0
      : p.type === "COUPON" &&
        !!p.coupon &&
        !(
          p.coupon.discountType === "PERCENTAGE" &&
          p.coupon.discountValue >= 100
        );
  const terminal = p.status === "ENDED" || p.status === "EXPIRED";
  const actions: PromotionAction[] = [];
  if (
    supported &&
    !terminal &&
    p.status !== "ACTIVE" &&
    (!p.endsAt || Date.parse(p.endsAt) > Date.now()) &&
    (!p.totalLimit || p.usageCount < p.totalLimit)
  )
    actions.push("activate");
  if (p.status === "ACTIVE") actions.push("pause");
  if (!terminal) actions.push("end");
  if (supported) actions.push("duplicate");
  if (!p.usageCount && p.status !== "ACTIVE") actions.push("delete");
  return actions;
}
const optionalInt = (raw: string) => {
  const v = raw.trim();
  if (!v) return undefined;
  if (
    !/^\d+$/.test(v) ||
    !count(Number(v)) ||
    Number(v) < 1 ||
    Number(v) > 2147483647
  )
    throw new Error("Informe limites inteiros maiores que zero.");
  return Number(v);
};
const inputAmount = (raw: string, min: number) => {
  const v = raw.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(v))
    throw new Error("Informe um valor válido com até duas casas decimais.");
  const n = Number(v.replace(",", "."));
  if (!amount(n) || n < min || n > 99999999.99)
    throw new Error("Valor fora do intervalo permitido.");
  return n;
};
// Explicit minute or ISO timestamp, UTC. Existing records retain exact seconds on a metadata edit.
function inputDate(raw: string) {
  if (!raw.trim()) return undefined;
  const value = raw.trim();
  if (timestamp(value)) return value;
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(value);
  if (!m) throw new Error("Use DD/MM/AAAA HH:MM (UTC).");
  const iso = `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00.000Z`;
  if (!timestamp(iso)) throw new Error("Informe uma data válida (UTC).");
  return iso;
}
export function promotionFormFromItem(p: Promotion): PromotionForm {
  if (!isSupportedPromotion(p.type) || !editablePromotion(p))
    throw new Error("Pause a promoção antes de editar.");
  return {
    ...newPromotionForm(),
    campaignId: p.campaign.id,
    type: p.type,
    name: p.name,
    description: p.description,
    startsAt: p.startsAt ?? "",
    endsAt: p.endsAt ?? "",
    totalLimit: p.totalLimit == null ? "" : String(p.totalLimit),
    perBuyerLimit: p.perBuyerLimit == null ? "" : String(p.perBuyerLimit),
    couponCode: p.coupon?.code ?? "",
    discountType: p.coupon?.discountType ?? "PERCENTAGE",
    value: String(p.coupon?.discountValue ?? p.packagePrice),
    minimumAmount: String(p.coupon?.minimumAmount ?? 0),
    quantity: String(p.quantity),
  };
}
export function promotionPayload(f: PromotionForm, edit?: Promotion) {
  if (
    !safeId(f.campaignId) ||
    !isSupportedPromotion(f.type) ||
    f.name.trim().length < 2 ||
    f.name.trim().length > 100 ||
    f.description.length > 240
  )
    throw new Error("Informe uma campanha, tipo e nome de 2 a 100 caracteres.");
  if (
    edit &&
    (!editablePromotion(edit) ||
      edit.campaign.id !== f.campaignId ||
      edit.type !== f.type)
  )
    throw new Error(
      "A campanha e o tipo desta promoção não podem ser alterados.",
    );
  const startsAt = inputDate(f.startsAt),
    endsAt = inputDate(f.endsAt);
  if (startsAt && endsAt && startsAt >= endsAt)
    throw new Error("O término deve ocorrer depois do início.");
  // Package pricing does not enforce a per-buyer limit and combined coupon usage
  // is attributed to the coupon. Preserve legacy values but do not advertise them.
  const totalLimit =
    f.type === "COUPON"
      ? optionalInt(f.totalLimit)
      : (edit?.totalLimit ?? undefined);
  const perBuyerLimit =
    f.type === "COUPON"
      ? optionalInt(f.perBuyerLimit)
      : (edit?.perBuyerLimit ?? undefined);
  if (totalLimit && perBuyerLimit && perBuyerLimit > totalLimit)
    throw new Error("O limite por cliente não pode exceder o total.");
  // d13 PATCH cannot clear those limits consistently on promotion and coupon. Do not send a misleading unset.
  if (
    edit &&
    f.type === "COUPON" &&
    ((edit.totalLimit !== null && totalLimit === undefined) ||
      (edit.perBuyerLimit !== null && perBuyerLimit === undefined))
  )
    throw new Error(
      "O limite existente pode ser alterado, mas não removido por esta versão.",
    );
  let config: JsonObject = { ...(edit?.edit?.config ?? {}) };
  if (f.type === "COUPON") {
    const code = f.couponCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,40}$/.test(code))
      throw new Error(
        "Use um código de 2 a 40 letras, números, hífens ou sublinhados.",
      );
    if (f.discountType !== "FIXED" && f.discountType !== "PERCENTAGE")
      throw new Error("Tipo de desconto inválido.");
    const discountValue = inputAmount(f.value, 0.01);
    if (f.discountType === "PERCENTAGE" && discountValue >= 100)
      throw new Error(
        "O percentual precisa ficar abaixo de 100%, deixando um valor a pagar.",
      );
    config = {
      ...config,
      code,
      discountType: f.discountType,
      discountValue,
      minimumAmount: f.minimumAmount.trim()
        ? inputAmount(f.minimumAmount, 0)
        : 0,
    };
  } else if (!edit) {
    const quantity = optionalInt(f.quantity);
    if (!quantity) throw new Error("Informe a quantidade de cotas do pacote.");
    config = {
      ...config,
      quantity,
      promotionalPrice: inputAmount(f.value, 0.01),
    };
  }
  return {
    campaignId: f.campaignId,
    type: f.type,
    name: f.name.trim(),
    description: f.description.trim(),
    startsAt,
    endsAt,
    totalLimit,
    perBuyerLimit,
    status: edit?.status ?? "DRAFT",
    config,
    stackRules: edit?.edit?.stackRules ?? {
      allowCoupon: f.type !== "COUPON",
      allowCashback: false,
    },
  };
}
async function scoped<T>(
  client: PromotionsClient,
  session: PromotionsSession,
  url: string,
  parser: (p: unknown) => T,
  method = "GET",
  body?: unknown,
) {
  if (!samePromotionsSession(client, session))
    return { kind: "stale" } as const;
  try {
    const res = await client.request<unknown>(url, method, body);
    if (!samePromotionsSession(client, session))
      return { kind: "stale" } as const;
    return { kind: "ok", data: parser(res) } as const;
  } catch (e) {
    if (!samePromotionsSession(client, session))
      return { kind: "stale" } as const;
    if (e instanceof ApiError && e.status === 404)
      return { kind: "missing" } as const;
    throw e;
  }
}
const itemPath = (id: string) => {
  if (!safeId(id)) throw invalid();
  return path + "/" + encodeURIComponent(id);
};
export const loadPromotionList = (
  c: PromotionsClient,
  s: PromotionsSession,
  f: PromotionFilters,
  page: number,
) =>
  scoped(c, s, promotionListPath(f, page), (p) =>
    parsePromotionPage(p, f, page),
  );
export const loadPromotionSummary = (
  c: PromotionsClient,
  s: PromotionsSession,
) => scoped(c, s, path + "/dashboard", parsePromotionSummary);
export const loadPromotionReport = (
  c: PromotionsClient,
  s: PromotionsSession,
  id: string,
) => scoped(c, s, itemPath(id) + "/report", (p) => parsePromotionReport(p, id));
export const loadPromotionHistory = (
  c: PromotionsClient,
  s: PromotionsSession,
  id: string,
) => scoped(c, s, itemPath(id) + "/history", parsePromotionHistory);

function mutationResult(
  raw: unknown,
  expected: {
    id?: string;
    campaignId: string;
    status: PromotionStatus;
    type: PromotionType;
  },
) {
  const v = obj(raw);
  if (
    !v ||
    !safeId(v.id) ||
    v.campaignId !== expected.campaignId ||
    v.type !== expected.type ||
    v.status !== expected.status ||
    (expected.id && v.id !== expected.id)
  )
    throw invalid();
  return { id: v.id, status: expected.status };
}
export function savePromotion(
  c: PromotionsClient,
  s: PromotionsSession,
  f: PromotionForm,
  edit?: Promotion,
) {
  const body = promotionPayload(f, edit);
  return scoped(
    c,
    s,
    edit ? itemPath(edit.id) : path,
    (result) =>
      mutationResult(result, {
        id: edit?.id,
        campaignId: body.campaignId,
        type: body.type,
        status: body.status,
      }),
    edit ? "PATCH" : "POST",
    body,
  );
}
export async function runPromotionAction(
  c: PromotionsClient,
  s: PromotionsSession,
  p: Promotion,
  action: PromotionAction,
) {
  if (!enabledPromotionActions(p).includes(action))
    throw new Error("Esta ação não está disponível para esta promoção.");
  if (action === "activate") {
    if (!safeId(p.campaign.id)) throw invalid();
    const campaign = await scoped(
      c,
      s,
      "/campaigns/" + encodeURIComponent(p.campaign.id),
      (raw) => {
        const row = obj(raw);
        if (!row || row.id !== p.campaign.id || !text(row.status))
          throw invalid();
        return row.status;
      },
    );
    if (campaign.kind !== "ok") return campaign;
    if (campaign.data !== "PUBLISHED")
      throw new Error("Ative promoções somente em campanhas publicadas.");
  }
  const next = {
    activate: "ACTIVE",
    pause: "PAUSED",
    end: "ENDED",
    duplicate: "DRAFT",
    delete: "ENDED",
  } as const;
  const target = itemPath(p.id);
  return scoped(
    c,
    s,
    action === "delete" ? target : target + "/" + action,
    (result) =>
      mutationResult(result, {
        id: action === "duplicate" ? undefined : p.id,
        campaignId: p.campaign.id,
        type: p.type,
        status: next[action],
      }),
    action === "delete" ? "DELETE" : "POST",
  );
}
