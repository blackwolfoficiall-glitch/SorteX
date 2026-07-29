import { Suspense } from "react";
import PromotionsCenter from "@/components/growth/PromotionsCenter";
export default function PromocoesPage(){return <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Carregando promoções…</div>}><PromotionsCenter/></Suspense>}
