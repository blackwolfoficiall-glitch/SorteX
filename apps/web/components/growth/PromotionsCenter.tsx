"use client";

import { type ReactNode, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bot,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Copy,
  Edit3,
  Gift,
  History,
  LoaderCircle,
  Megaphone,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Sparkles,
  Target,
  TicketPercent,
  Trash2,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import "./promotions-premium.css";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import {
  createPromotion,
  deletePromotion,
  duplicatePromotion,
  listPromotions,
  promotionAction,
  promotionDashboard,
  promotionHistory,
  promotionReport,
  updatePromotion,
  type Promotion,
  type PromotionHistoryItem,
  type PromotionReport,
} from "@/lib/growth/client";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Strategy = {
  key: string;
  type: string;
  name: string;
  description: string;
  moment: string;
  icon: typeof Gift;
};

const strategies: Strategy[] = [
  {
    key: "BONUS",
    type: "BONUS",
    name: "Bônus por quantidade",
    description: "Compre uma quantidade e receba títulos extras.",
    moment: "Elevar o ticket médio",
    icon: Gift,
  },
  {
    key: "INSTANT_PRIZE",
    type: "INSTANT_PRIZE",
    name: "Cotas premiadas",
    description: "Números que liberam prêmios instantâneos.",
    moment: "Aumentar engajamento",
    icon: Trophy,
  },
  {
    key: "ROULETTE",
    type: "INSTANT_PRIZE",
    name: "Roleta de prêmios",
    description: "Libere giros conforme a quantidade comprada.",
    moment: "Lançamentos e ativações",
    icon: Target,
  },
  {
    key: "COUPON",
    type: "COUPON",
    name: "Cupom de desconto",
    description: "Código com desconto fixo ou percentual.",
    moment: "Recuperar e reativar",
    icon: TicketPercent,
  },
  {
    key: "FLASH",
    type: "FLASH",
    name: "Oferta relâmpago",
    description: "Benefício por um período curto e controlado.",
    moment: "Criar urgência",
    icon: Zap,
  },
  {
    key: "LAST_TICKETS",
    type: "FLASH",
    name: "Últimas cotas",
    description: "Acelere a reta final da campanha.",
    moment: "Próximo do encerramento",
    icon: Clock3,
  },
  {
    key: "CASHBACK",
    type: "CASHBACK",
    name: "Cashback",
    description: "Crédito promocional para compras futuras.",
    moment: "Estimular recorrência",
    icon: CircleDollarSign,
  },
  {
    key: "LOWEST",
    type: "INSTANT_PRIZE",
    name: "Menor cota",
    description: "Benefício ligado ao menor número elegível.",
    moment: "Campanhas competitivas",
    icon: Trophy,
  },
  {
    key: "REFERRAL",
    type: "BONUS",
    name: "Indique e ganhe",
    description: "Benefício por indicação com rastreamento.",
    moment: "Expandir alcance",
    icon: Megaphone,
  },
  {
    key: "CUSTOM",
    type: "BONUS",
    name: "Estratégia personalizada",
    description: "Combine condições dentro das regras da SorteX.",
    moment: "Necessidades específicas",
    icon: Sparkles,
  },
];

const typeLabels: Record<string, string> = {
  PACKAGE: "Oferta por quantidade",
  COUPON: "Cupom de desconto",
  INSTANT_PRIZE: "Cota premiada",
  FLASH: "Oferta relâmpago",
  BONUS: "Bônus por quantidade",
  QUANTITY_DISCOUNT: "Desconto por quantidade",
  CASHBACK: "Cashback",
};
const statusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ENDED: "Encerrada",
  EXPIRED: "Expirada",
  ERROR: "Erro",
};
const campaignStatusLabels: Record<string, string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Em análise",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
  SOLD_OUT: "Esgotada",
  DRAWN: "Sorteada",
  FINISHED: "Encerrada",
  CANCELLED: "Cancelada",
};
const actionLabels: Record<string, string> = {
  PROMOTION_CREATED: "Estratégia criada",
  PROMOTION_UPDATED: "Estratégia editada",
  PROMOTION_ACTIVATE: "Estratégia ativada",
  PROMOTION_PAUSE: "Estratégia pausada",
  PROMOTION_END: "Estratégia encerrada",
  PROMOTION_DUPLICATED: "Estratégia duplicada",
};

type FormState = {
  name: string;
  campaignId: string;
  type: string;
  strategyKey: string;
  description: string;
  startsAt: string;
  endsAt: string;
  totalLimit: string;
  perBuyerLimit: string;
  dailyLimit: string;
  quantity: string;
  benefit: string;
  value: string;
  code: string;
  discountType: string;
  tiers: string;
  isPopular: boolean;
  rules: string;
};
const initialForm = (): FormState => ({
  name: "",
  campaignId: "",
  type: "BONUS",
  strategyKey: "BONUS",
  description: "",
  startsAt: "",
  endsAt: "",
  totalLimit: "",
  perBuyerLimit: "",
  dailyLimit: "",
  quantity: "100",
  benefit: "20",
  value: "10",
  code: "",
  discountType: "PERCENTAGE",
  tiers: "100:20",
  isPopular: false,
  rules: "",
});

export default function PromotionsCenter() {
  const searchParams = useSearchParams();
  const prefillHandled = useRef(false);
  const loadVersion = useRef(0);
  const [items, setItems] = useState<Promotion[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [listTotal, setListTotal] = useState(0);
  const [filters, setFilters] = useState({
    search: "",
    campaignId: "",
    type: "",
    status: "",
  });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [wizardError, setWizardError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<FormState>(initialForm());
  const [section, setSection] = useState("execution");
  const [detail, setDetail] = useState<{
    type: "report" | "history" | "share";
    promotion: Promotion;
  } | null>(null);
  const [report, setReport] = useState<PromotionReport | null>(null);
  const [history, setHistory] = useState<PromotionHistoryItem[]>([]);

  async function load() {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      const query = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value),
        ),
      );
      const [promotions, ownCampaigns, dashboard] = await Promise.all([
        listPromotions(`?${query}`),
        getMyCampaigns(),
        promotionDashboard(),
      ]);
      if (version !== loadVersion.current) return;
      setItems(promotions.items);
      setListTotal(promotions.total);
      setCampaigns(ownCampaigns);
      setStats(dashboard);
      setForm((current) => ({
        ...current,
        campaignId: current.campaignId || ownCampaigns[0]?.id || "",
      }));
    } catch {
      if (version === loadVersion.current) {
        setLoadFailed(true);
        setStats(null);
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }
  // Invalidate the request epoch, not a DOM ref. A stale response must not
  // replace a newer set of filters or hide its loading/error state.
  function invalidateReads() {
    loadVersion.current++;
  }
  useEffect(() => {
    const timer = setTimeout(() => void load(), filters.search ? 300 : 0);
    return () => {
      clearTimeout(timer);
      invalidateReads();
    };
    // A consulta é reagendada intencionalmente quando os filtros mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);
  useEffect(() => {
    if (
      prefillHandled.current ||
      !campaigns.length ||
      searchParams.get("action") !== "create" ||
      searchParams.get("strategy") !== "price-reduction"
    )
      return;
    const campaignId = searchParams.get("campaignId") || "";
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    prefillHandled.current = true;
    const price = Number(searchParams.get("price"));
    const previousPrice = Number(searchParams.get("previousPrice"));
    const timer = window.setTimeout(() => {
      setForm({
        ...initialForm(),
        campaignId: campaign.id,
        type: "FLASH",
        strategyKey: "FLASH",
        name: "Preço reduzido",
        description: `Novo valor público da cota: ${Number.isFinite(price) ? money.format(price) : "valor atualizado"}. Valor anterior: ${Number.isFinite(previousPrice) ? money.format(previousPrice) : "não informado"}.`,
        quantity: "1",
        value: Number.isFinite(price) ? String(price) : "",
      });
      setWizardError("");
      setWizardStep(1);
      setWizardOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [campaigns, searchParams]);

  const visible = useMemo(() => {
    if (section === "all") return items;
    const map: Record<string, string[]> = {
      execution: ["ACTIVE"],
      scheduled: ["SCHEDULED"],
      paused: ["PAUSED"],
      ended: ["ENDED", "EXPIRED"],
      drafts: ["DRAFT"],
    };
    return items.filter((item) => map[section]?.includes(item.status));
  }, [items, section]);
  const ranked = useMemo(
    () => items.filter((item) => item.attributedRevenue > 0)
      .sort((a, b) => b.attributedRevenue - a.attributedRevenue),
    [items],
  );
  const recommendedCampaign = stats?.active === 0
    ? campaigns.find((campaign) => campaign.status === "PUBLISHED")
    : undefined;
  const hasFilter = Boolean(filters.search || filters.campaignId || filters.type || filters.status);
  const metric = (key: string) => (stats && Number.isFinite(stats[key]) ? stats[key] : null);
  const attributedRevenue = metric("revenue");

  function chooseStrategy(strategy: Strategy, campaignId?: string) {
    setForm((current) => ({
      ...initialForm(),
      campaignId: campaignId || current.campaignId || campaigns[0]?.id || "",
      type: strategy.type,
      strategyKey: strategy.key,
      name: strategy.name,
    }));
    setEditingId("");
    setWizardError("");
    setCatalogOpen(false);
    setWizardStep(1);
    setWizardOpen(true);
  }
  function edit(item: Promotion) {
    const config = item.config || {};
    setEditingId(item.id);
    setWizardError("");
    setForm({
      ...initialForm(),
      name: item.name,
      campaignId: item.campaign.id,
      type: item.type,
      strategyKey: String(config.strategyKey || item.type),
      description: item.description || "",
      startsAt: localDate(item.startsAt),
      endsAt: localDate(item.endsAt),
      totalLimit: item.totalLimit?.toString() || "",
      perBuyerLimit: String(config.perBuyerLimit || ""),
      dailyLimit: String(config.dailyLimit || ""),
      quantity: String(config.quantity || config.minimumQuantity || 100),
      benefit: String(config.extraQuantity || config.rounds || 20),
      value: String(config.discountValue || config.value || 10),
      code: String(config.code || ""),
      discountType: String(config.discountType || "PERCENTAGE"),
      tiers: Array.isArray(config.tiers)
        ? config.tiers
            .map(
              (tier: Record<string, unknown>) =>
                `${tier.quantity}:${tier.extraQuantity ?? tier.percent}`,
            )
            .join(",")
        : "100:20",
      isPopular: Boolean(config.isPopular),
      rules: String(config.naturalRule || ""),
    });
    setWizardStep(1);
    setWizardOpen(true);
  }
  function configPayload() {
    const base = {
      strategyKey: form.strategyKey,
      dailyLimit: numberOrUndefined(form.dailyLimit),
      isPopular: form.isPopular,
    };
    if (form.type === "COUPON")
      return {
        ...base,
        code: form.code,
        discountType: form.discountType,
        discountValue: Number(form.value),
        minimumAmount: 0,
      };
    if (form.type === "BONUS")
      return {
        ...base,
        minimumQuantity: Number(form.quantity),
        extraQuantity: Number(form.benefit),
        tiers: parseTiers(form.tiers, "extraQuantity"),
        naturalRule: naturalRule(form),
      };
    if (form.type === "QUANTITY_DISCOUNT")
      return { ...base, tiers: parseTiers(form.tiers, "percent") };
    if (form.type === "INSTANT_PRIZE")
      return {
        ...base,
        quantity: Number(form.quantity),
        value: Number(form.value),
        rounds: Number(form.benefit),
        prizeType: "OUTRO",
        naturalRule: naturalRule(form),
      };
    if (form.type === "CASHBACK")
      return {
        ...base,
        discountType: form.discountType,
        value: Number(form.value),
        notice: "Crédito promocional sem saque.",
      };
    if (form.type === "PACKAGE")
      return {
        ...base,
        quantity: Number(form.quantity),
        promotionalPrice: Number(form.value),
      };
    return {
      ...base,
      discountType: form.discountType,
      discountValue: Number(form.value),
      minimumQuantity: Number(form.quantity),
    };
  }
  async function save(status: "DRAFT" | "SCHEDULED" | "ACTIVE") {
    if (!form.name.trim() || !form.campaignId) {
      setWizardError("Informe o nome e a campanha da estratégia.");
      return;
    }
    setBusyId("save");
    setWizardError("");
    try {
      const body = {
        name: form.name,
        campaignId: form.campaignId,
        type: form.type,
        description: form.description || undefined,
        startsAt: form.startsAt
          ? new Date(form.startsAt).toISOString()
          : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        totalLimit: numberOrUndefined(form.totalLimit),
        perBuyerLimit: numberOrUndefined(form.perBuyerLimit),
        status,
        config: configPayload(),
        stackRules: {
          allowCoupon: form.type !== "COUPON",
          allowCashback: false,
        },
      };
      if (editingId) await updatePromotion(editingId, body);
      else await createPromotion(body);
      setNotice(
        status === "ACTIVE"
          ? "Estratégia ativada com sucesso."
          : status === "SCHEDULED"
            ? "Estratégia agendada com sucesso."
            : "Estratégia salva como rascunho.",
      );
      setWizardOpen(false);
      setEditingId("");
      setSection(
        status === "ACTIVE"
          ? "execution"
          : status === "SCHEDULED"
            ? "scheduled"
            : "drafts",
      );
      setForm({ ...initialForm(), campaignId: campaigns[0]?.id || "" });
      await load();
    } catch {
      setWizardError(
        "Não foi possível salvar a estratégia. Revise os dados e tente novamente.",
      );
    } finally {
      setBusyId("");
    }
  }
  async function runAction(item: Promotion, action: string) {
    if (busyId) return;
    if (
      (action === "pause" || action === "end") &&
      !confirm(
        action === "pause"
          ? "Pausar esta estratégia? As utilizações anteriores serão preservadas."
          : "Encerrar esta estratégia?",
      )
    )
      return;
    setBusyId(item.id + action);
    setError("");
    try {
      await promotionAction(item.id, action);
      setNotice(
        action === "pause"
          ? "Estratégia pausada."
          : action === "activate"
            ? "Estratégia reativada."
            : "Estratégia encerrada.",
      );
      setSection(
        action === "activate"
          ? "execution"
          : action === "pause"
            ? "paused"
            : "ended",
      );
      await load();
    } catch {
      setError(
        "Não foi possível concluir a ação. Verifique o período e a campanha.",
      );
    } finally {
      setBusyId("");
    }
  }
  async function duplicate(item: Promotion) {
    if (busyId) return;
    setBusyId(item.id + "duplicate");
    try {
      await duplicatePromotion(item.id);
      setNotice("Estratégia duplicada e salva como rascunho.");
      setSection("drafts");
      await load();
    } catch {
      setError("Não foi possível duplicar a estratégia.");
    } finally {
      setBusyId("");
    }
  }
  async function remove(item: Promotion) {
    if (
      !confirm(
        "Excluir esta estratégia? Esta ação só é permitida quando não há utilizações.",
      )
    )
      return;
    setBusyId(item.id + "delete");
    try {
      await deletePromotion(item.id);
      setNotice("Estratégia excluída.");
      await load();
    } catch {
      setError(
        "Esta estratégia não pode ser excluída. Encerre-a para preservar o histórico.",
      );
    } finally {
      setBusyId("");
    }
  }
  async function openDetail(
    type: "report" | "history" | "share",
    promotion: Promotion,
  ) {
    setDetail({ type, promotion });
    setReport(null);
    setHistory([]);
    if (type === "report")
      promotionReport(promotion.id)
        .then(setReport)
        .catch(() => setError("Não foi possível carregar o relatório."));
    if (type === "history")
      promotionHistory(promotion.id)
        .then(setHistory)
        .catch(() => setError("Não foi possível carregar o histórico."));
  }

  return (
    <PremiumScope className="sx-promo">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="sx-premium-badge">
            Centro de estratégias de conversão
          </p>
          <h1 className="sx-premium-title mt-2">Promoções</h1>
          <p className="sx-premium-muted mt-2 max-w-2xl">
            Consulte resultados e organize benefícios promocionais das suas campanhas.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => setCatalogOpen(true)}
            className="sx-premium-button"
          >
            Modelos prontos
          </button>
          <button
            onClick={() => setCatalogOpen(true)}
            className="sx-premium-button" data-variant="primary"
          >
            <Plus size={18} aria-hidden="true" /> Criar estratégia
          </button>
        </div>
      </header>

      <section className="sx-promo-metrics mt-6" aria-label="Indicadores de promoções">
        <Metric icon={Play} label="Em execução" value={metric("active") ?? "Indisponível"} />
        <Metric icon={CalendarClock} label="Agendadas" value={metric("scheduled") ?? "Indisponível"} />
        <Metric icon={CircleDollarSign} label="Receita atribuída" value={attributedRevenue === null ? "Indisponível" : money.format(attributedRevenue)} />
        <Metric icon={Target} label="Utilizações" value={metric("usages") ?? "Indisponível"} />
        <Metric icon={BarChart3} label="Conversão atribuída" value="Sem dados de visualizações" />
        <Metric icon={Trophy} label="Maior receita na lista" value={!loading && !loadFailed ? ranked[0]?.name ?? "Sem dados" : "Indisponível"} />
      </section>

      {!loading && !loadFailed && (
      <section className="sx-premium-ticket sx-promo-hero mt-6 p-5 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black">
              <Bot size={15} aria-hidden="true" /> Sugestão baseada em regras
            </span>
            <h2 className="sx-premium-title mt-4">
              {recommendedCampaign
                ? `Oportunidade em ${recommendedCampaign.title}`
                : "Revise as suas promoções"}
            </h2>
            <p className="mt-2 text-violet-100">
              {recommendedCampaign
                ? "Sua conta não possui promoções registradas como ativas. É possível preparar uma estratégia para a campanha publicada, sem ativá-la agora."
                : "Use os indicadores e os filtros para revisar as estratégias registradas na sua operação."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1">
                Fonte: promoções da sua conta
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1">
                Impacto: estimativa, não garantia
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
            {recommendedCampaign && (
              <>
                <button
                  onClick={() => {
                    chooseStrategy(strategies[0], recommendedCampaign.id);
                  }}
                  className="min-h-11 rounded-xl bg-white px-4 font-black text-violet-800"
                >
                  Criar com esta sugestão
                </button>
                <Link
                  href={`/dashboard/ia?campaignId=${recommendedCampaign.id}`}
                  className="flex min-h-11 items-center justify-center rounded-xl border border-white/30 px-4 font-bold"
                >
                  Ver análise completa
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
      )}

      <section className="sx-premium-surface sx-promo-panel mt-6" aria-label="Filtrar promoções">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative xl:col-span-2">
            <span className="sr-only">Buscar</span>
            <Search
              className="absolute left-3 top-3.5 text-zinc-400"
              size={17}
            />
            <input
              value={filters.search}
              onChange={(event) =>
                setFilters({ ...filters, search: event.target.value })
              }
              placeholder="Buscar nome ou campanha"
              className="h-11 w-full rounded-xl border pl-10 pr-3"
            />
          </label>
          <Filter
            label="Campanha" value={filters.campaignId}
            onChange={(value) => setFilters({ ...filters, campaignId: value })}
            options={[
              ["", "Todas as campanhas"],
              ...campaigns.map((campaign) => [campaign.id, campaign.title]),
            ]}
          />
          <Filter
            label="Tipo de promoção" value={filters.type}
            onChange={(value) => setFilters({ ...filters, type: value })}
            options={[["", "Todos os tipos"], ...Object.entries(typeLabels)]}
          />
          <Filter
            label="Status da promoção" value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={[
              ["", "Todos os status"],
              ...Object.entries(statusLabels).filter(
                ([key]) => key !== "ERROR",
              ),
            ]}
          />
        </div>
      </section>
      {notice && (
        <Feedback tone="success" close={() => setNotice("")}>
          {notice}
        </Feedback>
      )}
      {error && (
        <Feedback tone="error" close={() => setError("")}>
          {error}
        </Feedback>
      )}

      <nav aria-label="Seções de promoções" className="mt-6">
        <label className="block md:hidden">
          <span className="mb-2 block text-sm font-bold">Seção</span>
          <select
            value={section}
            onChange={(event) => setSection(event.target.value)}
            aria-label="Seção de promoções" className="h-12 w-full rounded-xl border bg-white px-3"
          >
            <SectionOptions />
          </select>
        </label>
        <div className="hidden flex-wrap gap-2 md:flex">
          {[
            ["execution", "Em execução"],
            ["scheduled", "Agendadas"],
            ["paused", "Pausadas"],
            ["drafts", "Rascunhos"],
            ["ended", "Encerradas"],
            ["all", "Todas"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              aria-pressed={section === key}
              className="sx-premium-button sx-promo-tab"
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {loading ? (
        <Loading text="Consultando promoções…" />
      ) : loadFailed ? (
        <section className="sx-premium-surface sx-promo-panel sx-promo-empty">
          <p role="alert">Não foi possível carregar as estratégias.</p>
          <button type="button" className="sx-premium-button" data-variant="primary" onClick={() => void load()}>Tentar novamente</button>
        </section>
      ) : visible.length ? (
        <section className="mt-5 grid gap-4 xl:grid-cols-2" aria-label="Promoções listadas">
          {visible.map((promotion) => (
            <PromotionCard
              key={promotion.id}
              promotion={promotion}
              busy={busyId.startsWith(promotion.id)}
              onEdit={() => edit(promotion)}
              onDuplicate={() => void duplicate(promotion)}
              onAction={(action) => void runAction(promotion, action)}
              onShare={() => void openDetail("share", promotion)}
              onReport={() => void openDetail("report", promotion)}
              onHistory={() => void openDetail("history", promotion)}
              onDelete={() => void remove(promotion)}
            />
          ))}
        </section>
      ) : (
        <Empty
          filtered={hasFilter}
          sectionOnly={!hasFilter && section !== "all" && items.length > 0}
          create={() => setCatalogOpen(true)}
        />
      )}

      {!loading && !loadFailed && listTotal > items.length && (
        <p role="status" className="sx-premium-muted mt-4">Exibindo a primeira página da consulta ({items.length} de {listTotal} registros).</p>
      )}

      {!loading && !loadFailed && ranked.length > 0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">
                Dados da sua conta
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Maiores receitas atribuídas na lista
              </h2>
            </div>
          </div>
          <div className="sx-premium-surface mt-4 overflow-hidden">
            {ranked
              .slice(0, 5)
              .map((item, index) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 border-b p-4 last:border-0 sm:flex-row sm:items-center"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-50 font-black text-violet-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate">{item.name}</b>
                    <span className="text-sm text-zinc-500">
                      {item.campaign.title}
                    </span>
                  </div>
                  <div className="text-sm sm:text-right">
                    <b>{money.format(item.attributedRevenue)}</b>
                    <span className="block text-zinc-500">
                      {item.usageCount} utilizações
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {catalogOpen && (
        <Catalog close={() => setCatalogOpen(false)} choose={chooseStrategy} />
      )}
      {wizardOpen && (
        <Wizard
          form={form}
          setForm={setForm}
          campaigns={campaigns}
          step={wizardStep}
          setStep={setWizardStep}
          editing={Boolean(editingId)}
          busy={busyId === "save"}
          error={wizardError}
          close={() => setWizardOpen(false)}
          save={save}
        />
      )}
      {detail && (
        <DetailDrawer
          detail={detail}
          report={report}
          history={history}
          close={() => setDetail(null)}
        />
      )}
    </PremiumScope>
  );
}

function PromotionCard({
  promotion,
  busy,
  onEdit,
  onDuplicate,
  onAction,
  onShare,
  onReport,
  onHistory,
  onDelete,
}: {
  promotion: Promotion;
  busy: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onAction: (action: string) => void;
  onShare: () => void;
  onReport: () => void;
  onHistory: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="sx-premium-surface sx-promo-panel sx-promo-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-xs font-black uppercase tracking-wide text-violet-600">
            {typeLabels[promotion.type] || promotion.type}
          </span>
          <h2 className="sx-premium-section mt-1">{promotion.name}</h2>
          <p className="sx-premium-muted">
            {promotion.campaign.title}
          </p>
        </div>
        <span
          className="sx-premium-badge sx-promo-status" data-status={promotion.status}
        >
          <span aria-hidden>
            {promotion.status === "ACTIVE"
              ? "●"
              : promotion.status === "PAUSED"
                ? "Ⅱ"
                : "○"}
          </span>
          {statusLabels[promotion.status] || "Estado não reconhecido"}
        </span>
      </div>
      <div className="sx-promo-inset mt-4">
        <p>{promotionRule(promotion)}</p>
        {!hasCheckoutBenefit(promotion.type) && (
          <p className="sx-premium-muted mt-1">Sem benefício automático no checkout.</p>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Info
          label="Utilizações"
          value={`${promotion.usageCount}${promotion.totalLimit ? `/${promotion.totalLimit}` : ""}`}
        />
        <Info
          label="Receita atribuída"
          value={money.format(promotion.attributedRevenue)}
        />
        <Info label="Período" value={period(promotion)} />
        <Info
          label="Atualização"
          value={new Date(promotion.updatedAt).toLocaleDateString("pt-BR")}
        />
      </div>
      <div className="sx-promo-card-actions mt-5">
        <Action icon={Edit3} label="Editar" onClick={onEdit} disabled={busy} />
        <Action
          icon={Copy}
          label="Duplicar"
          onClick={onDuplicate}
          disabled={busy}
        />
        {promotion.status === "ACTIVE" ? (
          <Action
            icon={Pause}
            label="Pausar"
            onClick={() => onAction("pause")}
            disabled={busy}
          />
        ) : !["ENDED", "EXPIRED"].includes(promotion.status) ? (
          <Action
            icon={Play}
            label="Reativar"
            onClick={() => onAction("activate")}
            disabled={busy}
          />
        ) : null}
        <Action
          icon={Megaphone}
          label="Divulgar"
          onClick={onShare}
          disabled={busy}
        />
        <Action
          icon={BarChart3}
          label="Relatório"
          onClick={onReport}
          disabled={busy}
        />
        <details className="relative">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold hover:bg-zinc-50">
            <MoreHorizontal size={16} /> Mais
          </summary>
          <div className="sx-premium-surface sx-promo-more w-full p-2">
            <button
              onClick={onHistory}
              className="flex w-full gap-2 rounded-xl p-2 text-sm font-bold hover:bg-zinc-50"
            >
              <History size={16} /> Ver histórico
            </button>
            {!["ENDED", "EXPIRED"].includes(promotion.status) && (
              <button
                onClick={() => onAction("end")}
                className="flex w-full gap-2 rounded-xl p-2 text-sm font-bold text-orange-700 hover:bg-orange-50"
              >
                <Clock3 size={16} /> Encerrar
              </button>
            )}
            <button
              onClick={onDelete}
              className="flex w-full gap-2 rounded-xl p-2 text-sm font-bold text-red-700 hover:bg-red-50"
            >
              <Trash2 size={16} /> Excluir
            </button>
          </div>
        </details>
      </div>
    </article>
  );
}

function Catalog({
  close,
  choose,
}: {
  close: () => void;
  choose: (strategy: Strategy) => void;
}) {
  return (
    <Overlay close={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-title"
        className="sx-premium-surface sx-promo-dialog sx-promo-catalog w-full sm:max-w-6xl"
      >
        <ModalTitle
          id="catalog-title"
          title="Criar estratégia"
          subtitle="Escolha a estratégia mais adequada para o momento da campanha."
          close={close}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {strategies.map((strategy) => {
            const Icon = strategy.icon;
            return (
              <article
                key={strategy.key}
                className="sx-premium-surface sx-promo-panel flex flex-col"
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                  <Icon size={21} />
                </span>
                <h3 className="mt-4 font-black">{strategy.name}</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  {strategy.description}
                </p>
                {!hasCheckoutBenefit(strategy.type) && (
                  <p className="mt-1 text-xs font-bold text-zinc-600">
                    Sem benefício automático no checkout.
                  </p>
                )}
                <p className="mt-3 text-xs font-bold text-zinc-500">
                  Melhor momento: {strategy.moment}
                </p>
                <button
                  onClick={() => choose(strategy)}
                  className="sx-premium-button sx-promo-catalog-action"
                >
                  Criar
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </Overlay>
  );
}

function Wizard({
  form,
  setForm,
  campaigns,
  step,
  setStep,
  editing,
  busy,
  error,
  close,
  save,
}: {
  form: FormState;
  setForm: (value: FormState) => void;
  campaigns: Campaign[];
  step: number;
  setStep: (value: number) => void;
  editing: boolean;
  busy: boolean;
  error: string;
  close: () => void;
  save: (status: "DRAFT" | "SCHEDULED" | "ACTIVE") => void;
}) {
  const campaign = campaigns.find((item) => item.id === form.campaignId);
  const strategy =
    strategies.find((item) => item.key === form.strategyKey) || strategies[0];
  return (
    <Overlay close={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wizard-title"
        className="sx-premium-surface sx-promo-dialog w-full sm:max-w-4xl"
      >
        <ModalTitle
          id="wizard-title"
          title={editing ? "Editar estratégia" : "Nova estratégia"}
          subtitle={`Etapa ${step} de 7 · ${["Campanha", "Estratégia", "Regras", "Período", "Limites", "Simulação", "Revisão"][step - 1]}`}
          close={close}
        />
        <div className="sx-promo-progress mt-5 h-2 overflow-hidden rounded-full" role="progressbar" aria-label="Etapas da estratégia" aria-valuemin={0} aria-valuemax={7} aria-valuenow={step}>
          <div
            className="sx-promo-progress-value h-full rounded-full"
            style={{ width: `${(step / 7) * 100}%` }}
          />
        </div>
        <form onSubmit={(event) => event.preventDefault()} className="mt-6">
          {step === 1 && (
            <div>
              <h3 className="text-xl font-black">Escolha a campanha</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {campaigns.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setForm({ ...form, campaignId: item.id })}
                    aria-pressed={form.campaignId === item.id}
                    className="sx-promo-inset sx-promo-campaign text-left"
                  >
                    <b>{item.title}</b>
                    <span className="mt-2 block text-sm text-zinc-500">
                      {campaignStatusLabels[item.status] ||
                        "Status indisponível"}{" "}
                      ·{" "}
                      {Math.round(
                        (item.soldNumbers / Math.max(1, item.totalNumbers)) *
                          100,
                      )}
                      % vendido
                    </span>
                    <span className="text-sm text-zinc-500">
                      Cota: {money.format(item.numberPrice)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="rounded-3xl border bg-zinc-50 p-6">
              <span className="text-xs font-black uppercase text-violet-600">
                Estratégia selecionada
              </span>
              <h3 className="mt-2 text-2xl font-black">{strategy.name}</h3>
              <p className="mt-2 text-zinc-600">{strategy.description}</p>
              {!hasCheckoutBenefit(form.type) && (
                <p className="mt-2 text-sm font-bold text-zinc-600">
                  Esta estratégia pode ser gerida, mas não concede benefício
                  automático no checkout.
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  close();
                }}
                className="mt-4 text-sm font-black text-violet-700"
              >
                Trocar estratégia no catálogo
              </button>
            </div>
          )}
          {step === 3 && <Rules form={form} setForm={setForm} />}
          {step === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Início (vazio para iniciar ao ativar)">
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm({ ...form, startsAt: e.target.value })
                  }
                />
              </Field>
              <Field label="Término">
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </Field>
              <p className="sm:col-span-2 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
                A promoção será encerrada automaticamente no término informado.
                O período deve respeitar a campanha.
              </p>
            </div>
          )}
          {step === 5 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Limite total">
                <input
                  type="number"
                  min="1"
                  value={form.totalLimit}
                  onChange={(e) =>
                    setForm({ ...form, totalLimit: e.target.value })
                  }
                />
              </Field>
              <Field label="Por comprador">
                <input
                  type="number"
                  min="1"
                  value={form.perBuyerLimit}
                  onChange={(e) =>
                    setForm({ ...form, perBuyerLimit: e.target.value })
                  }
                />
              </Field>
              <Field label="Limite diário">
                <input
                  type="number"
                  min="1"
                  value={form.dailyLimit}
                  onChange={(e) =>
                    setForm({ ...form, dailyLimit: e.target.value })
                  }
                />
              </Field>
            </div>
          )}
          {step === 6 && <Simulation form={form} campaign={campaign} />}
          {step === 7 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Review
                label="Campanha"
                value={campaign?.title || "Não selecionada"}
              />
              <Review label="Estratégia" value={strategy.name} />
              <Review label="Regra" value={hasCheckoutBenefit(form.type) ? naturalRule(form) : "Sem benefício automático no checkout."} />
              <Review
                label="Período"
                value={
                  form.startsAt || form.endsAt
                    ? `${form.startsAt || "Ao ativar"} até ${form.endsAt || "sem término"}`
                    : "Enquanto estiver ativa"
                }
              />
              <Review
                label="Limites"
                value={
                  form.totalLimit
                    ? `${form.totalLimit} utilizações`
                    : "Sem limite total"
                }
              />
              <Review
                label="Canais"
                value="Página pública e Comunicação, após confirmação"
              />
            </div>
          )}
          {error && <p role="alert" className="sx-promo-feedback mt-4" data-tone="error">{error}</p>}
          <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => (step === 1 ? close() : setStep(step - 1))}
              className="sx-premium-button"
            >
              Voltar
            </button>
            {step < 7 ? (
              <button
                type="button"
                disabled={!form.campaignId}
                onClick={() => setStep(step + 1)}
                className="sx-premium-button sm:ml-auto" data-variant="primary"
              >
                Avançar
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save("DRAFT")}
                  className="sx-premium-button sm:ml-auto"
                >
                  Salvar como rascunho
                </button>
                <button
                  type="button"
                  disabled={busy || !form.startsAt}
                  onClick={() =>
                    confirm("Agendar esta estratégia?") &&
                    void save("SCHEDULED")
                  }
                  className="sx-premium-button"
                >
                  Agendar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    confirm("Ativar esta estratégia agora?") &&
                    void save("ACTIVE")
                  }
                  className="sx-premium-button" data-variant="primary"
                >
                  {busy && <LoaderCircle size={17} className="animate-spin" />}{" "}
                  Ativar promoção
                </button>
              </>
            )}
          </div>
        </form>
      </section>
    </Overlay>
  );
}

function Rules({
  form,
  setForm,
}: {
  form: FormState;
  setForm: (value: FormState) => void;
}) {
  const common = (
    <>
      <Field label="Nome da estratégia">
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Descrição opcional">
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </Field>
    </>
  );
  if (form.type === "COUPON")
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {common}
        <Field label="Código">
          <input
            value={form.code}
            onChange={(e) =>
              setForm({
                ...form,
                code: e.target.value.toUpperCase().replace(/\s/g, ""),
              })
            }
            placeholder="SORTEX10"
          />
        </Field>
        <Field label="Tipo de desconto">
          <select
            value={form.discountType}
            onChange={(e) => setForm({ ...form, discountType: e.target.value })}
          >
            <option value="PERCENTAGE">Percentual</option>
            <option value="FIXED">Valor fixo</option>
          </select>
        </Field>
        <Field label="Valor">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />
        </Field>
        <Preview>
          {form.code || "SORTEX10"} · {form.value}
          {form.discountType === "PERCENTAGE" ? "%" : ` reais`} de desconto
        </Preview>
      </div>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {common}
      <Field label="Quantidade comprada">
        <input
          type="number"
          min="1"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
      </Field>
      <Field
        label={
          form.strategyKey === "ROULETTE"
            ? "Quantidade de giros"
            : "Benefício / títulos extras"
        }
      >
        <input
          type="number"
          min="1"
          value={form.benefit}
          onChange={(e) => setForm({ ...form, benefit: e.target.value })}
        />
      </Field>
      <Field label="Faixas (quantidade:benefício)">
        <input
          value={form.tiers}
          onChange={(e) => setForm({ ...form, tiers: e.target.value })}
          placeholder="100:20, 300:80, 500:150"
        />
      </Field>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border px-4">
        <input
          type="checkbox"
          checked={form.isPopular}
          onChange={(e) => setForm({ ...form, isPopular: e.target.checked })}
        />
        <span className="font-bold">Destacar como Mais Popular</span>
      </label>
      <Preview>{naturalRule(form)}</Preview>
    </div>
  );
}

function Simulation({
  form,
  campaign,
}: {
  form: FormState;
  campaign?: Campaign;
}) {
  if (form.type !== "BONUS") {
    return <p className="sx-promo-inset">Estimativa indisponível para este tipo de estratégia. Revise as regras antes de continuar.</p>;
  }
  const quantity = Number(form.quantity) || 0,
    benefit = Number(form.benefit) || 0,
    price = campaign?.numberPrice || 0,
    uses = Number(form.totalLimit) || 1,
    cost = benefit * price * uses;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Review label="Custo promocional estimado" value={money.format(cost)} />
        <Review
          label="Títulos extras estimados"
          value={(benefit * uses).toLocaleString("pt-BR")}
        />
        <Review
          label="Preço médio com benefício"
          value={
            quantity + benefit
              ? money.format((quantity * price) / (quantity + benefit))
              : "Sem dados"
          }
        />
        <Review
          label="Ticket atual usado"
          value={money.format(quantity * price)}
        />
      </div>
      <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
        <b>Estimativa de execução manual, não garantia.</b> O bônus não é aplicado automaticamente no checkout. Hipóteses: valor atual da cota, regra
        configurada e{" "}
        {form.totalLimit
          ? "limite total informado"
          : "uma utilização ilustrativa"}
        . Receita e conversão projetadas não são exibidas sem base histórica
        suficiente.
      </p>
    </div>
  );
}

function DetailDrawer({
  detail,
  report,
  history,
  close,
}: {
  detail: { type: "report" | "history" | "share"; promotion: Promotion };
  report: PromotionReport | null;
  history: PromotionHistoryItem[];
  close: () => void;
}) {
  return (
    <Overlay close={close} drawer>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="promotion-detail-title"
        className="sx-premium-surface sx-promo-dialog sx-promo-drawer w-full sm:max-w-xl"
      >
        <ModalTitle
          id="promotion-detail-title"
          title={
            detail.type === "report"
              ? "Relatório da estratégia"
              : detail.type === "history"
                ? "Histórico da estratégia"
                : "Divulgar estratégia"
          }
          subtitle={detail.promotion.name}
          close={close}
        />
        {detail.type === "report" &&
          (report ? (
            <div className="mt-6">
              <div className="grid grid-cols-2 gap-3">
                <Review
                  label="Utilizações aprovadas"
                  value={String(report.usages)}
                />
                <Review
                  label="Compradores únicos"
                  value={String(report.uniqueBuyers)}
                />
                <Review
                  label="Receita atribuída"
                  value={money.format(report.revenue)}
                />
                <Review
                  label="Ticket médio"
                  value={money.format(report.averageTicket)}
                />
                <Review
                  label="Desconto concedido"
                  value={money.format(report.grantedDiscount)}
                />
              </div>
              <p className="mt-4 text-xs text-zinc-500">
                Fonte: {report.source}
              </p>
              {report.daily.length ? (
                <div className="mt-6 space-y-2">
                  {report.daily.map((day) => (
                    <div
                      key={day.date}
                      className="flex justify-between rounded-xl bg-zinc-50 p-3 text-sm"
                    >
                      <span>
                        {new Date(`${day.date}T12:00:00`).toLocaleDateString(
                          "pt-BR",
                        )}
                      </span>
                      <b>
                        {day.usages} · {money.format(day.revenue)}
                      </b>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-6 rounded-2xl bg-zinc-50 p-4 text-sm">
                  Ainda não existem utilizações aprovadas para gerar a evolução
                  diária.
                </p>
              )}
            </div>
          ) : (
            <Loading />
          ))}
        {detail.type === "history" &&
          (history.length ? (
            <div className="mt-6 space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-2xl border p-4">
                  <b>{actionLabels[item.action] || "Alteração registrada"}</b>
                  <p className="mt-1 text-sm text-zinc-500">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Loading text="Carregando histórico..." />
          ))}
        {detail.type === "share" && (
          <div className="mt-6">
            <p className="text-zinc-600">
              Revise a mensagem e escolha o canal. Nenhum envio será feito sem
              sua confirmação.
            </p>
            <div className="mt-5 grid gap-2">
              <Link
                href={`/dashboard/comunicacao?campaignId=${detail.promotion.campaign.id}&promotionId=${detail.promotion.id}`}
                className="flex min-h-12 items-center justify-center rounded-xl bg-violet-600 px-4 font-black text-white"
              >
                Criar mensagem com IA
              </Link>
              <Link
                href="/dashboard/integracoes?integration=WHATSAPP"
                className="flex min-h-12 items-center justify-center rounded-xl border px-4 font-black"
              >
                Conectar WhatsApp
              </Link>
              <Link
                href="/dashboard/integracoes?integration=META_ADS"
                className="flex min-h-12 items-center justify-center rounded-xl border px-4 font-black"
              >
                Conectar Meta
              </Link>
              <Link
                href={`/dashboard/ads?promotionId=${detail.promotion.id}`}
                className="flex min-h-12 items-center justify-center rounded-xl border px-4 font-black"
              >
                Abrir SorteX Ads
              </Link>
              <button
                onClick={() =>
                  navigator.clipboard?.writeText(
                    `${location.origin}/campanha/${detail.promotion.campaign.slug}`,
                  )
                }
                className="min-h-12 rounded-xl border px-4 font-black"
              >
                Copiar link da campanha
              </button>
            </div>
          </div>
        )}
      </aside>
    </Overlay>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gift;
  label: string;
  value: string | number;
}) {
  return (
    <div className="sx-premium-surface sx-promo-panel">
      <Icon size={18} className="sx-promo-accent" aria-hidden="true" />
      <span className="mt-3 block text-xs font-bold text-zinc-500">
        {label}
      </span>
      <b className="sx-promo-metric-value mt-1 block break-words text-xl">{value}</b>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="sx-promo-inset min-w-0 p-3">
      <span className="text-[11px] font-bold text-zinc-500">{label}</span>
      <b className="mt-1 block break-words text-xs">{value}</b>
    </div>
  );
}
function Action({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof Gift;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="sx-premium-button"
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </button>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-sm font-bold text-zinc-700">
      {label}
      <div className="mt-2 [&_input]:h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:px-3 [&_select]:h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:bg-white [&_select]:px-3">
        {children}
      </div>
    </label>
  );
}
function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
function Feedback({
  tone,
  close,
  children,
}: {
  tone: "success" | "error";
  close: () => void;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="sx-promo-feedback mt-4 flex items-center justify-between gap-3" data-tone={tone}
    >
      <span>{children}</span>
      <button onClick={close} aria-label="Fechar mensagem">
        <X size={17} />
      </button>
    </div>
  );
}
function Overlay({ children, close, drawer = false }: {
  children: ReactNode; close: () => void; drawer?: boolean;
}) {
  const overlay = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = overlay.current?.querySelector<HTMLElement>("[data-promotion-initial-focus]");
    target?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(overlay.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary',
    ) ?? []).filter((control) => control.getClientRects().length > 0 && control.tabIndex >= 0);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first && last) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last && first) {
      event.preventDefault();
      first.focus();
    }
  }
  return <div ref={overlay} className="sx-promo-overlay" data-drawer={drawer || undefined} onKeyDown={keyboard}>{children}</div>;
}
function ModalTitle({
  id,
  title,
  subtitle,
  close,
}: {
  id?: string;
  title: string;
  subtitle: string;
  close: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 id={id} className="sx-premium-section">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <button
        onClick={close}
        aria-label="Fechar" data-promotion-initial-focus
        className="sx-premium-button sx-promo-close"
      >
        <X size={18} />
      </button>
    </div>
  );
}
function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="sx-promo-inset p-4">
      <span className="text-xs font-bold text-zinc-500">{label}</span>
      <b className="mt-1 block break-words">{value}</b>
    </div>
  );
}
function Preview({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-violet-50 p-4 text-sm font-black text-violet-800 sm:col-span-2">
      Prévia: {children}
    </div>
  );
}
function Loading({ text = "Carregando dados reais..." }: { text?: string }) {
  return (
    <div className="sx-premium-muted mt-8 flex items-center justify-center gap-2" role="status">
      <LoaderCircle size={17} className="sx-promo-spin" aria-hidden="true" />
      {text}
    </div>
  );
}
function Empty({
  filtered,
  sectionOnly,
  create,
}: {
  filtered: boolean;
  sectionOnly: boolean;
  create: () => void;
}) {
  return (
    <section className="sx-premium-surface sx-promo-empty mt-6 text-center" aria-live="polite">
      <Gift className="sx-promo-accent mx-auto" size={32} aria-hidden="true" />
      <h2 className="mt-4 text-xl font-black">
        {filtered
          ? "Nenhuma promoção encontrada com esses filtros."
          : sectionOnly ? "Nenhuma estratégia nesta seção." : "Você ainda não criou nenhuma estratégia."}
      </h2>
      {!filtered && !sectionOnly && (
        <>
          <p className="mx-auto mt-2 max-w-lg text-zinc-500">
            Escolha um modelo pronto ou crie uma promoção personalizada para
            aumentar suas vendas.
          </p>
          <button
            onClick={create}
            className="sx-premium-button mt-5" data-variant="primary"
          >
            Escolher uma estratégia
          </button>
        </>
      )}
    </section>
  );
}
function SectionOptions() {
  return (
    <>
      {[
        ["execution", "Em execução"],
        ["scheduled", "Agendadas"],
        ["paused", "Pausadas"],
        ["drafts", "Rascunhos"],
        ["ended", "Encerradas"],
        ["all", "Todas"],
      ].map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </>
  );
}
function numberOrUndefined(value: string) {
  const number = Number(value);
  return number > 0 ? number : undefined;
}
function parseTiers(value: string, key: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [quantity, benefit] = item.split(":");
      return { quantity: Number(quantity), [key]: Number(benefit) };
    })
    .filter((item) => item.quantity > 0 && Number(item[key]) > 0);
}
function localDate(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}
function naturalRule(form: FormState) {
  if (form.type === "COUPON")
    return `Ao usar ${form.code || "o cupom"}, o comprador recebe ${form.value}${form.discountType === "PERCENTAGE" ? "%" : " reais"} de desconto.`;
  if (form.strategyKey === "ROULETTE")
    return `A cada ${form.quantity || 0} títulos, o comprador recebe ${form.benefit || 0} giro(s).`;
  if (form.strategyKey === "CUSTOM" && form.rules) return form.rules;
  return `Ao comprar pelo menos ${form.quantity || 0} títulos, o comprador recebe ${form.benefit || 0} títulos extras.`;
}
function hasCheckoutBenefit(type: string) {
  return type === "PACKAGE" || type === "COUPON";
}
function promotionRule(promotion: Promotion) {
  const config = promotion.config || {};
  if (promotion.type === "COUPON")
    return `Use ${config.code || promotion.coupons?.[0]?.code || "o cupom"} para receber ${config.discountValue || 0}${config.discountType === "PERCENTAGE" ? "%" : " reais"} de desconto.`;
  if (config.strategyKey === "ROULETTE")
    return `A cada ${config.quantity || 0} títulos, o comprador recebe ${config.rounds || 0} giro(s).`;
  if (config.naturalRule) return String(config.naturalRule);
  if (promotion.type === "BONUS")
    return `Ao comprar ${config.minimumQuantity || 0} títulos, receba ${config.extraQuantity || 0} títulos extras.`;
  return promotion.description || "Estratégia configurada para esta campanha.";
}
function period(promotion: Promotion) {
  if (!promotion.startsAt && !promotion.endsAt) return "Enquanto ativa";
  const start = promotion.startsAt
    ? new Date(promotion.startsAt).toLocaleDateString("pt-BR")
    : "Agora";
  const end = promotion.endsAt
    ? new Date(promotion.endsAt).toLocaleDateString("pt-BR")
    : "sem fim";
  return `${start} – ${end}`;
}
