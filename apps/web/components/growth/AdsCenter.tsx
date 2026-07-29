"use client";
import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  PanelsTopLeft,
  HelpCircle,
  LoaderCircle,
  Megaphone,
  MessageCircle,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import {
  adAction,
  adsDashboard,
  createAd,
  duplicateAd,
  generateAdStrategy,
  listAds,
  metaAdsStatus,
  publishAd,
  selectMetaAssets,
  syncAd,
  updateAd,
  type AdvisorAdStrategy,
  type AdsDashboardData,
  type MetaAdsIntegration,
  type SortexAd,
} from "@/lib/growth/client";
import {
  listIntegrations,
  startMetaOAuth,
  type OrganizerIntegration,
} from "@/lib/organizer-platform/client";
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const statuses: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendada",
  SANDBOX_ACTIVE: "Ativa em sandbox",
  LIVE_ACTIVE: "Ativa na Meta",
  PAUSED: "Pausada",
  ENDED: "Encerrada",
  CANCELLED: "Cancelada",
};
const objectives: Record<string, string> = {
  VISITS: "Mais visitas",
  PARTICIPANTS: "Mais compradores",
  SALES: "Mais vendas",
  ABANDONED_RESERVATIONS: "Recuperar reservas",
  PROMOTION: "Divulgar promoção",
  NEW_CAMPAIGN: "Campanha nova",
  DRAW_APPROACHING: "Sorteio próximo",
};
const empty = {
  name: "",
  campaignId: "",
  objective: "SALES",
  channels: ["INSTAGRAM", "FACEBOOK"],
  budgetType: "TOTAL",
  budget: "35",
  startsAt: "",
  endsAt: "",
  minAge: "18",
  maxAge: "65",
  gender: "ALL",
  interests: "sorteios, prêmios",
  state: "",
  cities: "",
  radius: "",
  title: "",
  text: "",
  cta: "PARTICIPAR_AGORA",
  imageUrl: "",
  videoUrl: "",
  link: "",
  calendar: "Story 12h, Feed 18h, Reels 20h",
};
type AdForm = typeof empty;
type SetAdForm = Dispatch<SetStateAction<AdForm>>;

export default function AdsCenter() {
  const router = useRouter();
  const [items, setItems] = useState<SortexAd[]>([]),
    [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [stats, setStats] = useState<AdsDashboardData>({}),
    [meta, setMeta] = useState<MetaAdsIntegration>({
      status: "NOT_CONNECTED",
      sandbox: true,
    }),
    [form, setForm] = useState({ ...empty }),
    [open, setOpen] = useState(false),
    [step, setStep] = useState(1),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [editingId, setEditingId] = useState<string | null>(null),
    [strategy, setStrategy] = useState<AdvisorAdStrategy | null>(null);
  const [period, setPeriod] = useState("30D"),
    [campaignFilter, setCampaignFilter] = useState(""),
    [platformFilter, setPlatformFilter] = useState("ALL"),
    [adTypeFilter, setAdTypeFilter] = useState(""),
    [startDate, setStartDate] = useState(""),
    [endDate, setEndDate] = useState("");
  const [integrations, setIntegrations] = useState<OrganizerIntegration[]>([]),
    [showModeHelp, setShowModeHelp] = useState(false),
    [showHowItWorks, setShowHowItWorks] = useState(false),
    [comingSoon, setComingSoon] = useState<string | null>(null),
    [connectionLoading, setConnectionLoading] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const dashboardQuery = new URLSearchParams({
        period,
        ...(campaignFilter ? { campaignId: campaignFilter } : {}),
        ...(platformFilter !== "ALL" ? { platform: platformFilter } : {}),
        ...(adTypeFilter ? { adType: adTypeFilter } : {}),
        ...(period === "CUSTOM" && startDate ? { startDate } : {}),
        ...(period === "CUSTOM" && endDate ? { endDate } : {}),
      });
      const [a, c, s, m, connectedIntegrations] = await Promise.all([
        listAds(),
        getMyCampaigns(),
        adsDashboard(`?${dashboardQuery.toString()}`),
        metaAdsStatus(),
        listIntegrations(),
      ]);
      setItems(a.items);
      setCampaigns(c);
      setStats(s);
      setMeta(m);
      setIntegrations(connectedIntegrations);
      const requested =
        typeof window === "undefined"
          ? null
          : new URLSearchParams(window.location.search);
      const requestedCampaign = c.find(
        (campaign) => campaign.id === requested?.get("campaignId"),
      );
      setForm((v) =>
        requestedCampaign
          ? {
              ...v,
              campaignId: requestedCampaign.id,
              title: requestedCampaign.title,
              link: `${window.location.origin}/campanha/${requestedCampaign.slug}`,
            }
          : v.campaignId
            ? v
            : { ...v, campaignId: c[0]?.id || "", title: c[0]?.title || "" },
      );
      if (requested?.get("action") === "create") setOpen(true);
    } catch {
      setError(
        "Não foi possível carregar seus anúncios agora. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }
  const loadLatest = useEffectEvent(load);
  useEffect(() => {
    const timer = window.setTimeout(() => void loadLatest(), 0);
    return () => window.clearTimeout(timer);
  }, [period, campaignFilter, platformFilter, adTypeFilter, startDate, endDate]);
  function toggle(channel: string) {
    setForm((v) => ({
      ...v,
      channels: v.channels.includes(channel)
        ? v.channels.filter((x) => x !== channel)
        : [...v.channels, channel],
    }));
  }
  async function importStrategy() {
    if (!form.campaignId) return;
    setBusy(true);
    try {
      const s = await generateAdStrategy(form.campaignId, form.objective);
      setStrategy(s);
      setForm((v) => ({
        ...v,
        name: v.name || `Estratégia — ${s.campaignTitle}`,
        budget: String(s.suggestedBudget),
        budgetType: s.budgetType,
        minAge: String(s.audience.minAge),
        maxAge: String(s.audience.maxAge),
        gender: s.audience.gender,
        cities: s.audience.cities.join(", "),
        interests: s.audience.interests.join(", "),
        title: s.creative.title,
        text: s.creative.text,
        cta: s.creative.cta,
        link: s.creative.link,
        calendar: s.calendar.map((x) => `${x.format} ${x.hour}h`).join(", "),
      }));
      setNotice(
        "Estratégia preenchida pela IA. Revise tudo antes de publicar.",
      );
    } catch {
      setError("Não foi possível gerar a estratégia agora. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = payloadFrom(form);
      if (editingId) await updateAd(editingId, payload);
      else await createAd(payload);
      setNotice("Rascunho salvo. Nenhum anúncio foi publicado.");
      close();
      await load();
    } catch {
      setError(
        "Não foi possível salvar a campanha. Revise os dados e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    setBusy(true);
    setError("");
    try {
      let id = editingId;
      if (id) await updateAd(id, payloadFrom(form));
      else id = (await createAd(payloadFrom(form))).id;
      const result = await publishAd(id);
      setNotice(result.message);
      close();
      await load();
    } catch {
      setError(
        "Não foi possível publicar a campanha. Revise sua conexão e tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  function edit(ad: SortexAd) {
    const a = ad.audience,
      l = ad.location,
      c = ad.creative;
    setForm({
      ...empty,
      name: ad.name,
      campaignId: ad.campaign.id,
      objective: ad.objective,
      channels: ad.channels,
      budgetType: ad.budgetType,
      budget: String(ad.budget),
      minAge: String(a.minAge ?? 18),
      maxAge: String(a.maxAge ?? 65),
      gender: textValue(a.gender, "ALL"),
      interests: stringList(a.interests).join(", "),
      state: textValue(l.state),
      cities: stringList(l.cities).join(", "),
      radius: String(l.radius ?? ""),
      title: textValue(c.title),
      text: textValue(c.text),
      cta: textValue(c.cta, "PARTICIPAR_AGORA"),
      imageUrl: textValue(c.imageUrl),
      videoUrl: textValue(c.videoUrl),
      link: textValue(c.link),
      calendar: stringList(c.calendar).join(", "),
      startsAt: "",
      endsAt: "",
    });
    setEditingId(ad.id);
    setOpen(true);
    setStep(1);
  }
  function close() {
    setOpen(false);
    setStep(1);
    setEditingId(null);
    setStrategy(null);
    setForm({
      ...empty,
      campaignId: campaigns[0]?.id || "",
      title: campaigns[0]?.title || "",
    });
  }
  async function connect() {
    if (connectionLoading) return;
    setConnectionLoading("META_ADS");
    setError("");
    try {
      const { url } = await startMetaOAuth("META_ADS");
      location.assign(url);
    } catch {
      router.push(
        "/dashboard/integracoes?integration=META_ADS&origem=sortex-ads",
      );
    } finally {
      setConnectionLoading(null);
    }
  }
  function openWhatsApp() {
    if (connectionLoading) return;
    setConnectionLoading("WHATSAPP");
    router.push(
      "/dashboard/integracoes?integration=WHATSAPP&origem=sortex-ads",
    );
  }
  async function chooseAssets() {
    const account = (
        document.getElementById("meta-ad-account") as HTMLSelectElement
      )?.value,
      page = (document.getElementById("meta-page") as HTMLSelectElement)?.value;
    if (!account || !page) return;
    try {
      await selectMetaAssets(account, page);
      setNotice("Conexão atualizada com sucesso.");
      await load();
    } catch {
      setError("Não foi possível atualizar a conexão. Tente novamente.");
    }
  }
  async function action(id: string, a: "activate" | "pause" | "end") {
    try {
      await adAction(id, a);
      await load();
    } catch {
      setError("Não foi possível concluir esta ação. Tente novamente.");
    }
  }
  const metaConnected = meta.status === "CONNECTED" && !meta.sandbox;
  const whatsapp = integrations.find((item) => item.type === "WHATSAPP");
  const waitingStatuses = [
    "NOT_CONNECTED",
    "CONFIGURING",
    "DISCONNECTED",
    "SANDBOX_CONNECTED",
  ];
  const connectionState =
    meta.status === "ERROR"
      ? "Erro de autenticação"
      : metaConnected
        ? "Meta conectada"
        : waitingStatuses.includes(meta.status)
          ? "Aguardando conexão"
          : "Em manutenção";
  const connectionDot =
    meta.status === "ERROR"
      ? "bg-red-400"
      : metaConnected
        ? "bg-green-400"
        : connectionState === "Em manutenção"
          ? "bg-white"
          : "bg-amber-300";
  return (
    <div className="mx-auto w-full max-w-[1500px] overflow-x-hidden pb-12">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
            Gerenciador de mídia
          </p>
          <h1 className="mt-2 text-3xl font-black">SorteX Ads</h1>
          <p className="mt-2 max-w-2xl text-zinc-500">
            A IA sugere. Somente você revisa e autoriza a execução.
          </p>
        </div>
        <div className="relative flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <button
            onClick={() => setShowModeHelp((value) => !value)}
            className={`flex min-h-9 items-center justify-center gap-2 rounded-full px-4 text-xs font-black ${metaConnected ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-700"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${metaConnected ? "bg-green-500" : "bg-zinc-400"}`}
            />
            {metaConnected ? "Modo Produção" : "Modo Teste"}
          </button>
          {showModeHelp && (
            <div className="absolute right-0 top-11 z-20 w-72 rounded-2xl border bg-white p-4 text-xs leading-5 text-zinc-600 shadow-xl">
              {metaConnected
                ? "Campanhas aprovadas podem ser publicadas na conta Meta conectada."
                : "Você pode criar e testar campanhas sem publicação externa ou cobrança."}
            </div>
          )}
          <button
            onClick={() => setOpen(true)}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 font-bold text-white"
          >
            <Plus size={18} />
            Criar campanha
          </button>
        </div>
      </header>
      <section
        aria-labelledby="ads-intelligence-title"
        className="mt-6 rounded-[2rem] border bg-white p-5 shadow-sm md:p-7"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">
              Dashboard unificado
            </p>
            <h2 id="ads-intelligence-title" className="mt-1 text-2xl font-black">
              Inteligência de marketing
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Métricas reais das plataformas conectadas e das campanhas
              rastreadas pela SorteX.
            </p>
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
            {[
              ["TODAY", "Hoje"],
              ["7D", "7 dias"],
              ["30D", "30 dias"],
              ["90D", "90 dias"],
              ["CUSTOM", "Personalizado"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={period === value}
                onClick={() => setPeriod(value)}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${period === value ? "bg-violet-700 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-violet-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-zinc-700">
            Campanha SorteX
            <select
              value={campaignFilter}
              onChange={(event) => setCampaignFilter(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border bg-white px-3"
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-zinc-700">
            Plataforma
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border bg-white px-3"
            >
              <option value="ALL">Todas as plataformas</option>
              <option value="META_ADS">Meta Ads</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="FACEBOOK">Facebook</option>
              <option value="WHATSAPP">WhatsApp Business</option>
              <option value="YOUTUBE">YouTube</option>
              <option value="GOOGLE">Google Ads</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-zinc-700">
            Tipo de anúncio
            <select
              value={adTypeFilter}
              onChange={(event) => setAdTypeFilter(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border bg-white px-3"
            >
              <option value="">Todos os objetivos</option>
              {Object.entries(objectives).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {period === "CUSTOM" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Período inicial">
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </Field>
            <Field label="Período final">
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </Field>
          </div>
        )}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <Stat label="Investimento" value={money.format(stats.spent || 0)} />
          <Stat label="Alcance" value={stats.reach || 0} />
          <Stat label="Impressões" value={stats.impressions || 0} />
          <Stat label="CTR" value={ratio(stats.clicks, stats.impressions)} />
          <Stat
            label="CPC"
            value={money.format(
              stats.clicks ? (stats.spent || 0) / stats.clicks : 0,
            )}
          />
          <Stat label="Conversões" value={stats.sales || 0} />
          <Stat
            label="ROAS"
            value={
              stats.spent
                ? `${((stats.revenue || 0) / stats.spent).toFixed(2)}x`
                : "—"
            }
          />
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
          <DailyEvolution rows={stats.daily || []} />
          <AiMarketingSummary data={stats} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(stats.platforms || []).map((platform) => (
            <PlatformMetrics key={platform.key} platform={platform} />
          ))}
        </div>
      </section>
      {!metaConnected ? (
        <section className="mt-6 overflow-hidden rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-950 via-violet-800 to-fuchsia-700 p-6 text-white shadow-xl md:p-8">
          <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                <span className={`h-2 w-2 rounded-full ${connectionDot}`} />
                {connectionState}
              </span>
              <h2 className="mt-4 text-2xl font-black md:text-3xl">
                Conecte sua conta Meta
              </h2>
              <p className="mt-2 max-w-2xl text-violet-100">
                Conecte sua conta para publicar anúncios diretamente no
                Instagram e Facebook sem sair da SorteX.
              </p>
              <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                <span>✓ Publicar campanhas</span>
                <span>✓ Gerenciar anúncios</span>
                <span>✓ Acompanhar métricas</span>
                <span>✓ Controlar orçamento</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={connectionLoading === "META_ADS"}
                onClick={() => void connect()}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-black text-violet-800 transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:cursor-wait disabled:opacity-70"
              >
                {connectionLoading === "META_ADS" && (
                  <LoaderCircle size={18} className="animate-spin" />
                )}
                {connectionLoading === "META_ADS"
                  ? "Abrindo conexão..."
                  : "Conectar Meta"}
              </button>
              <button
                type="button"
                onClick={() => setShowHowItWorks(true)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/30 px-5 font-bold transition hover:bg-white/10 active:scale-[.98]"
              >
                <HelpCircle size={17} />
                Saiba como funciona
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-[2rem] border border-green-100 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Meta conectada
              </span>
              <h2 className="mt-4 text-2xl font-black">
                Sua mídia está pronta para produção
              </h2>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <ConnectionDetail
                  label="Empresa"
                  value={meta.businesses?.[0]?.name || "Conta Meta"}
                />
                <ConnectionDetail
                  label="Instagram conectado"
                  value={
                    meta.pages?.some((page) => page.instagram_business_account)
                      ? "Sim"
                      : "Não identificado"
                  }
                />
                <ConnectionDetail
                  label="Conta de anúncios"
                  value={
                    meta.adAccounts?.find(
                      (account) => account.id === meta.selectedAdAccountId,
                    )?.name || "Selecione uma conta"
                  }
                />
                <ConnectionDetail
                  label="Última sincronização"
                  value={
                    meta.lastSyncedAt
                      ? new Date(meta.lastSyncedAt).toLocaleString("pt-BR")
                      : "Ainda não sincronizada"
                  }
                />
              </div>
            </div>
            {meta.adAccounts?.length && meta.pages?.length ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  id="meta-ad-account"
                  defaultValue={meta.selectedAdAccountId || ""}
                  className="h-11 min-w-0 rounded-xl border bg-white px-3"
                >
                  <option value="">Conta de anúncios</option>
                  {meta.adAccounts.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <select
                  id="meta-page"
                  defaultValue={meta.selectedPageId || ""}
                  className="h-11 min-w-0 rounded-xl border bg-white px-3"
                >
                  <option value="">Página</option>
                  {meta.pages.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void chooseAssets()}
                  className="h-11 rounded-xl bg-zinc-900 px-4 font-bold text-white"
                >
                  Gerenciar conexão
                </button>
              </div>
            ) : null}
          </div>
        </section>
      )}
      {notice && (
        <p className="mt-4 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-800">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <section id="conexoes" className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-violet-600">
              Ecossistema de mídia
            </p>
            <h2 className="mt-1 text-2xl font-black">Conexões</h2>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <ConnectionCard
            icon={<PanelsTopLeft />}
            name="Meta Ads"
            status={
              metaConnected
                ? "Conectado"
                : meta.status === "ERROR"
                  ? "Erro de autenticação"
                  : "Não conectado"
            }
            tone={
              metaConnected ? "green" : meta.status === "ERROR" ? "red" : "gray"
            }
            onClick={() => void connect()}
            loading={connectionLoading === "META_ADS"}
            disabled={Boolean(connectionLoading)}
          />
          <ConnectionCard
            icon={<MessageCircle />}
            name="WhatsApp Business"
            status={
              whatsapp?.status === "CONNECTED" ? "Conectado" : "Não conectado"
            }
            tone={whatsapp?.status === "CONNECTED" ? "green" : "gray"}
            onClick={openWhatsApp}
            loading={connectionLoading === "WHATSAPP"}
            disabled={Boolean(connectionLoading)}
          />
          <ConnectionCard
            icon={<ExternalLink />}
            name="Google Ads"
            status="Em breve"
            tone="muted"
            onClick={() => setComingSoon("Google Ads")}
          />
          <ConnectionCard
            icon={<Megaphone />}
            name="TikTok Ads"
            status="Em breve"
            tone="muted"
            onClick={() => setComingSoon("TikTok Ads")}
          />
          <ConnectionCard
            icon={<ExternalLink />}
            name="X Ads"
            status="Em breve"
            tone="muted"
            onClick={() => setComingSoon("X Ads")}
          />
        </div>
      </section>
      {items.length > 0 && (
        <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <Stat label="Campanhas ativas" value={stats.active} />
          <Stat label="Investimento" value={money.format(stats.spent || 0)} />
          <Stat label="Receita" value={money.format(stats.revenue || 0)} />
          <Stat label="Conversões" value={stats.sales} />
          <Stat label="CTR" value={ratio(stats.clicks, stats.impressions)} />
          <Stat
            label="CPM"
            value={money.format(
              stats.impressions
                ? ((stats.spent || 0) / stats.impressions) * 1000
                : 0,
            )}
          />
          <Stat
            label="CPC"
            value={money.format(
              stats.clicks ? (stats.spent || 0) / stats.clicks : 0,
            )}
          />
        </section>
      )}
      {loading ? (
        <div className="grid h-72 place-items-center">
          <LoaderCircle className="animate-spin text-violet-600" />
        </div>
      ) : items.length ? (
        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          {items.map((ad) => (
            <article
              key={ad.id}
              className="rounded-3xl border bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <span className="text-xs font-black uppercase text-violet-600">
                    {objectives[ad.objective] || ad.objective}
                  </span>
                  <h2 className="mt-1 text-xl font-black">{ad.name}</h2>
                  <p className="text-sm text-zinc-500">{ad.campaign.title}</p>
                </div>
                <span className="h-fit rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold">
                  {statuses[ad.status] || ad.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                <Mini label="Alcance" value={ad.reach || 0} />
                <Mini label="Cliques" value={ad.clicks} />
                <Mini
                  label="CTR"
                  value={`${Number(ad.ctr || 0).toFixed(2)}%`}
                />
                <Mini label="CPC" value={money.format(ad.cpc || 0)} />
                <Mini label="Vendas" value={ad.approvedSales} />
                <Mini
                  label="ROAS"
                  value={
                    ad.spent
                      ? `${(ad.attributedRevenue / ad.spent).toFixed(2)}x`
                      : "—"
                  }
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => edit(ad)}
                  className="rounded-xl border p-2"
                >
                  <Settings2 size={16} />
                </button>
                {!["LIVE_ACTIVE", "SANDBOX_ACTIVE"].includes(ad.status) && (
                  <button
                    onClick={() => void action(ad.id, "activate")}
                    className="rounded-xl border p-2 text-green-700"
                  >
                    <Play size={16} />
                  </button>
                )}
                {["LIVE_ACTIVE", "SANDBOX_ACTIVE"].includes(ad.status) && (
                  <button
                    onClick={() => void action(ad.id, "pause")}
                    className="rounded-xl border p-2 text-amber-700"
                  >
                    <Pause size={16} />
                  </button>
                )}
                <button
                  onClick={() => void duplicateAd(ad.id).then(load)}
                  className="rounded-xl border p-2"
                >
                  <Copy size={16} />
                </button>
                {ad.status === "LIVE_ACTIVE" && (
                  <button
                    onClick={() => void syncAd(ad.id).then(load)}
                    className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"
                  >
                    <RefreshCw size={16} />
                    Sincronizar
                  </button>
                )}
                <a
                  href={`/s/${ad.code}`}
                  target="_blank"
                  className="ml-auto rounded-xl bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700"
                >
                  Link rastreado
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="mt-8 overflow-hidden rounded-[2rem] border bg-white p-8 text-center shadow-sm md:p-14">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-violet-100 to-fuchsia-50 text-violet-600">
            <Megaphone size={36} />
          </div>
          <h2 className="mt-5 text-2xl font-black">
            Você ainda não possui campanhas publicadas.
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-zinc-500">
            Conecte sua conta Meta e publique sua primeira campanha.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-6 min-h-12 rounded-xl bg-violet-600 px-6 font-black text-white"
          >
            Criar primeira campanha
          </button>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/55 p-0 sm:p-4">
          <form
            onSubmit={(e) => void save(e)}
            className="relative mx-auto min-h-full w-full bg-white p-5 sm:my-5 sm:min-h-0 sm:max-w-4xl sm:rounded-3xl md:p-7"
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-4 top-4 rounded-full p-2"
            >
              <X />
            </button>
            <p className="text-xs font-black uppercase text-violet-600">
              Etapa {step} de 5
            </p>
            <h2 className="mt-1 pr-10 text-2xl font-black">
              {editingId ? "Editar campanha" : "Nova campanha de mídia"}
            </h2>
            {step === 1 && (
              <StepOne
                form={form}
                setForm={setForm}
                campaigns={campaigns}
                toggle={toggle}
                importStrategy={importStrategy}
                busy={busy}
              />
            )}{" "}
            {step === 2 && (
              <StepAudience form={form} setForm={setForm} strategy={strategy} />
            )}{" "}
            {step === 3 && <StepBudget form={form} setForm={setForm} />}{" "}
            {step === 4 && <StepCreative form={form} setForm={setForm} />}{" "}
            {step === 5 && (
              <Approval form={form} campaigns={campaigns} meta={meta} />
            )}
            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                disabled={step === 1}
                onClick={() => setStep((x) => x - 1)}
                className="h-12 rounded-xl border px-5 font-bold disabled:opacity-30"
              >
                Voltar
              </button>
              {step < 5 ? (
                <button
                  type="button"
                  onClick={() => setStep((x) => x + 1)}
                  className="h-12 rounded-xl bg-violet-600 px-6 font-bold text-white sm:ml-auto"
                >
                  Avançar
                </button>
              ) : (
                <>
                  <button
                    disabled={busy}
                    className="h-12 rounded-xl border px-5 font-bold sm:ml-auto"
                  >
                    Salvar rascunho
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void approve()}
                    className="h-12 rounded-xl bg-green-600 px-6 font-black text-white"
                  >
                    {busy
                      ? "Publicando..."
                      : meta.status === "CONNECTED" && !meta.sandbox
                        ? "Publicar na Meta"
                        : "Ativar em sandbox"}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
      {showHowItWorks && <InfoModal onClose={() => setShowHowItWorks(false)} />}
      {comingSoon && (
        <ComingSoonModal
          channel={comingSoon}
          onClose={() => setComingSoon(null)}
        />
      )}
    </div>
  );
}
function payloadFrom(f: typeof empty) {
  return {
    name: f.name,
    campaignId: f.campaignId,
    objective: f.objective,
    channels: f.channels,
    budgetType: f.budgetType,
    budget: Number(f.budget),
    startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : undefined,
    endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
    audience: {
      minAge: Number(f.minAge),
      maxAge: Number(f.maxAge),
      gender: f.gender,
      interests: f.interests
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    },
    location: {
      country: "BR",
      state: f.state,
      cities: f.cities
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      radius: Number(f.radius) || null,
    },
    creative: {
      title: f.title,
      text: f.text,
      cta: f.cta,
      imageUrl: f.imageUrl,
      videoUrl: f.videoUrl,
      link: f.link,
      calendar: f.calendar
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    },
  };
}
function StepOne({
  form,
  setForm,
  campaigns,
  toggle,
  importStrategy,
  busy,
}: {
  form: AdForm;
  setForm: SetAdForm;
  campaigns: Campaign[];
  toggle: (channel: string) => void;
  importStrategy: () => Promise<void>;
  busy: boolean;
}) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="Nome">
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Campanha">
        <select
          value={form.campaignId}
          onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
        >
          {campaigns.map((c: Campaign) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Objetivo">
        <select
          value={form.objective}
          onChange={(e) => setForm({ ...form, objective: e.target.value })}
        >
          {Object.entries(objectives).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <b className="text-sm">Canais</b>
        <div className="mt-2 flex flex-wrap gap-2">
          {["INSTAGRAM", "FACEBOOK", "WHATSAPP"].map((x) => (
            <button
              type="button"
              key={x}
              onClick={() => toggle(x)}
              className={`rounded-xl border px-3 py-2 text-sm font-bold ${form.channels.includes(x) ? "bg-violet-600 text-white" : ""}`}
            >
              {x === "WHATSAPP"
                ? "WhatsApp"
                : x === "FACEBOOK"
                  ? "Facebook"
                  : "Instagram"}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        disabled={busy || !form.campaignId}
        onClick={() => void importStrategy()}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-violet-50 font-black text-violet-700 md:col-span-2"
      >
        <Bot size={18} />
        Preencher estratégia com IA SorteX
      </button>
    </div>
  );
}
function StepAudience({
  form,
  setForm,
  strategy,
}: {
  form: AdForm;
  setForm: SetAdForm;
  strategy: AdvisorAdStrategy | null;
}) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="Idade mínima">
        <input
          type="number"
          min={18}
          value={form.minAge}
          onChange={(e) => setForm({ ...form, minAge: e.target.value })}
        />
      </Field>
      <Field label="Idade máxima">
        <input
          type="number"
          max={65}
          value={form.maxAge}
          onChange={(e) => setForm({ ...form, maxAge: e.target.value })}
        />
      </Field>
      <Field label="Sexo">
        <select
          value={form.gender}
          onChange={(e) => setForm({ ...form, gender: e.target.value })}
        >
          <option value="ALL">Todos</option>
          <option value="FEMALE">Feminino</option>
          <option value="MALE">Masculino</option>
        </select>
      </Field>
      <Field label="Interesses">
        <input
          value={form.interests}
          onChange={(e) => setForm({ ...form, interests: e.target.value })}
        />
      </Field>
      <Field label="Estado">
        <input
          value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })}
        />
      </Field>
      <Field label="Cidades">
        <input
          value={form.cities}
          onChange={(e) => setForm({ ...form, cities: e.target.value })}
        />
      </Field>
      <Field label="Raio planejado (km)">
        <input
          type="number"
          value={form.radius}
          onChange={(e) => setForm({ ...form, radius: e.target.value })}
        />
      </Field>
      {strategy && (
        <p className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-800 md:col-span-2">
          {strategy.audience.evidence}
        </p>
      )}
    </div>
  );
}
function StepBudget({
  form,
  setForm,
}: {
  form: AdForm;
  setForm: SetAdForm;
}) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="Orçamento">
        <input
          type="number"
          min="1"
          step=".01"
          value={form.budget}
          onChange={(e) => setForm({ ...form, budget: e.target.value })}
        />
        <div className="mt-2 flex flex-wrap gap-1">
          {[20, 35, 50, 100, 250, 500].map((x) => (
            <button
              type="button"
              key={x}
              onClick={() => setForm({ ...form, budget: String(x) })}
              className="rounded-lg border px-2 py-1 text-xs"
            >
              R$ {x}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Tipo">
        <select
          value={form.budgetType}
          onChange={(e) => setForm({ ...form, budgetType: e.target.value })}
        >
          <option value="TOTAL">Total</option>
          <option value="DAILY">Diário</option>
        </select>
      </Field>
      <Field label="Início">
        <input
          type="datetime-local"
          value={form.startsAt}
          onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
        />
      </Field>
      <Field label="Término">
        <input
          type="datetime-local"
          value={form.endsAt}
          onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
        />
      </Field>
      <p className="text-sm text-zinc-500 md:col-span-2">
        A sugestão de orçamento não é garantia de resultado. A cobrança real
        pertence à Meta.
      </p>
    </div>
  );
}
function StepCreative({
  form,
  setForm,
}: {
  form: AdForm;
  setForm: SetAdForm;
}) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <Field label="Título">
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </Field>
      <Field label="Chamada">
        <select
          value={form.cta}
          onChange={(e) => setForm({ ...form, cta: e.target.value })}
        >
          <option value="PARTICIPAR_AGORA">Participar agora</option>
          <option value="COMPRAR_TITULOS">Comprar títulos</option>
          <option value="VER_CAMPANHA">Ver campanha</option>
        </select>
      </Field>
      <Field label="Legenda">
        <textarea
          value={form.text}
          onChange={(e) => setForm({ ...form, text: e.target.value })}
        />
      </Field>
      <Field label="Imagem pública">
        <input
          type="url"
          value={form.imageUrl}
          onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
        />
      </Field>
      <Field label="Vídeo público (Story/Reels)">
        <input
          type="url"
          value={form.videoUrl}
          onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
        />
      </Field>
      <Field label="Link">
        <input
          value={form.link}
          onChange={(e) => setForm({ ...form, link: e.target.value })}
        />
      </Field>
      <Field label="Calendário sugerido">
        <textarea
          value={form.calendar}
          onChange={(e) => setForm({ ...form, calendar: e.target.value })}
        />
      </Field>
      <div className="rounded-2xl bg-zinc-100 p-5">
        <small>Prévia</small>
        <h3 className="mt-3 text-xl font-black">
          {form.title || "Título do anúncio"}
        </h3>
        <p className="mt-2 text-sm">{form.text || "Legenda do criativo."}</p>
        <button
          type="button"
          className="mt-4 rounded-xl bg-violet-600 px-4 py-2 text-white"
        >
          Participar agora
        </button>
      </div>
    </div>
  );
}
function Approval({
  form,
  campaigns,
  meta,
}: {
  form: AdForm;
  campaigns: Campaign[];
  meta: MetaAdsIntegration;
}) {
  return (
    <div className="mt-5 rounded-3xl border bg-zinc-50 p-5">
      <h3 className="flex items-center gap-2 text-xl font-black">
        <CheckCircle2 className="text-green-600" />
        Central de aprovação
      </h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Mini
          label="Campanha"
          value={
            campaigns.find((x: Campaign) => x.id === form.campaignId)?.title ||
            "—"
          }
        />
        <Mini label="Canais" value={form.channels.join(", ")} />
        <Mini
          label="Orçamento"
          value={money.format(Number(form.budget) || 0)}
        />
        <Mini label="Público" value={form.cities || "Brasil"} />
        <Mini label="Calendário" value={form.calendar} />
        <Mini
          label="Execução"
          value={
            meta.status === "CONNECTED" && !meta.sandbox
              ? "API oficial Meta"
              : "Sandbox"
          }
        />
      </div>
      <div className="mt-4 rounded-2xl bg-white p-4">
        <b>{form.title}</b>
        <p className="mt-2 text-sm">{form.text}</p>
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        A IA não possui permissão para executar esta publicação.
      </p>
    </div>
  );
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
function DailyEvolution({
  rows,
}: {
  rows: Array<{
    date: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
}) {
  const maximum = Math.max(1, ...rows.map((row) => row.clicks));
  return (
    <article className="rounded-3xl bg-zinc-50 p-5">
      <h3 className="font-black">Evolução diária</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Cliques e conversões registrados no período.
      </p>
      {rows.length ? (
        <div className="mt-5 flex min-h-44 items-end gap-2 overflow-x-auto">
          {rows.map((row) => (
            <div
              key={row.date}
              className="flex min-w-12 flex-1 flex-col items-center gap-2"
              title={`${row.clicks} cliques · ${row.conversions} conversões`}
            >
              <span className="text-[10px] font-bold text-zinc-500">
                {row.clicks}
              </span>
              <span
                className="w-full min-w-8 rounded-t-lg bg-gradient-to-t from-violet-700 to-fuchsia-500"
                style={{
                  height: `${Math.max(8, (row.clicks / maximum) * 120)}px`,
                }}
              />
              <span className="text-[10px] text-zinc-500">
                {new Date(`${row.date}T12:00:00`).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-white p-5 text-sm text-zinc-500">
          Ainda não há eventos suficientes neste período.
        </p>
      )}
    </article>
  );
}

function AiMarketingSummary({ data }: { data: AdsDashboardData }) {
  const recommendations = data.recommendations;
  return (
    <article className="rounded-3xl bg-gradient-to-br from-violet-950 to-violet-700 p-5 text-white">
      <div className="flex items-center gap-2">
        <Bot size={20} />
        <h3 className="font-black">IA SorteX analisa</h3>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <InsightLine
          label="Melhor canal"
          value={recommendations?.bestChannel?.name || "Histórico insuficiente"}
        />
        <InsightLine
          label="Canal a revisar"
          value={recommendations?.worstChannel?.name || "Histórico insuficiente"}
        />
        <InsightLine
          label="Maior retorno"
          value={
            recommendations?.campaignWithHighestReturn?.title ||
            "Sem investimento atribuído"
          }
        />
        <InsightLine
          label="Previsão para 30 dias"
          value={
            recommendations?.forecast
              ? money.format(recommendations.forecast.next30Days)
              : "Histórico insuficiente"
          }
        />
        <InsightLine
          label="Melhor horário"
          value={
            recommendations?.idealHour
              ? `${String(recommendations.idealHour.hour).padStart(2, "0")}:00 · ${recommendations.idealHour.conversions} conversões`
              : "Histórico insuficiente"
          }
        />
        <InsightLine
          label="Cidade que mais converte"
          value={recommendations?.topCities[0]?.name || "Dados indisponíveis"}
        />
        <InsightLine
          label="Público mais eficiente"
          value={
            recommendations?.efficientAudiences[0]?.name ||
            "Dados indisponíveis"
          }
        />
        <InsightLine
          label="Campanhas abaixo da média"
          value={
            recommendations?.underperformingCampaigns.length
              ? recommendations.underperformingCampaigns
                  .map((item) => item.title)
                  .join(", ")
              : "Nenhuma identificada"
          }
        />
        {recommendations?.investmentSuggestion && (
          <p className="rounded-2xl bg-white/10 p-3">
            {recommendations.investmentSuggestion}
          </p>
        )}
        {(recommendations?.unavailable || []).map((message) => (
          <p key={message} className="text-xs text-violet-200">
            {message}
          </p>
        ))}
      </div>
    </article>
  );
}

function InsightLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
      <span className="text-violet-200">{label}</span>
      <b className="text-right">{value}</b>
    </div>
  );
}

function PlatformMetrics({
  platform,
}: {
  platform: NonNullable<AdsDashboardData["platforms"]>[number];
}) {
  const entries = Object.entries(platform.metrics)
    .filter(([, value]) => value != null)
    .slice(0, 6);
  return (
    <article className="rounded-3xl border bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-black">{platform.name}</h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${platform.connected ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}
        >
          {platform.connected ? "Conectado" : "Integração necessária"}
        </span>
      </div>
      {entries.length ? (
        <dl className="mt-4 grid grid-cols-2 gap-3">
          {entries.map(([key, value]) => (
            <div key={key} className="rounded-xl bg-zinc-50 p-3">
              <dt className="text-[11px] text-zinc-500">{metricLabel(key)}</dt>
              <dd className="mt-1 font-black">
                {formatMetric(key, Number(value))}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          Métricas disponíveis após conectar a API oficial e sincronizar a
          conta.
        </p>
      )}
    </article>
  );
}

function metricLabel(value: string) {
  return (
    {
      campaigns: "Campanhas",
      investment: "Investimento",
      reach: "Alcance",
      impressions: "Impressões",
      clicks: "Cliques",
      conversions: "Conversões",
      revenue: "Receita atribuída",
      ctr: "CTR",
      cpc: "CPC",
      cpm: "CPM",
      roas: "ROAS",
      costPerConversion: "Custo por conversão",
      sent: "Enviadas",
      delivered: "Entregues",
      read: "Lidas",
      replied: "Respondidas",
      followers: "Seguidores",
      views: "Visualizações",
      engagement: "Engajamento",
      subscribers: "Inscritos",
    }[value] || value
  );
}

function formatMetric(key: string, value: number) {
  if (["investment", "revenue", "cpc", "cpm", "costPerConversion"].includes(key))
    return money.format(value);
  if (key === "ctr") return `${value.toFixed(2)}%`;
  if (key === "roas") return `${value.toFixed(2)}x`;
  return new Intl.NumberFormat("pt-BR").format(value);
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) {
  return (
    <div className="min-w-0 rounded-2xl border bg-white p-4">
      <small className="block truncate text-zinc-500">{label}</small>
      <b className="mt-2 block break-words text-xl">{value ?? 0}</b>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl bg-white p-3">
      <small className="text-zinc-500">{label}</small>
      <b className="mt-1 block break-words text-sm">{value}</b>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm font-bold [&_input]:mt-2 [&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:px-3 [&_select]:mt-2 [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:px-3 [&_textarea]:mt-2 [&_textarea]:min-h-24 [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:p-3">
      {label}
      {children}
    </label>
  );
}
function ratio(a = 0, b = 0) {
  return b ? `${((a / b) * 100).toFixed(2)}%` : "0%";
}
function ConnectionDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <span className="text-xs font-bold text-zinc-500">{label}</span>
      <b className="mt-1 block break-words">{value}</b>
    </div>
  );
}
function ConnectionCard({
  icon,
  name,
  status,
  tone,
  onClick,
  loading = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  name: string;
  status: string;
  tone: "green" | "red" | "gray" | "muted";
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const colors = {
    green: "bg-green-50 text-green-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-zinc-100 text-zinc-700",
    muted: "bg-zinc-50 text-zinc-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading}
      className="w-full rounded-3xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md active:translate-y-0 active:scale-[.99] disabled:cursor-wait disabled:opacity-60"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
          {loading ? <LoaderCircle className="animate-spin" /> : icon}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-black ${colors[tone]}`}
        >
          {status}
        </span>
      </div>
      <h3 className="mt-5 font-black">{name}</h3>
    </button>
  );
}

function InfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ads-help-title"
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:max-w-2xl sm:rounded-[2rem] sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase tracking-[.18em] text-violet-600">
              SorteX Ads
            </span>
            <h2 id="ads-help-title" className="mt-2 text-2xl font-black">
              Como funciona o SorteX Ads
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-100 transition hover:bg-zinc-200 active:scale-95"
          >
            <X size={19} />
          </button>
        </div>
        <p className="mt-4 text-zinc-600">
          O SorteX Ads permite criar e gerenciar campanhas publicitárias sem
          sair da plataforma.
        </p>
        <ol className="mt-6 space-y-3">
          {[
            "Conecte sua conta Meta.",
            "Conecte seu WhatsApp Business.",
            "A IA SorteX analisa sua campanha.",
            "A IA sugere o melhor público, orçamento e horário.",
            "Você revisa.",
            "Você publica.",
            "O SorteX Ads acompanha os resultados em tempo real.",
          ].map((item, index) => (
            <li key={item} className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
                {index + 1}
              </span>
              <span className="pt-0.5 text-sm font-semibold text-zinc-700">
                {item}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl bg-zinc-50 p-4">
          <h3 className="font-black">Em breve</h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-600">
            <li>• Google Ads</li>
            <li>• TikTok Ads</li>
            <li>• X Ads</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-12 w-full rounded-xl bg-violet-600 px-6 font-black text-white transition hover:bg-violet-700 active:scale-[.99]"
        >
          Entendi
        </button>
      </section>
    </div>
  );
}

function ComingSoonModal({
  channel,
  onClose,
}: {
  channel: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="coming-soon-title"
        className="w-full rounded-t-[2rem] bg-white p-6 text-center shadow-2xl sm:max-w-md sm:rounded-[2rem] sm:p-8"
      >
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-violet-100 text-violet-700">
          <Megaphone />
        </span>
        <h2 id="coming-soon-title" className="mt-4 text-2xl font-black">
          {channel} — Em breve
        </h2>
        <p className="mt-2 text-zinc-600">
          Esta conexão está sendo preparada para chegar ao SorteX Ads com uma
          experiência segura e completa.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-12 w-full rounded-xl bg-violet-600 px-6 font-black text-white transition hover:bg-violet-700 active:scale-[.99]"
        >
          Entendi
        </button>
      </section>
    </div>
  );
}
