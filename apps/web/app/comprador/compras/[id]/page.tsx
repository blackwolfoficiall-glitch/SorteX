"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CircleHelp, Clock3, LoaderCircle, Ticket } from "lucide-react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import PremiumScope from "@/components/premium/PremiumScope";
import { getPurchase } from "@/lib/purchases/client";
import { purchaseStatusLabels } from "@/lib/purchases/status";
import type { Purchase } from "@/lib/purchases/types";
import { getPaymentByPurchase, PaymentRequestError } from "@/lib/payments/client";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments/types";
import styles from "./buyer-purchase-detail-premium.module.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR");
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
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
  PIX: "Pix", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito",
};

type PaymentView =
  | { kind: "loading" | "missing" | "unavailable" }
  | { kind: "ready"; status: PaymentStatus; method: PaymentMethod };

type Detail =
  | { key: number; kind: "error" }
  | { key: number; kind: "ready"; purchase: Purchase; payment: PaymentView };

function PaymentStatusLine({ view }: { view: PaymentView }) {
  if (view.kind === "ready") {
    return <><span>{paymentStatusLabels[view.status]}</span><span className={styles.method}>{paymentMethodLabels[view.method]}</span></>;
  }

  const message = {
    loading: "Carregando situação do pagamento…",
    missing: "Nenhum pagamento registrado",
    unavailable: "Situação do pagamento indisponível.",
  }[view.kind];
  return <span role={view.kind === "loading" ? "status" : undefined}>{message}</span>;
}

export default function Compra() {
  const { id } = useParams<{ id: string }>();
  const user = useAuthorizedUser();
  return (
    <PremiumScope className={styles.page}>
      <PurchaseDetail key={`${user?.id ?? ""}:${id}`} id={id} />
    </PremiumScope>
  );
}

function PurchaseDetail({ id }: { id: string }) {
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Detail>();
  const detail = result?.key === retry ? result : undefined;
  const reload = () => setRetry((value) => value + 1);

  useEffect(() => {
    let active = true;

    async function load() {
      let purchase: Purchase;
      try {
        purchase = await getPurchase(id);
      } catch {
        if (active) setResult({ key: retry, kind: "error" });
        return;
      }
      if (!active) return;
      setResult({ key: retry, kind: "ready", purchase, payment: { kind: "loading" } });

      let payment: PaymentView;
      try {
        const { status, method } = await getPaymentByPurchase(id);
        payment = { kind: "ready", status, method };
      } catch (error) {
        payment = { kind: error instanceof PaymentRequestError && error.status === 404 ? "missing" : "unavailable" };
      }
      if (active) setResult({ key: retry, kind: "ready", purchase, payment });
    }

    void load();
    return () => { active = false; };
  }, [id, retry]);

  return (
    <div className={styles.wrap}>
      <Link href="/comprador/meus-numeros" className={styles.control}>
        <ArrowLeft aria-hidden="true" size={17} /> Voltar ao histórico
      </Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Área do comprador</p>
          <h1>Detalhe da compra</h1>
          <p>Acompanhe o pedido, o pagamento e seus títulos emitidos.</p>
        </div>
        <Ticket size={31} aria-hidden="true" />
      </header>
      {!detail ? (
        <div className={styles.state} role="status"><LoaderCircle className={styles.spinner} aria-hidden="true" size={19} /> Carregando compra…</div>
      ) : detail.kind === "error" ? (
        <section className={styles.state} aria-label="Compra indisponível">
          <p role="alert">Não foi possível abrir esta compra.</p>
          <p>Confira se a compra pertence a esta conta ou volte ao histórico.</p>
          <button type="button" className={styles.control} onClick={reload}>Tentar novamente</button>
        </section>
      ) : <PurchaseView purchase={detail.purchase} payment={detail.payment} reload={reload} />}
    </div>
  );
}

function PurchaseView({ purchase, payment, reload }: { purchase: Purchase; payment: PaymentView; reload: () => void }) {
  const paid = purchase.status === "PAID";
  const open = purchase.status === "RESERVED" || purchase.status === "AWAITING_PAYMENT";
  const issued = paid ? purchase.tickets.filter((ticket) => ticket.status === "SOLD") : [];
  const shownDate = open ? purchase.expiresAt : paid && purchase.confirmedAt ? purchase.confirmedAt : purchase.createdAt;
  const dateLabel = open ? "Prazo previsto" : paid && purchase.confirmedAt ? "Compra confirmada em" : "Pedido criado em";
  return (
    <article className={styles.card} aria-labelledby="purchase-campaign">
      <header className={styles.cardHead}>
        <span className={styles.badge} data-status={purchase.status}>{purchaseStatusLabels[purchase.status]}</span>
        <h2 id="purchase-campaign">{purchase.campaign.title}</h2>
        <p className={styles.date}>
          <Clock3 size={15} aria-hidden="true" /> <span>{dateLabel}: <time dateTime={shownDate}>{date.format(new Date(shownDate))}</time></span>
        </p>
      </header>
      <dl className={styles.facts}>
        <div><dt>Títulos no pedido</dt><dd>{number.format(purchase.quantity)}</dd></div>
        <div><dt>Total do pedido</dt><dd>{money.format(purchase.total)}</dd></div>
        <div><dt>Desconto</dt><dd>{money.format(purchase.discount)}</dd></div>
        <div><dt>Pagamento</dt><dd><PaymentStatusLine view={payment} />
        {payment.kind === "unavailable" && <button type="button" className={styles.control} onClick={reload}>Tentar consultar novamente</button>}</dd></div>
      </dl>
      <section className={styles.titles} aria-labelledby="purchase-titles">
        <h3 id="purchase-titles">Títulos desta compra</h3>
        {issued.length > 0 ? (
          <ul role="list" aria-label="Números emitidos">
            {issued.map((ticket) => <li key={ticket.number}>{ticket.number}</li>)}
          </ul>
        ) : <p>Nenhum título confirmado nesta compra.</p>}
      </section>
      <div className={styles.actions}>
        {open && <Link href={`/comprador/checkout/${purchase.id}`} prefetch={false} className={`${styles.control} ${styles.primary}`}>Continuar pagamento <ArrowUpRight size={16} aria-hidden="true" /></Link>}
        <Link href="/comprador/suporte" className={styles.control}><CircleHelp size={16} aria-hidden="true" /> Preciso de suporte</Link>
      </div>
    </article>
  );
}
