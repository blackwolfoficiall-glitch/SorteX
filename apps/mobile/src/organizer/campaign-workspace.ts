import {
  organizerDashboardSession,
  type DashboardClient,
  type DashboardSession,
} from "./dashboard";
import type { OrganizerCampaignState } from "../domain/organizer-campaign-lifecycle";

export type OrganizerCampaignView = OrganizerCampaignState & {
  organizerId: string;
  description?: string;
  shortDescription?: string;
  regulation?: string;
  mainPrizeName?: string;
  numberPrice?: number;
  progress?: { sold: number; total: number; percent: number };
  publishedAt?: string | null;
};

const allowedStates: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Em análise",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
  SOLD_OUT: "Esgotada",
  DRAWN: "Apurada",
  FINISHED: "Finalizada",
  CANCELLED: "Cancelada",
};

export function campaignStateLabel(status: string) {
  return Object.hasOwn(allowedStates, status) ? allowedStates[status] : "Situação indisponível";
}

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const optionalText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : undefined;
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const invalid = () => new Error("Não foi possível confirmar a campanha com a sua conta.");

export const validCampaignId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);

export function parseOwnedCampaign(
  payload: unknown,
  organizerId: string,
  expectedId?: string,
): OrganizerCampaignView {
  const raw = record(payload);
  if (
    !raw ||
    !validCampaignId(raw.id) ||
    (expectedId !== undefined && expectedId !== raw.id) ||
    raw.organizerId !== organizerId ||
    typeof raw.title !== "string" ||
    !raw.title.trim() ||
    typeof raw.status !== "string"
  )
    throw invalid();
  const total = raw.totalNumbers,
    sold = raw.soldNumbers;
  return {
    id: raw.id,
    organizerId,
    status: raw.status,
    title: raw.title,
    ...(typeof raw.publicationBlocked === "boolean"
      ? { publicationBlocked: raw.publicationBlocked }
      : {}),
    adminReviewStatus: optionalText(raw.adminReviewStatus),
    publishedAt: raw.publishedAt === null ? null : optionalText(raw.publishedAt),
    numberPrice:
      typeof raw.numberPrice === "number" &&
      raw.numberPrice >= 0 &&
      raw.numberPrice <= Number.MAX_SAFE_INTEGER / 100
        ? raw.numberPrice
        : undefined,
    mainPrizeName: optionalText(raw.mainPrizeName),
    description: optionalText(raw.description),
    shortDescription: optionalText(raw.shortDescription),
    regulation: optionalText(raw.regulation),
    progress:
      count(total) && count(sold) && total > 0 && sold <= total
        ? { sold, total, percent: Math.floor((sold / total) * 100) }
        : undefined,
  };
}

export function parseOwnedCampaignList(payload: unknown, organizerId: string) {
  // Keep compatibility with previously accepted bare and paged arrays.
  const rows = Array.isArray(payload) ? payload : record(payload)?.items;
  if (!Array.isArray(rows)) throw invalid();
  const seen = new Set<string>();
  return rows.map((item) => {
    const campaign = parseOwnedCampaign(item, organizerId);
    if (seen.has(campaign.id)) throw invalid();
    seen.add(campaign.id);
    return campaign;
  });
}

export async function loadOrganizerWorkspace<T>(
  client: DashboardClient,
  expected: DashboardSession,
  path: string,
  decode: (data: unknown, organizerId: string) => T,
): Promise<T | null> {
  const same = () => {
    const current = organizerDashboardSession(client);
    return current?.organizerId === expected.organizerId && current.revision === expected.revision;
  };
  if (!same()) return null;
  try {
    const response = await client.request<unknown>(path);
    return same() ? decode(response, expected.organizerId) : null;
  } catch (error) {
    if (!same()) return null;
    throw error;
  }
}
