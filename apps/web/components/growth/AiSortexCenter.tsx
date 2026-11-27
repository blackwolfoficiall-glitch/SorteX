"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Calculator,
  ChevronRight,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import {
  generateAdvisorMessage,
  getAdvisor,
  simulateAdvisor,
  type AdvisorSnapshot,
} from "@/lib/growth/client";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import PremiumScope from "@/components/premium/PremiumScope";
import AdvisorConversation from "./AdvisorConversation";
import { AdvisorConfirmAction } from "./AdvisorConfirmAction";
import ui from "./advisor-premium.module.css";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
type Tab = "resumo" | "chat" | "simulacoes" | "mensagens";

const analyses: Record<
  string,
  { title: string; description: string; tab: Tab }
> = {
  "sales-time": {
    title: "Melhor horário para vender",
    description:
      "A análise usa o histórico real de vendas. Quando ainda não houver amostra suficiente, mostramos exatamente quais dados faltam.",
    tab: "resumo",
  },
  "underperforming-campaigns": {
    title: "Campanhas abaixo da média",
    description:
      "Compare alertas e recomendações calculados a partir do desempenho atual das suas campanhas.",
    tab: "resumo",
  },
  recommendations: {
    title: "Sugestões automáticas",
    description:
      "Prioridades e próximas ações produzidas com os dados atuais da conta, sempre sujeitas à sua confirmação.",
    tab: "resumo",
  },
  "revenue-forecast": {
    title: "Previsão de faturamento",
    description:
      "Simule cenários com premissas editáveis. Projeções são estimativas, não garantias.",
    tab: "simulacoes",
  },
};

const tabs = [
  { id: "resumo", label: "Resumo", icon: BarChart3 },
  { id: "chat", label: "Conversar", icon: MessageCircle },
  { id: "simulacoes", label: "Simulações", icon: Calculator },
  { id: "mensagens", label: "Rascunhos", icon: WandSparkles },
] as const;

function liveError(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : "Não foi possível concluir. Tente novamente.";
}

export default function AiSortexCenter() {
  const organizer = useAuthorizedUser();
  // Account changes remount the full view, including all unsaved text.
  return organizer ? <AdvisorCenterView key={organizer.id} /> : null;
}

function AdvisorCenterView() {
  const searchParams = useSearchParams();
  const analysisId = searchParams.get("analysis") ?? "";
  const analysis = Object.hasOwn(analyses, analysisId)
    ? analyses[analysisId]
    : undefined;
  const requested = searchParams.get("tab");
  const tab =
    tabs.find(({ id }) => id === requested)?.id ?? analysis?.tab ?? "resumo";
  const [data, setData] = useState<AdvisorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(isCurrent = () => true) {
    setLoading(true);
    setError("");
    try {
      const snapshot = await getAdvisor();
      if (isCurrent()) setData(snapshot);
    } catch {
      if (isCurrent())
        setError("Não foi possível carregar os indicadores desta conta.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }
  useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, []);

  return (
    <PremiumScope className={ui.root}>
      <header className={`sx-premium-ticket ${ui.hero}`}>
        <div>
          <p className={ui.heroTag}>
            <Sparkles size={17} aria-hidden="true" /> SorteX Advisor
          </p>
          <h1 className="sx-premium-title">
            {data ? `Olá, ${data.organizerName}.` : "Copilot de operações"}
          </h1>
          <p>
            Desempenho, oportunidades e próximos passos em um só lugar. Nenhuma
            ação é executada sem sua confirmação.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`sx-premium-button ${ui.heroAction}`}
        >
          <RefreshCw size={17} aria-hidden="true" /> Atualizar análise
        </button>
      </header>
      {loading && !data && (
        <div className={`sx-premium-surface ${ui.load}`} role="status">
          <LoaderCircle className={ui.spinner} aria-hidden="true" /> Carregando
          os indicadores desta conta…
        </div>
      )}
      {error && (
        <div className={`sx-premium-surface ${ui.loadError}`} role="alert">
          <AlertTriangle size={21} aria-hidden="true" />
          <div>
            <strong>{error}</strong>
            {data && <p>Os dados abaixo são da última consulta concluída.</p>}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="sx-premium-button"
          >
            Tentar novamente
          </button>
        </div>
      )}
      {data && (
        <>
          {analysis && (
            <section
              className={`sx-premium-surface ${ui.analysis}`}
              aria-labelledby="advisor-analysis-title"
            >
              <p className={ui.eyebrow}>Análise selecionada</p>
              <h2 id="advisor-analysis-title" className="sx-premium-section">
                {analysis.title}
              </h2>
              <p className="sx-premium-muted">{analysis.description}</p>
            </section>
          )}
          <nav
            className={`sx-premium-surface ${ui.navigation}`}
            aria-label="Seções do SorteX Advisor"
          >
            {tabs.map((item) => (
              <Link
                key={item.id}
                href={
                  item.id === "resumo"
                    ? "/dashboard/ia"
                    : `/dashboard/ia?tab=${item.id}`
                }
                scroll={false}
                prefetch={false}
                aria-current={tab === item.id ? "page" : undefined}
                className="sx-premium-button"
              >
                <item.icon size={17} aria-hidden="true" /> {item.label}
              </Link>
            ))}
          </nav>
          {tab === "resumo" && <Summary data={data} />}
          <div className={ui.chatSection} hidden={tab !== "chat"}>
            <AdvisorConversation
              pilotAvailable={
                data.aiPilotAvailable === true && !error && !loading
              }
              active={tab === "chat"}
            />
          </div>
          {tab === "simulacoes" && <Simulations data={data} />}
          {tab === "mensagens" && <Messages data={data} />}
        </>
      )}
    </PremiumScope>
  );
}

function Summary({ data }: { data: AdvisorSnapshot }) {
  const s = data.summary;
  return (
    <div className={ui.summary}>
      <section className={ui.stats} aria-label="Indicadores da conta">
        <Stat label="Campanhas" value={s.campaigns} />
        <Stat label="Receita" value={money.format(s.revenue)} />
        <Stat label="Conversão" value={`${s.conversion}%`} />
        <Stat
          label="Reservas abandonadas"
          value={s.abandonedReservations}
          href="/dashboard/ia?analysis=abandoned-reservations"
        />
        <Stat label="Promoções ativas" value={s.promotions} />
        <Stat label="Cotas premiadas" value={s.availablePrizes} />
      </section>
      <div className={ui.summaryPanels}>
        <section className={`sx-premium-surface ${ui.panel}`}>
          <h2 className="sx-premium-section">Recomendações para hoje</h2>
          <p className="mt-1 sx-premium-muted">
            Priorizadas a partir dos dados atuais da conta.
          </p>
          <div className="mt-4 space-y-3">
            {data.alerts.length ? (
              data.alerts.map((a) => <AlertCard key={a.id} alert={a} />)
            ) : (
              <div className={ui.note}>
                Nenhum alerta acionável foi encontrado com os dados atuais.
              </div>
            )}
          </div>
        </section>
        <section className={`sx-premium-surface ${ui.panel}`}>
          <h2 className="sx-premium-section">Visão da operação</h2>
          <div className={`mt-4 ${ui.miniGrid}`}>
            <Mini label="Vendas aprovadas" value={s.approvedSales} />
            <Mini label="Títulos vendidos" value={s.ticketsSold} />
            <Mini label="Pagamentos pendentes" value={s.pendingPayments} />
            <Mini label="Contatos CRM" value={s.contacts} />
            <Mini label="Automações ativas" value={s.automations} />
            <Mini label="Afiliados ativos" value={s.affiliates} />
          </div>
          <p className={`mt-4 ${ui.note}`}>
            Métricas calculadas a partir da conta autenticada. Valores ausentes
            permanecem em zero; projeções não são garantias.
          </p>
        </section>
      </div>
    </div>
  );
}

function Simulations({ data }: { data: AdvisorSnapshot }) {
  const [campaignId, setCampaignId] = useState(data.campaigns[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1000");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState(0);
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof simulateAdvisor>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const units = Number(quantity);
    const alternative = price.trim()
      ? Number(price.trim().replace(",", "."))
      : undefined;
    if (
      !Number.isInteger(units) ||
      units < 1 ||
      units > 10_000_000 ||
      (alternative !== undefined &&
        (!Number.isFinite(alternative) || alternative < 0.01))
    ) {
      setError(
        "Confira a quantidade e informe um preço válido, quando necessário.",
      );
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await simulateAdvisor({
          campaignId: campaignId || undefined,
          quantity: units,
          price: alternative,
          discountPercent: discount,
        }),
      );
    } catch (cause) {
      setError(liveError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={ui.workbench}>
      <form
        onSubmit={(event) => void run(event)}
        className={`sx-premium-surface ${ui.panel} ${ui.form}`}
      >
        <h2 className="sx-premium-section">Simular cenário</h2>
        <p className="sx-premium-muted">
          Projeções hipotéticas, sem gerar pedidos ou alterar campanhas.
        </p>
        <label className={ui.fieldLabel}>
          Campanha
          <select
            className={ui.field}
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
          >
            {data.campaigns.length === 0 && (
              <option value="">Nenhuma campanha nesta conta</option>
            )}
            {data.campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.fieldLabel}>
          Quantidade
          <input
            className={ui.field}
            type="number"
            min={1}
            max={10_000_000}
            step={1}
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label className={ui.fieldLabel}>
          Preço alternativo (opcional)
          <input
            className={ui.field}
            inputMode="decimal"
            value={price}
            placeholder="Usar preço atual"
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label className={ui.fieldLabel}>
          Desconto: {discount}%
          <input
            type="range"
            min={0}
            max={90}
            value={discount}
            onChange={(event) => setDiscount(Number(event.target.value))}
          />
        </label>
        {error && (
          <p className={ui.formError} role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="sx-premium-button"
          data-variant="primary"
        >
          {busy ? "Calculando..." : "Calcular simulação"}
        </button>
      </form>
      <section className={`sx-premium-surface ${ui.panel} ${ui.preview}`}>
        <h2 className="sx-premium-section">Resultado</h2>
        {busy ? (
          <p role="status" className="sx-premium-muted">
            Calculando com a API da SorteX…
          </p>
        ) : result ? (
          <div className={ui.preview} aria-live="polite">
            <div className={ui.miniGrid}>
              <Mini
                label="Faturamento bruto"
                value={money.format(result.grossRevenue)}
              />
              <Mini label="Desconto" value={money.format(result.discount)} />
              <Mini
                label="Receita estimada"
                value={money.format(result.estimatedRevenue)}
              />
              <Mini
                label="Preço por título"
                value={money.format(result.unitPrice)}
              />
            </div>
            <div className={ui.note}>
              <b>Fórmula</b>
              <p>{result.formula}</p>
              <p>{result.disclaimer}</p>
            </div>
          </div>
        ) : (
          <p className={ui.note}>Configure um cenário para comparar valores.</p>
        )}
      </section>
    </div>
  );
}

function Messages({ data }: { data: AdvisorSnapshot }) {
  const [objective, setObjective] = useState("Últimas cotas");
  const [tone, setTone] = useState("Amigável");
  const [campaignId, setCampaignId] = useState(data.campaigns[0]?.id ?? "");
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof generateAdvisorMessage>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setCopyStatus("");
    try {
      setResult(
        await generateAdvisorMessage({
          objective,
          tone,
          campaignId: campaignId || undefined,
        }),
      );
    } catch (cause) {
      setError(liveError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.content);
      setCopyStatus("Rascunho copiado.");
    } catch {
      setCopyStatus(
        "Não foi possível copiar automaticamente. Selecione o texto do rascunho para copiar.",
      );
    }
  }

  return (
    <div className={ui.workbench}>
      <form
        onSubmit={(event) => void generate(event)}
        className={`sx-premium-surface ${ui.panel} ${ui.form}`}
      >
        <h2 className="sx-premium-section">Preparar mensagem</h2>
        <p className="sx-premium-muted">
          Rascunho baseado em regras locais. Esta tela não envia mensagens.
        </p>
        <label className={ui.fieldLabel}>
          Objetivo da mensagem
          <select
            className={ui.field}
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
          >
            {[
              "Últimas cotas",
              "Pagamento pendente",
              "Reserva abandonada",
              "Promoção",
              "Roleta",
              "Cota premiada",
              "Lembrete",
              "Agradecimento",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className={ui.fieldLabel}>
          Tom da mensagem
          <select
            className={ui.field}
            value={tone}
            onChange={(event) => setTone(event.target.value)}
          >
            {[
              "Amigável",
              "Profissional",
              "Urgente",
              "Premium",
              "Direto",
              "Elegante",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className={ui.fieldLabel}>
          Campanha da mensagem
          <select
            className={ui.field}
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
          >
            {data.campaigns.length === 0 && (
              <option value="">Nenhuma campanha nesta conta</option>
            )}
            {data.campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className={ui.formError} role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="sx-premium-button"
          data-variant="primary"
        >
          <Sparkles size={17} aria-hidden="true" />{" "}
          {busy ? "Gerando..." : "Gerar mensagem"}
        </button>
      </form>
      <section className={`sx-premium-surface ${ui.panel} ${ui.preview}`}>
        <h2 className="sx-premium-section">Prévia</h2>
        {busy && (
          <p role="status" className="sx-premium-muted">
            Preparando o rascunho…
          </p>
        )}
        {result ? (
          <div className={ui.preview}>
            <h3 className="sx-premium-section">{result.title}</h3>
            <label className={ui.fieldLabel}>
              Rascunho da mensagem
              <textarea
                className={ui.field}
                rows={5}
                value={result.content}
                onChange={(event) => {
                  setCopyStatus("");
                  setResult({ ...result, content: event.target.value });
                }}
              />
            </label>
            <p className="sx-premium-muted">
              Copie o texto editado antes de abrir a Central de Comunicação. O
              envio só acontece após confirmação.
            </p>
            <div className={ui.actions}>
              <button
                type="button"
                onClick={() => void copy()}
                className="sx-premium-button"
              >
                Copiar
              </button>
              <Link
                href={result.openUrl}
                className="sx-premium-button"
                data-variant="primary"
              >
                Abrir Comunicação <ChevronRight size={17} aria-hidden="true" />
              </Link>
            </div>
            {copyStatus && (
              <p className="sx-premium-muted" role="status">
                {copyStatus}
              </p>
            )}
          </div>
        ) : (
          <p className={ui.note}>Escolha o contexto para gerar uma mensagem.</p>
        )}
      </section>
    </div>
  );
}

function AlertCard({ alert }: { alert: AdvisorSnapshot["alerts"][number] }) {
  return (
    <article className={ui.alertCard}>
      <div className="flex gap-3">
        <span className={`sx-premium-badge h-fit text-xs ${ui.priority}`}>
          {alert.priority === "HIGH"
            ? "ALTA"
            : alert.priority === "MEDIUM"
              ? "MÉDIA"
              : "BAIXA"}
        </span>
        <div className="min-w-0">
          <h3 className="font-black">{alert.title}</h3>
          <p className="mt-1 sx-premium-muted">{alert.detail}</p>
          <p className="mt-2 text-xs font-bold">{alert.evidence}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {alert.actions.map((a) => (
              <AdvisorConfirmAction key={a.label} action={a} />
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const body = (
    <>
      <span className="font-bold">{label}</span>
      <b className="tabular-nums">{value}</b>
      {href && (
        <span data-link="" className="font-bold">
          Ver reservas →
        </span>
      )}
    </>
  );
  return href ? (
    <Link href={href} className={`sx-premium-surface ${ui.stat}`}>
      {body}
    </Link>
  ) : (
    <div className={`sx-premium-surface ${ui.stat}`}>{body}</div>
  );
}
function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={ui.mini}>
      <span className="font-bold">{label}</span>
      <b className="tabular-nums">{value}</b>
    </div>
  );
}
