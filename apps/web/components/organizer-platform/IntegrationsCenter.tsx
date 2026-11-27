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
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./integrations-premium.module.css";
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
    <PremiumScope className={styles.scope}>
      <section
        className={styles.content}
        aria-labelledby="organizer-integrations-title"
      >
        <header className={styles.banner}>
          <div>
            <p className={styles.eyebrow}>Canais oficiais</p>
            <h1 id="organizer-integrations-title" className="sx-premium-title">
              Integrações
            </h1>
            <p className={`mt-2 max-w-2xl ${styles.muted}`}>
              Conecte os canais usados pela SorteX para anunciar, comunicar e
              automatizar.
            </p>
          </div>
          <span className={styles.status}>
            <ShieldCheck aria-hidden="true" className="mr-1 inline" size={15} />{" "}
            Credenciais protegidas no backend
          </span>
        </header>

        {notice && (
          <div role="status" className={styles.notice} data-tone={notice.tone}>
            <span className="flex-1">{notice.text}</span>
            <div className="flex items-center gap-2">
              {notice.tone === "error" && (
                <button
                  onClick={() => void load()}
                  className="sx-premium-button"
                >
                  Tentar novamente
                </button>
              )}
              <button
                className="sx-premium-button"
                aria-label="Fechar mensagem"
                onClick={() => setNotice(null)}
              >
                <X aria-hidden="true" size={17} />
              </button>
            </div>
          </div>
        )}

        <nav aria-label="Seções das integrações" className={styles.tabs}>
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
              className={styles.tab}
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
                  <p className={`text-sm ${styles.muted}`}>
                    Entre pela plataforma oficial ou conheça a experiência em
                    modo demonstração.
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
                        onDisconnect={() =>
                          meta && runAction(meta, "disconnect")
                        }
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
              <section className={`p-4 sm:p-6 ${styles.surface}`}>
                <div>
                  <h2 className="text-xl font-black">Em breve</h2>
                  <p className={`mt-1 text-sm ${styles.muted}`}>
                    Novos canais oficiais, sem formulários incompletos.
                  </p>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {future.map((entry) => {
                    const interested = interests.has(entry.type);
                    return (
                      <article
                        key={entry.name}
                        className={`flex min-w-0 items-start gap-3 rounded-2xl p-3 sm:p-4 ${styles.inset}`}
                      >
                        <Clock3
                          aria-hidden="true"
                          className={`shrink-0 ${styles.muted}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black">{entry.name}</h3>
                            <span className={styles.status}>Em breve</span>
                          </div>
                          <p className={`mt-1 text-xs ${styles.muted}`}>
                            {entry.description}
                          </p>
                          <button
                            disabled={
                              interested || busy === `notify-${entry.type}`
                            }
                            onClick={() => void notify(entry.type, entry.name)}
                            className={`mt-2 sx-premium-button ${styles.interest}`}
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
              <div className={`p-4 sm:p-6 ${styles.surface}`}>
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <History aria-hidden="true" size={19} /> Histórico recente
                </h2>
                {history.length ? (
                  <div className={`mt-4 ${styles.history}`}>
                    {history.map((log) => (
                      <div key={log.id} className="py-3">
                        <div className="flex flex-wrap justify-between gap-2">
                          <b className="text-sm">{log.integration}</b>
                          <time className={`text-xs ${styles.muted}`}>
                            {new Date(log.createdAt).toLocaleString("pt-BR")}
                          </time>
                        </div>
                        <p className={`mt-1 text-xs ${styles.muted}`}>
                          {friendlyLog(log.action)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`mt-5 text-sm ${styles.muted}`}>
                    Nenhuma atividade de conexão registrada.
                  </p>
                )}
              </div>
              <div className={`p-4 sm:p-6 ${styles.surface}`}>
                <h2 className="flex items-center gap-2 text-lg font-black">
                  <ShieldCheck aria-hidden="true" size={19} /> Saúde das
                  conexões
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
      </section>
    </PremiumScope>
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
      className={`p-4 sm:p-7 ${styles.surface} ${styles.card}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div
          className={styles.providerIcon}
          data-tone={isMeta ? "brand" : "success"}
        >
          {isMeta ? (
            <BarChart3 aria-hidden="true" size={27} />
          ) : (
            <MessageCircle aria-hidden="true" size={27} />
          )}
        </div>
        <Status value={item?.status || "NOT_CONNECTED"} />
      </div>
      <h3 className="mt-5 text-2xl font-black">
        {isMeta ? "Meta Business" : "WhatsApp Business"}
      </h3>
      <p className={`mt-2 text-sm leading-6 ${styles.muted}`}>
        {isMeta
          ? "Publique e acompanhe anúncios no Instagram e Facebook sem sair da SorteX."
          : "Conecte seu número comercial para enviar mensagens oficiais, acompanhar entregas e usar automações."}
      </p>
      <ul className="mt-5 grid gap-2 text-sm font-semibold sm:grid-cols-2">
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
            <Check aria-hidden="true" className={styles.success} size={15} />
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
              className={`sx-premium-button ${styles.primary}`}
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
              className="sx-premium-button"
            >
              Testar em modo demonstração
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onOpen}
              className={`sx-premium-button ${styles.primary}`}
            >
              Gerenciar
            </button>
            <button
              disabled={Boolean(busy)}
              onClick={onSync}
              className="sx-premium-button"
            >
              Sincronizar
            </button>
            <button
              onClick={() =>
                onNavigate(isMeta ? "/dashboard/ads" : "/dashboard/comunicacao")
              }
              className="sx-premium-button"
            >
              {isMeta ? "Ir para SorteX Ads" : "Abrir Comunicação"}
            </button>
            <button
              disabled={Boolean(busy)}
              onClick={onDisconnect}
              className={`sx-premium-button ${styles.danger}`}
            >
              Desconectar
            </button>
          </>
        )}
      </div>
      {demo && (
        <p className={`mt-3 text-xs font-bold ${styles.warning}`}>
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
      <div
        className={`ml-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto ${styles.drawer}`}
      >
        <header
          className={`sticky top-0 z-10 flex items-center justify-between gap-2 border-b p-4 ${styles.drawerHeader}`}
        >
          <div>
            <p className={styles.eyebrow}>Conexão oficial</p>
            <h2 id="connection-title" className="text-xl font-black">
              {connected
                ? `Gerenciar ${meta ? "Meta Business" : "WhatsApp Business"}`
                : `Conectar ${meta ? "Meta Business" : "WhatsApp Business"}`}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="sx-premium-button"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 p-5 sm:p-8">
          {!connected ? (
            <>
              <div className={`rounded-2xl p-4 sm:p-6 ${styles.inset}`}>
                <ShieldCheck
                  aria-hidden="true"
                  className={styles.accent}
                  size={34}
                />
                <h3 className="mt-4 text-2xl font-black">
                  Login seguro no ambiente oficial
                </h3>
                <p className={`mt-2 leading-7 ${styles.muted}`}>
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
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-black ${styles.inset} ${styles.accent}`}
                    >
                      {index + 1}
                    </span>
                    <p className="pt-1 text-sm font-semibold">{text}</p>
                  </li>
                ))}
              </ol>
              {!meta && (
                <p
                  className={`mt-6 rounded-2xl p-4 text-sm ${styles.inset} ${styles.warning}`}
                >
                  Dependendo da disponibilidade da sua conta, você poderá
                  conectar um número existente ou cadastrar um novo número.
                </p>
              )}
              <div className="mt-8 grid gap-3">
                <button
                  disabled={Boolean(busy)}
                  onClick={onOAuth}
                  className={`sx-premium-button ${styles.primary}`}
                >
                  {busy === `oauth-${kind}` && (
                    <LoaderCircle
                      aria-hidden="true"
                      className="animate-spin"
                      size={18}
                    />
                  )}{" "}
                  Continuar com a Meta{" "}
                  <ExternalLink aria-hidden="true" size={16} />
                </button>
                <button
                  disabled={Boolean(busy)}
                  onClick={onDemo}
                  className="sx-premium-button"
                >
                  Testar em modo demonstração
                </button>
                <button onClick={onClose} className="sx-premium-button">
                  Voltar
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                className={`flex items-center gap-3 rounded-2xl p-4 ${styles.inset} ${styles.success}`}
              >
                <CheckCircle2 aria-hidden="true" />
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
                  className={`sx-premium-button ${styles.primary}`}
                >
                  <RefreshCw aria-hidden="true" size={17} />
                  Sincronizar
                </button>
                <button
                  onClick={() =>
                    onNavigate(
                      meta ? "/dashboard/ads" : "/dashboard/comunicacao",
                    )
                  }
                  className="sx-premium-button"
                >
                  {meta ? (
                    <>
                      <BarChart3 aria-hidden="true" size={17} />
                      Ir para SorteX Ads
                    </>
                  ) : (
                    <>
                      <MessageCircle aria-hidden="true" size={17} />
                      Abrir Comunicação
                    </>
                  )}
                </button>
                {!meta && (
                  <button
                    onClick={() =>
                      onNavigate("/dashboard/comunicacao?section=modelos")
                    }
                    className="sx-premium-button"
                  >
                    Modelos de mensagem
                  </button>
                )}
                <button
                  disabled={Boolean(busy)}
                  onClick={onDisconnect}
                  className={`sx-premium-button ${styles.danger}`}
                >
                  <Unplug aria-hidden="true" size={17} />
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
      className={`mt-5 grid gap-3 rounded-2xl p-4 text-sm sm:grid-cols-2 ${styles.inset}`}
      data-expanded={expanded}
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
      aria-labelledby="demo-title"
    >
      <div
        className={`w-full max-w-lg p-4 sm:p-8 ${styles.surface} ${styles.demoDialog}`}
      >
        <Megaphone aria-hidden="true" className={styles.accent} />
        <h2 id="demo-title" className="mt-4 text-2xl font-black">
          Entrar no modo demonstração?
        </h2>
        <p className={`mt-3 leading-7 ${styles.muted}`}>
          O modo demonstração permite conhecer a interface sem conectar uma
          conta real. Nenhum anúncio será publicado e nenhuma mensagem será
          enviada.
        </p>
        <p className={`mt-3 text-sm font-bold ${styles.warning}`}>
          Integração:{" "}
          {kind === "META_ADS" ? "Meta Business" : "WhatsApp Business"}
        </p>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            disabled={busy}
            onClick={onClose}
            className="sx-premium-button"
          >
            Cancelar
          </button>
          <button
            disabled={busy}
            onClick={onConfirm}
            className={`sx-premium-button ${styles.primary}`}
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
      ? "success"
      : value === "SANDBOX_CONNECTED"
        ? "warning"
        : value === "ERROR"
          ? "error"
          : "neutral";
  return (
    <span className={styles.status} data-tone={style}>
      {label}
    </span>
  );
}
function Health({ name, item }: { name: string; item?: OrganizerIntegration }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 ${styles.inset}`}
    >
      <div>
        <b className="text-sm">{name}</b>
        <p className={`mt-1 text-xs ${styles.muted}`}>
          {item?.lastError
            ? "A conexão precisa de atenção."
            : item?.status === "SANDBOX_CONNECTED"
              ? "Modo demonstração, sem conta externa."
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
    <div className={`p-4 text-center sm:p-10 ${styles.surface}`}>
      <ShieldCheck
        aria-hidden="true"
        className={`mx-auto ${styles.accent}`}
        size={38}
      />
      <h3 className="mt-4 text-xl font-black">Nenhuma conexão ativa</h3>
      <p className={`mt-2 text-sm ${styles.muted}`}>
        Conecte a Meta ou o WhatsApp Business pelo fluxo oficial.
      </p>
      <button
        onClick={onAvailable}
        className={`mt-5 sx-premium-button ${styles.primary}`}
      >
        Ver conexões disponíveis
      </button>
    </div>
  );
}
function IntegrationSkeleton() {
  return (
    <div
      className="grid gap-5 lg:grid-cols-2"
      role="status"
      aria-label="Carregando integrações"
    >
      {[0, 1].map((key) => (
        <div
          key={key}
          aria-hidden="true"
          className={`h-96 rounded-3xl motion-safe:animate-pulse ${styles.inset}`}
        />
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
      <span
        className={`block text-xs font-black uppercase tracking-wide ${styles.muted}`}
      >
        {label}
      </span>
      <b className="mt-1 block truncate">{value || "Não disponível"}</b>
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
