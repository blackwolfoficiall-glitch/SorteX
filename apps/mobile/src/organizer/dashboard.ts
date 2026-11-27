import type { SortexClient } from "../api/client";

const campaignStatuses = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "PAUSED",
  "SOLD_OUT",
  "DRAWN",
  "FINISHED",
  "CANCELLED",
] as const;
type CampaignStatus = (typeof campaignStatuses)[number];
export type DashboardCampaign = {
  id: string;
  title: string;
  status: CampaignStatus;
  publicationBlocked: boolean;
  totalNumbers: number;
  soldNumbers: number;
};
export type DashboardSummary = {
  grossRevenue: number;
  activeCampaigns: number;
  participants: number;
  soldTickets: number;
  averageTicket?: number;
};
export type Dashboard = {
  summary: DashboardSummary;
  campaigns: DashboardCampaign[];
  generatedAt: string;
  revenueHistory?: { date: string; revenue: number }[];
};
export type DashboardClient = Pick<
  SortexClient,
  "request" | "snapshot" | "activeSessionRevision"
>;
export type DashboardSession = { organizerId: string; revision: number };

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const monetary = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= Number.MAX_SAFE_INTEGER / 100;
const status = (value: unknown): value is CampaignStatus =>
  typeof value === "string" &&
  (campaignStatuses as readonly string[]).includes(value);

export function parseOrganizerDashboard(payload: unknown): Dashboard {
  const data = record(payload);
  const summary = record(data?.summary);
  const invalid = () =>
    new Error("A API não devolveu indicadores válidos para o painel.");
  if (
    !data ||
    !summary ||
    !Array.isArray(data.campaigns) ||
    typeof data.generatedAt !== "string" ||
    !Number.isFinite(Date.parse(data.generatedAt)) ||
    new Date(data.generatedAt).toISOString() !== data.generatedAt ||
    !monetary(summary.grossRevenue) ||
    !count(summary.activeCampaigns) ||
    !count(summary.participants) ||
    !count(summary.soldTickets) ||
    (summary.averageTicket !== undefined && !monetary(summary.averageTicket))
  )
    throw invalid();
  const seen = new Set<string>();
  const campaigns = data.campaigns.map((item: unknown): DashboardCampaign => {
    const c = record(item);
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(c.id) ||
      seen.has(c.id) ||
      typeof c.title !== "string" ||
      !c.title.trim() ||
      !status(c.status) ||
      typeof c.publicationBlocked !== "boolean" ||
      !count(c.totalNumbers) ||
      !count(c.soldNumbers)
    )
      throw invalid();
    seen.add(c.id);
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      publicationBlocked: c.publicationBlocked,
      totalNumbers: c.totalNumbers,
      soldNumbers: c.soldNumbers,
    };
  });
  if (
    summary.activeCampaigns !==
      campaigns.filter(
        (c) =>
          !c.publicationBlocked &&
          (c.status === "PUBLISHED" || c.status === "SOLD_OUT"),
      ).length ||
    (campaigns.length === 0 &&
      (summary.grossRevenue !== 0 ||
        summary.participants !== 0 ||
        summary.soldTickets !== 0))
  )
    throw invalid();
  const history = data.revenueHistory;
  let revenueHistory: Dashboard["revenueHistory"];
  if (history !== undefined) {
    if (!Array.isArray(history) || history.length > 367) throw invalid();
    let after = "";
    revenueHistory = history.map((item) => {
      const row = record(item);
      if (!row || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
          !Number.isFinite(Date.parse(row.date)) ||
          new Date(row.date).toISOString().slice(0, 10) !== row.date ||
          row.date <= after || !monetary(row.revenue)) throw invalid();
      after = row.date;
      return { date: row.date, revenue: row.revenue };
    });
  }
  return {
    ...(revenueHistory ? { revenueHistory } : {}),
    generatedAt: data.generatedAt,
    campaigns,
    summary: {
      grossRevenue: summary.grossRevenue,
      activeCampaigns: summary.activeCampaigns,
      participants: summary.participants,
      soldTickets: summary.soldTickets,
      ...(typeof summary.averageTicket === "number" ? { averageTicket: summary.averageTicket } : {}),
    },
  };
}

export function organizerDashboardSession(
  client: DashboardClient,
): DashboardSession | null {
  const state = client.snapshot();
  const revision = client.activeSessionRevision();
  return state.status === "signedIn" &&
    state.user?.role === "ORGANIZER" &&
    revision !== null
    ? { organizerId: state.user.id, revision }
    : null;
}

export async function loadOrganizerDashboard(
  client: DashboardClient,
  expected: DashboardSession,
): Promise<Dashboard | null> {
  const same = () => {
    const current = organizerDashboardSession(client);
    return (
      current?.organizerId === expected.organizerId &&
      current.revision === expected.revision
    );
  };
  if (!same()) return null;
  try {
    const response = await client.request<unknown>("/dashboard");
    return same() ? parseOrganizerDashboard(response) : null;
  } catch (error) {
    if (!same()) return null;
    throw error;
  }
}
