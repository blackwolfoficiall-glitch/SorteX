"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Monitor, Smartphone, Tablet, ZoomIn } from "lucide-react";
import type { Campaign } from "@/lib/campaigns/types";
import type { Brand } from "@/lib/organizer-platform/client";

export type PreviewDevice = "mobile" | "tablet" | "desktop";
export type PreviewPayload = { campaign: Campaign; brand: Brand; appearance: Record<string, unknown> };

const devices = [
  { key: "mobile", label: "Celular", icon: Smartphone, width: 390 },
  { key: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { key: "desktop", label: "Desktop", icon: Monitor, width: 1200 },
] as const;

export function PersonalizationPreview({ payload, campaignId, campaigns, changeCampaign }: { payload: PreviewPayload; campaignId: string; campaigns: Campaign[]; changeCampaign: (id: string) => void }) {
  const [device, setDevice] = useState<PreviewDevice>(() => {
    if (typeof window === "undefined") return "mobile";
    const value = new URLSearchParams(window.location.search).get("preview");
    return value === "tablet" || value === "desktop" ? value : "mobile";
  });
  const [zoom, setZoom] = useState("fit");
  const [frameState, setFrameState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const iframe = useRef<HTMLIFrameElement>(null);
  const selected = devices.find((item) => item.key === device) ?? devices[0];
  const numericZoom = zoom === "fit" ? (device === "desktop" ? 0.5 : device === "tablet" ? 0.72 : 0.9) : Number(zoom) / 100;
  const frameHeight = 760;
  const message = useMemo(() => ({ type: "SORTEX_PREVIEW_UPDATE", payload }), [payload]);
  const hasCampaign = Boolean(campaignId && payload.campaign.id !== "preview-demo");
  const previewPath = hasCampaign
    ? `/preview/campaign/${encodeURIComponent(payload.campaign.id)}?embedded=1&retry=${retry}`
    : "";

  const sendPayload = useCallback(() => {
    iframe.current?.contentWindow?.postMessage(message, window.location.origin);
  }, [message]);

  useEffect(() => {
    if (!hasCampaign) return;
    queueMicrotask(() => setFrameState("loading"));
    sendPayload();
    const timeout = window.setTimeout(() => setFrameState((state) => state === "ready" ? state : "error"), 12000);
    return () => window.clearTimeout(timeout);
  }, [hasCampaign, payload.campaign.id, retry, sendPayload]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) return;
      if (event.data?.type === "SORTEX_PREVIEW_READY") sendPayload();
      if (event.data?.type === "SORTEX_PREVIEW_RENDERED") setFrameState("ready");
      if (event.data?.type === "SORTEX_PREVIEW_ERROR") setFrameState("error");
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [sendPayload]);

  function selectDevice(value: PreviewDevice) {
    setDevice(value);
    const params = new URLSearchParams(window.location.search);
    params.set("preview", value);
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  }
  function openFullPreview() {
    if (!hasCampaign) return;
    const key = `sortex-preview-${crypto.randomUUID()}`;
    localStorage.setItem(key, JSON.stringify(payload));
    window.open(`/preview/campaign/${encodeURIComponent(payload.campaign.id)}?key=${encodeURIComponent(key)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section aria-labelledby="preview-title" className="w-full min-w-0 max-w-full overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="preview-title" className="text-xl font-black">Pré-visualização em tempo real</h2>
          <p className="mt-1 text-sm text-zinc-500">A página pública real é renderizada sem publicar o rascunho.</p>
        </div>
        <button type="button" onClick={openFullPreview} disabled={!hasCampaign} title={!hasCampaign ? "Selecione uma campanha para abrir a prévia completa." : undefined} className="flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-bold transition hover:border-violet-400 focus-visible:ring-4 focus-visible:ring-violet-200 disabled:cursor-not-allowed disabled:opacity-50">
          <ExternalLink size={16} /> Abrir prévia completa
        </button>
      </div>
      <label className="mt-4 block text-sm font-bold text-zinc-700">
        Campanha da prévia
        <select value={campaignId} onChange={(event) => changeCampaign(event.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-white px-3">
          {!campaigns.length && <option value="">Prévia demonstrativa</option>}
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}
        </select>
      </label>
      {!campaigns.length && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Selecione uma campanha para visualizar. Nenhum dado demonstrativo será tratado como campanha real.</p>}
      <div className="relative z-20 mt-4 grid grid-cols-3 rounded-2xl bg-zinc-100 p-1" role="group" aria-label="Dispositivo da prévia">
        {devices.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-label={label} aria-pressed={device === key} onClick={() => selectDevice(key)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-sm font-black outline-none transition focus-visible:ring-4 focus-visible:ring-violet-200 ${device === key ? "border border-violet-300 bg-white text-violet-700 shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}><Icon size={17} /><span className="hidden sm:inline" aria-hidden="true">{label}</span><span className="sr-only">{device === key ? "Selecionado" : ""}</span></button>)}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-zinc-500">{device === "desktop" && numericZoom < 1 ? "Prévia reduzida para caber na tela" : `${selected.width}px de largura`}</span>
        <label className="flex items-center gap-2 text-xs font-bold"><ZoomIn size={15} /><span className="sr-only">Zoom da prévia</span><select value={zoom} onChange={(event) => setZoom(event.target.value)} className="h-9 rounded-lg border bg-white px-2"><option value="fit">Ajustar à tela</option><option value="50">50%</option><option value="75">75%</option><option value="100">100%</option></select></label>
      </div>
      <div className="relative z-0 mt-4 max-w-full overflow-auto overscroll-contain rounded-[2rem] border bg-zinc-200 p-3 shadow-inner">
        <div className="mx-auto origin-top" style={{ width: selected.width * numericZoom, height: frameHeight * numericZoom }}>
          <div className="relative" style={{ width: selected.width, height: frameHeight, transform: `scale(${numericZoom})`, transformOrigin: "top left" }}>
            {hasCampaign && <iframe key={previewPath} ref={iframe} title={`Prévia da campanha em ${selected.label}`} src={previewPath} onLoad={sendPayload} onError={() => setFrameState("error")} style={{ width: selected.width, height: frameHeight }} className={`block border-0 bg-white shadow-xl transition-opacity ${frameState === "ready" ? "opacity-100" : "opacity-0"} ${device === "mobile" ? "rounded-[2.2rem] ring-8 ring-zinc-800" : "rounded-xl"}`} />}
            {!hasCampaign && <div className="grid h-full place-items-center rounded-xl bg-white p-8 text-center"><div><p className="text-lg font-black text-zinc-800">Selecione uma campanha para visualizar.</p><p className="mt-2 text-sm text-zinc-500">A prévia usa os dados reais da campanha escolhida.</p></div></div>}
            {hasCampaign && frameState === "loading" && <div className="absolute inset-0 overflow-hidden rounded-xl bg-white p-6" aria-live="polite"><p className="text-center text-sm font-bold text-zinc-600">Carregando pré-visualização…</p><div className="mt-6 animate-pulse space-y-4"><div className="h-52 rounded-2xl bg-zinc-200"/><div className="h-8 w-3/4 rounded bg-zinc-200"/><div className="h-20 rounded-xl bg-zinc-100"/><div className="h-12 rounded-xl bg-violet-100"/></div></div>}
            {hasCampaign && frameState === "error" && <div className="absolute inset-0 grid place-items-center rounded-xl bg-white p-8 text-center" role="alert"><div><p className="text-lg font-black text-zinc-900">Não foi possível carregar a pré-visualização.</p><p className="mt-2 text-sm text-zinc-500">Verifique sua conexão e tente novamente.</p><div className="mt-5 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => { setFrameState("loading"); setRetry((value) => value + 1); }} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white">Tentar novamente</button><button type="button" onClick={openFullPreview} className="rounded-xl border px-4 py-2 text-sm font-bold">Abrir prévia completa</button></div></div></div>}
          </div>
        </div>
      </div>
    </section>
  );
}
