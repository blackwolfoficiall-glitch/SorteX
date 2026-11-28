"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Clock3, LoaderCircle, Ticket } from "lucide-react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import PremiumScope from "@/components/premium/PremiumScope";
import { getMyPurchases } from "@/lib/purchases/client";
import type { Purchase, PurchaseStatus } from "@/lib/purchases/types";
import { purchaseStatusLabels } from "@/lib/purchases/status";
import styles from "./buyer-purchases-premium.module.css";

const tabs: Array<{ label: string; status?: PurchaseStatus }> = [
  { label: "Todas" },
  { label: "Reservadas", status: "RESERVED" },
  { label: "Aguardando", status: "AWAITING_PAYMENT" },
  { label: "Pendentes", status: "PENDING" },
  { label: "Pagas", status: "PAID" },
  { label: "Expiradas", status: "EXPIRED" },
  { label: "Canceladas", status: "CANCELLED" },
  { label: "Estornadas", status: "REFUNDED" },
];
type Selection = { status?: PurchaseStatus };
type ListResult =
  | { selection: Selection; items: Purchase[] }
  | { selection: Selection; failed: true };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR");
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function BuyerPurchase({ purchase }: { purchase: Purchase }) {
  const paid = purchase.status === "PAID";
  const open = purchase.status === "RESERVED" || purchase.status === "AWAITING_PAYMENT";
  const shownDate = open ? purchase.expiresAt : purchase.confirmedAt && paid ? purchase.confirmedAt : purchase.createdAt;
  const label = open ? "Prazo previsto" : purchase.confirmedAt && paid ? "Confirmada em" : "Pedido criado em";
  const issued = paid ? purchase.tickets.filter((ticket) => ticket.status === "SOLD") : [];

  return (
    <li className={styles.row}>
      <article className={styles.card}>
        <header className={styles.cardHead}>
          <span className={styles.icon}><Ticket size={19} aria-hidden="true" /></span>
          <div>
            <span className={styles.badge} data-status={purchase.status}>{purchaseStatusLabels[purchase.status]}</span>
            <h2>{purchase.campaign.title}</h2>
          </div>
        </header>
        <dl className={styles.facts}>
          <div><dt>Títulos no pedido</dt><dd>{number.format(purchase.quantity)}</dd></div>
          <div><dt>{paid ? "Valor confirmado" : "Valor do pedido"}</dt><dd>{money.format(purchase.total)}</dd></div>
        </dl>
        <p className={styles.date}><Clock3 size={14} aria-hidden="true" /> <span>{label}: <time dateTime={shownDate}>{date.format(new Date(shownDate))}</time></span></p>
        {issued.length > 0 ? (
          <div className={styles.issued}>
            <p>Títulos emitidos</p>
            <ul role="list" aria-label="Números emitidos">
              {issued.slice(0, 12).map((ticket) => <li key={ticket.number}>{ticket.number}</li>)}
            </ul>
            {issued.length > 12 && <p>Mais {number.format(issued.length - 12)} no detalhe</p>}
          </div>
        ) : paid ? <p className={styles.date}>Sem números emitidos nesta lista.</p> : null}
        <Link className={styles.action} href={`/comprador/compras/${purchase.id}`} aria-label={`Ver compra: ${purchase.campaign.title}`}>
          Ver compra <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </article>
    </li>
  );
}

export default function MeusNumerosPage() {
  const user = useAuthorizedUser();
  return (
    <PremiumScope className={styles.page}>
      <PurchaseHistory key={user?.id ?? ""} />
    </PremiumScope>
  );
}

function PurchaseHistory() {
  const [selection, setSelection] = useState<Selection>({});
  const [result, setResult] = useState<ListResult>();
  const current = result?.selection === selection ? result : undefined;

  useEffect(() => {
    let active = true;
    getMyPurchases(selection.status)
      .then((items) => { if (active) setResult({ selection, items }); })
      .catch(() => { if (active) setResult({ selection, failed: true }); });
    return () => { active = false; };
  }, [selection]);

  function selectStatus(next?: PurchaseStatus) {
    setSelection((previous) => previous.status === next ? previous : { status: next });
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Área do comprador</p>
          <h1>Meus títulos</h1>
          <p>Acompanhe suas compras e consulte os números que já foram emitidos.</p>
        </div>
        <Ticket size={32} aria-hidden="true" />
      </header>
      <section className={styles.filters} aria-label="Filtrar compras por situação">
        {tabs.map((tab) => (
          <button key={tab.label} type="button" aria-pressed={selection.status === tab.status} className={styles.control} onClick={() => selectStatus(tab.status)}>
            {tab.label}
          </button>
        ))}
      </section>
      <section aria-label="Histórico de compras">
        {!current ? (
          <div role="status" className={styles.state}>
            <LoaderCircle aria-hidden="true" size={20} className={styles.spinner} /> Carregando compras…
          </div>
        ) : "failed" in current ? (
          <div className={styles.state}>
            <p role="alert">Não foi possível carregar suas compras.</p>
            <button type="button" className={styles.control} onClick={() => setSelection((previous) => ({ ...previous }))}>Tentar novamente</button>
          </div>
        ) : current.items.length === 0 ? (
          <div className={styles.state}>
            <Ticket aria-hidden="true" size={28} />
            <h2>{selection.status ? "Nenhuma compra nesta categoria" : "Você ainda não tem compras"}</h2>
            {selection.status
              ? <button type="button" className={styles.control} onClick={() => selectStatus()}>Ver todas</button>
              : <Link className={styles.control} href="/comprador/sorteios">Explorar campanhas</Link>}
          </div>
        ) : (
          <ul role="list" className={styles.list}>
            {current.items.map((purchase) => <BuyerPurchase key={purchase.id} purchase={purchase} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
