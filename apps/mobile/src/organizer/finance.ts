import { ApiError, type SortexClient } from "../api/client";

export const statementPageSize = 15;
export const ledgerTypes = {
  GROSS_SALE: "Venda bruta registrada",
  PLATFORM_FEE: "Taxa SorteX",
  GATEWAY_FEE: "Taxa de gateway registrada",
  ORGANIZER_NET_REVENUE: "Receita líquida lançada",
  REFUND: "Estorno registrado",
  CHARGEBACK: "Contestação registrada",
  PAYOUT_REQUEST: "Solicitação de saque registrada",
  PAYOUT_COMPLETED: "Baixa interna da solicitação de saque",
  PAYOUT_CANCELLED: "Cancelamento interno da solicitação de saque",
  MANUAL_ADJUSTMENT: "Ajuste interno",
  BONUS: "Bônus registrado",
  MONTHLY_PLAN_FEE: "Taxa de plano registrada",
  CAMPAIGN_FEE_WAIVER: "Isenção de taxa registrada",
  PLATFORM_REVENUE: "Receita da plataforma registrada",
} as const;
export const ledgerStatuses = {
  PENDING: "Pendente",
  AVAILABLE: "Disponível no saldo interno",
  BLOCKED: "Bloqueado no saldo interno",
  COMPLETED: "Registrado como concluído",
  CANCELLED: "Cancelado",
  REVERSED: "Revertido",
} as const;

export type FinanceBalance = {
  currency: "BRL";
  accountExists: boolean;
  gross: string;
  net: string;
  available: string;
  pending: string;
  blocked: string;
  platformFees: string;
  gatewayFees: string;
};
export type LedgerItem = {
  id: string;
  type: keyof typeof ledgerTypes;
  status: keyof typeof ledgerStatuses;
  direction: "CREDIT" | "DEBIT";
  currency: "BRL";
  amount: string;
  createdAt: string;
  campaignTitle: string | null;
};
export type Statement = {
  data: LedgerItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
};
export type FinanceSession = { organizerId: string; revision: number };
export type FinanceClient = Pick<
  SortexClient,
  "request" | "snapshot" | "activeSessionRevision"
>;
export type FinanceRead =
  | { kind: "ok"; balance: FinanceBalance; statement: Statement }
  | { kind: "unavailable" }
  | { kind: "stale" };

const amountPattern = /^-?(?:0|[1-9][0-9]{0,15})\.[0-9]{2}$/;
const money = (value: unknown): value is string =>
  typeof value === "string" && amountPattern.test(value);
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const invalid = () =>
  new Error(
    "A API retornou dados financeiros inválidos. Nenhum valor foi exibido.",
  );

export function parseBalance(value: unknown): FinanceBalance {
  const v = record(value);
  if (
    !v ||
    v.currency !== "BRL" ||
    typeof v.accountExists !== "boolean" ||
    !money(v.gross) ||
    !money(v.net) ||
    !money(v.available) ||
    !money(v.pending) ||
    !money(v.blocked) ||
    !money(v.platformFees) ||
    !money(v.gatewayFees)
  )
    throw invalid();
  if (
    !v.accountExists &&
    [
      v.gross,
      v.net,
      v.available,
      v.pending,
      v.blocked,
      v.platformFees,
      v.gatewayFees,
    ].some((amount) => amount !== "0.00")
  )
    throw invalid();
  return {
    currency: v.currency,
    accountExists: v.accountExists,
    gross: v.gross,
    net: v.net,
    available: v.available,
    pending: v.pending,
    blocked: v.blocked,
    platformFees: v.platformFees,
    gatewayFees: v.gatewayFees,
  };
}

function parseEntry(value: unknown): LedgerItem {
  const v = record(value);
  if (
    !v ||
    typeof v.id !== "string" ||
    !v.id ||
    v.currency !== "BRL" ||
    typeof v.type !== "string" ||
    !Object.hasOwn(ledgerTypes, v.type) ||
    typeof v.status !== "string" ||
    !Object.hasOwn(ledgerStatuses, v.status) ||
    (v.direction !== "CREDIT" && v.direction !== "DEBIT") ||
    !money(v.amount) ||
    v.amount.startsWith("-") ||
    typeof v.createdAt !== "string" ||
    !Number.isFinite(Date.parse(v.createdAt)) ||
    new Date(v.createdAt).toISOString() !== v.createdAt ||
    (v.campaignTitle !== null && typeof v.campaignTitle !== "string")
  )
    throw invalid();
  return {
    id: v.id,
    type: v.type as LedgerItem["type"],
    status: v.status as LedgerItem["status"],
    currency: v.currency,
    direction: v.direction,
    amount: v.amount,
    createdAt: v.createdAt,
    campaignTitle: v.campaignTitle,
  };
}

export function parseStatement(
  value: unknown,
  expectedPage: number,
  expectedLimit: number,
): Statement {
  const v = record(value);
  const p = record(v?.pagination);
  if (
    !v ||
    !Array.isArray(v.data) ||
    v.data.length > expectedLimit ||
    !p ||
    p.page !== expectedPage ||
    p.limit !== expectedLimit ||
    typeof p.total !== "number" ||
    !Number.isSafeInteger(p.total) ||
    p.total < v.data.length ||
    p.pages !== Math.ceil(p.total / expectedLimit)
  )
    throw invalid();
  const data = v.data.map(parseEntry);
  if (new Set(data.map((entry) => entry.id)).size !== data.length)
    throw invalid();
  return {
    data,
    pagination: {
      page: expectedPage,
      limit: expectedLimit,
      total: p.total,
      pages: p.pages,
    },
  };
}

export function formatFinanceMoney(
  value: string,
  direction?: LedgerItem["direction"],
): string {
  if (!money(value)) throw invalid();
  const unsigned = value.replace(/^-/, "");
  const integer = unsigned.slice(0, -3),
    decimal = unsigned.slice(-2);
  const sign =
    value.startsWith("-") || direction === "DEBIT"
      ? "−"
      : direction === "CREDIT"
        ? "+"
        : "";
  return `${sign}R$ ${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${decimal}`;
}

export function organizerFinanceSession(
  client: FinanceClient,
): FinanceSession | null {
  const current = client.snapshot();
  const revision = client.activeSessionRevision();
  return current.status === "signedIn" &&
    current.user?.role === "ORGANIZER" &&
    revision !== null
    ? { organizerId: current.user.id, revision }
    : null;
}

export async function loadOrganizerFinance(
  client: FinanceClient,
  expected: FinanceSession,
  page: number,
): Promise<FinanceRead> {
  const sameAccount = () => {
    const current = organizerFinanceSession(client);
    return (
      current?.organizerId === expected.organizerId &&
      current.revision === expected.revision
    );
  };
  if (!sameAccount()) return { kind: "stale" };
  if (!Number.isSafeInteger(page) || page < 1) throw invalid();
  try {
    const [balance, statement] = await Promise.all([
      client.request<unknown>("/finance/balance/snapshot"),
      client.request<unknown>(
        `/finance/statement/snapshot?page=${page}&limit=${statementPageSize}`,
      ),
    ]);
    if (!sameAccount()) return { kind: "stale" };
    const parsedBalance = parseBalance(balance);
    const parsedStatement = parseStatement(statement, page, statementPageSize);
    if (!parsedBalance.accountExists && parsedStatement.pagination.total !== 0)
      throw invalid();
    return { kind: "ok", balance: parsedBalance, statement: parsedStatement };
  } catch (error) {
    if (!sameAccount()) return { kind: "stale" };
    if (error instanceof ApiError && error.status === 404)
      return { kind: "unavailable" };
    throw error;
  }
}
