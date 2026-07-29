"use client";

import { useEffect, useState } from "react";
import { Clock3, LoaderCircle, ShoppingCart, Ticket, TrendingUp } from "lucide-react";
import Card from "@/components/ui/Card";
import { getOrganizerPurchaseSummary } from "@/lib/purchases/client";
import type { OrganizerPurchaseSummary } from "@/lib/purchases/types";

export default function OrganizerPurchaseStats() {
  const [summary, setSummary] = useState<OrganizerPurchaseSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { getOrganizerPurchaseSummary().then(setSummary).catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar as reservas.")); }, []);
  if (error) return <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>;
  if (!summary) return <div className="mt-6 flex h-28 items-center justify-center"><LoaderCircle className="animate-spin text-violet-700" /></div>;
  const cards = [
    { label: "Reservas ativas", value: summary.activeReservations, icon: Clock3 },
    { label: "Aguardando pagamento", value: summary.awaitingPayment, icon: ShoppingCart },
    { label: "Títulos reservados", value: summary.reservedNumbers, icon: Ticket },
    { label: "Títulos vendidos", value: summary.soldNumbers, icon: TrendingUp },
  ];
  return <section className="mt-7"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon }) => <Card key={label} className="p-5"><Icon className="text-violet-600" /><p className="mt-3 text-sm text-zinc-500">{label}</p><p className="mt-1 text-3xl font-black">{value.toLocaleString("pt-BR")}</p></Card>)}</div>{summary.latest.length > 0 && <Card className="mt-4 p-5"><h2 className="text-lg font-black">Últimas reservas</h2><div className="mt-4 divide-y">{summary.latest.slice(0, 5).map((purchase) => <div key={purchase.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><strong>{purchase.buyer.name}</strong><p className="text-zinc-500">{purchase.campaign.title}</p></div><div className="text-right"><strong>{purchase.quantity.toLocaleString("pt-BR")} títulos</strong><p className="text-green-700">R$ {purchase.total.toFixed(2).replace(".", ",")}</p></div></div>)}</div></Card>}</section>;
}
