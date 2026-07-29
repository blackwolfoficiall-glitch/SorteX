import { AuthApiError, authRequest } from "@/lib/auth/client";
import type {
  Campaign,
  CampaignDraft,
  CampaignMilestone,
  DrawRuleSimulation,
  DrawRuleTemplate,
} from "./types";

const campaignsInFlight = new Map<string, Promise<Campaign[]>>();

export function getMyCampaigns(status?: string) {
  const key = status || "all";
  const current = campaignsInFlight.get(key);
  if (current) return current;
  const request = authRequest<Campaign[]>(
    `/api/campaigns/my${status ? `?status=${status}` : ""}`,
    { cache: "no-store" },
  ).finally(() => campaignsInFlight.delete(key));
  campaignsInFlight.set(key, request);
  return request;
}
export const getCampaign = (id: string) =>
  authRequest<Campaign>(`/api/campaigns/${id}`, { cache: "no-store" });
export const createCampaign = (data: CampaignDraft = {}) =>
  authRequest<Campaign>("/api/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });
export const updateCampaign = (id: string, data: CampaignDraft) =>
  authRequest<Campaign>(`/api/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
export const evaluateCampaignMilestones = (campaignId: string) =>
  authRequest<string[]>(`/api/campaigns/${campaignId}/milestones/evaluate`, {
    method: "POST",
  });
export const drawCampaignMilestone = (
  campaignId: string,
  milestoneId: string,
) =>
  authRequest<CampaignMilestone>(
    `/api/campaigns/${campaignId}/milestones/${milestoneId}/draw`,
    { method: "POST" },
  );
export const publishCampaign = (id: string) =>
  authRequest<Campaign>(`/api/campaigns/${id}/publish`, { method: "POST" });
export const pauseCampaign = (id: string) =>
  authRequest<Campaign>(`/api/campaigns/${id}/pause`, { method: "POST" });
export const finishCampaign = (id: string) =>
  authRequest<Campaign>(`/api/campaigns/${id}/finish`, { method: "POST" });
export const duplicateCampaign = (id: string) =>
  authRequest<Campaign>(`/api/campaigns/${id}/duplicate`, { method: "POST" });
export const deleteCampaign = (id: string) =>
  authRequest<{ message: string }>(`/api/campaigns/${id}`, {
    method: "DELETE",
  });
export const getDrawRuleTemplates = () =>
  authRequest<DrawRuleTemplate[]>("/api/draw-rule-templates", {
    cache: "no-store",
  });
export const simulateDrawRule = (ruleDefinition: Record<string, unknown>) =>
  authRequest<DrawRuleSimulation>("/api/draw-rule-templates/simulate", {
    method: "POST",
    body: JSON.stringify({ ruleDefinition }),
  });
export const saveDrawRuleTemplate = (data: {
  name: string;
  description: string;
  ruleDefinition: Record<string, unknown>;
}) =>
  authRequest<DrawRuleTemplate>("/api/draw-rule-templates", {
    method: "POST",
    body: JSON.stringify(data),
  });

export async function uploadCampaignMedia(
  id: string,
  target: string,
  files: File[],
  instantPrizeId?: string,
) {
  const body = new FormData();
  body.set("target", target);
  if (instantPrizeId) body.set("instantPrizeId", instantPrizeId);
  files.forEach((file) => body.append("files", file));
  const response = await fetch(`/api/campaigns/${id}/images`, {
    method: "POST",
    credentials: "same-origin",
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as Campaign & {
    message?: string | string[];
  };
  if (!response.ok) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(" ")
      : payload.message || "Não foi possível enviar a mídia.";
    throw new AuthApiError(message, response.status);
  }
  return payload;
}
export async function uploadCampaignMilestoneImage(id: string, file: File) {
  const body = new FormData();
  body.set("target", "MILESTONE");
  body.append("files", file);
  const response = await fetch(`/api/campaigns/${id}/images`, {
    method: "POST",
    credentials: "same-origin",
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    uploadedMediaUrl?: string;
    message?: string | string[];
  };
  if (!response.ok || !payload.uploadedMediaUrl) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(" ")
      : payload.message || "Não foi possível enviar a foto do prêmio.";
    throw new AuthApiError(message, response.status);
  }
  return payload.uploadedMediaUrl;
}
export const deleteCampaignImage = (campaignId: string, imageId: string) =>
  authRequest<Campaign>(`/api/campaigns/${campaignId}/images/${imageId}`, {
    method: "DELETE",
  });
export const updateCampaignImage = (
  campaignId: string,
  imageId: string,
  data: { caption?: string; sortOrder?: number },
) =>
  authRequest<Campaign>(`/api/campaigns/${campaignId}/images/${imageId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
