"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./orders-premium.module.css";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clipboard,
  Clock3,
  Contact,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  History,
  LoaderCircle,
  Mail,
  PackageOpen,
  Phone,
  ReceiptText,
  RefreshCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import {
  getOrder,
  listOrders,
  type OrganizerOrder,
  type OrderSummary,
} from "@/lib/organizer-platform/client";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  RESERVED: "Reservado",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};
const methodLabels: Record<string, string> = {
  PIX: "Pix",
  CARD: "Cartão",
  BOLETO: "Boleto",
};

type Filters = {
  search: string;
  campaignId: string;
  status: string;
  method: string;
  from: string;
  to: string;
  minValue: string;
  maxValue: string;
  sort: string;
};
const emptyFilters: Filters = {
  search: "",
  campaignId: "",
  status: "",
  method: "",
  from: "",
  to: "",
  minValue: "",
  maxValue: "",
  sort: "recent",
};

type OrderList = Awaited<ReturnType<typeof listOrders>>;
type OrderResult = { query: string; orders: OrderList } | { query: string; error: string };
type OrderDrawerState = { loading: true } | { loading: false; order: Record<string, unknown> };

export default function PedidosPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsUnavailable, setCampaignsUnavailable] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [selected, setSelected] = useState<OrderDrawerState | null>(null);
  const requestId = useRef(0);
  const [message, setMessage] = useState("");
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
  }).toString();
  const query = `${params}:${attempt}`;
  const current = result?.query === query ? result : null;
  const orders = current && "orders" in current ? current.orders : undefined;
  const items = orders?.items ?? [];
  const total = orders?.total;
  const pages = orders?.pages ?? 0;
  const summary = orders?.summary;
  const loading = !current;
  const error = current && "error" in current ? current.error : "";
  const refresh = () => setAttempt((value) => value + 1);

  useEffect(() => {
    let active = true;
    void getMyCampaigns()
      .then((items) => { if (active) setCampaigns(items); })
      .catch(() => { if (active) setCampaignsUnavailable(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      void listOrders(`?${params}`)
        .then((orders) => { if (active) setResult({ query, orders }); })
        .catch((cause: unknown) => {
          if (active) setResult({
            query,
            error: cause instanceof Error && cause.message ? cause.message : "Não foi possível carregar os pedidos.",
          });
        });
    }, filters.search ? 350 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [params, query, filters.search]);

  function change(patch: Partial<Filters>) {
    refresh();
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }
  function quick(days: number, label?: "yesterday") {
    const end = new Date();
    const start = new Date();
    if (label === "yesterday") {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else start.setDate(start.getDate() - days + 1);
    change({ from: iso(start), to: iso(end) });
  }
  async function openDetails(id: string) {
    const key = ++requestId.current;
    setSelected({ loading: true });
    try {
      const order = await getOrder(id);
      if (key === requestId.current) setSelected({ loading: false, order });
    } catch (cause) {
      if (key !== requestId.current) return;
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Não foi possível abrir o pedido.",
      );
      setSelected(null);
    }
  }
  function closeDetails() {
    requestId.current++;
    setSelected(null);
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copiado com sucesso.`);
    } catch {
      setMessage("Não foi possível copiar. Confira a permissão da área de transferência.");
    }
  }

  const comparison = summary?.comparison;
  const summaryValue = (key: keyof OrderSummary, format: (value: number) => string) =>
    summary ? format(summary[key]) : "—";
  const cards = [
    {
      label: "Vendas aprovadas",
      value: summaryValue("approvedSales", money.format),
      icon: CheckCircle2,
      tone: "emerald",
      detail: "Valor bruto dos pedidos pagos",
    },
    {
      label: "Reservas pendentes",
      value: summaryValue("pendingReservations", (value) => value.toLocaleString("pt-BR")),
      icon: Clock3,
      tone: "amber",
      detail: "Aguardam conclusão",
    },
    {
      label: "Pedidos hoje",
      value: summaryValue("ordersToday", (value) => value.toLocaleString("pt-BR")),
      icon: ShoppingBag,
      tone: "blue",
      detail: "Pelo horário do servidor",
    },
    {
      label: "Receita do período",
      value: summaryValue("periodRevenue", money.format),
      icon: CircleDollarSign,
      tone: "violet",
      detail: "Por data de criação do pedido",
    },
  ];

  return (
    <PremiumScope className={styles.orders}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            Vendas e reservas
          </p>
          <h1 className={styles.title}>Pedidos</h1>
          <p className={styles.subtitle}>
            Acompanhe cada etapa sem alterar manualmente o status dos
            pagamentos.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu items={items} enabled={Boolean(orders && items.length)} />
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className={styles.controlButton}
          >
            <RefreshCcw size={17} />
            Atualizar
          </button>
        </div>
      </header>

      {message && (
        <div
          role="status"
          className={styles.message}
        >
          <span>{message}</span>
          <button type="button" aria-label="Dispensar aviso" className={styles.controlButton} onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <section className={styles.summary} aria-label="Resumo da operação">
        <p className={styles.summaryNote}>Resumo da sua conta. Só o intervalo de datas altera a receita do período; a busca e os outros filtros alteram a lista.</p>
        {cards.map(({ label, value, icon: Icon, tone, detail }) => (
          <article key={label} className={styles.stat} data-featured={tone === "violet" || undefined}>
            <span className={styles.icon}><Icon size={20} aria-hidden="true" /></span>
            <div>
              <h2>{label}</h2>
              <strong>{value}</strong>
              <p>{detail}</p>
              {tone === "violet" && comparison !== undefined && comparison !== 0 && (
                <p className={styles.comparison}>
                  {comparison < 0 ? <TrendingDown size={14} aria-hidden="true" /> : <TrendingUp size={14} aria-hidden="true" />}{" "}
                  {comparison > 0 ? "+" : ""}{comparison.toFixed(1)}% em relação ao período anterior
                </p>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className={styles.panel} aria-labelledby="order-filters">
        <h2 className={styles.panelTitle} id="order-filters">
          <SlidersHorizontal size={18} aria-hidden="true" />
          Filtros
        </h2>
        <div className={styles.filterGrid}>
          <div className={styles.searchField}>
            <label htmlFor="orders-search">
              <FilterLabel>Busca</FilterLabel>
            </label>
            <span className="relative block">
              <Search
                aria-hidden="true"
                className={styles.searchIcon}
                size={18}
              />
              <input
                id="orders-search"
                type="search"
                value={filters.search}
                onChange={(e) => change({ search: e.target.value })}
                placeholder="Nome ou e-mail do comprador"
                className={`${control} ${styles.searchInput}`}
              />
            </span>
          </div>
          <label className={styles.campaignField}>
            <FilterLabel>Campanha</FilterLabel>
            <select
              aria-label="Campanha"
              value={filters.campaignId}
              onChange={(e) => change({ campaignId: e.target.value })}
              className={control}
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <FilterLabel>Status</FilterLabel>
            <select
              aria-label="Status"
              value={filters.status}
              onChange={(e) => change({ status: e.target.value })}
              className={control}
            >
              <option value="">Todos os status</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.methodField}>
            <FilterLabel>Método de pagamento</FilterLabel>
            <select
              aria-label="Método de pagamento"
              value={filters.method}
              onChange={(e) => change({ method: e.target.value })}
              className={control}
            >
              <option value="">Todos os métodos</option>
              <option value="PIX">Pix</option>
              <option value="CARD">Cartão</option>
              <option value="BOLETO">Boleto</option>
            </select>
          </label>
          <div className={styles.dateGroup}>
            <label>
              <FilterLabel>Data inicial</FilterLabel>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => change({ from: e.target.value })}
                className={control}
              />
            </label>
            <label>
              <FilterLabel>Data final</FilterLabel>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => change({ to: e.target.value })}
                className={control}
              />
            </label>
          </div>
          <label>
            <FilterLabel>Valor mínimo</FilterLabel>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.minValue}
              onChange={(e) => change({ minValue: e.target.value })}
              placeholder="R$ 0,00"
              className={control}
            />
          </label>
          <label>
            <FilterLabel>Valor máximo</FilterLabel>
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.maxValue}
              onChange={(e) => change({ maxValue: e.target.value })}
              placeholder="Sem limite"
              className={control}
            />
          </label>
        </div>
        {campaignsUnavailable && <p className={styles.muted} role="status">Filtro por campanha indisponível no momento.</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Quick label="Hoje" onClick={() => quick(1)} />
          <Quick label="Ontem" onClick={() => quick(1, "yesterday")} />
          <Quick label="7 dias" onClick={() => quick(7)} />
          <Quick label="30 dias" onClick={() => quick(30)} />
          <Quick label="90 dias" onClick={() => quick(90)} />
          <Quick label="Pix" onClick={() => change({ method: "PIX" })} />
          <Quick label="Cartão" onClick={() => change({ method: "CARD" })} />
          <Quick label="Boleto" onClick={() => change({ method: "BOLETO" })} />
          <Quick
            label="Pendentes"
            onClick={() => change({ status: "AWAITING_PAYMENT" })}
          />
          <Quick label="Pagos" onClick={() => change({ status: "PAID" })} />
          <Quick
            label="Cancelados"
            onClick={() => change({ status: "CANCELLED" })}
          />
          <Quick
            label="Reservados"
            onClick={() => change({ status: "RESERVED" })}
          />
          <button
            onClick={() => {
              setFilters(emptyFilters);
              refresh();
              setPage(1);
            }}
            className={styles.controlButton}
          >
            Limpar filtros
          </button>
        </div>
      </section>

      <div className={styles.results}>
        <p className={styles.muted} aria-live="polite">
          {total !== undefined ? <><b>{total}</b> {total === 1 ? "pedido encontrado" : "pedidos encontrados"}</> : "Resultados dos pedidos"}
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Ordenação"
            value={filters.sort}
            onChange={(e) => change({ sort: e.target.value })}
            className={smallControl}
          >
            <option value="recent">Mais recentes</option>
            <option value="value_desc">Maior valor</option>
            <option value="value_asc">Menor valor</option>
            <option value="quantity_desc">Maior quantidade</option>
            <option value="buyer_desc">Maior comprador</option>
          </select>
          <select
            aria-label="Pedidos por página"
            value={limit}
            onChange={(e) => {
              setPage(1);
              refresh();
              setLimit(Number(e.target.value));
            }}
            className={smallControl}
          >
            {[25, 50, 100, 250].map((value) => (
              <option key={value} value={value}>
                {value} pedidos
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} retry={refresh} />
      ) : loading ? (
        <div className={styles.loading} role="status">
          <LoaderCircle aria-hidden="true" /> Carregando pedidos…
        </div>
      ) : items.length ? (
        <div className={styles.collection} aria-label="Pedidos encontrados">
          <div className={styles.desktopOrders}>
            <table>
              <caption className="sr-only">Pedidos encontrados</caption>
              <thead><tr><th scope="col">Comprador</th><th scope="col">Campanha</th><th scope="col">Pedido e pagamento</th><th scope="col">Valor</th><th scope="col">Ações</th></tr></thead>
              <tbody>
                {items.map((item) => <OrderRow key={item.id} item={item} open={() => void openDetails(item.id)} copy={copy} setMessage={setMessage} />)}
              </tbody>
            </table>
          </div>
          <section className={styles.mobileOrders} aria-label="Lista de pedidos">
            {items.map((item) => <OrderCard key={item.id} item={item} open={() => void openDetails(item.id)} copy={copy} setMessage={setMessage} />)}
          </section>
        </div>
      ) : (
        <EmptyState
          filtered={Object.entries(filters).some(
            ([key, value]) => key !== "sort" && Boolean(value),
          )}
        />
      )}

      {orders && items.length > 0 && (
        <nav
          aria-label="Paginação"
          className="flex items-center justify-center gap-3"
        >
          <button
            disabled={page <= 1}
            onClick={() => { refresh(); setPage((value) => value - 1); }}
            className={pageButton}
          >
            <ChevronLeft size={16} />
            Anterior
          </button>
          <span className="text-sm font-bold">
            Página {page} de {Math.max(1, pages)}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => { refresh(); setPage((value) => value + 1); }}
            className={pageButton}
          >
            Próxima
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
      {selected && (
        <OrderDrawer
          state={selected}
          close={closeDetails}
        />
      )}
    </PremiumScope>
  );
}

type OrderViewProps = {
  item: OrganizerOrder;
  open: () => void;
  copy: (text: string, label: string) => Promise<void>;
  setMessage: (value: string) => void;
};
const orderId = (id: string) => `Pedido #${id.slice(-8).toUpperCase()}`;
const paymentLabel = (method?: string) => (method && (methodLabels[method] || method)) || "Não iniciado";
const affiliateLabel = (item: OrganizerOrder) => item.affiliateConversion?.affiliate.name || "Sem afiliado registrado";

function OrderStatus({ status }: { status: string }) {
  return <span className={styles.badge} data-status={status}>{statusLabels[status] || status}</span>;
}

function OrderRow(props: OrderViewProps) {
  const { item, open } = props;
  return (
    <tr>
      <th scope="row">
        <strong>{item.buyer.name}</strong>
        <span>{item.buyer.email}</span>
        <span>{item.buyer.phone || "Telefone não informado"}</span>
      </th>
      <td>
        <strong>{item.campaign.title}</strong>
        <span>{affiliateLabel(item)}</span>
      </td>
      <td>
        <OrderStatus status={item.status} />
        <span>{orderId(item.id)}</span>
        <span>{paymentLabel(item.payments[0]?.method)} · {dateTime.format(new Date(item.createdAt))}</span>
      </td>
      <td><strong>{money.format(item.total)}</strong><span>{item.quantity} cotas</span></td>
      <td>
        <Action icon={Eye} label="Abrir detalhes" onClick={open} />
        <details className={styles.rowActions}>
          <summary>Mais ações</summary>
          <div><OrderActions {...props} hideOpen /></div>
        </details>
      </td>
    </tr>
  );
}

function OrderCard({ item, ...props }: OrderViewProps) {
  const payment = item.payments[0];
  const when = new Date(item.createdAt);
  const initials = item.buyer.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <article className={styles.card}>
      <div className="flex items-start gap-3">
        <span className={styles.avatar}>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-black">{item.buyer.name}</h3>
              <p className={styles.muted}>{orderId(item.id)}</p>
            </div>
            <OrderStatus status={item.status} />
          </div>
          <div className={styles.contacts}>
            <span className="inline-flex items-center gap-1">
              <Phone size={13} />
              {item.buyer.phone || "Não informado"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Mail size={13} />
              {item.buyer.email}
            </span>
          </div>
        </div>
      </div>
      <div className={styles.cardFields}>
        <Metric label="Campanha" value={item.campaign.title} />
        <Metric label="Quantidade" value={`${item.quantity} cotas`} />
        <Metric label="Valor" value={money.format(item.total)} strong />
        <Metric
          label="Pagamento"
          value={paymentLabel(payment?.method)}
        />
        <Metric label="Data e hora" value={dateTime.format(when)} />
        <Metric
          label="Origem / afiliado"
          value={affiliateLabel(item)}
        />
      </div>
      <div className={styles.cardActions}><OrderActions item={item} {...props} /></div>
    </article>
  );
}

function OrderActions({ item, open, copy, setMessage, hideOpen = false }: OrderViewProps & { hideOpen?: boolean }) {
  const payment = item.payments[0];
  return (
    <>
      {!hideOpen && <Action icon={Eye} label="Abrir detalhes" onClick={open} />}
      <Action icon={Clipboard} label="Copiar pedido" onClick={() => void copy(item.id, "Número do pedido")} />
      <Action
        icon={WalletCards}
        label={payment?.method === "PIX" ? "Pix: código protegido" : "Copiar Pix"}
        disabled={payment?.method !== "PIX"}
        onClick={() => setMessage("O código Pix é protegido e fica disponível somente no pagamento do comprador.")}
      />
      <Action icon={FileText} label="Ver comprovante" disabled />
      <Link
        href={`/dashboard/comunicacao?contact=${encodeURIComponent(item.buyer.email)}`}
        className={actionClass}
      >
        <Contact size={14} aria-hidden="true" /> Entrar em contato
      </Link>
      <Action icon={History} label="Histórico" onClick={open} />
    </>
  );
}

function OrderDrawer({ state, close }: { state: OrderDrawerState; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  function dismiss() {
    ref.current?.close();
    close();
  }

  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-label="Detalhes do pedido"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => { if (event.target === event.currentTarget) dismiss(); }}
    >
      <div className={styles.drawerContent}>
        <button type="button" aria-label="Fechar detalhes" className={styles.drawerClose} onClick={dismiss}>
          <X size={20} aria-hidden="true" />
        </button>
        {state.loading ? (
          <div className={styles.loading} role="status">
            <LoaderCircle aria-hidden="true" /> Carregando detalhes…
          </div>
        ) : <OrderDrawerContents data={state.order} />}
      </div>
    </dialog>
  );
}

function OrderDrawerContents({ data }: { data: Record<string, unknown> }) {
  const buyer = (data.buyer ?? {}) as Record<string, unknown>;
  const campaign = (data.campaign ?? {}) as Record<string, unknown>;
  const payments = (data.payments ?? []) as Array<Record<string, unknown>>;
  const tickets = Number(((data._count ?? {}) as Record<string, unknown>).tickets || 0);
  const payment = payments[0];
  const approved = payments.find((entry) => String(entry.status) === "APPROVED");
  const created = new Date(String(data.createdAt));
  const events = payments
    .flatMap((p) => (p.events ?? []) as Array<Record<string, unknown>>)
    .sort(
      (a, b) =>
        new Date(String(a.createdAt)).getTime() -
        new Date(String(b.createdAt)).getTime(),
    );
  return (
    <>
      <header className={styles.drawerHeader}>
        <p className={styles.eyebrow}>{orderId(String(data.id))}</p>
        <h2 className={styles.drawerTitle}>{String(campaign.title || "Detalhes")}</h2>
        <p className={styles.muted}>{String(buyer.name || "")} · {money.format(Number(data.total || 0))}</p>
      </header>
        <section className="mt-7">
          <h3 className="font-black">Linha do tempo</h3>
          <div className="mt-4 space-y-0">
            <Timeline label="Reserva criada" date={created} />
            <Timeline
              label="Pagamento iniciado"
              date={payment ? new Date(String(payment.createdAt)) : undefined}
            />
            <Timeline
              label="Pagamento aprovado"
              date={
                approved?.approvedAt
                  ? new Date(String(approved.approvedAt))
                  : undefined
              }
            />
            <Timeline
              label="Bilhetes gerados"
              recorded={tickets ? `${tickets} emitidos (horário não informado)` : undefined}
              last
            />
          </div>
        </section>
        <section className={styles.cardFields}>
          <Metric
            label="Afiliado"
            value={String(
              (data.affiliateConversion as Record<string, unknown> | undefined)
                ?.affiliate || "Não registrado",
            )}
          />
          <Metric label="Origem" value="Plataforma SorteX" />
          <Metric label="IP" value="Protegido" />
          <Metric label="Dispositivo" value="Não registrado" />
        </section>
        <section className="mt-7">
          <h3 className="font-black">Histórico completo</h3>
          <div className="mt-3 space-y-2">
            {events.length ? (
              events.map((event) => (
                <div
                  key={String(event.id)}
                  className="rounded-xl border p-3 text-sm"
                >
                  <b>{translateEvent(String(event.eventType))}</b>
                  <span className={styles.muted}>
                    {dateTime.format(new Date(String(event.createdAt)))}
                  </span>
                </div>
              ))
            ) : (
              <p className={styles.muted}>
                Nenhum evento adicional registrado.
              </p>
            )}
          </div>
        </section>
        <section className="mt-7">
          <h3 className="font-black">Observações</h3>
          <p className={styles.muted}>
            Nenhuma observação registrada para este pedido.
          </p>
        </section>
    </>
  );
}

function ExportMenu({ items, enabled }: { items: OrganizerOrder[]; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () =>
      items.map((item) => [
        item.id,
        item.buyer.name,
        item.buyer.email,
        item.campaign.title,
        item.quantity,
        item.total,
        statusLabels[item.status] || item.status,
        methodLabels[item.payments[0]?.method] ||
          item.payments[0]?.method ||
          "",
        dateTime.format(new Date(item.createdAt)),
      ]),
    [items],
  );
  function exportFile(kind: "csv" | "xls") {
    if (!enabled) return;
    const header = [
      "Pedido",
      "Comprador",
      "E-mail",
      "Campanha",
      "Quantidade",
      "Valor",
      "Status",
      "Método",
      "Data",
    ];
    const separator = kind === "csv" ? ";" : "\t";
    const content = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(separator),
      )
      .join("\n");
    const blob = new Blob(["\ufeff", content], {
      type:
        kind === "csv"
          ? "text/csv;charset=utf-8"
          : "application/vnd.ms-excel;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pedidos-sortex.${kind}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }
  return (
    <div className="relative">
      <button
        type="button"
        disabled={!enabled}
        aria-expanded={enabled && open}
        onClick={() => setOpen((value) => !value)}
        className={styles.primary}
      >
        <Download size={17} />
        Exportar
      </button>
      {enabled && open && (
        <div className={styles.exportMenu}>
          <p className={styles.muted}>Exportar a página atual</p>
          <button onClick={() => exportFile("csv")} className={exportOption}>
            <FileText size={16} />
            CSV
          </button>
          <button onClick={() => exportFile("xls")} className={exportOption}>
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <button
            onClick={() => {
              setOpen(false);
              window.print();
            }}
            className={exportOption}
          >
            <ReceiptText size={16} />
            PDF / Imprimir
          </button>
        </div>
      )}
    </div>
  );
}
function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <section className={styles.empty}>
      <span className={styles.emptyIcon}>
        <PackageOpen size={38} />
      </span>
      <h2 className="mt-6 text-xl font-black">
        {filtered
          ? "Nenhum pedido encontrado."
          : "Você ainda não possui pedidos."}
      </h2>
      <p className={styles.muted}>
        {filtered
          ? "Revise ou limpe os filtros para visualizar outros resultados."
          : "Assim que alguém comprar títulos da sua campanha, eles aparecerão aqui automaticamente."}
      </p>
      <Link
        href="/dashboard/campanhas"
        className={styles.primary}
      >
        Ir para campanhas
      </Link>
    </section>
  );
}
function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className={styles.empty}>
      <p className={styles.error} role="alert">{message}</p>
      <button
        onClick={retry}
        className={styles.controlButton}
      >
        Tentar novamente
      </button>
    </div>
  );
}
function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles.filterChip}
    >
      {label}
    </button>
  );
}
function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className={styles.filterLabel}>
      {children}
    </span>
  );
}
function Action({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: typeof Eye;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Ainda não disponível para este pedido" : undefined}
      className={actionClass}
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
function Metric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={styles.metric}>
      <span>
        {label}
      </span>
      <span data-strong={strong || undefined}>
        {value}
      </span>
    </div>
  );
}
function Timeline({
  label,
  date,
  recorded,
  last = false,
}: {
  label: string;
  date?: Date;
  recorded?: string;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-3 pb-5">
      <span
        className={styles.timelineDot} data-recorded={Boolean(date || recorded)}
      />
      {!last && (
        <span className={styles.timelineLine} />
      )}
      <div>
        <b className="text-sm">
          {label}
        </b>
        <span className={styles.muted}>
          {date ? dateTime.format(date) : recorded ?? "Sem registro"}
        </span>
      </div>
    </div>
  );
}
function iso(value: Date) {
  return value.toISOString().slice(0, 10);
}
function translateEvent(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}
const control = styles.control;
const smallControl = `${styles.control} ${styles.smallControl}`;
const actionClass = styles.action;
const exportOption = styles.exportOption;
const pageButton = styles.controlButton;
