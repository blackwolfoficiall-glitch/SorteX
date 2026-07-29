"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PublicCampaignView from "@/components/campaigns/PublicCampaignView";
import type { PreviewPayload } from "@/components/organizer-platform/PersonalizationPreview";

function PreviewRuntime() {
  const search = useSearchParams();
  const [payload, setPayload] = useState<PreviewPayload | null>(() => {
    if (typeof window === "undefined") return null;
    const key = new URLSearchParams(window.location.search).get("key");
    if (!key) return null;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    try { return JSON.parse(stored) as PreviewPayload; } catch { return null; }
  });
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data?.type === "SORTEX_PERSONALIZATION_PREVIEW") setPayload(event.data.payload as PreviewPayload);
    };
    window.addEventListener("message", receive);
    window.parent.postMessage({ type: "SORTEX_PERSONALIZATION_PREVIEW_READY" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, [search]);
  if (!payload) return <main className="grid min-h-screen place-items-center bg-zinc-100 p-6 text-center text-sm font-bold text-zinc-500">Preparando pré-visualização...</main>;
  const campaign = {
    ...payload.campaign,
    showParticipants: payload.appearance.showParticipants !== false,
    customization: { useOrganizerDefaults: false, configuration: { ...payload.appearance, primaryColor: payload.brand.primaryColor, buttonColor: payload.brand.buttonColor } },
    organizer: {
      ...payload.campaign.organizer,
      name: payload.brand.publicName,
      slogan: payload.brand.slogan,
      logoUrl: payload.brand.primaryLogoUrl,
      brand: { ...payload.brand, appearanceConfig: payload.appearance },
    },
  };
  return <PublicCampaignView previewCampaign={campaign} previewMode />;
}

export default function PersonalizationPreviewPage() {
  return <Suspense><PreviewRuntime /></Suspense>;
}
