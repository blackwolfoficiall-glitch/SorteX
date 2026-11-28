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
import AdsConfirmedSales from "./AdsConfirmedSales";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./ads-premium.module.css";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import {
  adAction,
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
  const [integrations, setIntegrations] = useState<OrganizerIntegration[]>([]),
    [metaStatusKnown, setMetaStatusKnown] = useState(false),
    [showModeHelp, setShowModeHelp] = useState(false),
    [showHowItWorks, setShowHowItWorks] = useState(false),
    [comingSoon, setComingSoon] = useState<string | null>(null),
    [connectionLoading, setConnectionLoading] = useState<string | null>(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [ads, campaignList, metaStatus, connections] = await Promise.allSettled([
        listAds(),
        getMyCampaigns(),
        metaAdsStatus(),
        listIntegrations(),
      ]);
      if (ads.status === "fulfilled") setItems(ads.value.items);
      if (campaignList.status === "fulfilled") setCampaigns(campaignList.value);
      setMetaStatusKnown(metaStatus.status === "fulfilled");
      if (metaStatus.status === "fulfilled") setMeta(metaStatus.value);
      if (connections.status === "fulfilled") setIntegrations(connections.value);
      if ([ads, campaignList, metaStatus, connections].some((item) => item.status === "rejected"))
        setError("Não foi possível carregar parte dos dados de gerenciamento de mídia.");
      const c = campaignList.status === "fulfilled" ? campaignList.value : [];
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
  }, []);
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
    <PremiumScope className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Mídia e origem das vendas</p>
          <h1 className={styles.title}>SorteX Ads</h1>
          <p className={styles.copy}>
            Compare pedidos pagos na SorteX e veja o que é possível medir por origem.
            Métricas verificadas de mídia são exibidas separadamente quando disponíveis.
          </p>
        </div>
        <div className={styles.heroActions}>
          <div className={styles.mode}>
            <button
              type="button"
              aria-expanded={showModeHelp}
              onClick={() => setShowModeHelp((value) => !value)}
              className={styles.secondary}
            >
              <HelpCircle size={17} aria-hidden="true" />
              {loading ? "Consultando modo" : !metaStatusKnown ? "Modo não confirmado" : metaConnected ? "Meta conectada" : "Modo Teste"}
            </button>
            {showModeHelp && (
              <p className={styles.modeHelp}>
                {!metaStatusKnown
                  ? "O estado de gerenciamento externo ainda não foi confirmado."
                  : metaConnected
                    ? "Conexão ativa não substitui a autorização para publicar nem comprova o desempenho de mídia."
                    : "Rascunhos e ativações em sandbox não são anúncios externos e não geram cobrança."}
              </p>
            )}
          </div>
          <button type="button" onClick={() => setOpen(true)} className={styles.primary}>
            <Plus size={18} aria-hidden="true" />
            Criar campanha
          </button>
          <a href="#area-de-gerenciamento-ads" className={styles.secondary}>Rascunhos e conexões</a>
        </div>
      </header>
      <AdsConfirmedSales campaigns={campaigns} />
      <section id="area-de-gerenciamento-ads" className={styles.management} aria-labelledby="ads-management-title">
        <header>
          <p className={styles.eyebrow}>Área de trabalho</p>
          <h2 id="ads-management-title">Rascunhos e conexões</h2>
          <p className={styles.copy}>As conexões abaixo são de gerenciamento. Elas não habilitam por si só a leitura de mídia no relatório.</p>
        </header>
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
                A conexão identifica sua conta. Ela não confirma elegibilidade para anúncios nem libera métricas de mídia no relatório.
              </p>
              <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                <span>Acesso e aprovação do anunciante</span>
                <span>Permissões verificadas pela plataforma</span>
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
                Conta conectada para gerenciamento
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
              <p className="mt-3 text-xs text-zinc-600">
                Este anúncio não possui métricas de período verificadas neste relatório.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => edit(ad)}
                  aria-label="Editar campanha de mídia"
                  className="rounded-xl border p-2"
                >
                  <Settings2 size={16} />
                </button>
                {!["LIVE_ACTIVE", "SANDBOX_ACTIVE"].includes(ad.status) && (
                  <button
                    onClick={() => void action(ad.id, "activate")}
                    aria-label="Ativar campanha de mídia"
                    className="rounded-xl border p-2 text-green-700"
                  >
                    <Play size={16} />
                  </button>
                )}
                {["LIVE_ACTIVE", "SANDBOX_ACTIVE"].includes(ad.status) && (
                  <button
                    onClick={() => void action(ad.id, "pause")}
                    aria-label="Pausar campanha de mídia"
                    className="rounded-xl border p-2 text-amber-700"
                  >
                    <Pause size={16} />
                  </button>
                )}
                <button
                  onClick={() => void duplicateAd(ad.id).then(load)}
                  aria-label="Duplicar campanha de mídia"
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
                  rel="noopener noreferrer"
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
            Você pode preparar um rascunho sem publicar nem investir em anúncios.
          </p>
          <button
            onClick={() => setOpen(true)}
            className="mt-6 min-h-12 rounded-xl bg-violet-600 px-6 font-black text-white"
          >
            Criar primeira campanha
          </button>
        </div>
      )}
      </section>
      {open && (
        <div className={`${styles.legacyDialog} fixed inset-0 z-[90] overflow-y-auto bg-black/55 p-0 sm:p-4`}>
          <form
            onSubmit={(e) => void save(e)}
            className="relative mx-auto min-h-full w-full bg-white p-5 sm:my-5 sm:min-h-0 sm:max-w-4xl sm:rounded-3xl md:p-7"
          >
            <button
              type="button"
              onClick={close}
              aria-label="Fechar editor de campanha"
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
    </PremiumScope>
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
