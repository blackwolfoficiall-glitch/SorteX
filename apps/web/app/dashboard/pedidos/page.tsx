"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
const initialSummary: OrderSummary = {
  approvedSales: 0,
  pendingReservations: 0,
  ordersToday: 0,
  periodRevenue: 0,
  comparison: 0,
};
const statusLabels: Record<string, string> = {
  PENDING: "Pendente",
  RESERVED: "Reservado",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
};
const statusClasses: Record<string, string> = {
  PENDING: "bg-blue-50 text-blue-700",
  RESERVED: "bg-amber-50 text-amber-700",
  AWAITING_PAYMENT: "bg-blue-50 text-blue-700",
  PAID: "bg-emerald-50 text-emerald-700",
  EXPIRED: "bg-zinc-100 text-zinc-600",
  CANCELLED: "bg-red-50 text-red-700",
  REFUNDED: "bg-violet-50 text-violet-700",
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

export default function PedidosPage() {
  const [items, setItems] = useState<OrganizerOrder[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(25);
  const [summary, setSummary] = useState<OrderSummary>(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      });
      const result = await listOrders(`?${params}`);
      setItems(result.items);
      setPages(result.pages);
      setTotal(result.total);
      setSummary(result.summary ?? initialSummary);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os pedidos.",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, limit, page]);

  useEffect(() => {
    void getMyCampaigns()
      .then(setCampaigns)
      .catch(() => setCampaigns([]));
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), filters.search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.search]);

  function change(patch: Partial<Filters>) {
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
    setDrawerLoading(true);
    setSelected({});
    try {
      setSelected(await getOrder(id));
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Não foi possível abrir o pedido.",
      );
      setSelected(null);
    } finally {
      setDrawerLoading(false);
    }
  }
  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setMessage(`${label} copiado com sucesso.`);
  }

  const comparison = summary.comparison;
  const cards = [
    {
      label: "Vendas aprovadas",
      value: money.format(summary.approvedSales),
      icon: CheckCircle2,
      tone: "emerald",
    },
    {
      label: "Reservas pendentes",
      value: summary.pendingReservations.toLocaleString("pt-BR"),
      icon: Clock3,
      tone: "amber",
    },
    {
      label: "Pedidos hoje",
      value: summary.ordersToday.toLocaleString("pt-BR"),
      icon: ShoppingBag,
      tone: "blue",
    },
    {
      label: "Receita do período",
      value: money.format(summary.periodRevenue),
      icon: CircleDollarSign,
      tone: "violet",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
            Vendas e reservas
          </p>
          <h1 className="mt-2 text-3xl font-black">Pedidos</h1>
          <p className="mt-2 text-zinc-500">
            Acompanhe cada etapa sem alterar manualmente o status dos
            pagamentos.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu items={items} />
          <button
            onClick={() => void load()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-4 font-bold shadow-sm"
          >
            <RefreshCcw size={17} />
            Atualizar
          </button>
        </div>
      </header>

      {message && (
        <div
          role="status"
          className="flex items-center justify-between rounded-2xl bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800"
        >
          <span>{message}</span>
          <button onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <article
            key={label}
            className="group rounded-3xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <div
                className={`grid h-11 w-11 place-items-center rounded-2xl ${toneClass(tone)}`}
              >
                <Icon size={21} />
              </div>
              <span
                className={`inline-flex items-center gap-1 text-xs font-bold ${comparison < 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {comparison < 0 ? (
                  <TrendingDown size={14} />
                ) : (
                  <TrendingUp size={14} />
                )}{" "}
                {comparison >= 0 ? "+" : ""}
                {comparison.toFixed(1)}%
              </span>
            </div>
            <p className="mt-5 text-sm font-semibold text-zinc-500">{label}</p>
            <strong className="mt-1 block text-2xl font-black">{value}</strong>
            <p className="mt-2 text-xs text-zinc-400">
              em relação ao período anterior
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center gap-2 text-sm font-black">
          <SlidersHorizontal size={18} className="text-violet-600" />
          Filtros
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="xl:col-span-2">
            <FilterLabel>Busca</FilterLabel>
            <span className="relative block">
              <Search
                className="absolute left-3 top-3 text-zinc-400"
                size={18}
              />
              <input
                value={filters.search}
                onChange={(e) => change({ search: e.target.value })}
                placeholder="Comprador, telefone ou e-mail"
                className={`${control} pl-10`}
              />
            </span>
          </label>
          <label>
            <FilterLabel>Campanha</FilterLabel>
            <select
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
          <label>
            <FilterLabel>Método de pagamento</FilterLabel>
            <select
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
          <div className="grid gap-3 sm:grid-cols-2 xl:col-span-2">
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
              setPage(1);
            }}
            className="ml-auto rounded-full px-3 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100"
          >
            Limpar filtros
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          <b className="text-zinc-900">{total}</b> pedidos encontrados
        </p>
        <div className="flex gap-2">
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
        <ErrorState message={error} retry={() => void load()} />
      ) : loading ? (
        <div className="grid h-64 place-items-center">
          <LoaderCircle className="animate-spin text-violet-600" />
        </div>
      ) : items.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <OrderCard
              key={item.id}
              item={item}
              open={() => void openDetails(item.id)}
              copy={copy}
              setMessage={setMessage}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          filtered={Object.entries(filters).some(
            ([key, value]) => key !== "sort" && Boolean(value),
          )}
        />
      )}

      {!loading && items.length > 0 && (
        <nav
          aria-label="Paginação"
          className="flex items-center justify-center gap-3"
        >
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
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
            onClick={() => setPage((value) => value + 1)}
            className={pageButton}
          >
            Próxima
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
      {selected && (
        <OrderDrawer
          data={selected}
          loading={drawerLoading}
          close={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function OrderCard({
  item,
  open,
  copy,
  setMessage,
}: {
  item: OrganizerOrder;
  open: () => void;
  copy: (text: string, label: string) => Promise<void>;
  setMessage: (value: string) => void;
}) {
  const payment = item.payments[0];
  const when = new Date(item.createdAt);
  const initials = item.buyer.name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <article className="group rounded-3xl border bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-100 font-black text-violet-700">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="truncate font-black">{item.buyer.name}</h2>
              <p className="text-xs text-zinc-400">
                Pedido #{item.id.slice(-8).toUpperCase()}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${statusClasses[item.status] || "bg-zinc-100 text-zinc-700"}`}
            >
              {statusLabels[item.status] || item.status}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
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
      <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-4 text-sm sm:grid-cols-3">
        <Metric label="Campanha" value={item.campaign.title} />
        <Metric label="Quantidade" value={`${item.quantity} cotas`} />
        <Metric label="Valor" value={money.format(item.total)} strong />
        <Metric
          label="Pagamento"
          value={
            methodLabels[payment?.method] || payment?.method || "Não iniciado"
          }
        />
        <Metric label="Data e hora" value={dateTime.format(when)} />
        <Metric
          label="Origem / afiliado"
          value={item.affiliateConversion?.affiliate.name || "Direto"}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Action icon={Eye} label="Abrir detalhes" onClick={open} />
        <Action
          icon={Clipboard}
          label="Copiar pedido"
          onClick={() => void copy(item.id, "Número do pedido")}
        />
        <Action
          icon={WalletCards}
          label="Copiar Pix"
          disabled={payment?.method !== "PIX"}
          onClick={() =>
            setMessage(
              "O código Pix é protegido e fica disponível somente no pagamento do comprador.",
            )
          }
        />
        <Action icon={FileText} label="Ver comprovante" disabled />
        <Link
          href={`/dashboard/comunicacao?contact=${encodeURIComponent(item.buyer.email)}`}
          className={actionClass}
        >
          <Contact size={14} />
          Entrar em contato
        </Link>
        <Action icon={History} label="Histórico" onClick={open} />
      </div>
    </article>
  );
}

function OrderDrawer({
  data,
  loading,
  close,
}: {
  data: Record<string, unknown>;
  loading: boolean;
  close: () => void;
}) {
  if (loading)
    return (
      <div className="fixed inset-0 z-[70] grid place-items-center bg-black/30">
        <LoaderCircle className="animate-spin text-white" />
      </div>
    );
  const buyer = (data.buyer ?? {}) as Record<string, unknown>;
  const campaign = (data.campaign ?? {}) as Record<string, unknown>;
  const payments = (data.payments ?? []) as Array<Record<string, unknown>>;
  const tickets = Array.from({
    length: Number(
      ((data._count ?? {}) as Record<string, unknown>).tickets || 0,
    ),
  });
  const payment = payments[0];
  const created = new Date(String(data.createdAt));
  const events = payments
    .flatMap((p) => (p.events ?? []) as Array<Record<string, unknown>>)
    .sort(
      (a, b) =>
        new Date(String(a.createdAt)).getTime() -
        new Date(String(b.createdAt)).getTime(),
    );
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/35"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes do pedido"
    >
      <button
        aria-label="Fechar detalhes"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={close}
      />
      <aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-violet-600">
              Pedido #{String(data.id).slice(-8).toUpperCase()}
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {String(campaign.title || "Detalhes")}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {String(buyer.name || "")} ·{" "}
              {money.format(Number(data.total || 0))}
            </p>
          </div>
          <button onClick={close} className="rounded-xl border p-2">
            <X />
          </button>
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
                String(payment?.status) === "APPROVED"
                  ? new Date(String(payment.createdAt))
                  : undefined
              }
            />
            <Timeline
              label="Bilhetes gerados"
              date={tickets.length ? created : undefined}
              last
            />
          </div>
        </section>
        <section className="mt-7 grid gap-3 rounded-2xl bg-zinc-50 p-4 sm:grid-cols-2">
          <Metric
            label="Afiliado"
            value={String(
              (data.affiliateConversion as Record<string, unknown> | undefined)
                ?.affiliate || "Direto",
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
                  <span className="mt-1 block text-xs text-zinc-500">
                    {dateTime.format(new Date(String(event.createdAt)))}
                  </span>
                </div>
              ))
            ) : (
              <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
                Nenhum evento adicional registrado.
              </p>
            )}
          </div>
        </section>
        <section className="mt-7">
          <h3 className="font-black">Observações</h3>
          <p className="mt-2 rounded-xl border p-4 text-sm text-zinc-500">
            Nenhuma observação registrada para este pedido.
          </p>
        </section>
      </aside>
    </div>
  );
}

function ExportMenu({ items }: { items: OrganizerOrder[] }) {
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
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-950 px-4 font-bold text-white"
      >
        <Download size={17} />
        Exportar
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-20 w-44 rounded-2xl border bg-white p-2 shadow-xl">
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
    <section className="rounded-3xl border bg-white px-6 py-16 text-center shadow-sm">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-violet-50 text-violet-600">
        <PackageOpen size={38} />
      </span>
      <h2 className="mt-6 text-xl font-black">
        {filtered
          ? "Nenhum pedido encontrado."
          : "Você ainda não possui pedidos."}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500">
        {filtered
          ? "Revise ou limpe os filtros para visualizar outros resultados."
          : "Assim que alguém comprar títulos da sua campanha, eles aparecerão aqui automaticamente."}
      </p>
      <Link
        href="/dashboard/campanhas"
        className="mt-6 inline-flex h-11 items-center rounded-xl bg-violet-700 px-5 font-bold text-white"
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
    <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center text-red-700">
      <p>{message}</p>
      <button
        onClick={retry}
        className="mt-4 rounded-xl bg-red-700 px-4 py-2 font-bold text-white"
      >
        Tentar novamente
      </button>
    </div>
  );
}
function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border bg-white px-3 py-2 text-xs font-bold text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
    >
      {label}
    </button>
  );
}
function FilterLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-xs font-bold text-zinc-600">
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
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Ainda não disponível para este pedido" : undefined}
      className={actionClass}
    >
      <Icon size={14} />
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
    <div className="min-w-0">
      <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <span
        className={`mt-1 block truncate text-xs ${strong ? "font-black text-zinc-950" : "font-semibold text-zinc-700"}`}
      >
        {value}
      </span>
    </div>
  );
}
function Timeline({
  label,
  date,
  last = false,
}: {
  label: string;
  date?: Date;
  last?: boolean;
}) {
  return (
    <div className="relative flex gap-3 pb-5">
      <span
        className={`relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full ${date ? "bg-emerald-500" : "bg-zinc-200"}`}
      />
      {!last && (
        <span className="absolute left-[5px] top-4 h-full w-px bg-zinc-200" />
      )}
      <div>
        <b className={`text-sm ${date ? "text-zinc-900" : "text-zinc-400"}`}>
          {label}
        </b>
        <span className="block text-xs text-zinc-400">
          {date ? dateTime.format(date) : "Ainda não ocorreu"}
        </span>
      </div>
    </div>
  );
}
function toneClass(tone: string) {
  return (
    {
      emerald: "bg-emerald-50 text-emerald-600",
      amber: "bg-amber-50 text-amber-600",
      blue: "bg-blue-50 text-blue-600",
      violet: "bg-violet-50 text-violet-600",
    }[tone] || "bg-zinc-50"
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
const control =
  "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100";
const smallControl =
  "h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold";
const actionClass =
  "inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-600 transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-not-allowed disabled:opacity-40";
const exportOption =
  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-zinc-50";
const pageButton =
  "inline-flex items-center gap-1 rounded-xl border bg-white px-4 py-2 text-sm font-bold disabled:opacity-40";
