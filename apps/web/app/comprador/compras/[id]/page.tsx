"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getPurchase } from "@/lib/purchases/client";
import { purchaseStatusLabels } from "@/lib/purchases/status";
import type { Purchase } from "@/lib/purchases/types";
import {
  getPaymentByPurchase,
  PaymentRequestError,
} from "@/lib/payments/client";
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/payments/types";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const paymentStatusLabels: Record<PaymentStatus, string> = {
  CREATED: "Criado",
  PENDING: "Aguardando confirmação",
  PROCESSING: "Em processamento",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Estornado",
  CHARGEBACK: "Contestado",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
};

type PaymentView =
  | { kind: "loading" | "missing" | "unavailable" }
  | { kind: "ready"; payment: Payment };

type Detail =
  | { key: string; kind: "error" }
  | { key: string; kind: "ready"; purchase: Purchase; payment: PaymentView };

function PaymentStatusLine({ view }: { view: PaymentView }) {
  if (view.kind === "ready") {
    const { payment } = view;
    return (
      <>
        <span>{paymentStatusLabels[payment.status]}</span>
        <span className="block font-normal text-zinc-500">
          {paymentMethodLabels[payment.method]}
        </span>
      </>
    );
  }

  return {
    loading: "Carregando status...",
    missing: "Nenhum pagamento registrado",
    unavailable: "Status indisponível. Tente atualizar a página.",
  }[view.kind];
}

export default function Compra() {
  const { id } = useParams<{ id: string }>();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Detail>();
  const key = `${id}:${retry}`;
  const detail = result?.key === key ? result : undefined;

  useEffect(() => {
    let active = true;

    async function load() {
      let purchase: Purchase;
      try {
        purchase = await getPurchase(id);
      } catch {
        if (active) setResult({ key, kind: "error" });
        return;
      }
      if (!active) return;
      setResult({ key, kind: "ready", purchase, payment: { kind: "loading" } });

      let payment: PaymentView;
      try {
        payment = { kind: "ready", payment: await getPaymentByPurchase(id) };
      } catch (error) {
        payment = {
          kind:
            error instanceof PaymentRequestError && error.status === 404
              ? "missing"
              : "unavailable",
        };
      }
      if (active) setResult({ key, kind: "ready", purchase, payment });
    }

    void load();
    return () => {
      active = false;
    };
  }, [id, key]);

  return (
    <main className="mx-auto max-w-3xl p-5 md:py-10">
      <Link
        href="/comprador/meus-numeros"
        className="inline-flex items-center gap-2 text-sm font-bold text-violet-700"
      >
        <ArrowLeft aria-hidden size={17} />
        Voltar ao histórico
      </Link>
      <h1 className="mt-3 text-3xl font-black">Detalhe da compra</h1>
      {!detail ? (
        <p role="status" className="p-10 text-center">
          Carregando compra...
        </p>
      ) : detail.kind === "error" ? (
        <section className="mt-6 rounded-3xl bg-white p-6">
          <p role="alert" className="font-bold text-red-700">
            Não foi possível abrir esta compra.
          </p>
          <p className="mt-2 text-sm text-zinc-600">
            Confirme que a compra pertence a esta conta ou volte ao histórico.
          </p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-4 rounded-xl border border-violet-300 px-4 py-2 text-sm font-bold text-violet-700"
          >
            Tentar novamente
          </button>
        </section>
      ) : (
        <PurchaseView purchase={detail.purchase} payment={detail.payment} />
      )}
    </main>
  );
}

function PurchaseView({
  purchase,
  payment,
}: {
  purchase: Purchase;
  payment: PaymentView;
}) {
  return (
    <section className="mt-6 rounded-3xl bg-white p-6">
      <p className="text-sm font-bold text-violet-700">
        {purchaseStatusLabels[purchase.status]}
      </p>
      <h2 className="mt-1 text-2xl font-black">{purchase.campaign.title}</h2>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-zinc-500">Quantidade</dt>
          <dd className="font-bold">{purchase.quantity}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Total</dt>
          <dd className="font-bold">{money.format(purchase.total)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Desconto</dt>
          <dd className="font-bold">{money.format(purchase.discount)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Pagamento</dt>
          <dd className="font-bold">
            <PaymentStatusLine view={payment} />
          </dd>
        </div>
      </dl>
      <section className="mt-5" aria-labelledby="purchase-titles">
        <h3 id="purchase-titles" className="font-black">
          Títulos desta compra
        </h3>
        {purchase.tickets.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {purchase.tickets.map((ticket) => (
              <li
                key={ticket.number}
                className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-bold"
              >
                {ticket.number}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">
            Nenhum título confirmado nesta compra.
          </p>
        )}
      </section>
      {["AWAITING_PAYMENT", "RESERVED"].includes(purchase.status) && (
        <Link
          href={`/comprador/checkout/${purchase.id}`}
          className="mt-6 block rounded-xl bg-violet-700 p-4 text-center font-bold text-white"
        >
          Continuar pagamento
        </Link>
      )}
      <Link
        href="/comprador/suporte"
        className="mt-3 block text-center font-bold text-violet-700"
      >
        Preciso de suporte
      </Link>
    </section>
  );
}
