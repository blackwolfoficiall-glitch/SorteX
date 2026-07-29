export type DashboardCampaign = {
  id: string;
  title: string;
  status: string;
  soldNumbers: number;
  totalNumbers: number;
  grossRevenue: number;
};

export type DashboardSummary = {
  grossRevenue: number;
  revenueToday: number;
  revenueMonth: number;
  activeCampaigns: number;
  soldTickets: number;
  participants: number;
  averageTicket: number;
};

export type DashboardResponse = {
  summary: DashboardSummary;
  campaigns: DashboardCampaign[];
  generatedAt: string;
};

export async function getDashboard(): Promise<DashboardResponse> {
  const response = await fetch("/api/dashboard", { cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as
    | DashboardResponse
    | { message?: string | string[] };

  if (!response.ok) {
    const detail = "message" in payload ? payload.message : undefined;
    const message = Array.isArray(detail) ? detail.join(" ") : detail;
    throw new Error(
      message ||
        `Não foi possível carregar o Dashboard (HTTP ${response.status}).`,
    );
  }

  return payload as DashboardResponse;
}
