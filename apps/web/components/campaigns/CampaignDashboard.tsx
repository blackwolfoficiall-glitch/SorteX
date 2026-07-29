"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  Gift,
  LoaderCircle,
  PauseCircle,
  Plus,
  Rocket,
  Search,
  Ticket,
  Trash2,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  deleteCampaign,
  duplicateCampaign,
  finishCampaign,
  getMyCampaigns,
  pauseCampaign,
  publishCampaign,
} from "@/lib/campaigns/client";
import type { Campaign, CampaignStatus } from "@/lib/campaigns/types";
import CampaignShare, { cleanTitle, isValidCampaignSlug } from "./CampaignShare";
import CampaignPublicLink from "./CampaignPublicLink";

type CampaignTab = "DRAFT" | "PUBLISHED" | "PAUSED" | "FINISHED";
type SortOption = "default" | "sold" | "recent" | "revenue" | "drawDate";

const PAGE_SIZE = 6;
const tabs: Array<{ label: string; value?: CampaignTab }> = [
  { label: "Todas" },
  { label: "Rascunhos", value: "DRAFT" },
  { label: "Publicadas", value: "PUBLISHED" },
  { label: "Pausadas", value: "PAUSED" },
  { label: "Finalizadas", value: "FINISHED" },
];
const sortOptions: Array<{ label: string; value: SortOption }> = [
  { label: "Todos", value: "default" },
  { label: "Mais vendidos", value: "sold" },
  { label: "Mais recentes", value: "recent" },
  { label: "Maior faturamento", value: "revenue" },
  { label: "Data do sorteio", value: "drawDate" },
];
const statusLabel: Record<CampaignStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Rascunho",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
  SOLD_OUT: "Finalizada",
  DRAWN: "Finalizada",
  FINISHED: "Finalizada",
  CANCELLED: "Finalizada",
};
const statusStyle: Record<CampaignStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PENDING_REVIEW: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-800",
  SOLD_OUT: "bg-red-100 text-red-700",
  DRAWN: "bg-red-100 text-red-700",
  FINISHED: "bg-red-100 text-red-700",
  CANCELLED: "bg-red-100 text-red-700",
};
export default function CampaignDashboard() {
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const requestedStatus = searchParams.get("status");
  const [status, setStatus] = useState<CampaignTab | undefined>(requestedStatus && ["DRAFT", "PUBLISHED", "PAUSED", "FINISHED"].includes(requestedStatus) ? requestedStatus as CampaignTab : undefined);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("default");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const items = await getMyCampaigns();
      if (sequence === requestSequence.current) setCampaigns(items);
    } catch (cause) {
      if (sequence === requestSequence.current) setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as campanhas.",
      );
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    getMyCampaigns()
      .then((items) => {
        if (sequence === requestSequence.current) setCampaigns(items);
      })
      .catch((cause) => {
        if (sequence === requestSequence.current)
          setError(cause instanceof Error ? cause.message : "Não foi possível carregar as campanhas.");
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false);
      });
    return () => {
      requestSequence.current += 1;
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return campaigns
      .filter((campaign) => {
        if (status === "DRAFT" && !["DRAFT", "PENDING_REVIEW"].includes(campaign.status)) return false;
        if (status === "FINISHED" && !["FINISHED", "SOLD_OUT", "DRAWN", "CANCELLED"].includes(campaign.status)) return false;
        if (status && !["DRAFT", "FINISHED"].includes(status) && campaign.status !== status) return false;
        if (query && !cleanTitle(campaign.title).toLocaleLowerCase("pt-BR").includes(query)) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "revenue") return b.grossRevenue - a.grossRevenue;
        if (sort === "sold") return soldPercent(b) - soldPercent(a);
        if (sort === "drawDate") return dateValue(a.drawDate) - dateValue(b.drawDate);
        if (sort === "recent") return +new Date(b.createdAt) - +new Date(a.createdAt);
        return 0;
      });
  }, [campaigns, status, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleCampaigns = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function run(id: string, operation: () => Promise<unknown>) {
    setBusyId(id);
    setError("");
    try {
      await operation();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível concluir a ação.");
    } finally {
      setBusyId("");
    }
  }

  function remove(campaign: Campaign) {
    if (!window.confirm(`Excluir o rascunho “${cleanTitle(campaign.title)}”?`)) return;
    void run(campaign.id, () => deleteCampaign(campaign.id));
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-7 md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-black text-zinc-950 md:text-4xl">Minhas Campanhas</h1>
          <Link href="/dashboard/campanhas/nova" className="inline-flex h-12 items-center gap-2 rounded-xl bg-violet-700 px-5 font-bold text-white transition hover:bg-violet-800">
            <Plus size={20} /> Criar nova rifa
          </Link>
        </header>

        <section className="mt-7 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button key={tab.label} onClick={() => { setStatus(tab.value); setPage(1); }} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${status === tab.value ? "bg-violet-700 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_2fr]">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar campanha" className="h-11 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none focus:border-violet-500" />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sortOptions.map((option) => <button key={option.value} onClick={() => { setSort(option.value); setPage(1); }} className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-bold transition ${sort === option.value ? "border-violet-700 bg-violet-50 text-violet-700" : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-300"}`}>{option.label}</button>)}
            </div>
          </div>
        </section>

        {error && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 p-4 text-red-700"><p>Não foi possível carregar suas campanhas.</p><Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>{loading ? <LoaderCircle className="animate-spin" size={16}/> : null}Tentar novamente</Button></div>}
        {loading ? (
          <div className="flex h-64 items-center justify-center"><LoaderCircle className="animate-spin text-violet-700" /></div>
        ) : error ? null : visibleCampaigns.length === 0 ? (
          <Card className="mt-6 p-12 text-center"><Ticket className="mx-auto text-violet-500" size={44} /><h2 className="mt-4 text-xl font-black">Nenhuma campanha encontrada</h2><p className="mt-2 text-zinc-500">Ajuste os filtros ou crie uma nova campanha.</p></Card>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {visibleCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} busy={busyId === campaign.id} run={run} remove={remove} />)}
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <nav aria-label="Paginação das campanhas" className="mt-7 flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
            <span className="text-sm font-bold text-zinc-600">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Próxima</Button>
          </nav>
        )}
      </div>
    </main>
  );
}

function CampaignCard({ campaign, busy, run, remove }: { campaign: Campaign; busy: boolean; run: (id: string, operation: () => Promise<unknown>) => Promise<void>; remove: (campaign: Campaign) => void }) {
  const percent = soldPercent(campaign);
  const isDraft = ["DRAFT", "PENDING_REVIEW"].includes(campaign.status);
  const canPublish = isDraft || campaign.status === "PAUSED";
  const canPause = campaign.status === "PUBLISHED";
  const canFinish = ["PUBLISHED", "PAUSED"].includes(campaign.status);
  return (
    <Card className="relative transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-3xl bg-gradient-to-br from-violet-100 to-purple-50">
        {campaign.coverImageUrl ? <Image src={mediaUrl(campaign.coverImageUrl)} alt={campaign.title} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /> : <Ticket className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-violet-300" size={52} />}
      </div>
      <div className="min-w-0 p-5">
          <div className="min-w-0"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[campaign.status]}`}>{statusLabel[campaign.status]}</span><h2 className="mt-3 truncate text-xl font-black">{cleanTitle(campaign.title)}</h2></div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Info label="Valor arrecadado" value={money(campaign.grossRevenue)} /><Info label="Quantidade vendida" value={campaign.soldNumbers.toLocaleString("pt-BR")} /></div>
          <div className="mt-4"><div className="flex justify-between text-xs text-zinc-500"><span>Percentual vendido</span><b>{percent.toFixed(1)}%</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${percent}%` }} /></div></div>
          <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500"><CalendarDays size={15} /> {campaign.drawDate ? new Date(campaign.drawDate).toLocaleDateString("pt-BR") : "Sorteio não definido"}</p>
          {campaign.instantPrizes.length>0&&<div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/60 p-3"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-violet-700"><Gift size={15}/> Cotas premiadas</p><div className="mt-3 grid grid-cols-3 gap-2"><Info label="Total" value={String(campaign.instantPrizes.length)}/><Info label="Encontradas" value={String(campaign.instantPrizes.filter(prize=>["FOUND","DELIVERED"].includes(prize.status)).length)}/><Info label="Disponíveis" value={String(campaign.instantPrizes.filter(prize=>prize.status==="AVAILABLE").length)}/></div></div>}
          {campaign.status==="PUBLISHED"&&<div className="mt-5 min-w-0 rounded-2xl border bg-zinc-50 p-3"><p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-600">Link da campanha</p><CampaignPublicLink compact slug={campaign.slug} editHref={`/dashboard/campanhas/${campaign.id}/editar`}/></div>}
          {isDraft?<div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"><Link href={`/dashboard/campanhas/${campaign.id}/editar`}><Button className="w-full" size="sm"><Edit3 size={15}/> Editar</Button></Link><Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(campaign.id,()=>duplicateCampaign(campaign.id))}><Copy size={15}/> Duplicar</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(campaign.id,()=>publishCampaign(campaign.id))}><Rocket size={15}/> Publicar</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>remove(campaign)}><Trash2 size={15}/> Excluir</Button></div>:<div className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{campaign.status==="PUBLISHED"&&isValidCampaignSlug(campaign.slug)&&<Link href={`/campanha/${campaign.slug}`} target="_blank"><Button className="w-full" size="sm"><ExternalLink size={15}/> Abrir campanha</Button></Link>}{campaign.status==="PUBLISHED"&&!isValidCampaignSlug(campaign.slug)&&<Link href={`/dashboard/campanhas/${campaign.id}/editar`}><Button className="w-full" size="sm" variant="outline">Corrigir link</Button></Link>}<Link href={`/dashboard/campanhas/${campaign.id}/editar`}><Button className="w-full" size="sm" variant="outline"><Edit3 size={15}/> Editar</Button></Link><Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(campaign.id,()=>duplicateCampaign(campaign.id))}><Copy size={15}/> Duplicar</Button>{campaign.status==="PUBLISHED"&&<CampaignShare compact label="Compartilhar" title={campaign.title} slug={campaign.slug}/>} {canPause&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(campaign.id,()=>pauseCampaign(campaign.id))}><PauseCircle size={15}/> Pausar</Button>}{canFinish&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void run(campaign.id,()=>finishCampaign(campaign.id))}><CheckCircle2 size={15}/> Encerrar</Button>}{canPublish&&<Button size="sm" variant="ghost" disabled={busy} onClick={()=>void run(campaign.id,()=>publishCampaign(campaign.id))}><Rocket size={15}/> Publicar</Button>}</div>}
        </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-zinc-50 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-black text-zinc-900">{value}</p></div>; }
function soldPercent(campaign: Campaign) { return campaign.totalNumbers ? Math.min(100, (campaign.soldNumbers / campaign.totalNumbers) * 100) : 0; }
function dateValue(value?: string) { return value ? +new Date(value) : Number.MAX_SAFE_INTEGER; }
function money(value = 0) { return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
export function mediaUrl(path: string | null) { return path?.replace("/public/campaigns/media/", "/api/public/campaign-media/") || ""; }
