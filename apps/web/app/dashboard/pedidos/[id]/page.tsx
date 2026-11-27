"use client";

import Link from "next/link";
import { use, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowUpRight, CalendarClock, CreditCard, LoaderCircle,
  ReceiptText, Ticket, UserRound,
} from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import { AuthApiError } from "@/lib/auth/client";
import { getOrder } from "@/lib/organizer-platform/client";
import styles from "./order-detail-premium.module.css";

type TicketEntry = { id: string; number: number };
type PaymentEvent = { id: string; eventType: string; processed: boolean; createdAt: string };
type Payment = {
  id: string;
  status: string;
  method: string;
  provider: string;
  amount: number;
  platformFee: number;
  gatewayFee: number;
  netAmount: number;
  createdAt: string;
  approvedAt?: string | null;
  events?: PaymentEvent[];
};
type Order = {
  id: string;
  status: string;
  quantity: number;
  subtotal: number;
  discount: number;
  total: number;
  expiresAt: string;
  createdAt: string;
  campaign: { title: string };
  buyer: { name: string; email?: string; phone?: string | null; city?: string | null; state?: string | null };
  tickets?: TicketEntry[];
  _count?: { tickets?: number };
  payments?: Payment[];
  promotion?: { name: string } | null;
};
type Result = { key: string; value: Order } | { key: string; missing: boolean };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brazilTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});
const orderLabels: Record<string, string> = {
  PENDING: "Pendente", RESERVED: "Reservado", AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago", EXPIRED: "Expirado", CANCELLED: "Cancelado", REFUNDED: "Reembolsado",
};
const paymentLabels: Record<string, string> = {
  CREATED: "Criado", PENDING: "Pendente", PROCESSING: "Em processamento",
  APPROVED: "Aprovado", REJECTED: "Rejeitado", FAILED: "Falhou", CANCELLED: "Cancelado",
  REFUNDED: "Estornado", EXPIRED: "Expirado", IN_PROCESS: "Em processamento",
  IN_MEDIATION: "Em mediação", PARTIALLY_REFUNDED: "Estornado parcialmente",
  CHARGED_BACK: "Chargeback",
};
const methodLabels: Record<string, string> = {
  PIX: "Pix", CREDIT_CARD: "Cartão de crédito", DEBIT_CARD: "Cartão de débito",
  CARD: "Cartão", BOLETO: "Boleto",
};
const providerLabels: Record<string, string> = {
  MERCADO_PAGO: "Mercado Pago", STONE: "Stone", PAGBANK: "PagBank", PAGARME: "Pagar.me", ASAAS: "Asaas",
};
const formatMoney = (value?: number) => typeof value === "number" && Number.isFinite(value) ? currency.format(value) : "Não informado";
const formatDate = (value?: string | null) => {
  const date = value && new Date(value);
  return date && Number.isFinite(date.getTime()) ? brazilTime.format(date) : "Não informada";
};
const readable = (text?: string) => text ? text.replaceAll("_", " ").toLowerCase() : "Não informado";
const countLabel = (count: number) => count === 1 ? "1 título" : `${count.toLocaleString("pt-BR")} títulos`;

function parseOrder(record: Record<string, unknown>, id: string) {
  if (record.id !== id || typeof record.status !== "string" ||
      !record.campaign || typeof record.campaign !== "object" ||
      !("title" in record.campaign) || typeof record.campaign.title !== "string" ||
      !record.buyer || typeof record.buyer !== "object" ||
      !("name" in record.buyer) || typeof record.buyer.name !== "string") {
    throw new Error("Detalhes do pedido indisponíveis.");
  }
  return record as unknown as Order;
}

export default function PedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [attempt, retry] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const key = `${id}:${attempt}`;

  useEffect(() => {
    let active = true;
    void getOrder(id)
      .then((data) => parseOrder(data, id))
      .then((value) => { if (active) setResult({ key, value }); })
      .catch((error: unknown) => {
        if (active) setResult({ key, missing: error instanceof AuthApiError && [401, 403, 404].includes(error.status) });
      });
    return () => { active = false; };
  }, [id, key]);

  const current = result?.key === key ? result : null;
  return (
    <PremiumScope className={styles.page}>
      <Link href="/dashboard/pedidos" className={styles.navLink}>
        <ArrowLeft size={17} aria-hidden="true" /> Voltar aos pedidos
      </Link>
      {!current ? (
        <div className={styles.state} role="status">
          <LoaderCircle size={20} className={styles.spinner} aria-hidden="true" /> Carregando pedido…
        </div>
      ) : "missing" in current ? (
        <section className={styles.state}>
          <h1 className={styles.heading} role="alert">
            {current.missing ? "Pedido indisponível para esta conta." : "Não foi possível carregar o pedido."}
          </h1>
          {!current.missing && <button type="button" className={styles.navLink} onClick={() => retry((n) => n + 1)}>Tentar novamente</button>}
        </section>
      ) : <OrderContent order={current.value} />}
    </PremiumScope>
  );
}

function OrderContent({ order }: { order: Order }) {
  const tickets = (Array.isArray(order.tickets) ? order.tickets : [])
    .filter((item) => item && typeof item.id === "string" && Number.isInteger(item.number));
  const ticketCount = Number.isInteger(order._count?.tickets) && (order._count?.tickets ?? -1) >= 0
    ? order._count?.tickets : undefined;
  const payments = Array.isArray(order.payments) ? order.payments.filter((item) => item && typeof item.id === "string") : [];

  return (
    <>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Pedido #{order.id.slice(-8).toUpperCase()}</p>
          <h1 className={styles.heading}>{order.campaign.title}</h1>
          <p className={styles.muted}>Pedido, reserva e pagamento em um só lugar. Esta página é somente para consulta.</p>
        </div>
        <span className={styles.badge} data-status={order.status}>{orderLabels[order.status] ?? readable(order.status)}</span>
      </header>

      <div className={styles.infoGrid}>
        <Card title="Comprador" icon={<UserRound size={19} aria-hidden="true" />}>
          <dl className={styles.data}>
            <Line label="Nome" value={order.buyer.name} />
            <Line label="E-mail" value={order.buyer.email || "Não informado"} />
            <Line label="Telefone" value={order.buyer.phone || "Não informado"} />
            <Line label="Localidade" value={[order.buyer.city, order.buyer.state].filter(Boolean).join(" - ") || "Não informada"} />
          </dl>
          {order.buyer.email && (
            <Link href={`/dashboard/crm/contatos?search=${encodeURIComponent(order.buyer.email)}`} className={styles.navLink}>
              Abrir no CRM <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          )}
        </Card>
        <Card title="Reserva" icon={<CalendarClock size={19} aria-hidden="true" />}>
          <dl className={styles.data}>
            <Line label="Quantidade reservada" value={Number.isInteger(order.quantity) ? countLabel(order.quantity) : "Não informada"} />
            <Line label="Criada em" value={formatDate(order.createdAt)} />
            <Line label="Vencimento" value={formatDate(order.expiresAt)} />
            <Line label="Promoção" value={order.promotion?.name || "Nenhuma"} />
          </dl>
          <p className={styles.muted}>Horários de Brasília.</p>
        </Card>
        <Card title="Valores" icon={<ReceiptText size={19} aria-hidden="true" />} featured>
          <dl className={styles.data}>
            <Line label="Subtotal" value={formatMoney(order.subtotal)} />
            <Line label="Desconto" value={formatMoney(order.discount)} />
            <Line label="Total do pedido" value={formatMoney(order.total)} strong />
          </dl>
          <p className={styles.muted}>Total do pedido não é saldo disponível.</p>
        </Card>
      </div>

      <Card title="Números do pedido" icon={<Ticket size={19} aria-hidden="true" />}>
        {tickets.length > 0 ? (
          <ul className={styles.tickets}>
            {tickets.map((ticket) => <li key={ticket.id}>{String(ticket.number).padStart(6, "0")}</li>)}
          </ul>
        ) : ticketCount === undefined ? (
          <p className={styles.muted}>A quantidade de títulos não foi informada nesta consulta.</p>
        ) : ticketCount === 0 ? (
          <p className={styles.muted}>Nenhum título registrado para este pedido.</p>
        ) : (
          <p className={styles.muted}>{countLabel(ticketCount)} registrados no pedido. A lista de números não está disponível nesta consulta.</p>
        )}
      </Card>

      <Card title="Pagamento e histórico" icon={<CreditCard size={19} aria-hidden="true" />}>
        {!payments.length ? <p className={styles.muted}>Nenhum pagamento iniciado.</p> : (
          <div className={styles.paymentList}>{payments.map((payment) => <PaymentCard key={payment.id} payment={payment} />)}</div>
        )}
      </Card>
    </>
  );
}

function PaymentCard({ payment }: { payment: Payment }) {
  const events = Array.isArray(payment.events) ? payment.events.filter((item) => item && typeof item.id === "string") : [];
  const status = paymentLabels[payment.status] ?? readable(payment.status);
  const pending = ["CREATED", "PENDING", "PROCESSING"].includes(payment.status);
  return (
    <section className={styles.payment}>
      <header>
        <h3>{methodLabels[payment.method] ?? readable(payment.method)}</h3>
        <span className={styles.badge} data-status={payment.status}>{status}</span>
      </header>
      <dl className={styles.paymentData}>
        <Line label="Gateway" value={providerLabels[payment.provider] ?? readable(payment.provider)} />
        <Line label="Valor" value={formatMoney(payment.amount)} strong />
        <Line label="Iniciado em" value={formatDate(payment.createdAt)} />
        {payment.approvedAt && <Line label="Aprovado em" value={formatDate(payment.approvedAt)} />}
        <Line label="Taxa SorteX" value={formatMoney(payment.platformFee)} />
        <Line label="Taxa Gateway" value={formatMoney(payment.gatewayFee)} />
        <Line label={pending ? "Líquido previsto" : "Líquido registrado"} value={formatMoney(payment.netAmount)} />
      </dl>
      {pending && <p className={styles.muted}>Pagamento ainda não confirmado. Este valor não é um recebimento.</p>}
      {events.length > 0 ? (
        <div className={styles.events}>
          <h4>Eventos registrados</h4>
          <ul>
            {events.map((event) => (
              <li key={event.id}>
                <strong>{readable(event.eventType)}</strong>
                <span>{formatDate(event.createdAt)} · {event.processed ? "Processado" : "Pendente"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className={styles.muted}>Sem eventos adicionais registrados.</p>}
      {payment.method === "PIX" && <p className={styles.muted}>O código Pix fica protegido no checkout do comprador.</p>}
    </section>
  );
}

function Card({ title, icon, children, featured = false }: {
  title: string; icon: ReactNode; children: ReactNode; featured?: boolean;
}) {
  return (
    <section className={styles.card} data-featured={featured || undefined}>
      <h2><span className={styles.icon}>{icon}</span>{title}</h2>
      {children}
    </section>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={styles.line}><dt>{label}</dt><dd data-strong={strong || undefined}>{value}</dd></div>;
}
