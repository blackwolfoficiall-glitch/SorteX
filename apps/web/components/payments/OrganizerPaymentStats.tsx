"use client";

import { useEffect, useState } from "react";
import {
  CircleDollarSign,
  LoaderCircle,
  Receipt,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Card from "@/components/ui/Card";
import { getOrganizerPaymentSummary } from "@/lib/payments/client";
import type { OrganizerPaymentSummary } from "@/lib/payments/types";

export default function OrganizerPaymentStats() {
  const [summary, setSummary] = useState<OrganizerPaymentSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getOrganizerPaymentSummary()
      .then(setSummary)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os pagamentos.",
        ),
      );
  }, []);
  if (error)
    return (
      <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
        {error}
      </p>
    );
  if (!summary)
    return (
      <div className="mt-5 flex h-28 items-center justify-center">
        <LoaderCircle className="animate-spin text-violet-700" />
      </div>
    );
  const cards = [
    {
      label: "Faturamento aprovado",
      value: summary.grossRevenue,
      icon: CircleDollarSign,
    },
    { label: "Taxa SorteX", value: summary.platformFee, icon: ShieldCheck },
    { label: "Taxa gateway", value: summary.gatewayFee, icon: Receipt },
    {
      label: "Líquido estimado",
      value: summary.estimatedNetAmount,
      icon: WalletCards,
    },
  ];
  return (
    <section className="mt-7">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-5">
            <Icon className="text-violet-600" />
            <p className="mt-3 text-sm text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-black">
              R$ {value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </Card>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-green-50 px-3 py-2 text-green-700">
          {summary.approved} aprovados
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">
          {summary.pending} pendentes
        </span>
        <span className="rounded-full bg-red-50 px-3 py-2 text-red-700">
          {summary.rejected} rejeitados
        </span>
      </div>
      {summary.latest.length > 0 && (
        <Card className="mt-4 p-5">
          <h2 className="text-lg font-black">Vendas recentes</h2>
          <div className="mt-3 divide-y">
            {summary.latest.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <strong>{payment.purchase.buyer.name}</strong>
                  <p className="text-zinc-500">
                    {payment.purchase.campaign.title} ·{" "}
                    {payment.purchase.quantity} títulos
                  </p>
                </div>
                <div className="text-right">
                  <strong>
                    R$ {payment.amount.toFixed(2).replace(".", ",")}
                  </strong>
                  <p className="text-zinc-500">
                    {payment.status.replaceAll("_", " ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}
