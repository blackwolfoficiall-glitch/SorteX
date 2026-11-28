import type { SortexClient } from "../api/client";

export const organizerWinnersPath = "/winners/organizer";
export const winnerStatuses: Record<string, string> = {
  IDENTIFIED: "Identificado",
  PENDING_CONTACT: "Contato pendente",
  CONTACTED: "Contatado",
  CLAIMED: "Resgatado",
  PAYMENT_PENDING: "Pagamento pendente",
  DELIVERED: "Entregue",
  CONFIRMED_BY_WINNER: "Confirmado pelo ganhador",
  NOT_CLAIMED: "Não resgatado",
  CANCELLED: "Cancelado",
  DISPUTED: "Em contestação",
};

export type WinnersClient = Pick<SortexClient, "request" | "snapshot" | "activeSessionRevision">;
export type WinnersSession = { organizerId: string; revision: number };
export type OrganizerWinner = {
  id: string;
  campaign: { id: string; title: string };
  winningNumber: string;
  prizeName: string;
  prizeValue: string | null;
  status: string;
  winnerName: string;
  city: string | null;
  createdAt: string;
  deliveredAt: string | null;
  publicDisclosureAuthorized: boolean;
};
export type WinnerPeriod = 0 | 7 | 30 | 90;
const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : null;
const string = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const money = (value: unknown) => {
  const amount = typeof value === "string" || typeof value === "number" ? String(value) : "";
  return /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$/.test(amount) ? amount : null;
};
export function organizerWinnersSession(client: WinnersClient): WinnersSession | null {
  const auth = client.snapshot();
  const revision = client.activeSessionRevision();
  return auth.status === "signedIn" && auth.user?.role === "ORGANIZER" && revision !== null
    ? { organizerId: auth.user.id, revision } : null;
}
export function parseOrganizerWinners(value: unknown, organizerId: string): OrganizerWinner[] {
  const invalid = () => new Error("Não foi possível verificar os registros da sua operação.");
  if (!Array.isArray(value)) throw invalid();
  const ids = new Set<string>();
  return value.map((raw: unknown) => {
    const row = record(raw), campaign = record(row?.campaign), buyer = record(row?.buyer);
    if (!row || !campaign || campaign.organizerId !== organizerId || !buyer ||
        !string(row.id) || ids.has(row.id) || !string(campaign.id) || !string(campaign.title) ||
        !string(row.winningNumber) || !/^\d+$/.test(row.winningNumber) ||
        !string(row.prizeName) || !string(row.status) || !timestamp(row.createdAt) ||
        (row.deliveredAt !== null && !timestamp(row.deliveredAt)) ||
        typeof row.publicDisclosureAuthorized !== "boolean" || !string(buyer.name))
      throw invalid();
    ids.add(row.id);
    const names = buyer.name.trim().split(/\s+/);
    // Only the display fields leave this parser. Do not store contact data,
    // ticket/purchase identifiers, or the confirmation material in UI state.
    const prizeValue = money(row.prizeValue);
    if (row.prizeValue !== null && prizeValue === null) throw invalid();
    return {
      id: row.id, campaign: { id: campaign.id, title: campaign.title },
      winningNumber: row.winningNumber, prizeName: row.prizeName,
      prizeValue, status: row.status, createdAt: row.createdAt,
      deliveredAt: row.deliveredAt, publicDisclosureAuthorized: row.publicDisclosureAuthorized,
      winnerName: names.length === 1 ? names[0]! : names[0] + " " + Array.from(names.at(-1)!)[0] + ".",
      city: string(buyer.city) ? buyer.city : null,
    };
  });
}
export async function loadOrganizerWinners(client: WinnersClient, session: WinnersSession) {
  const current = () => {
    const active = organizerWinnersSession(client);
    return active?.organizerId === session.organizerId && active.revision === session.revision;
  };
  if (!current()) return null;
  try {
    const rows = await client.request<unknown>(organizerWinnersPath);
    return current() ? parseOrganizerWinners(rows, session.organizerId) : null;
  } catch (error) {
    if (!current()) return null;
    throw error;
  }
}
export function filterOrganizerWinners(rows: OrganizerWinner[], campaign: string, search: string, days: WinnerPeriod, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  const number = search.trim();
  return rows.filter((row) => (!campaign || row.campaign.id === campaign) &&
    (!number || row.winningNumber.includes(number)) &&
    (!days || Date.parse(row.createdAt) >= cutoff.getTime()));
}
