"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  Clock3,
  Copy,
  Crown,
  Edit3,
  Filter,
  Gift,
  Grid2X2,
  History,
  ImageIcon,
  LayoutList,
  LoaderCircle,
  Megaphone,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  Table2,
  Trash2,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import { AuthApiError, authRequest } from "@/lib/auth/client";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import {
  getExpiredInstantPrizeAlerts,
  markExpiredInstantPrizeViewed,
  type ExpiredInstantPrizeAlert,
} from "@/lib/purchases/client";
import {
  createPrizeTickets,
  getPrizeTicketSummary,
  listPrizeTickets,
  prizeTicketAction,
  prizeTicketHistory,
  updatePrizeTicket,
  type PrizeHistoryItem,
  type PrizeTicket,
  type PrizeTicketSummary,
} from "@/lib/prizes/client";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
type PrizeView = "all" | "available" | "reserved" | "found" | "paused" | "expired" | "delivered" | "winners";
const statusCards = [
  { key: "all", label: "Todas", description: "Todas as cotas premiadas", icon: Gift },
  { key: "available", label: "Disponíveis", description: "Prontas para serem encontradas", icon: Crown },
  { key: "reserved", label: "Reservadas", description: "Aguardando confirmação de pagamento", icon: Clock3 },
  { key: "found", label: "Encontradas", description: "Pagamento aprovado e prêmio identificado", icon: Trophy },
  { key: "paused", label: "Pausadas", description: "Temporariamente indisponíveis", icon: Pause },
  { key: "expired", label: "Expiradas", description: "Retornaram ao estoque", icon: AlertTriangle },
  { key: "delivered", label: "Entregues", description: "Prêmios com entrega concluída", icon: Check },
] as const;
const sectionCopy: Record<PrizeView, { title: string; description: string; empty: string }> = {
  all: { title: "Todas as cotas premiadas", description: "Visão completa dos números premiados do organizador.", empty: "Nenhuma cota premiada foi cadastrada." },
  available: { title: "Cotas disponíveis", description: "Números premiados ativos e disponíveis para novos compradores.", empty: "Nenhuma cota premiada está disponível." },
  reserved: { title: "Cotas reservadas", description: "Números vinculados temporariamente a reservas que ainda aguardam pagamento.", empty: "Nenhuma cota premiada está reservada neste momento." },
  found: { title: "Cotas encontradas", description: "Números premiados confirmados após o pagamento aprovado.", empty: "Nenhuma cota premiada foi encontrada." },
  paused: { title: "Cotas pausadas", description: "Números temporariamente indisponíveis para novas compras.", empty: "Nenhuma cota premiada está pausada." },
  expired: { title: "Cotas retornadas ao estoque", description: "Números que estavam em reservas não pagas e retornaram ao estoque.", empty: "Nenhuma cota premiada retornou ao estoque." },
  delivered: { title: "Prêmios entregues", description: "Cotas encontradas cuja entrega já foi concluída.", empty: "Nenhum prêmio foi marcado como entregue." },
  winners: { title: "Ganhadores de sorteios", description: "Ganhadores registrados nos sorteios das campanhas.", empty: "Nenhum ganhador registrado." },
};
const prizeTypes: Record<string, string> = {
  PIX: "Pix",
  PRODUCT: "Produto",
  GIFT_CARD: "Vale-presente",
  OTHER: "Outro",
};
const statusLabels: Record<string, string> = {
  AVAILABLE: "Disponível",
  FOUND: "Encontrada",
  DELIVERED: "Entregue",
  CANCELLED: "Pausada",
  IDENTIFIED: "Aguardando contato",
  NOTIFIED: "Contato realizado",
  CLAIMED: "Entrega agendada",
  DISPUTED: "Em análise",
};
const actionLabels: Record<string, string> = {
  INSTANT_PRIZES_CREATED: "Cota criada",
  INSTANT_PRIZE_UPDATED: "Cota editada",
  INSTANT_PRIZE_PAUSE: "Cota pausada",
  INSTANT_PRIZE_REACTIVATE: "Cota reativada",
  INSTANT_PRIZE_DELIVER: "Prêmio entregue",
  INSTANT_PRIZE_REMOVED: "Cota removida",
};

type OrganizerWinner = {
  id: string;
  winningNumber: string;
  prizeName: string;
  prizeValue: number | null;
  status: string;
  createdAt: string;
  deliveredAt: string | null;
  publicDisclosureAuthorized: boolean;
  campaign: { id: string; title: string; slug: string };
  buyer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
  };
};
type FormState = {
  campaignId: string;
  mode: "MANUAL" | "RANDOM" | "IMPORT";
  numbers: string;
  randomCount: string;
  description: string;
  details: string;
  value: string;
  type: string;
  instructions: string;
  activate: boolean;
};
const emptyForm = (): FormState => ({
  campaignId: "",
  mode: "MANUAL",
  numbers: "",
  randomCount: "1",
  description: "",
  details: "",
  value: "",
  type: "PIX",
  instructions: "",
  activate: true,
});

export default function PrizeTicketsCenter() {
  const [prizes, setPrizes] = useState<PrizeTicket[]>([]),
    [expired, setExpired] = useState<ExpiredInstantPrizeAlert[]>([]),
    [winners, setWinners] = useState<OrganizerWinner[]>([]),
    [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summary, setSummary] = useState<PrizeTicketSummary | null>(null),
    [total, setTotal] = useState(0),
    [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState<"" | "SESSION" | "FORBIDDEN" | "NETWORK">(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<PrizeView>("all"),
    [campaignId, setCampaignId] = useState(""),
    [type, setType] = useState(""),
    [period, setPeriod] = useState(""),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("newest"),
    [page, setPage] = useState(1),
    [view, setView] = useState<"cards" | "table" | "compact">("cards"),
    [filtersOpen, setFiltersOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const filtersReady = useRef(false);
  const [wizard, setWizard] = useState(false),
    [step, setStep] = useState(1),
    [form, setForm] = useState<FormState>(emptyForm()),
    [editing, setEditing] = useState<PrizeTicket | null>(null);
  const [history, setHistory] = useState<{
      title: string;
      items: PrizeHistoryItem[];
    } | null>(null),
    [material, setMaterial] = useState<{
      ticket?: PrizeTicket;
      winner?: OrganizerWinner;
    } | null>(null);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const apiStatus = ["expired", "winners"].includes(selectedStatus) ? "all" : selectedStatus;
      const startDate = period ? new Date(Date.now() - Number(period) * 86400000).toISOString() : undefined;
      const [ticketPage, counters, returned, winnerRows, ownCampaigns] = await Promise.all([
        listPrizeTickets({ status: apiStatus, campaignId, search, type, startDate, sort, page, limit: 25 }),
        getPrizeTicketSummary(campaignId),
        getExpiredInstantPrizeAlerts(),
        authRequest<OrganizerWinner[]>("/api/draws/winners/organizer", {
          cache: "no-store",
        }),
        getMyCampaigns(),
      ]);
      setPrizes(ticketPage.items);
      setTotal(ticketPage.total);
      setPages(ticketPage.pages);
      setSummary(counters);
      setExpired(returned);
      setWinners(winnerRows);
      setCampaigns(ownCampaigns);
      setForm((current) => ({
        ...current,
        campaignId:
          current.campaignId ||
          ownCampaigns.find((item) => item.status === "PUBLISHED")?.id ||
          "",
      }));
    } catch (cause) {
      if (cause instanceof AuthApiError && cause.status === 401)
        setError("SESSION");
      else if (cause instanceof AuthApiError && cause.status === 403)
        setError("FORBIDDEN");
      else setError("NETWORK");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const applyUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const candidate = params.get("status") as PrizeView | null;
      setSelectedStatus(
        candidate && [...statusCards.map((item) => item.key), "winners"].includes(candidate)
          ? candidate
          : "all",
      );
      setCampaignId(params.get("campaign") || "");
      setSearch(params.get("search") || "");
      setType(params.get("type") || "");
      setPeriod(params.get("period") || "");
      setSort(params.get("sort") || "newest");
      setPage(Math.max(1, Number(params.get("page")) || 1));
      filtersReady.current = true;
    };
    applyUrl();
    window.addEventListener("popstate", applyUrl);
    return () => window.removeEventListener("popstate", applyUrl);
  }, []);
  useEffect(() => {
    if (!filtersReady.current) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
    // A alteração dos filtros é o gatilho deliberado desta consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, campaignId, search, type, period, sort, page]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 20000);
    return () => window.clearInterval(timer);
  });

  const filteredPrizes = prizes;
  const filteredExpired = useMemo(
    () =>
      expired.filter(
        (item) =>
          (!campaignId || item.campaignId === campaignId) &&
          (!search || item.winningNumber.includes(search)) &&
          matchesPeriod(item.expiredAt, period),
      ),
    [expired, campaignId, search, period],
  );
  const filteredWinners = useMemo(
    () =>
      winners.filter(
        (item) =>
          (!campaignId || item.campaign.id === campaignId) &&
          (!search || item.winningNumber.includes(search)) &&
          matchesPeriod(item.createdAt, period),
      ),
    [winners, campaignId, search, period],
  );

  function syncUrl(next: Partial<{ status: PrizeView; campaign: string; search: string; type: string; period: string; sort: string; page: number }>, push = false) {
    const values = { status: selectedStatus, campaign: campaignId, search, type, period, sort, page, ...next };
    const params = new URLSearchParams();
    if (values.status !== "all") params.set("status", values.status);
    if (values.campaign) params.set("campaign", values.campaign);
    if (values.search) params.set("search", values.search);
    if (values.type) params.set("type", values.type);
    if (values.period) params.set("period", values.period);
    if (values.sort !== "newest") params.set("sort", values.sort);
    if (values.page > 1) params.set("page", String(values.page));
    const url = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history[push ? "pushState" : "replaceState"]({}, "", url);
  }
  function selectStatus(value: PrizeView) {
    setSelectedStatus(value);
    setPage(1);
    syncUrl({ status: value, page: 1 }, true);
    requestAnimationFrame(() => {
      document.querySelector(`[data-status-card="${value}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  function clearFilters() {
    setSelectedStatus("all"); setCampaignId(""); setSearch(""); setType(""); setPeriod(""); setSort("newest"); setPage(1);
    window.history.pushState({}, "", window.location.pathname);
  }

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm(),
      campaignId:
        campaigns.find((item) => item.status === "PUBLISHED")?.id || "",
    });
    setStep(1);
    setWizard(true);
  }
  function openEdit(item: PrizeTicket) {
    setEditing(item);
    setForm({
      ...emptyForm(),
      campaignId: item.campaign.id,
      numbers: item.exactNumber || "",
      description: item.description,
      value: String(item.value),
      type: item.type,
      instructions: item.instructions || "",
      activate: item.status === "AVAILABLE",
    });
    setStep(3);
    setWizard(true);
  }
  function resolvedNumbers() {
    const campaign = campaigns.find((item) => item.id === form.campaignId);
    if (form.mode === "RANDOM" && campaign) {
      const result = new Set<number>();
      const limit = Math.min(Number(form.randomCount) || 1, 100);
      while (result.size < limit)
        result.add(
          crypto.getRandomValues(new Uint32Array(1))[0] % campaign.totalNumbers,
        );
      return [...result].map(String);
    }
    return form.numbers
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  async function save(activate: boolean) {
    if (busy) return;
    setBusy("save");
    try {
      if (editing)
        await updatePrizeTicket(editing.id, {
          description: form.description,
          instructions: form.instructions,
          value: Number(form.value) || 0,
          type: form.type,
        });
      else
        await createPrizeTickets({
          campaignId: form.campaignId,
          numbers: resolvedNumbers(),
          description: form.description,
          instructions: form.instructions,
          value: Number(form.value) || 0,
          type: form.type,
          origin: form.mode,
          activate,
        });
      setNotice(
        editing
          ? "Cota premiada atualizada."
          : activate
            ? "Cota premiada ativada."
            : "Cota premiada salva inicialmente como pausada.",
      );
      setWizard(false);
      await load();
    } catch (cause) {
      setNotice(friendly(cause, "Não foi possível salvar a cota premiada."));
    } finally {
      setBusy("");
    }
  }
  async function action(item: PrizeTicket, operation: string) {
    if (busy) return;
    if (
      ["pause", "remove", "deliver"].includes(operation) &&
      !confirm(
        operation === "remove"
          ? "Remover esta cota premiada?"
          : "Confirmar esta alteração?",
      )
    )
      return;
    setBusy(item.id + operation);
    try {
      await prizeTicketAction(item.id, operation);
      setNotice(
        operation === "pause"
          ? "Cota pausada."
          : operation === "reactivate"
            ? "Cota reativada."
            : operation === "deliver"
              ? "Prêmio marcado como entregue."
              : "Cota removida.",
      );
      await load();
    } catch (cause) {
      setNotice(friendly(cause, "Não foi possível concluir a ação."));
    } finally {
      setBusy("");
    }
  }
  async function openHistory(item: PrizeTicket) {
    setBusy(item.id + "history");
    try {
      setHistory({
        title: `Histórico da cota ${item.exactNumber}`,
        items: await prizeTicketHistory(item.id),
      });
    } catch {
      setNotice("Não foi possível carregar o histórico.");
    } finally {
      setBusy("");
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Número copiado com sucesso.");
    } catch {
      setNotice(
        "Não foi possível copiar automaticamente. Selecione o número manualmente.",
      );
    }
  }

  if (error) return <ErrorState kind={error} retry={() => void load()} />;
  return (
    <main className="mx-auto w-full max-w-[1500px] overflow-x-hidden pb-16">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
            Prêmios instantâneos
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            Cotas premiadas
          </h1>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Gerencie números premiados, acompanhe vencedores e monitore reservas
            expiradas.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 font-black text-white transition hover:bg-violet-700 active:scale-[.98]"
        >
          <Plus size={18} /> Adicionar cota premiada
        </button>
      </header>
      <section className="mt-7" aria-labelledby="prize-overview-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 id="prize-overview-title" className="text-xl font-black">Visão geral das cotas</h2>
            <p className="mt-1 text-sm text-zinc-500">Selecione um indicador para filtrar a listagem.</p>
          </div>
          <button onClick={() => selectStatus("winners")} className="hidden rounded-xl border bg-white px-4 py-2 text-sm font-bold hover:border-violet-400 md:block">
            Ganhadores de sorteios
          </button>
        </div>
        <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 xl:grid-cols-7">
          {statusCards.map((card) => (
            <StatusFilterCard
              key={card.key}
              dataStatus={card.key}
              icon={card.icon}
              label={card.label}
              description={card.description}
              value={summary?.[card.key]}
              loading={loading && !summary}
              active={selectedStatus === card.key}
              click={() => selectStatus(card.key)}
            />
          ))}
        </div>
        <button onClick={() => selectStatus("winners")} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm font-bold md:hidden">
          Ver ganhadores de sorteios
        </button>
      </section>
      {notice && (
        <div
          role="status"
          className="mt-4 flex items-center justify-between rounded-2xl bg-violet-50 p-4 text-sm font-bold text-violet-800"
        >
          <span>{notice}</span>
          <button aria-label="Fechar mensagem" onClick={() => setNotice("")}>
            <X size={17} />
          </button>
        </div>
      )}
      <section className="mt-6 rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between md:hidden">
          <b>Filtros</b>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex min-h-10 items-center gap-2 rounded-xl border px-3 font-bold"
          >
            <Filter size={16} />
            {filtersOpen ? "Fechar" : "Abrir"}
          </button>
        </div>
        <div
          className={`${filtersOpen ? "grid" : "hidden"} mt-4 gap-3 md:mt-0 md:grid md:grid-cols-6`}
        >
          <Select
            value={campaignId}
            set={(value) => { setCampaignId(value); setPage(1); syncUrl({ campaign: value, page: 1 }); }}
            options={[
              ["", "Todas as campanhas"],
              ...campaigns.map((item) => [item.id, item.title]),
            ]}
          />
          <Select
            value={type}
            set={(value) => { setType(value); setPage(1); syncUrl({ type: value, page: 1 }); }}
            options={[["", "Todos os prêmios"], ...Object.entries(prizeTypes)]}
          />
          <Select
            value={period}
            set={(value) => { setPeriod(value); setPage(1); syncUrl({ period: value, page: 1 }); }}
            options={[
              ["", "Todo o período"],
              ["7", "Últimos 7 dias"],
              ["30", "Últimos 30 dias"],
              ["90", "Últimos 90 dias"],
            ]}
          />
          <Select
            value={sort}
            set={(value) => { setSort(value); setPage(1); syncUrl({ sort: value, page: 1 }); }}
            options={[["newest", "Mais recentes"], ["oldest", "Mais antigas"], ["number", "Número da cota"]]}
          />
          <label className="relative">
            <span className="sr-only">Buscar número</span>
            <Search
              size={17}
              className="absolute left-3 top-3.5 text-zinc-400"
            />
            <input
              value={search}
              onChange={(event) => { const value = event.target.value.replace(/\D/g, ""); setSearch(value); setPage(1); syncUrl({ search: value, page: 1 }); }}
              placeholder="Buscar número"
              className="h-11 w-full rounded-xl border pl-10 pr-3"
            />
          </label>
          <button onClick={clearFilters} className="h-11 rounded-xl border px-3 text-sm font-bold transition hover:border-violet-400 hover:text-violet-700">Limpar filtros</button>
        </div>
      </section>
      <div ref={listRef} className="scroll-mt-6 pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black">{sectionCopy[selectedStatus].title}</h2>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">{sectionCopy[selectedStatus].description}</p>
          </div>
          {!loading && !["expired", "winners"].includes(selectedStatus) && <span className="text-sm font-bold text-zinc-500">{total} {total === 1 ? "resultado" : "resultados"}</span>}
        </div>
      </div>
      {loading ? (
        <Skeleton />
      ) : (
        <>
          {["all", "available", "paused"].includes(selectedStatus) && (
            <>
              <div className="mt-5 flex items-center justify-end">
                <div className="flex rounded-xl border bg-white p-1">
                  <ViewButton
                    active={view === "cards"}
                    label="Cards"
                    icon={Grid2X2}
                    click={() => setView("cards")}
                  />
                  <ViewButton
                    active={view === "table"}
                    label="Tabela"
                    icon={Table2}
                    click={() => setView("table")}
                  />
                  <ViewButton
                    active={view === "compact"}
                    label="Grade"
                    icon={LayoutList}
                    click={() => setView("compact")}
                  />
                </div>
              </div>
              {filteredPrizes.length ? (
                <PrizeList
                  items={filteredPrizes}
                  view={view}
                  busy={busy}
                  edit={openEdit}
                  action={action}
                  copy={copy}
                  history={openHistory}
                  material={(ticket) => setMaterial({ ticket })}
                />
              ) : (
                <Empty
                  icon={Crown}
                  title={sectionCopy[selectedStatus].empty}
                  action="Adicionar cota premiada"
                  click={openCreate}
                />
              )}
            </>
          )}
          {selectedStatus === "reserved" &&
            (filteredPrizes.length ? (
              <section className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredPrizes.map((item) => <ReservedCard key={item.id} item={item} />)}
              </section>
            ) : <Empty icon={Clock3} title={sectionCopy.reserved.empty} />)}
          {["found", "delivered"].includes(selectedStatus) &&
            (filteredPrizes.length ? (
              <section className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredPrizes.map((item) => (
                  <FoundCard
                    key={item.id}
                    item={item}
                    busy={busy}
                    action={action}
                    history={openHistory}
                    material={() => setMaterial({ ticket: item })}
                  />
                ))}
              </section>
            ) : (
              <Empty
                icon={Trophy}
                title={sectionCopy[selectedStatus].empty}
              />
            ))}
          {selectedStatus === "expired" &&
            (filteredExpired.length ? (
              <section className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredExpired.map((item) => (
                  <ExpiredCard
                    key={item.id}
                    item={item}
                    copy={copy}
                    viewed={async () => {
                      await markExpiredInstantPrizeViewed(item.id);
                      setNotice("Alerta marcado como visualizado.");
                    }}
                  />
                ))}
              </section>
            ) : (
              <Empty
                icon={AlertTriangle}
                title="Nenhuma cota premiada retornou ao estoque."
              />
            ))}
          {selectedStatus === "winners" &&
            (filteredWinners.length ? (
              <section className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredWinners.map((item) => (
                  <WinnerCard
                    key={item.id}
                    item={item}
                    material={() => setMaterial({ winner: item })}
                  />
                ))}
              </section>
            ) : (
              <Empty icon={UserRound} title="Nenhum ganhador registrado." />
            ))}
          {!["expired", "winners"].includes(selectedStatus) && pages > 1 && (
            <Pagination page={page} pages={pages} change={(value) => { setPage(value); syncUrl({ page: value }, true); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
          )}
        </>
      )}
      {wizard && (
        <Wizard
          step={step}
          setStep={setStep}
          form={form}
          setForm={setForm}
          campaigns={campaigns}
          editing={Boolean(editing)}
          busy={busy === "save"}
          close={() => setWizard(false)}
          save={save}
        />
      )}
      {history && (
        <Drawer title={history.title} close={() => setHistory(null)}>
          {history.items.length ? (
            <div className="space-y-3">
              {history.items.map((item) => (
                <div key={item.id} className="rounded-2xl border p-4">
                  <b>{actionLabels[item.action] || "Alteração registrada"}</b>
                  <p className="mt-1 text-sm text-zinc-500">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-zinc-50 p-4">
              Nenhuma alteração registrada.
            </p>
          )}
        </Drawer>
      )}
      {material && (
        <MaterialDrawer data={material} close={() => setMaterial(null)} />
      )}
    </main>
  );
}

function PrizeList({
  items,
  view,
  busy,
  edit,
  action,
  copy,
  history,
  material,
}: {
  items: PrizeTicket[];
  view: string;
  busy: string;
  edit: (item: PrizeTicket) => void;
  action: (item: PrizeTicket, action: string) => void;
  copy: (value: string) => void;
  history: (item: PrizeTicket) => void;
  material: (item: PrizeTicket) => void;
}) {
  if (view === "table")
    return (
      <div className="mt-4 overflow-hidden rounded-3xl border bg-white">
        <div className="hidden grid-cols-[1fr_1.5fr_1.5fr_1fr_auto] gap-3 border-b bg-zinc-50 p-4 text-xs font-black uppercase text-zinc-500 md:grid">
          <span>Número</span>
          <span>Prêmio</span>
          <span>Campanha</span>
          <span>Status</span>
          <span>Ações</span>
        </div>
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-2 border-b p-4 last:border-0 md:grid-cols-[1fr_1.5fr_1.5fr_1fr_auto] md:items-center"
          >
            <b className="font-mono text-violet-700">{item.exactNumber}</b>
            <span>{item.description}</span>
            <span className="text-sm text-zinc-500">{item.campaign.title}</span>
            <Status value={item.status} />
            <button
              onClick={() => edit(item)}
              className="rounded-lg border px-3 py-2 text-sm font-bold"
            >
              Editar
            </button>
          </div>
        ))}
      </div>
    );
  return (
    <section
      className={`mt-4 grid gap-4 ${view === "compact" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" : "lg:grid-cols-2"}`}
    >
      {items.map((item) => (
        <PrizeCard
          key={item.id}
          compact={view === "compact"}
          item={item}
          busy={busy.startsWith(item.id)}
          edit={() => edit(item)}
          action={(op) => action(item, op)}
          copy={() => void copy(item.exactNumber || "")}
          history={() => void history(item)}
          material={() => material(item)}
        />
      ))}
    </section>
  );
}
function PrizeCard({
  item,
  compact,
  busy,
  edit,
  action,
  copy,
  history,
  material,
}: {
  item: PrizeTicket;
  compact: boolean;
  busy: boolean;
  edit: () => void;
  action: (op: string) => void;
  copy: () => void;
  history: () => void;
  material: () => void;
}) {
  return (
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          <Crown size={21} />
        </span>
        <Status value={item.status} />
      </div>
      <p className="mt-4 text-xs font-black uppercase text-zinc-400">
        Número premiado
      </p>
      <h3 className="mt-1 break-all font-mono text-2xl font-black text-violet-700">
        {item.exactNumber}
      </h3>
      <b className="mt-3 block">{item.description}</b>
      <p className="mt-1 text-sm text-zinc-500">{item.campaign.title}</p>
      {!compact && (
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <Info label="Valor" value={money.format(item.value)} />
          <Info label="Origem" value={originLabel(item.origin)} />
          <Info
            label="Criação"
            value={new Date(item.createdAt).toLocaleDateString("pt-BR")}
          />
          <Info
            label="Disponibilidade"
            value={item.status === "AVAILABLE" ? "Ativa" : "Pausada"}
          />
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Small icon={Edit3} label="Editar" click={edit} disabled={busy} />
        <Small icon={Copy} label="Copiar" click={copy} disabled={busy} />
        {item.status === "AVAILABLE" ? (
          <Small
            icon={Pause}
            label="Pausar"
            click={() => action("pause")}
            disabled={busy}
          />
        ) : (
          <Small
            icon={Play}
            label="Reativar"
            click={() => action("reactivate")}
            disabled={busy}
          />
        )}
        <details className="relative">
          <summary
            aria-label="Mais ações"
            className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border"
          >
            <MoreHorizontal size={17} />
          </summary>
          <div className="absolute bottom-12 right-0 z-20 w-48 rounded-2xl border bg-white p-2 shadow-xl">
            <MenuButton icon={Megaphone} label="Divulgar" click={material} />
            <MenuButton icon={History} label="Ver histórico" click={history} />
            <MenuButton
              icon={Trash2}
              label="Remover"
              click={() => action("remove")}
              danger
            />
          </div>
        </details>
      </div>
    </article>
  );
}
function ReservedCard({ item }: { item: PrizeTicket }) {
  const reservation = item.reservation;
  if (!reservation) return null;
  return (
    <article className="rounded-3xl border border-blue-200 bg-gradient-to-br from-white to-blue-50 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-100 text-blue-700"><Clock3 size={21} /></span>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">Reservada</span>
      </div>
      <p className="mt-4 text-xs font-black uppercase text-zinc-400">Número premiado</p>
      <h3 className="mt-1 break-all font-mono text-2xl font-black text-violet-700">{item.exactNumber}</h3>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Info label="Prêmio" value={item.description} />
        <Info label="Campanha" value={item.campaign.title} />
        <Info label="Comprador" value={reservation.buyerName} />
        <Info label="Telefone" value={reservation.buyerPhone || "Não informado"} />
        <Info label="Cidade" value={[reservation.city, reservation.state].filter(Boolean).join(" - ") || "Não informada"} />
        <Info label="Tempo restante" value={remainingTime(reservation.expiresAt)} />
        <Info label="Data da reserva" value={new Date(reservation.reservedAt).toLocaleString("pt-BR")} />
        <Info label="Pagamento" value="Aguardando confirmação" />
      </div>
      <p className="mt-3 text-xs text-zinc-500">Somente a cota premiada desta reserva é exibida.</p>
    </article>
  );
}
function FoundCard({
  item,
  busy,
  action,
  history,
  material,
}: {
  item: PrizeTicket;
  busy: string;
  action: (item: PrizeTicket, action: string) => void;
  history: (item: PrizeTicket) => void;
  material: () => void;
}) {
  const result = item.results[0];
  return (
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase text-emerald-600">
            Cota encontrada
          </span>
          <h2 className="mt-1 font-mono text-2xl font-black">
            {item.exactNumber}
          </h2>
        </div>
        <Status value={item.status} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Info label="Prêmio" value={item.description} />
        <Info label="Campanha" value={item.campaign.title} />
        <Info label="Comprador" value={result?.buyer.name || "Não informado"} />
        <Info
          label="Contato"
          value={`${result?.buyer.phone || "Não informado"} · ${result?.buyer.email || ""}`}
        />
        <Info
          label="Cidade"
          value={
            [result?.buyer.city, result?.buyer.state]
              .filter(Boolean)
              .join(" - ") || "Não informada"
          }
        />
        <Info label="Pedido" value={result?.purchase.id || "Não informado"} />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Por privacidade, somente o número premiado é exibido.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Small
          icon={UserRound}
          label="Abrir ganhador"
          click={material}
          disabled={false}
        />
        {item.status !== "DELIVERED" && (
          <Small
            icon={Check}
            label="Marcar entregue"
            click={() => action(item, "deliver")}
            disabled={busy.startsWith(item.id)}
          />
        )}
        <Small
          icon={ImageIcon}
          label="Gerar material"
          click={material}
          disabled={false}
        />
        <Small
          icon={History}
          label="Histórico"
          click={() => history(item)}
          disabled={false}
        />
      </div>
    </article>
  );
}
function ExpiredCard({
  item,
  copy,
  viewed,
}: {
  item: ExpiredInstantPrizeAlert;
  copy: (value: string) => void;
  viewed: () => Promise<void>;
}) {
  return (
    <article className="rounded-3xl border border-amber-200 bg-gradient-to-br from-white to-amber-50 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          <AlertTriangle />
        </span>
        <div>
          <span className="text-xs font-black uppercase text-amber-700">
            Retornada ao estoque
          </span>
          <h2 className="mt-1 text-lg font-black">
            Reserva expirada com cota premiada
          </h2>
        </div>
      </div>
      <p className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-zinc-600">
        Quando uma reserva não é paga dentro do prazo, os títulos são liberados
        novamente. A cota premiada retorna ao estoque e o comprador não recebe o
        prêmio.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Info label="Cota premiada" value={item.winningNumber} />
        <Info label="Prêmio" value={item.prizeName} />
        <Info label="Campanha" value={item.campaignTitle} />
        <Info label="Comprador" value={item.buyerName} />
        <Info
          label="Contato"
          value={`${item.buyerPhone} · ${item.buyerEmail}`}
        />
        <Info
          label="Cidade"
          value={
            [item.city, item.state].filter(Boolean).join(" - ") ||
            "Não informada"
          }
        />
        <Info
          label="Reserva"
          value={new Date(item.reservedAt).toLocaleString("pt-BR")}
        />
        <Info
          label="Expiração"
          value={new Date(item.expiredAt).toLocaleString("pt-BR")}
        />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Nenhum outro título da reserva é exibido.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Small
          icon={Copy}
          label="Copiar número"
          click={() => copy(item.winningNumber)}
          disabled={false}
        />
        <Link
          href={`/campanha/${item.campaignSlug}`}
          className="flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold"
        >
          Abrir campanha
        </Link>
        <Small
          icon={Share2}
          label="Divulgar novamente"
          click={() =>
            navigator.share?.({
              title: item.campaignTitle,
              url: `${location.origin}/campanha/${item.campaignSlug}`,
            })
          }
          disabled={false}
        />
        <Small
          icon={Check}
          label="Visualizado"
          click={() => void viewed()}
          disabled={false}
        />
      </div>
    </article>
  );
}
function WinnerCard({
  item,
  material,
}: {
  item: OrganizerWinner;
  material: () => void;
}) {
  return (
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="flex justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-700">
          <Trophy />
        </span>
        <Status value={item.status} />
      </div>
      <h2 className="mt-4 text-xl font-black">{maskName(item.buyer.name)}</h2>
      <p className="text-sm text-zinc-500">
        {item.buyer.city || "Cidade não informada"}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Info label="Campanha" value={item.campaign.title} />
        <Info label="Cota" value={item.winningNumber} />
        <Info label="Prêmio" value={item.prizeName} />
        <Info
          label="Data"
          value={new Date(item.createdAt).toLocaleString("pt-BR")}
        />
        <Info
          label="Divulgação"
          value={
            item.publicDisclosureAuthorized ? "Autorizada" : "Não autorizada"
          }
        />
        <Info
          label="Entrega"
          value={statusLabels[item.status] || item.status}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Small
          icon={UserRound}
          label="Abrir cadastro"
          click={() =>
            location.assign(`/dashboard/crm/contatos/${item.buyer.id}`)
          }
          disabled={false}
        />
        <Small
          icon={ImageIcon}
          label="Gerar material"
          click={material}
          disabled={false}
        />
        <Small
          icon={History}
          label="Ver histórico"
          click={() => location.assign(`/dashboard/pedidos?search=${item.id}`)}
          disabled={false}
        />
      </div>
    </article>
  );
}

function Wizard({
  step,
  setStep,
  form,
  setForm,
  campaigns,
  editing,
  busy,
  close,
  save,
}: {
  step: number;
  setStep: (value: number) => void;
  form: FormState;
  setForm: (value: FormState) => void;
  campaigns: Campaign[];
  editing: boolean;
  busy: boolean;
  close: () => void;
  save: (activate: boolean) => void;
}) {
  const campaign = campaigns.find((item) => item.id === form.campaignId);
  return (
    <Overlay>
      <section
        role="dialog"
        aria-modal="true"
        className="max-h-[96dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 sm:max-w-3xl sm:rounded-[2rem] sm:p-8"
      >
        <Title
          title={editing ? "Editar cota premiada" : "Adicionar cota premiada"}
          subtitle={`Etapa ${step} de 5 · ${["Campanha", "Número", "Prêmio", "Disponibilidade", "Revisão"][step - 1]}`}
          close={close}
        />
        <div className="mt-5 h-2 rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-violet-600"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
        <div className="mt-6">
          {step === 1 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {campaigns
                .filter((item) => ["PUBLISHED", "PAUSED"].includes(item.status))
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setForm({ ...form, campaignId: item.id })}
                    className={`rounded-2xl border p-4 text-left ${form.campaignId === item.id ? "border-violet-500 bg-violet-50" : ""}`}
                  >
                    <b>{item.title}</b>
                    <span className="mt-2 block text-sm text-zinc-500">
                      {item.totalNumbers.toLocaleString("pt-BR")} números ·{" "}
                      {item.status === "PUBLISHED" ? "Publicada" : "Pausada"}
                    </span>
                  </button>
                ))}
            </div>
          )}
          {step === 2 && (
            <div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["MANUAL", "Manual"],
                  ["RANDOM", "Aleatório"],
                  ["IMPORT", "Importar lista"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() =>
                      setForm({ ...form, mode: key as FormState["mode"] })
                    }
                    className={`rounded-xl border px-3 py-3 text-sm font-black ${form.mode === key ? "bg-zinc-900 text-white" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.mode === "RANDOM" ? (
                <Field label="Quantidade de números">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={form.randomCount}
                    onChange={(event) =>
                      setForm({ ...form, randomCount: event.target.value })
                    }
                  />
                </Field>
              ) : (
                <Field
                  label={
                    form.mode === "IMPORT"
                      ? "Cole os números separados por vírgula ou linha"
                      : "Número da cota"
                  }
                >
                  <textarea
                    value={form.numbers}
                    onChange={(event) =>
                      setForm({ ...form, numbers: event.target.value })
                    }
                    className="min-h-32 w-full rounded-xl border p-3"
                    placeholder={
                      form.mode === "IMPORT" ? "00010, 00250, 01000" : "00010"
                    }
                  />
                </Field>
              )}
              <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
                A API valida intervalo, duplicidade e se o número está vendido
                ou reservado.
              </p>
            </div>
          )}
          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do prêmio">
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </Field>
              <Field label="Tipo">
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value })
                  }
                >
                  {Object.entries(prizeTypes).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Valor estimado">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.value}
                  onChange={(event) =>
                    setForm({ ...form, value: event.target.value })
                  }
                />
              </Field>
              <Field label="Instruções de entrega">
                <input
                  value={form.instructions}
                  onChange={(event) =>
                    setForm({ ...form, instructions: event.target.value })
                  }
                />
              </Field>
              <p className="sm:col-span-2 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">
                A imagem do prêmio pode ser adicionada posteriormente na edição
                de mídia da campanha sem duplicar o armazenamento existente.
              </p>
            </div>
          )}
          {step === 4 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setForm({ ...form, activate: true })}
                className={`rounded-2xl border p-5 text-left ${form.activate ? "border-emerald-500 bg-emerald-50" : ""}`}
              >
                <b>Ativar agora</b>
                <span className="mt-1 block text-sm text-zinc-500">
                  Disponível assim que for confirmada.
                </span>
              </button>
              <button
                onClick={() => setForm({ ...form, activate: false })}
                className={`rounded-2xl border p-5 text-left ${!form.activate ? "border-amber-500 bg-amber-50" : ""}`}
              >
                <b>Salvar pausada</b>
                <span className="mt-1 block text-sm text-zinc-500">
                  Pode ser reativada posteriormente.
                </span>
              </button>
            </div>
          )}
          {step === 5 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Info
                label="Campanha"
                value={campaign?.title || "Não selecionada"}
              />
              <Info
                label="Número/origem"
                value={
                  form.mode === "RANDOM"
                    ? `${form.randomCount} número(s) aleatório(s)`
                    : form.numbers || "Não informado"
                }
              />
              <Info
                label="Prêmio"
                value={form.description || "Não informado"}
              />
              <Info
                label="Valor"
                value={money.format(Number(form.value) || 0)}
              />
              <Info
                label="Disponibilidade"
                value={
                  form.activate ? "Ativar após confirmação" : "Salvar pausada"
                }
              />
              <Info
                label="Regra"
                value="Somente pagamento aprovado gera ganhador"
              />
            </div>
          )}
        </div>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            onClick={() => (step === 1 ? close() : setStep(step - 1))}
            className="min-h-12 rounded-xl border px-5 font-black"
          >
            Voltar
          </button>
          {step < 5 ? (
            <button
              disabled={!form.campaignId}
              onClick={() => setStep(step + 1)}
              className="min-h-12 rounded-xl bg-violet-600 px-6 font-black text-white disabled:opacity-50 sm:ml-auto"
            >
              Avançar
            </button>
          ) : (
            <>
              <button
                disabled={busy}
                onClick={() => void save(false)}
                className="min-h-12 rounded-xl border px-5 font-black sm:ml-auto"
              >
                Salvar pausada
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  confirm("Ativar esta cota premiada?") && void save(true)
                }
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 font-black text-white"
              >
                {busy && <LoaderCircle size={17} className="animate-spin" />}{" "}
                Ativar
              </button>
            </>
          )}
        </div>
      </section>
    </Overlay>
  );
}
function MaterialDrawer({
  data,
  close,
}: {
  data: { ticket?: PrizeTicket; winner?: OrganizerWinner };
  close: () => void;
}) {
  const authorized = data.winner?.publicDisclosureAuthorized ?? false;
  const campaign = data.ticket?.campaign || data.winner?.campaign;
  const prize = data.ticket?.description || data.winner?.prizeName || "Prêmio";
  return (
    <Drawer title="Material do ganhador" close={close}>
      <p className="text-sm text-zinc-600">
        Escolha o formato e revise antes de compartilhar. Nenhum envio será
        realizado automaticamente.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {[
          "Story 9:16",
          "Post 1:1",
          "Feed 4:5",
          "Banner horizontal",
          "Card para WhatsApp",
        ].map((format) => (
          <button
            key={format}
            className="rounded-2xl border p-4 text-sm font-black hover:border-violet-300"
          >
            {format}
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-3xl bg-gradient-to-br from-violet-950 to-fuchsia-700 p-6 text-center text-white">
        <Trophy className="mx-auto" size={38} />
        <h3 className="mt-3 text-2xl font-black">Cota premiada encontrada</h3>
        <p className="mt-2">{prize}</p>
        <p className="mt-4 text-sm">
          {authorized ? data.winner?.buyer.name : "Nome protegido"} ·{" "}
          {data.winner?.buyer.city ||
            data.ticket?.results[0]?.buyer.city ||
            "Cidade não informada"}
        </p>
        <small className="mt-5 block">{campaign?.title}</small>
      </div>
      {!authorized && (
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          Os dados pessoais permanecem mascarados porque não há autorização de
          divulgação registrada.
        </p>
      )}
      <div className="mt-5 grid gap-2">
        <Link
          href={`/dashboard/ads?campaignId=${campaign?.id || ""}`}
          className="flex min-h-12 items-center justify-center rounded-xl bg-violet-600 font-black text-white"
        >
          Abrir SorteX Ads
        </Link>
        <Link
          href={`/dashboard/comunicacao?campaignId=${campaign?.id || ""}`}
          className="flex min-h-12 items-center justify-center rounded-xl border font-black"
        >
          Enviar para Comunicação
        </Link>
        <button
          onClick={() =>
            navigator.clipboard.writeText(
              `Saiu uma cota premiada na campanha ${campaign?.title}: ${prize}.`,
            )
          }
          className="min-h-12 rounded-xl border font-black"
        >
          Copiar texto
        </button>
      </div>
    </Drawer>
  );
}
function ErrorState({
  kind,
  retry,
}: {
  kind: "SESSION" | "FORBIDDEN" | "NETWORK";
  retry: () => void;
}) {
  const session = kind === "SESSION",
    forbidden = kind === "FORBIDDEN";
  return (
    <main className="mx-auto grid min-h-[65vh] max-w-2xl place-items-center p-5 text-center">
      <div>
        <AlertTriangle className="mx-auto text-violet-600" size={42} />
        <h1 className="mt-4 text-2xl font-black">
          {session
            ? "Sua sessão expirou."
            : forbidden
              ? "Você não possui acesso a esta área."
              : "Não foi possível carregar as cotas premiadas."}
        </h1>
        <p className="mt-2 text-zinc-500">
          {session
            ? "Entre novamente para continuar."
            : forbidden
              ? "Use uma conta de organizador autorizada."
              : "Verifique sua conexão e tente novamente."}
        </p>
        {session ? (
          <Link
            href={`/login?returnTo=${encodeURIComponent("/dashboard/ganhadores")}`}
            className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-violet-600 px-5 font-black text-white"
          >
            Entrar novamente
          </Link>
        ) : (
          !forbidden && (
            <button
              onClick={retry}
              className="mt-5 min-h-12 rounded-xl bg-violet-600 px-5 font-black text-white"
            >
              Tentar novamente
            </button>
          )
        )}
      </div>
    </main>
  );
}
function Skeleton() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-64 animate-pulse rounded-3xl bg-zinc-100"
        />
      ))}
    </div>
  );
}
function Empty({
  icon: Icon,
  title,
  action,
  click,
}: {
  icon: typeof Gift;
  title: string;
  action?: string;
  click?: () => void;
}) {
  return (
    <section className="mt-5 rounded-3xl border border-dashed bg-white p-10 text-center">
      <Icon className="mx-auto text-violet-500" size={38} />
      <h2 className="mt-4 text-xl font-black">{title}</h2>
      {action && (
        <button
          onClick={click}
          className="mt-5 rounded-xl bg-violet-600 px-5 py-3 font-black text-white"
        >
          {action}
        </button>
      )}
    </section>
  );
}
function StatusFilterCard({
  icon: Icon,
  label,
  description,
  value,
  loading,
  active,
  click,
  dataStatus,
}: {
  icon: typeof Gift;
  label: string;
  description: string;
  value?: number;
  loading: boolean;
  active: boolean;
  click: () => void;
  dataStatus: string;
}) {
  return (
    <button
      type="button"
      data-status-card={dataStatus}
      aria-pressed={active}
      aria-label={`Filtrar por ${label}`}
      onClick={click}
      className={`min-h-40 min-w-[218px] snap-center rounded-3xl border p-4 text-left shadow-sm outline-none transition active:scale-[.98] focus-visible:ring-4 focus-visible:ring-violet-200 md:min-w-0 ${active ? "border-violet-500 bg-violet-50 ring-1 ring-violet-300" : "bg-white hover:-translate-y-0.5 hover:border-violet-300"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-10 w-10 place-items-center rounded-2xl ${active ? "bg-violet-600 text-white" : "bg-zinc-100 text-violet-600"}`}><Icon size={19} /></span>
        {active && <span className="rounded-full bg-violet-600 px-2 py-1 text-[10px] font-black uppercase text-white">Selecionado</span>}
      </div>
      <span className="mt-3 block text-sm font-black">{label}</span>
      {loading ? <span className="mt-2 block h-7 w-14 animate-pulse rounded bg-zinc-200" /> : <b className="mt-1 block text-2xl">{value ?? 0}</b>}
      <span className="mt-1 block text-xs leading-4 text-zinc-500">{description}</span>
    </button>
  );
}
function Pagination({ page, pages, change }: { page: number; pages: number; change: (page: number) => void }) {
  return (
    <nav aria-label="Paginação das cotas" className="mt-6 flex items-center justify-center gap-3">
      <button disabled={page <= 1} onClick={() => change(page - 1)} className="min-h-11 rounded-xl border bg-white px-4 font-bold disabled:opacity-40">Anterior</button>
      <span className="text-sm font-bold">Página {page} de {pages}</span>
      <button disabled={page >= pages} onClick={() => change(page + 1)} className="min-h-11 rounded-xl border bg-white px-4 font-bold disabled:opacity-40">Próxima</button>
    </nav>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-zinc-50 p-3">
      <span className="text-[10px] font-black uppercase text-zinc-400">
        {label}
      </span>
      <b className="mt-1 block break-words text-sm">{value}</b>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const tone =
    value === "AVAILABLE"
      ? "bg-emerald-50 text-emerald-700"
      : value === "DELIVERED"
        ? "bg-violet-50 text-violet-700"
        : value === "CANCELLED"
          ? "bg-amber-50 text-amber-700"
          : "bg-blue-50 text-blue-700";
  return (
    <span className={`h-fit rounded-full px-3 py-1 text-xs font-black ${tone}`}>
      {statusLabels[value] || "Em acompanhamento"}
    </span>
  );
}
function Small({
  icon: Icon,
  label,
  click,
  disabled,
}: {
  icon: typeof Gift;
  label: string;
  click: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={click}
      disabled={disabled}
      className="flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm font-bold transition hover:bg-violet-50 active:scale-[.98] disabled:cursor-wait disabled:opacity-50"
    >
      <Icon size={15} />
      {label}
    </button>
  );
}
function MenuButton({
  icon: Icon,
  label,
  click,
  danger = false,
}: {
  icon: typeof Gift;
  label: string;
  click: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={click}
      className={`flex w-full items-center gap-2 rounded-xl p-2 text-sm font-bold hover:bg-zinc-50 ${danger ? "text-red-700" : ""}`}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}
function Select({
  value,
  set,
  options,
}: {
  value: string;
  set: (value: string) => void;
  options: string[][];
}) {
  return (
    <label>
      <span className="sr-only">Filtro</span>
      <select
        value={value}
        onChange={(event) => set(event.target.value)}
        className="h-11 w-full rounded-xl border bg-white px-3"
      >
        {options.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
function ViewButton({
  active,
  label,
  icon: Icon,
  click,
}: {
  active: boolean;
  label: string;
  icon: typeof Gift;
  click: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={click}
      className={`grid h-9 w-9 place-items-center rounded-lg ${active ? "bg-zinc-900 text-white" : "text-zinc-500"}`}
    >
      <Icon size={16} />
    </button>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-4 block text-sm font-bold">
      {label}
      <div className="mt-2 [&_input]:h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:px-3 [&_select]:h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:bg-white [&_select]:px-3">
        {children}
      </div>
    </label>
  );
}
function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/55 backdrop-blur-sm sm:items-center sm:p-5">
      {children}
    </div>
  );
}
function Drawer({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-zinc-950/50">
      <aside
        role="dialog"
        aria-modal="true"
        className="h-full w-full overflow-y-auto bg-white p-6 shadow-2xl sm:max-w-xl"
      >
        <Title
          title={title}
          subtitle="Dados protegidos e vinculados à sua conta"
          close={close}
        />
        <div className="mt-6">{children}</div>
      </aside>
    </div>
  );
}
function Title({
  title,
  subtitle,
  close,
}: {
  title: string;
  subtitle: string;
  close: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <button
        aria-label="Fechar"
        onClick={close}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-100"
      >
        <X size={18} />
      </button>
    </div>
  );
}
function originLabel(value: string) {
  return value === "RANDOM"
    ? "Gerada"
    : value === "IMPORT"
      ? "Importada"
      : "Manual";
}
function maskName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : parts[0];
}
function friendly(cause: unknown, fallback: string) {
  if (cause instanceof AuthApiError) {
    if (cause.status === 401)
      return "Sua sessão expirou. Entre novamente para continuar.";
    if (cause.status === 403)
      return "Você não possui permissão para esta ação.";
    return cause.message &&
      !/Unauthorized|Forbidden|Internal Server Error/i.test(cause.message)
      ? cause.message
      : fallback;
  }
  return fallback;
}
function matchesPeriod(value: string, period: string) {
  if (!period) return true;
  const start = new Date();
  start.setDate(start.getDate() - Number(period));
  return new Date(value) >= start;
}

function remainingTime(value: string) {
  const milliseconds = new Date(value).getTime() - Date.now();
  if (milliseconds <= 0) return "Expirada";
  const minutes = Math.ceil(milliseconds / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${rest}min`;
}
