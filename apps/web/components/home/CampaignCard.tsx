import Link from "next/link";
import type { Campaign } from "@/lib/campaigns/types";

export default function CampaignCard({ campaign }: { campaign: Campaign }) {
  const progress = campaign.totalNumbers
    ? Math.min(100, Math.round((campaign.soldNumbers / campaign.totalNumbers) * 100))
    : 0;
  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex h-56 items-center justify-center bg-zinc-100">🎟️</div>
      <div className="space-y-4 p-5">
        <h3 className="text-xl font-bold">{campaign.title}</h3>
        <div className="h-3 rounded-full bg-zinc-200"><div className="h-3 rounded-full bg-violet-600" style={{ width: `${progress}%` }} /></div>
        <div className="flex justify-between text-sm"><span>{progress}% vendido</span><strong>R$ {campaign.numberPrice.toFixed(2).replace(".", ",")}</strong></div>
        <Link href={`/campanha/${encodeURIComponent(campaign.slug)}`} className="block w-full rounded-2xl bg-violet-700 py-4 text-center font-bold text-white">Comprar cotas</Link>
      </div>
    </article>
  );
}
