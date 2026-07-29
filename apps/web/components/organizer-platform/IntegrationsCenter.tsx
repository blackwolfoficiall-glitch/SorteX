"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  LoaderCircle,
  Megaphone,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Unplug,
  X,
} from "lucide-react";
import {
  configureIntegration,
  integrationAction,
  listIntegrations,
  registerIntegrationInterest,
  startMetaOAuth,
  type OrganizerIntegration,
} from "@/lib/organizer-platform/client";

type AvailableKind = "META_ADS" | "WHATSAPP";
type View = "available" | "connected" | "soon";
type PublicConfig = Record<string, unknown>;

const statusLabels: Record<string, string> = {
  NOT_CONNECTED: "Não conectado",
  CONFIGURING: "Conectando",
  SANDBOX_CONNECTED: "Modo demonstração",
  CONNECTED: "Conectado",
  ACTION_REQUIRED: "Ação necessária",
  EXPIRED: "Autorização expirada",
  ERROR: "Erro de conexão",
  DISCONNECTED: "Não conectado",
};

const future = [
  {
    type: "GOOGLE_ADS",
    name: "Google Ads",
    category: "Publicidade",
    description: "Campanhas e métricas da rede Google.",
  },
  {
    type: "TIKTOK_ADS",
    name: "TikTok Ads",
    category: "Publicidade",
    description: "Anúncios e desempenho no TikTok.",
  },
  {
    type: "TELEGRAM",
    name: "Telegram",
    category: "Comunicação",
    description: "Mensagens oficiais em canais e bots.",
  },
  {
    type: "X_ADS",
    name: "X Ads",
    category: "Publicidade",
    description: "Campanhas publicitárias na plataforma X.",
  },
  {
    type: "ZAPIER",
    name: "Zapier",
    category: "Automação",
    description: "Automação com ferramentas externas.",
  },
  {
    type: "MAKE",
    name: "Make",
    category: "Automação",
    description: "Cenários visuais de automação.",
  },
] as const;

export function IntegrationsCenter() {
  const router = useRouter();
  const search = useSearchParams();
  const requested = search.get("integration");
  const connected = search.get("connected");
  const oauthResult = search.get("oauth");
  const [items, setItems] = useState<OrganizerIntegration[]>([]);
  const [selected, setSelected] = useState<AvailableKind | null>(() =>
    requested === "WHATSAPP" || requested === "META_ADS" ? requested : null,
  );
  const [view, setView] = useState<View>("available");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(() =>
    connected
      ? {
          tone: "success",
          text:
            connected === "WHATSAPP"
              ? "WhatsApp Business conectado com sucesso."
              : "Meta Business conectada com sucesso.",
        }
      : oauthResult === "cancelled"
        ? {
            tone: "error",
            text: "Você cancelou a autorização antes da conclusão.",
          }
        : oauthResult === "error"
          ? {
              tone: "error",
              text: "Não foi possível concluir a conexão com a Meta.",
            }
          : null,
  );
  const [demoConfirm, setDemoConfirm] = useState<AvailableKind | null>(null);
  const [interests, setInterests] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listIntegrations());
    } catch (error) {
      setNotice({
        tone: "error",
        text: friendlyError(error, "Não foi possível carregar as integrações."),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const meta = items.find((item) => item.type === "META_ADS");
  const whatsapp = items.find((item) => item.type === "WHATSAPP");
  const connectedItems = items.filter((item) => isConnected(item));
  const history = useMemo(
    () =>
      items
        .flatMap((item) =>
          item.logs.map((log) => ({
            ...log,
            integration:
              item.type === "WHATSAPP"
                ? "WhatsApp Business"
                : item.type === "META_ADS"
                  ? "Meta Business"
                  : item.displayName || item.type,
          })),
        )
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .slice(0, 8),
    [items],
  );

  async function beginOAuth(kind: AvailableKind) {
    if (busy) return;
    setBusy(`oauth-${kind}`);
    setNotice(null);
    try {
      const result = await startMetaOAuth(kind);
      window.location.assign(result.url);
    } catch (error) {
      setNotice({
        tone: "error",
        text: friendlyError(
          error,
          "Conexão oficial temporariamente indisponível. A configuração da plataforma ainda está sendo concluída.",
        ),
      });
      setBusy("");
    }
  }

  async function enterDemo(kind: AvailableKind) {
    if (busy) return;
    setBusy(`demo-${kind}`);
    try {
      const configured = await configureIntegration({
        type: kind,
        displayName:
          kind === "WHATSAPP" ? "WhatsApp Business" : "Meta Business",
        provider: "Demonstração SorteX",
        publicConfig: { mode: "demo", demonstrativeData: true },
        permissions: [],
        sandbox: true,
      });
      await integrationAction(configured.id, "connect");
      setDemoConfirm(null);
      setNotice({
        tone: "success",
        text: "Modo demonstração ativado. Nenhuma conta externa foi conectada.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        text: friendlyError(
          error,
          "Não foi possível ativar o modo demonstração.",
        ),
      });
    } finally {
      setBusy("");
    }
  }

  async function runAction(
    item: OrganizerIntegration,
    action: "sync" | "disconnect",
  ) {
    if (busy) return;
    if (
      action === "disconnect" &&
      !window.confirm(
        `Deseja desconectar ${item.type === "WHATSAPP" ? "o WhatsApp Business" : "a Meta Business"}?`,
      )
    )
      return;
    setBusy(`${action}-${item.id}`);
    try {
      await integrationAction(item.id, action);
      setNotice({
        tone: "success",
        text:
          action === "sync"
            ? "Conexão sincronizada com sucesso."
            : "Integração desconectada com sucesso.",
      });
      await load();
    } catch (error) {
      setNotice({
        tone: "error",
        text: friendlyError(error, "Não foi possível concluir esta ação."),
      });
    } finally {
      setBusy("");
    }
  }

  async function notify(type: (typeof future)[number]["type"], name: string) {
    if (busy) return;
    setBusy(`notify-${type}`);
    try {
      await registerIntegrationInterest(type);
      setInterests((current) => new Set(current).add(type));
      setNotice({
        tone: "success",
        text: `Interesse em ${name} registrado. Avisaremos quando estiver disponível.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: friendlyError(error, "Não foi possível registrar seu interesse."),
      });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 overflow-x-hidden pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
            Canais oficiais
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Integrações</h1>
          <p className="mt-2 max-w-2xl text-zinc-500">
            Conecte os canais usados pela SorteX para anunciar, comunicar e
            automatizar.
          </p>
        </div>
        <span className="rounded-full border bg-white px-3 py-1.5 text-xs font-black text-zinc-600">
          <ShieldCheck className="mr-1 inline" size={15} /> Credenciais
          protegidas no backend
        </span>
      </header>

      {notice && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 text-sm font-bold ${notice.tone === "error" ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
        >
          <span className="flex-1">{notice.text}</span>
          <div className="flex items-center gap-2">
            {notice.tone === "error" && (
              <button
                onClick={() => void load()}
                className="rounded-lg border border-current px-3 py-1.5"
              >
                Tentar novamente
              </button>
            )}
            <button
              aria-label="Fechar mensagem"
              onClick={() => setNotice(null)}
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}

      <nav
        aria-label="Seções das integrações"
        className="grid grid-cols-3 rounded-2xl bg-zinc-100 p-1"
      >
        {(
          [
            ["available", "Disponíveis"],
            ["connected", `Conectadas (${connectedItems.length})`],
            ["soon", "Em breve"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={view === key}
            onClick={() => setView(key)}
            className={`min-h-11 rounded-xl px-2 text-sm font-black transition ${view === key ? "bg-white text-violet-700 shadow-sm" : "text-zinc-500 hover:text-zinc-900"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <IntegrationSkeleton />
      ) : (
        <>
          {(view === "available" || view === "connected") && (
            <section aria-labelledby="available-title">
              <div className="mb-4">
                <h2 id="available-title" className="text-xl font-black">
                  Conexões disponíveis
                </h2>
                <p className="text-sm text-zinc-500">
                  Entre pela plataforma oficial ou conheça a experiência em modo
                  demonstração.
                </p>
              </div>
              {view === "connected" && !connectedItems.length ? (
                <EmptyConnected onAvailable={() => setView("available")} />
              ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                  {(view === "available" || isConnected(meta)) && (
                    <ConnectionCard
                      kind="META_ADS"
                      item={meta}
                      busy={busy}
                      onOpen={() => setSelected("META_ADS")}
                      onOAuth={() => beginOAuth("META_ADS")}
                      onDemo={() => setDemoConfirm("META_ADS")}
                      onSync={() => meta && runAction(meta, "sync")}
                      onDisconnect={() => meta && runAction(meta, "disconnect")}
                      onNavigate={(path) => router.push(path)}
                    />
                  )}
                  {(view === "available" || isConnected(whatsapp)) && (
                    <ConnectionCard
                      kind="WHATSAPP"
                      item={whatsapp}
                      busy={busy}
                      onOpen={() => setSelected("WHATSAPP")}
                      onOAuth={() => beginOAuth("WHATSAPP")}
                      onDemo={() => setDemoConfirm("WHATSAPP")}
                      onSync={() => whatsapp && runAction(whatsapp, "sync")}
                      onDisconnect={() =>
                        whatsapp && runAction(whatsapp, "disconnect")
                      }
                      onNavigate={(path) => router.push(path)}
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {(view === "available" || view === "soon") && (
            <section className="rounded-3xl border bg-white p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-black">Em breve</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Novos canais oficiais, sem formulários incompletos.
                </p>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {future.map((entry) => {
                  const interested = interests.has(entry.type);
                  return (
                    <article
                      key={entry.name}
                      className="flex min-w-0 items-center gap-3 rounded-2xl bg-zinc-50 p-4"
                    >
                      <Clock3 className="shrink-0 text-zinc-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black">{entry.name}</h3>
                          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-black uppercase">
                            Em breve
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          {entry.description}
                        </p>
                        <button
                          disabled={
                            interested || busy === `notify-${entry.type}`
                          }
                          onClick={() => void notify(entry.type, entry.name)}
                          className="mt-2 text-xs font-black text-violet-700 disabled:text-emerald-700"
                        >
                          {busy === `notify-${entry.type}`
                            ? "Registrando…"
                            : interested
                              ? "✓ Interesse registrado"
                              : "Avise-me"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border bg-white p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <History size={19} /> Histórico recente
              </h2>
              {history.length ? (
                <div className="mt-4 divide-y">
                  {history.map((log) => (
                    <div key={log.id} className="py-3">
                      <div className="flex justify-between gap-3">
                        <b className="text-sm">{log.integration}</b>
                        <time className="text-xs text-zinc-400">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </time>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {friendlyLog(log.action)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-zinc-500">
                  Nenhuma atividade de conexão registrada.
                </p>
              )}
            </div>
            <div className="rounded-3xl border bg-white p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <ShieldCheck size={19} /> Saúde das conexões
              </h2>
              <div className="mt-4 space-y-3">
                <Health name="Meta Business" item={meta} />
                <Health name="WhatsApp Business" item={whatsapp} />
              </div>
            </div>
          </section>
        </>
      )}

      {selected && (
        <ConnectionDrawer
          kind={selected}
          item={selected === "META_ADS" ? meta : whatsapp}
          busy={busy}
          onClose={() => setSelected(null)}
          onOAuth={() => void beginOAuth(selected)}
          onDemo={() => setDemoConfirm(selected)}
          onSync={() => {
            const item = selected === "META_ADS" ? meta : whatsapp;
            if (item) void runAction(item, "sync");
          }}
          onDisconnect={() => {
            const item = selected === "META_ADS" ? meta : whatsapp;
            if (item) void runAction(item, "disconnect");
          }}
          onNavigate={(path) => router.push(path)}
        />
      )}
      {demoConfirm && (
        <DemoDialog
          kind={demoConfirm}
          busy={busy === `demo-${demoConfirm}`}
          onClose={() => setDemoConfirm(null)}
          onConfirm={() => void enterDemo(demoConfirm)}
        />
      )}
    </div>
  );
}

function ConnectionCard({
  kind,
  item,
  busy,
  onOpen,
  onOAuth,
  onDemo,
  onSync,
  onDisconnect,
  onNavigate,
}: {
  kind: AvailableKind;
  item?: OrganizerIntegration;
  busy: string;
  onOpen: () => void;
  onOAuth: () => void;
  onDemo: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  onNavigate: (path: string) => void;
}) {
  const isMeta = kind === "META_ADS",
    connected = isConnected(item),
    demo = item?.status === "SANDBOX_CONNECTED";
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer rounded-3xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`grid size-13 place-items-center rounded-2xl ${isMeta ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}
        >
          {isMeta ? <BarChart3 size={27} /> : <MessageCircle size={27} />}
        </div>
        <Status value={item?.status || "NOT_CONNECTED"} />
      </div>
      <h3 className="mt-5 text-2xl font-black">
        {isMeta ? "Meta Business" : "WhatsApp Business"}
      </h3>
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        {isMeta
          ? "Publique e acompanhe anúncios no Instagram e Facebook sem sair da SorteX."
          : "Conecte seu número comercial para enviar mensagens oficiais, acompanhar entregas e usar automações."}
      </p>
      <ul className="mt-5 grid gap-2 text-sm font-semibold text-zinc-700 sm:grid-cols-2">
        {(isMeta
          ? [
              "Meta e Instagram Ads",
              "Contas e Páginas",
              "Instagram profissional",
              "Métricas oficiais",
            ]
          : [
              "Modelos aprovados",
              "Status de entrega",
              "Webhooks oficiais",
              "Automações",
            ]
        ).map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <Check className="text-emerald-600" size={15} />
            {feature}
          </li>
        ))}
      </ul>
      {connected && <ConnectionSummary kind={kind} item={item!} />}
      <div
        className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
        onClick={(event) => event.stopPropagation()}
      >
        {!connected ? (
          <>
            <button
              disabled={Boolean(busy)}
              onClick={onOAuth}
              className="min-h-11 rounded-xl bg-violet-700 px-4 font-black text-white transition hover:bg-violet-800 active:scale-[.98] disabled:opacity-50"
            >
              {busy === `oauth-${kind}`
                ? "Abrindo ambiente oficial…"
                : isMeta
                  ? "Conectar com a Meta"
                  : "Conectar WhatsApp Business"}
            </button>
            <button
              disabled={Boolean(busy)}
              onClick={onDemo}
              className="min-h-11 rounded-xl border px-4 font-bold hover:bg-zinc-50 disabled:opacity-50"
            >
              Testar em modo demonstração
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onOpen}
              className="min-h-11 rounded-xl bg-violet-700 px-4 font-black text-white"
            >
              Gerenciar
            </button>
            <button
              disabled={Boolean(busy)}
              onClick={onSync}
              className="min-h-11 rounded-xl border px-4 font-bold"
            >
              Sincronizar
            </button>
            <button
              onClick={() =>
                onNavigate(isMeta ? "/dashboard/ads" : "/dashboard/comunicacao")
              }
              className="min-h-11 rounded-xl border px-4 font-bold"
            >
              {isMeta ? "Ir para SorteX Ads" : "Abrir Comunicação"}
            </button>
            <button
              disabled={Boolean(busy)}
              onClick={onDisconnect}
              className="min-h-11 rounded-xl px-3 text-sm font-bold text-red-700"
            >
              Desconectar
            </button>
          </>
        )}
      </div>
      {demo && (
        <p className="mt-3 text-xs font-bold text-amber-700">
          Dados demonstrativos — nenhuma conta externa está conectada.
        </p>
      )}
    </article>
  );
}

function ConnectionDrawer({
  kind,
  item,
  busy,
  onClose,
  onOAuth,
  onDemo,
  onSync,
  onDisconnect,
  onNavigate,
}: {
  kind: AvailableKind;
  item?: OrganizerIntegration;
  busy: string;
  onClose: () => void;
  onOAuth: () => void;
  onDemo: () => void;
  onSync: () => void;
  onDisconnect: () => void;
  onNavigate: (path: string) => void;
}) {
  const meta = kind === "META_ADS",
    connected = isConnected(item);
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-title"
    >
      <div className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 p-5 backdrop-blur">
          <div>
            <p className="text-xs font-black uppercase text-violet-600">
              Conexão oficial
            </p>
            <h2 id="connection-title" className="text-xl font-black">
              {connected
                ? `Gerenciar ${meta ? "Meta Business" : "WhatsApp Business"}`
                : `Conectar ${meta ? "Meta Business" : "WhatsApp Business"}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-xl p-2 hover:bg-zinc-100"
          >
            <X />
          </button>
        </header>
        <div className="flex-1 p-5 sm:p-8">
          {!connected ? (
            <>
              <div className="rounded-3xl bg-gradient-to-br from-violet-50 to-blue-50 p-6">
                <ShieldCheck className="text-violet-700" size={34} />
                <h3 className="mt-4 text-2xl font-black">
                  Login seguro no ambiente oficial
                </h3>
                <p className="mt-2 leading-7 text-zinc-600">
                  {meta
                    ? "Você será direcionado ao ambiente oficial da Meta para entrar na sua conta e escolher os ativos que deseja conectar."
                    : "O Embedded Signup oficial permite escolher sua empresa, conta WhatsApp Business e número sem copiar tokens ou identificadores."}
                </p>
              </div>
              <ol className="mt-7 space-y-4">
                {(meta
                  ? [
                      "Entre com sua conta no ambiente oficial da Meta.",
                      "Autorize empresa, conta de anúncios, Página e Instagram profissional.",
                      "Revise os ativos retornados e conclua a conexão.",
                    ]
                  : [
                      "Continue com a Meta pelo Embedded Signup oficial.",
                      "Selecione ou crie a empresa, conta WhatsApp Business e número elegível.",
                      "Autorize as permissões e retorne à SorteX para concluir.",
                    ]
                ).map((text, index) => (
                  <li key={text} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-sm font-black text-violet-700">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-sm font-semibold text-zinc-700">
                      {text}
                    </p>
                  </li>
                ))}
              </ol>
              {!meta && (
                <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                  Dependendo da disponibilidade da sua conta, você poderá
                  conectar um número existente ou cadastrar um novo número.
                </p>
              )}
              <div className="mt-8 grid gap-3">
                <button
                  disabled={Boolean(busy)}
                  onClick={onOAuth}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 font-black text-white disabled:opacity-50"
                >
                  {busy === `oauth-${kind}` && (
                    <LoaderCircle className="animate-spin" size={18} />
                  )}{" "}
                  Continuar com a Meta <ExternalLink size={16} />
                </button>
                <button
                  disabled={Boolean(busy)}
                  onClick={onDemo}
                  className="min-h-12 rounded-xl border font-bold"
                >
                  Testar em modo demonstração
                </button>
                <button
                  onClick={onClose}
                  className="min-h-11 font-bold text-zinc-500"
                >
                  Voltar
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
                <CheckCircle2 />
                <div>
                  <b>
                    {item?.status === "SANDBOX_CONNECTED"
                      ? "Modo demonstração"
                      : `${meta ? "Meta Business" : "WhatsApp Business"} conectada`}
                  </b>
                  <p className="text-xs">
                    {item?.status === "SANDBOX_CONNECTED"
                      ? "Nenhuma operação externa será realizada."
                      : "A autorização oficial está ativa."}
                  </p>
                </div>
              </div>
              {item && <ConnectionSummary kind={kind} item={item} expanded />}
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  disabled={Boolean(busy)}
                  onClick={onSync}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 font-black text-white"
                >
                  <RefreshCw size={17} />
                  Sincronizar
                </button>
                <button
                  onClick={() =>
                    onNavigate(
                      meta ? "/dashboard/ads" : "/dashboard/comunicacao",
                    )
                  }
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 font-bold"
                >
                  {meta ? (
                    <>
                      <BarChart3 size={17} />
                      Ir para SorteX Ads
                    </>
                  ) : (
                    <>
                      <MessageCircle size={17} />
                      Abrir Comunicação
                    </>
                  )}
                </button>
                {!meta && (
                  <button
                    onClick={() =>
                      onNavigate("/dashboard/comunicacao?section=modelos")
                    }
                    className="min-h-11 rounded-xl border px-4 font-bold"
                  >
                    Modelos de mensagem
                  </button>
                )}
                <button
                  disabled={Boolean(busy)}
                  onClick={onDisconnect}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 font-bold text-red-700"
                >
                  <Unplug size={17} />
                  Desconectar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectionSummary({
  kind,
  item,
  expanded = false,
}: {
  kind: AvailableKind;
  item: OrganizerIntegration;
  expanded?: boolean;
}) {
  const config = (item.publicConfig || {}) as PublicConfig;
  const business = firstRecord(config.businesses);
  const ad = firstRecord(config.adAccounts);
  const page = firstRecord(config.pages);
  const instagram = record(page?.instagram_business_account);
  return (
    <div
      className={`mt-5 grid gap-3 rounded-2xl bg-zinc-50 p-4 text-sm ${expanded ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}
    >
      {kind === "META_ADS" ? (
        <>
          <Detail label="Empresa" value={stringValue(business?.name)} />
          <Detail
            label="Conta de anúncios"
            value={maskIdentifier(stringValue(ad?.name), stringValue(ad?.id))}
          />
          <Detail label="Página" value={stringValue(page?.name)} />
          <Detail
            label="Instagram"
            value={instagram ? `Conta profissional vinculada` : "Não vinculado"}
          />
        </>
      ) : (
        <>
          <Detail label="Empresa" value={stringValue(business?.name)} />
          <Detail
            label="Número"
            value={maskPhone(stringValue(config.displayPhoneNumber))}
          />
          <Detail
            label="Nome de exibição"
            value={stringValue(config.verifiedName) || item.displayName}
          />
          <Detail
            label="Webhook"
            value={item.status === "CONNECTED" ? "Ativo" : "Modo demonstração"}
          />
        </>
      )}
      <Detail
        label="Última sincronização"
        value={
          item.lastSyncedAt
            ? new Date(item.lastSyncedAt).toLocaleString("pt-BR")
            : "Ainda não sincronizada"
        }
      />
    </div>
  );
}
function DemoDialog({
  kind,
  busy,
  onClose,
  onConfirm,
}: {
  kind: AvailableKind;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <Megaphone className="text-violet-700" />
        <h2 className="mt-4 text-2xl font-black">
          Entrar no modo demonstração?
        </h2>
        <p className="mt-3 leading-7 text-zinc-600">
          O modo demonstração permite conhecer a interface sem conectar uma
          conta real. Nenhum anúncio será publicado e nenhuma mensagem será
          enviada.
        </p>
        <p className="mt-3 text-sm font-bold text-amber-700">
          Integração:{" "}
          {kind === "META_ADS" ? "Meta Business" : "WhatsApp Business"}
        </p>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            disabled={busy}
            onClick={onClose}
            className="min-h-11 rounded-xl border px-5 font-bold"
          >
            Cancelar
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-violet-700 px-5 font-black text-white disabled:opacity-50"
          >
            {busy ? "Ativando…" : "Entrar no modo demonstração"}
          </button>
        </div>
      </div>
    </div>
  );
}
function Status({ value }: { value: string }) {
  const label = statusLabels[value] || "Não conectado";
  const style =
    value === "CONNECTED"
      ? "bg-emerald-100 text-emerald-800"
      : value === "SANDBOX_CONNECTED"
        ? "bg-amber-100 text-amber-800"
        : value === "ERROR"
          ? "bg-red-100 text-red-800"
          : "bg-zinc-100 text-zinc-700";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${style}`}>
      {label}
    </span>
  );
}
function Health({ name, item }: { name: string; item?: OrganizerIntegration }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 p-4">
      <div>
        <b className="text-sm">{name}</b>
        <p className="mt-1 text-xs text-zinc-500">
          {item?.lastError
            ? "A conexão precisa de atenção."
            : isConnected(item)
              ? "Conexão operacional."
              : "Aguardando conexão."}
        </p>
      </div>
      <Status value={item?.status || "NOT_CONNECTED"} />
    </div>
  );
}
function EmptyConnected({ onAvailable }: { onAvailable: () => void }) {
  return (
    <div className="rounded-3xl border bg-white p-10 text-center">
      <ShieldCheck className="mx-auto text-zinc-300" size={38} />
      <h3 className="mt-4 text-xl font-black">Nenhuma conexão ativa</h3>
      <p className="mt-2 text-sm text-zinc-500">
        Conecte a Meta ou o WhatsApp Business pelo fluxo oficial.
      </p>
      <button
        onClick={onAvailable}
        className="mt-5 rounded-xl bg-violet-700 px-5 py-3 font-black text-white"
      >
        Ver conexões disponíveis
      </button>
    </div>
  );
}
function IntegrationSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {[0, 1].map((key) => (
        <div key={key} className="h-96 animate-pulse rounded-3xl bg-zinc-100" />
      ))}
    </div>
  );
}
function Detail({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <b className="mt-1 block truncate text-zinc-800">
        {value || "Não disponível"}
      </b>
    </div>
  );
}
function isConnected(item?: OrganizerIntegration) {
  return item?.status === "CONNECTED" || item?.status === "SANDBOX_CONNECTED";
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function firstRecord(value: unknown) {
  return Array.isArray(value) ? record(value[0]) : null;
}
function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
function maskIdentifier(name: string, id: string) {
  return name
    ? `${name}${id ? ` •••${id.slice(-4)}` : ""}`
    : id
      ? `•••${id.slice(-4)}`
      : "Não disponível";
}
function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8
    ? `•••• ••••-${digits.slice(-4)}`
    : "Não disponível";
}
function friendlyLog(action: string) {
  const labels: Record<string, string> = {
    OAUTH_CONNECTED: "Conta conectada pelo ambiente oficial.",
    CONNECTED: "Modo demonstração ativado.",
    SYNCED: "Conexão sincronizada.",
    DISCONNECTED: "Integração desconectada.",
    CONFIGURED: "Preferência registrada.",
  };
  return labels[action] || "Estado da conexão atualizado.";
}
function friendlyError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (/sessão|unauthorized|401/i.test(message))
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (/temporariamente indisponível|configuração.*concluída/i.test(message))
    return "Conexão oficial temporariamente indisponível. A configuração da plataforma ainda está sendo concluída.";
  if (/cancel|denied|negad/i.test(message))
    return "Você cancelou a autorização antes da conclusão.";
  return fallback;
}
