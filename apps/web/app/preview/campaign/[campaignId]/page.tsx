"use client";

import { Component, type ErrorInfo, type ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import PublicCampaignView from "@/components/campaigns/PublicCampaignView";
import type { PreviewPayload } from "@/components/organizer-platform/PersonalizationPreview";

function isPreviewPayload(value: unknown, campaignId: string): value is PreviewPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<PreviewPayload>;
  return Boolean(payload.campaign && payload.brand && payload.appearance && payload.campaign.id === campaignId);
}

class PreviewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") console.error("[SorteX preview] Falha ao renderizar", error, info);
    window.parent.postMessage({ type: "SORTEX_PREVIEW_ERROR" }, window.location.origin);
  }
  render() { return this.state.failed ? <PreviewError /> : this.props.children; }
}

function PreviewError() {
  return <main className="grid min-h-screen place-items-center bg-zinc-50 p-6 text-center"><div><h1 className="text-xl font-black text-zinc-900">Não foi possível carregar a pré-visualização.</h1><p className="mt-2 text-sm text-zinc-500">Feche esta prévia e tente novamente no editor.</p></div></main>;
}

function PreviewRuntime() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const search = useSearchParams();
  const embedded = search.get("embedded") === "1";
  const [payload, setPayload] = useState<PreviewPayload | null>(null);

  useEffect(() => {
    const key = search.get("key");
    if (!key) return;
    const stored = localStorage.getItem(key);
    if (!stored) return;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isPreviewPayload(parsed, campaignId)) setPayload(parsed);
    } finally {
      localStorage.removeItem(key);
    }
  }, [campaignId, search]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "SORTEX_PREVIEW_UPDATE") return;
      if (!isPreviewPayload(event.data.payload, campaignId)) {
        window.parent.postMessage({ type: "SORTEX_PREVIEW_ERROR" }, window.location.origin);
        return;
      }
      setPayload(event.data.payload);
    };
    window.addEventListener("message", receive);
    if (embedded) window.parent.postMessage({ type: "SORTEX_PREVIEW_READY" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, [campaignId, embedded]);

  useEffect(() => {
    if (!payload || !embedded) return;
    const frame = window.requestAnimationFrame(() => window.parent.postMessage({ type: "SORTEX_PREVIEW_RENDERED" }, window.location.origin));
    return () => window.cancelAnimationFrame(frame);
  }, [embedded, payload]);

  const campaign = useMemo(() => payload ? ({
    ...payload.campaign,
    showParticipants: payload.appearance.showParticipants !== false,
    customization: { useOrganizerDefaults: false, configuration: { ...payload.appearance, primaryColor: payload.brand.primaryColor, buttonColor: payload.brand.buttonColor } },
    organizer: { ...payload.campaign.organizer, name: payload.brand.publicName, slogan: payload.brand.slogan, logoUrl: payload.brand.primaryLogoUrl, brand: { ...payload.brand, appearanceConfig: payload.appearance } },
  }) : null, [payload]);

  if (!campaign) return <main className="min-h-screen bg-zinc-50 p-6"><p className="text-center text-sm font-bold text-zinc-600">Carregando pré-visualização…</p><div className="mx-auto mt-6 max-w-5xl animate-pulse space-y-4"><div className="h-72 rounded-3xl bg-zinc-200"/><div className="h-9 w-3/4 rounded bg-zinc-200"/><div className="h-24 rounded-2xl bg-zinc-100"/></div></main>;
  return <><div className="sticky top-0 z-[100] bg-amber-100 px-4 py-2 text-center text-xs font-black text-amber-900">Modo de pré-visualização — alterações não publicadas.</div><PublicCampaignView previewCampaign={campaign} previewMode /></>;
}

export default function CampaignPreviewPage() {
  return <PreviewErrorBoundary><Suspense fallback={<main className="grid min-h-screen place-items-center text-sm font-bold">Carregando pré-visualização…</main>}><PreviewRuntime /></Suspense></PreviewErrorBoundary>;
}
