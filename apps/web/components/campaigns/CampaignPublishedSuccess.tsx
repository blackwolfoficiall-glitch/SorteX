"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Edit3, ExternalLink, LoaderCircle } from "lucide-react";
import { getCampaign } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import CampaignPublicLink from "./CampaignPublicLink";
import CampaignShare, { cleanTitle, isValidCampaignSlug, useCampaignPublicUrl } from "./CampaignShare";

export default function CampaignPublishedSuccess({ id }: { id: string }) {
  const [campaign,setCampaign]=useState<Campaign|null>(null);const [error,setError]=useState("");
  useEffect(()=>{getCampaign(id).then(setCampaign).catch(cause=>setError(cause instanceof Error?cause.message:"Não foi possível carregar a campanha."));},[id]);
  const publicUrl=useCampaignPublicUrl(campaign?.slug);
  if(error)return <main className="mx-auto max-w-3xl px-4 py-8"><div className="rounded-3xl bg-red-50 p-6 text-center text-red-700"><p className="font-bold">{error}</p><Link href="/dashboard/campanhas" className="mt-4 inline-block underline">Voltar para Minhas campanhas</Link></div></main>;
  if(!campaign)return <div className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="animate-spin text-violet-700"/></div>;
  const validSlug=isValidCampaignSlug(campaign.slug);
  return <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-10">
    <section className="mx-auto w-full max-w-3xl overflow-visible rounded-3xl border bg-white shadow-xl">
      <header className="rounded-t-3xl bg-gradient-to-br from-violet-700 to-purple-900 px-5 py-8 text-center text-white sm:px-8 sm:py-10"><CheckCircle2 className="mx-auto" size={58}/><h1 className="mt-4 text-2xl font-black leading-tight sm:text-3xl">Campanha publicada com sucesso</h1><p className="mx-auto mt-2 max-w-xl text-sm text-violet-100 sm:text-base">Sua campanha já está disponível para os compradores.</p></header>
      <div className="min-w-0 space-y-6 p-5 sm:p-8">
        <div className="min-w-0 text-center"><span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-700">Publicada</span><h2 className="mt-4 break-words text-2xl font-black text-zinc-950 sm:text-3xl">{cleanTitle(campaign.title)}</h2></div>
        <div className="min-w-0"><p className="mb-2 text-sm font-bold text-zinc-700">Endereço público da campanha</p><CampaignPublicLink slug={campaign.slug} editHref={`/dashboard/campanhas/${campaign.id}/editar`}/></div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          {validSlug&&publicUrl?<a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-center font-bold text-white"><ExternalLink size={17}/> Abrir campanha</a>:<Link href={`/dashboard/campanhas/${campaign.id}/editar`} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-amber-100 px-4 py-3 text-center font-bold text-amber-900">Corrigir link</Link>}
          <Link href={`/dashboard/campanhas/${campaign.id}/editar`} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center font-bold"><Edit3 size={17}/> Editar campanha</Link>
          <CampaignShare title={campaign.title} slug={campaign.slug}/>
        </div>
      </div>
    </section>
  </main>;
}
