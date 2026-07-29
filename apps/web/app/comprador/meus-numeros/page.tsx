"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, LoaderCircle, Ticket } from "lucide-react";
import Card from "@/components/ui/Card";
import ReservationCountdown from "@/components/purchases/ReservationCountdown";
import { getMyPurchases } from "@/lib/purchases/client";
import type { Purchase, PurchaseStatus } from "@/lib/purchases/types";

const tabs: Array<{ label: string; status?: PurchaseStatus }> = [
  { label: "Todas" },
  { label: "Ativas", status: "RESERVED" },
  { label: "Aguardando", status: "AWAITING_PAYMENT" },
  { label: "Pagas", status: "PAID" },
  { label: "Expiradas", status: "EXPIRED" },
  { label: "Canceladas", status: "CANCELLED" },
];
const labels: Record<PurchaseStatus, string> = {
  PENDING: "Pendente",
  RESERVED: "Reservada",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Paga",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
  REFUNDED: "Estornada",
};

export default function MeusNumerosPage() {
  const [status, setStatus] = useState<PurchaseStatus>();
  const [items, setItems] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    getMyPurchases(status)
      .then(setItems)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Falha ao carregar suas compras.",
        ),
      )
      .finally(() => setLoading(false));
  }, [status]);
  function selectStatus(next?: PurchaseStatus) {
    setLoading(true);
    setError("");
    setStatus(next);
  }
  return (
    <main className="mx-auto max-w-5xl p-5 md:py-10">
      <p className="text-sm font-bold uppercase tracking-wider text-violet-700">
        Área do comprador
      </p>
      <h1 className="mt-2 text-3xl font-black">Meus títulos</h1>
      <div className="mt-5 flex gap-2 overflow-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => selectStatus(tab.status)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${status === tab.status ? "bg-violet-700 text-white" : "bg-white text-zinc-600"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-5 rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>
      )}
      {loading ? (
        <div className="flex h-52 items-center justify-center">
          <LoaderCircle className="animate-spin text-violet-700" />
        </div>
      ) : items.length === 0 ? (
        <Card className="mt-6 p-10 text-center">
          <Ticket className="mx-auto text-violet-400" size={42} />
          <h2 className="mt-4 font-black">Nenhuma compra nesta categoria</h2>
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {items.map((purchase) => (
            <Link
              key={purchase.id}
              href={`/comprador/compras/${purchase.id}`}
            >
              <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                      {labels[purchase.status]}
                    </span>
                    <h2 className="mt-3 text-lg font-black">
                      {purchase.campaign.title}
                    </h2>
                  </div>
                  <Ticket className="text-violet-600" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-zinc-500">Quantidade</p>
                    <strong>{purchase.quantity.toLocaleString("pt-BR")}</strong>
                  </div>
                  <div>
                    <p className="text-zinc-500">Valor</p>
                    <strong>
                      R$ {purchase.total.toFixed(2).replace(".", ",")}
                    </strong>
                  </div>
                </div>
                <p className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
                  <Clock3 size={14} />
                  {purchase.status === "AWAITING_PAYMENT" ? (
                    <>
                      Reserva:{" "}
                      <ReservationCountdown expiresAt={purchase.expiresAt} />
                    </>
                  ) : (
                    new Date(
                      purchase.confirmedAt || purchase.createdAt,
                    ).toLocaleString("pt-BR")
                  )}
                </p>
                <div className="mt-3 flex max-h-20 flex-wrap gap-1 overflow-hidden">
                  {purchase.tickets.slice(0, 12).map((ticket) => (
                    <span
                      key={ticket.number}
                      className="rounded bg-zinc-100 px-2 py-1 text-[10px] font-bold"
                    >
                      {ticket.number}
                    </span>
                  ))}
                  {purchase.tickets.length > 12 && (
                    <span className="px-2 py-1 text-[10px] text-zinc-500">
                      +{purchase.tickets.length - 12}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
