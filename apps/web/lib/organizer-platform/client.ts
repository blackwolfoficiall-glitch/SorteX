import { authRequest } from "@/lib/auth/client";

export type PlanFeature = {
  id: string;
  key: string;
  name: string;
  value: boolean | number | string;
};
export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPrice: number | string;
  platformFeeRate: number | string;
  features: PlanFeature[];
};
export type CurrentPlan = {
  profile: {
    onboardingStatus: "PLAN_SELECTION" | "IDENTITY_SETUP" | "COMPLETE";
    planSelectedAt: string | null;
  };
  subscription: null | {
    id: string;
    status: string;
    billingCycle: string;
    monthlyPrice: number;
    startedAt: string;
    nextRenewalAt: string | null;
    autoRenew: boolean;
  };
  plan: Plan | null;
  consumption: { campaigns: number };
  sandbox: boolean;
  message: string;
};
export type Brand = {
  organizerId: string;
  publicName: string;
  fantasyName: string | null;
  slogan: string | null;
  primaryLogoUrl: string | null;
  profileImageUrl: string | null;
  bannerUrl: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  buttonColor: string;
  progressColor: string;
  backgroundColor: string;
  cardColor: string;
  themeMode: string;
  layoutStyle: string;
  appearanceConfig?: Record<string, unknown> | null;
};
export type SocialLink = {
  id: string;
  type: string;
  label: string | null;
  url: string;
  isActive: boolean;
  sortOrder: number;
};
export type CommunityLink = {
  id: string;
  type: string;
  name: string;
  description: string | null;
  url: string;
  isActive: boolean;
  sortOrder: number;
};
export type OrganizerDomain = {
  id: string;
  type: string;
  domain: string;
  status: string;
  isPrimary: boolean;
  sslActive: boolean;
  httpsActive: boolean;
  lastCheckedAt: string | null;
  dnsInstructions: Record<string, unknown>;
};
export type CampaignTemplate = {
  id: string;
  name: string;
  description: string | null;
  configuration: Record<string, unknown>;
  updatedAt: string;
};
export type Personalization = {
  brand: Brand;
  socialLinks: SocialLink[];
  communities: CommunityLink[];
  domains: OrganizerDomain[];
  templates: CampaignTemplate[];
};

export const listPlans = () =>
  authRequest<Plan[]>("/api/plans", { cache: "no-store" });
export const getCurrentPlan = () =>
  authRequest<CurrentPlan>("/api/plans/me", { cache: "no-store" });
export const selectPlan = (planId: string, billingCycle: string) =>
  authRequest("/api/plans/select", {
    method: "POST",
    body: JSON.stringify({ planId, billingCycle }),
  });
export const cancelPlan = () =>
  authRequest("/api/plans/cancel", { method: "POST" });
export const reactivatePlan = () =>
  authRequest("/api/plans/reactivate", { method: "POST" });
const editableBrandKeys = [
  "publicName",
  "fantasyName",
  "slogan",
  "publicPhone",
  "publicEmail",
  "primaryLogoUrl",
  "profileImageUrl",
  "bannerUrl",
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "textColor",
  "buttonColor",
  "progressColor",
  "backgroundColor",
  "cardColor",
  "themeMode",
  "layoutStyle",
  "appearanceConfig",
] as const;
export function editableBrandPayload(body: Partial<Brand>) {
  return Object.fromEntries(
    editableBrandKeys.flatMap((key) =>
      body[key] === undefined ? [] : [[key, body[key]]],
    ),
  ) as Partial<Brand>;
}
export const completeOnboarding = (body: Partial<Brand> = {}) =>
  authRequest<{
    onboardingStatus: "COMPLETE";
    identitySetupCompletedAt: string;
  }>("/api/plans/onboarding/complete", {
    method: "POST",
    body: JSON.stringify(editableBrandPayload(body)),
  });
export const getPersonalization = () =>
  authRequest<Personalization>("/api/organizer/personalization", {
    cache: "no-store",
  });
export const updateBrand = (body: Partial<Brand>) =>
  authRequest<Brand>("/api/organizer/personalization/brand", {
    method: "PATCH",
    body: JSON.stringify(editableBrandPayload(body)),
  });
export async function uploadBrandAsset(
  kind: "logo" | "profile" | "banner",
  file: File,
) {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch(
    `/api/organizer/personalization/assets/${kind}`,
    { method: "POST", body, credentials: "include" },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.message || "Não foi possível enviar a imagem.");
  return payload;
}
export const removeBrandAsset = (kind: "logo" | "profile" | "banner") =>
  authRequest(`/api/organizer/personalization/assets/${kind}`, {
    method: "DELETE",
  });
export const resetBrand = () =>
  authRequest<Brand>("/api/organizer/personalization/reset", {
    method: "POST",
  });
export const addSocial = (body: Omit<SocialLink, "id">) =>
  authRequest("/api/organizer/personalization/social-links", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateSocial = (id: string, body: Omit<SocialLink, "id">) =>
  authRequest(`/api/organizer/personalization/social-links/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const deleteSocial = (id: string) =>
  authRequest(`/api/organizer/personalization/social-links/${id}`, {
    method: "DELETE",
  });
export const addCommunity = (body: Omit<CommunityLink, "id">) =>
  authRequest("/api/organizer/personalization/communities", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateCommunity = (id: string, body: Omit<CommunityLink, "id">) =>
  authRequest(`/api/organizer/personalization/communities/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const deleteCommunity = (id: string) =>
  authRequest(`/api/organizer/personalization/communities/${id}`, {
    method: "DELETE",
  });
export const addDomain = (body: {
  type: string;
  domain: string;
  isPrimary?: boolean;
}) =>
  authRequest("/api/organizer/personalization/domains", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const verifyDomain = (id: string) =>
  authRequest(`/api/organizer/personalization/domains/${id}/verify`, {
    method: "POST",
  });
export const deleteDomain = (id: string) =>
  authRequest(`/api/organizer/personalization/domains/${id}`, {
    method: "DELETE",
  });
export const createTemplate = (body: {
  name: string;
  description?: string;
  sourceCampaignId?: string;
  configuration: Record<string, unknown>;
}) =>
  authRequest("/api/organizer/personalization/templates", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const deleteTemplate = (id: string) =>
  authRequest(`/api/organizer/personalization/templates/${id}`, {
    method: "DELETE",
  });

export type OrganizerIntegration = {
  id: string;
  type: string;
  status: string;
  displayName: string | null;
  accountId: string | null;
  provider: string | null;
  publicConfig: Record<string, unknown> | null;
  webhookUrl: string | null;
  sandbox: boolean;
  credentialConfigured: boolean;
  lastTestedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  logs: Array<{
    id: string;
    action: string;
    status: string;
    message: string | null;
    createdAt: string;
  }>;
};
export const listIntegrations = () =>
  authRequest<OrganizerIntegration[]>("/api/organizer/integrations", {
    cache: "no-store",
  });
export const configureIntegration = (body: Record<string, unknown>) =>
  authRequest<OrganizerIntegration>("/api/organizer/integrations", {
    method: "PUT",
    body: JSON.stringify(body),
  });
export const integrationAction = (
  id: string,
  action: "connect" | "test" | "sync" | "disconnect",
) =>
  authRequest<OrganizerIntegration>(
    `/api/organizer/integrations/${id}/${action}`,
    { method: "POST" },
  );
export const integrationLogs = (id: string) =>
  authRequest<
    Array<{
      id: string;
      action: string;
      status: string;
      message: string | null;
      createdAt: string;
    }>
  >(`/api/organizer/integrations/${id}/logs`, { cache: "no-store" });
export const startMetaOAuth = (kind: "META_ADS" | "WHATSAPP") =>
  authRequest<{ url: string; type: string; official: boolean }>(
    `/api/organizer/integrations/oauth/meta/start?kind=${kind}`,
    { cache: "no-store" },
  );
export const registerIntegrationInterest = (integration: string) =>
  authRequest<{ registered: boolean; integration: string }>(
    "/api/organizer/integrations/interests",
    { method: "POST", body: JSON.stringify({ integration }) },
  );
export const sendWhatsAppTemplate = (
  id: string,
  body: { to: string; template: string; language?: string },
) =>
  authRequest<{ sent: boolean; sandbox: boolean; message?: string }>(
    `/api/organizer/integrations/${id}/whatsapp/templates`,
    { method: "POST", body: JSON.stringify(body) },
  );

export type OrganizerOrder = {
  id: string;
  status: string;
  quantity: number;
  total: number;
  expiresAt: string;
  createdAt: string;
  campaign: { id: string; title: string; slug: string };
  buyer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    state: string | null;
  };
  payments: Array<{
    id: string;
    status: string;
    method: string;
    provider: string;
    amount: number;
  }>;
  promotion: { id: string; name: string } | null;
  affiliateConversion?: { affiliate: { name: string } } | null;
  _count: { tickets: number };
};
export type OrderSummary = {
  approvedSales: number;
  pendingReservations: number;
  ordersToday: number;
  periodRevenue: number;
  comparison: number;
};
export const listOrders = (query = "") =>
  authRequest<{
    items: OrganizerOrder[];
    total: number;
    page: number;
    pages: number;
    summary: OrderSummary;
  }>(`/api/organizer/orders${query}`, { cache: "no-store" });
export const getOrder = (id: string) =>
  authRequest<Record<string, unknown>>(`/api/organizer/orders/${id}`, {
    cache: "no-store",
  });

export type MiniCampaign = {
  id: string;
  name: string;
  slug: string;
  status: string;
  prizeType: string;
  prizeDescription: string;
  maxTickets: number;
  soldTickets: number;
  ticketPrice: string | number;
  grossRevenue: string | number;
  startsAt: string | null;
  endsAt: string | null;
  drawAt: string | null;
  purchaseLimitPerBuyer: number | null;
  rules: string;
  description: string | null;
  imageUrl: string | null;
  mainCampaign: { id: string; title: string };
  _count?: { orders: number; tickets: number };
};
export const listMiniCampaigns = () =>
  authRequest<MiniCampaign[]>("/api/platform/mini-campaigns", {
    cache: "no-store",
  });
export const getMiniCampaign = (id: string) =>
  authRequest<MiniCampaign & Record<string, unknown>>(
    `/api/platform/mini-campaigns/${id}`,
    { cache: "no-store" },
  );
export const createMiniCampaign = (body: Record<string, unknown>) =>
  authRequest<MiniCampaign>("/api/platform/mini-campaigns", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateMiniCampaign = (id: string, body: Record<string, unknown>) =>
  authRequest<MiniCampaign>(`/api/platform/mini-campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const miniCampaignAction = (id: string, action: string) =>
  authRequest<MiniCampaign>(`/api/platform/mini-campaigns/${id}/${action}`, {
    method: "POST",
  });
export const deleteMiniCampaign = (id: string) =>
  authRequest(`/api/platform/mini-campaigns/${id}`, { method: "DELETE" });
export const recordMiniCampaignResult = (
  id: string,
  winningNumber: number,
  notes?: string,
) =>
  authRequest(`/api/platform/mini-campaigns/${id}/result`, {
    method: "POST",
    body: JSON.stringify({ winningNumber, notes }),
  });
