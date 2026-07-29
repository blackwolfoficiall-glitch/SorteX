import { authRequest } from "@/lib/auth/client";
export type Promotion = {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  usageCount: number;
  totalLimit: number | null;
  attributedRevenue: number;
  grantedDiscount: number;
  updatedAt: string;
  config: Record<string, unknown> | null;
  campaign: { id: string; title: string; slug: string };
  coupons: Array<{ code: string }>;
};
export const promotionDashboard = () =>
  authRequest<Record<string, number>>("/api/platform/promotions/dashboard", {
    cache: "no-store",
  });
export const listPromotions = (q = "") =>
  authRequest<{ items: Promotion[]; total: number; pages: number }>(
    `/api/platform/promotions${q}`,
    { cache: "no-store" },
  );
export const createPromotion = (body: Record<string, unknown>) =>
  authRequest<Promotion>("/api/platform/promotions", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updatePromotion = (id: string, body: Record<string, unknown>) =>
  authRequest<Promotion>(`/api/platform/promotions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const promotionAction = (id: string, action: string) =>
  authRequest(`/api/platform/promotions/${id}/${action}`, { method: "POST" });
export const duplicatePromotion = (id: string) =>
  authRequest(`/api/platform/promotions/${id}/duplicate`, { method: "POST" });
export const deletePromotion = (id: string) =>
  authRequest(`/api/platform/promotions/${id}`, { method: "DELETE" });
export type PromotionReport = {
  usages: number;
  uniqueBuyers: number;
  revenue: number;
  averageTicket: number;
  grantedDiscount: number;
  daily: Array<{ date: string; usages: number; revenue: number }>;
  source: string;
};
export type PromotionHistoryItem = {
  id: string;
  action: string;
  actorUserId: string | null;
  previousData: unknown;
  newData: unknown;
  createdAt: string;
};
export const promotionReport = (id: string) =>
  authRequest<PromotionReport>(`/api/platform/promotions/${id}/report`, {
    cache: "no-store",
  });
export const promotionHistory = (id: string) =>
  authRequest<PromotionHistoryItem[]>(
    `/api/platform/promotions/${id}/history`,
    { cache: "no-store" },
  );
export type SortexAd = {
  id: string;
  name: string;
  code: string;
  status: string;
  objective: string;
  channels: string[];
  budget: number;
  budgetType: string;
  views: number;
  clicks: number;
  registrations: number;
  reservations: number;
  approvedSales: number;
  attributedRevenue: number;
  spent: number;
  reach: number;
  impressions: number;
  ctr: number;
  cpm: number;
  cpc: number;
  lastSyncedAt: string | null;
  updatedAt: string;
  campaign: { id: string; title: string; slug: string };
  creative: Record<string, unknown>;
  audience: Record<string, unknown>;
  location: Record<string, unknown>;
};
export type AdsDashboardData = {
  active?: number;
  budget?: number;
  views?: number;
  clicks?: number;
  conversions?: number;
  sales?: number;
  spent?: number;
  revenue?: number;
  reach?: number;
  impressions?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  costPerConversion?: number;
  roas?: number | null;
  period?: { key: string; from: string; to: string };
  daily?: Array<{
    date: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
  platforms?: Array<{
    key: string;
    name: string;
    connected: boolean;
    status: string;
    lastSyncedAt: string | null;
    metrics: Record<string, number | null>;
  }>;
  comparisons?: Array<{
    key: string;
    name: string;
    conversions: number;
    investment: number;
  }>;
  recommendations?: {
    bestChannel: { name: string; conversions: number } | null;
    worstChannel: { name: string; conversions: number } | null;
    campaignWithHighestReturn: { id: string; title: string } | null;
    investmentSuggestion: string | null;
    underperformingCampaigns: Array<{
      id: string;
      title: string;
      conversions: number;
      conversionRate: number;
      roas: number | null;
    }>;
    forecast: {
      dailyRevenue: number;
      next30Days: number;
      basisDays: number;
    } | null;
    idealHour: { hour: number; conversions: number } | null;
    topCities: Array<{ name: string; conversions: number }>;
    efficientAudiences: Array<{ name: string; conversions: number }>;
    unavailable: string[];
  };
};
export const adsDashboard = (query = "") =>
  authRequest<AdsDashboardData>(
    `/api/platform/sortex-ads/dashboard${query}`,
    { cache: "no-store" },
  );
export const listAds = (q = "") =>
  authRequest<{ items: SortexAd[]; total: number; pages: number }>(
    `/api/platform/sortex-ads${q}`,
    { cache: "no-store" },
  );
export const createAd = (b: Record<string, unknown>) =>
  authRequest<SortexAd>("/api/platform/sortex-ads", {
    method: "POST",
    body: JSON.stringify(b),
  });
export const updateAd = (id: string, b: Record<string, unknown>) =>
  authRequest<SortexAd>(`/api/platform/sortex-ads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(b),
  });
export const adAction = (id: string, a: string) =>
  authRequest(`/api/platform/sortex-ads/${id}/${a}`, { method: "POST" });
export const duplicateAd = (id: string) =>
  authRequest(`/api/platform/sortex-ads/${id}/duplicate`, { method: "POST" });
export const deleteAd = (id: string) =>
  authRequest(`/api/platform/sortex-ads/${id}`, { method: "DELETE" });
export type MetaAdsIntegration = {
  status: string;
  sandbox: boolean;
  permissions?: string[];
  lastSyncedAt?: string | null;
  adAccounts?: Array<{ id: string; name: string; currency?: string }>;
  pages?: Array<{
    id: string;
    name: string;
    instagram_business_account?: { id: string };
  }>;
  businesses?: Array<{ id: string; name: string }>;
  selectedAdAccountId?: string | null;
  selectedPageId?: string | null;
};
export const metaAdsStatus = () =>
  authRequest<MetaAdsIntegration>(
    "/api/platform/sortex-ads/integration/status",
    { cache: "no-store" },
  );
export const selectMetaAssets = (adAccountId: string, pageId: string) =>
  authRequest("/api/platform/sortex-ads/integration/assets", {
    method: "POST",
    body: JSON.stringify({ adAccountId, pageId }),
  });
export const publishAd = (id: string) =>
  authRequest<{ sandbox: boolean; message: string }>(
    `/api/platform/sortex-ads/${id}/publish`,
    { method: "POST" },
  );
export const syncAd = (id: string) =>
  authRequest<SortexAd>(`/api/platform/sortex-ads/${id}/sync`, {
    method: "POST",
  });
export type Recommendation = {
  id: string;
  title: string;
  explanation: string;
  evidence: Record<string, unknown>;
  impact: string | null;
  priority: string;
  status: string;
  actionUrl: string;
  generatedAt: string;
  campaign: { id: string; title: string } | null;
};
export const listRecommendations = () =>
  authRequest<{
    summary: { campaigns: number; revenue: number; averageProgress: number };
    items: Recommendation[];
  }>("/api/platform/ai-sortex", { cache: "no-store" });
export const generateRecommendations = () =>
  authRequest("/api/platform/ai-sortex/generate", { method: "POST" });
export const recommendationFeedback = (
  id: string,
  status: string,
  feedback?: string,
) =>
  authRequest(`/api/platform/ai-sortex/${id}/feedback`, {
    method: "PATCH",
    body: JSON.stringify({ status, feedback }),
  });
export type AdvisorAction = {
  label: string;
  url: string;
  confirmation: string;
};
export type AdvisorAlert = {
  id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  detail: string;
  evidence: string;
  actions: AdvisorAction[];
};
export type AdvisorSnapshot = {
  organizerName: string;
  generatedAt: string;
  summary: {
    campaigns: number;
    publishedCampaigns: number;
    revenue: number;
    approvedSales: number;
    ticketsSold: number;
    conversion: number;
    abandonedReservations: number;
    pendingPayments: number;
    promotions: number;
    availablePrizes: number;
    automations: number;
    affiliates: number;
    contacts: number;
  };
  campaigns: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    revenue: number;
    price: number;
    sold: number;
    total: number;
    progress: number;
    activePromotions: number;
    approvedSales: number;
    instantPrizes: number;
    drawDate: string | null;
  }>;
  alerts: AdvisorAlert[];
};
export type AdvisorAnswer = {
  answer: string;
  evidence: string[];
  suggestedQuestions: string[];
  actions: AdvisorAction[];
  mode: "OPENAI" | "DETERMINISTIC";
};
export const getAdvisor = () =>
  authRequest<AdvisorSnapshot>("/api/platform/ai-sortex/advisor", {
    cache: "no-store",
  });
export const askAdvisor = (question: string) =>
  authRequest<AdvisorAnswer>("/api/platform/ai-sortex/advisor/chat", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
export const simulateAdvisor = (body: {
  campaignId?: string;
  quantity: number;
  price?: number;
  discountPercent?: number;
}) =>
  authRequest<{
    campaign: { id: string; title: string } | null;
    quantity: number;
    unitPrice: number;
    grossRevenue: number;
    discount: number;
    estimatedRevenue: number;
    formula: string;
    disclaimer: string;
  }>("/api/platform/ai-sortex/advisor/simulate", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const generateAdvisorMessage = (body: {
  objective: string;
  tone: string;
  campaignId?: string;
}) =>
  authRequest<{
    title: string;
    content: string;
    cta: string;
    tone: string;
    requiresConfirmation: boolean;
    openUrl: string;
  }>("/api/platform/ai-sortex/advisor/message", {
    method: "POST",
    body: JSON.stringify(body),
  });
export type AdvisorAdStrategy = {
  campaignId: string;
  campaignTitle: string;
  objective: string;
  suggestedBudget: number;
  budgetType: string;
  audience: {
    minAge: number;
    maxAge: number;
    gender: string;
    cities: string[];
    interests: string[];
    evidence: string;
  };
  creative: { title: string; text: string; cta: string; link: string };
  calendar: Array<{ format: string; hour: number }>;
  bestHour: number;
  evidence: string[];
  requiresConfirmation: boolean;
  executorUrl: string;
};
export const generateAdStrategy = (campaignId: string, objective = "SALES") =>
  authRequest<AdvisorAdStrategy>(
    "/api/platform/ai-sortex/advisor/ad-strategy",
    { method: "POST", body: JSON.stringify({ campaignId, objective }) },
  );
