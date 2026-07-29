"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Calculator,
  ChevronRight,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import {
  askAdvisor,
  generateAdvisorMessage,
  getAdvisor,
  simulateAdvisor,
  type AdvisorAction,
  type AdvisorAnswer,
  type AdvisorSnapshot,
} from "@/lib/growth/client";
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
type Tab = "resumo" | "chat" | "simulacoes" | "mensagens";

const analyses: Record<string, { title: string; description: string; tab: Tab }> = {
  "sales-time": {
    title: "Melhor horário para vender",
    description: "A análise usa o histórico real de vendas. Quando ainda não houver amostra suficiente, mostramos exatamente quais dados faltam.",
    tab: "resumo",
  },
  "underperforming-campaigns": {
    title: "Campanhas abaixo da média",
    description: "Compare alertas e recomendações calculados a partir do desempenho atual das suas campanhas.",
    tab: "resumo",
  },
  recommendations: {
    title: "Sugestões automáticas",
    description: "Prioridades e próximas ações produzidas com os dados atuais da conta, sempre sujeitas à sua confirmação.",
    tab: "resumo",
  },
  "revenue-forecast": {
    title: "Previsão de faturamento",
    description: "Simule cenários com premissas editáveis. Projeções são estimativas, não garantias.",
    tab: "simulacoes",
  },
};

export default function AiSortexCenter() {
  const searchParams = useSearchParams();
  const analysis = analyses[searchParams.get("analysis") || ""];
  const [data, setData] = useState<AdvisorSnapshot | null>(null),
    [tab, setTab] = useState<Tab>(analysis?.tab || "resumo"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await getAdvisor());
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível carregar a análise.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  if (loading)
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="text-center">
          <LoaderCircle className="mx-auto animate-spin text-violet-600" />
          <p className="mt-3 text-sm text-zinc-500">Analisando sua conta...</p>
        </div>
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-xl rounded-3xl border bg-white p-8 text-center">
        <AlertTriangle className="mx-auto text-red-500" />
        <h1 className="mt-3 text-xl font-black">
          Não foi possível carregar o SorteX Advisor
        </h1>
        <p className="mt-2 text-sm text-zinc-500">{error}</p>
        <button
          onClick={() => void load()}
          className="mt-5 rounded-xl bg-violet-600 px-5 py-3 font-bold text-white"
        >
          Tentar novamente
        </button>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-[1500px] overflow-x-hidden pb-12">
      <header className="rounded-3xl bg-gradient-to-br from-violet-950 via-violet-800 to-fuchsia-700 p-5 text-white shadow-xl md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-violet-200">
              <Sparkles size={16} />
              SorteX Advisor
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">
              Olá, {data.organizerName}.
            </h1>
            <p className="mt-2 max-w-2xl text-violet-100">
              Analisei suas campanhas e organizei as oportunidades mais
              importantes para hoje. Nenhuma ação será executada sem sua
              confirmação.
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/15 px-4 font-bold backdrop-blur hover:bg-white/25"
          >
            <RefreshCw size={17} />
            Atualizar análise
          </button>
        </div>
      </header>
      {analysis && (
        <section className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4" aria-labelledby="analysis-title">
          <p className="text-xs font-black uppercase tracking-wider text-violet-600">Análise selecionada</p>
          <h2 id="analysis-title" className="mt-1 text-xl font-black text-zinc-950">{analysis.title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">{analysis.description}</p>
        </section>
      )}
      <nav className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border bg-white p-2 sm:flex">
        {(
          [
            { id: "resumo", label: "Resumo", icon: BarChart3 },
            { id: "chat", label: "Conversar", icon: MessageCircle },
            { id: "simulacoes", label: "Simulações", icon: Calculator },
            { id: "mensagens", label: "Mensagens IA", icon: WandSparkles },
          ] as const
        ).map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition ${tab === x.id ? "bg-violet-600 text-white" : "text-zinc-600 hover:bg-zinc-50"}`}
          >
            <x.icon size={17} />
            {x.label}
          </button>
        ))}
      </nav>
      {tab === "resumo" && <Summary data={data} />}
      {tab === "chat" && <Chat />}
      {tab === "simulacoes" && <Simulations data={data} />}
      {tab === "mensagens" && <Messages data={data} />}
    </div>
  );
}

function Summary({ data }: { data: AdvisorSnapshot }) {
  const s = data.summary;
  return (
    <div className="mt-5 space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
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
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-3xl border bg-white p-5 md:p-6">
          <h2 className="text-xl font-black">Recomendações para hoje</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Priorizadas a partir dos dados atuais da conta.
          </p>
          <div className="mt-4 space-y-3">
            {data.alerts.length ? (
              data.alerts.map((a) => <AlertCard key={a.id} alert={a} />)
            ) : (
              <div className="rounded-2xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                Nenhum alerta acionável foi encontrado com os dados atuais.
              </div>
            )}
          </div>
        </section>
        <section className="rounded-3xl border bg-white p-5 md:p-6">
          <h2 className="text-xl font-black">Visão da operação</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Mini label="Vendas aprovadas" value={s.approvedSales} />
            <Mini label="Títulos vendidos" value={s.ticketsSold} />
            <Mini label="Pagamentos pendentes" value={s.pendingPayments} />
            <Mini label="Contatos CRM" value={s.contacts} />
            <Mini label="Automações ativas" value={s.automations} />
            <Mini label="Afiliados ativos" value={s.affiliates} />
          </div>
          <p className="mt-4 rounded-2xl bg-blue-50 p-4 text-xs leading-5 text-blue-800">
            Métricas calculadas a partir da conta autenticada. Valores ausentes
            permanecem em zero; projeções não são garantias.
          </p>
        </section>
      </div>
    </div>
  );
}

function Chat() {
  const [q, setQ] = useState(""),
    [messages, setMessages] = useState<
      Array<{
        role: "user" | "assistant";
        text: string;
        answer?: AdvisorAnswer;
      }>
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e?: FormEvent, quick?: string) {
    e?.preventDefault();
    const question = (quick ?? q).trim();
    if (question.length < 3 || busy) return;
    setMessages((m) => [...m, { role: "user", text: question }]);
    setQ("");
    setBusy(true);
    setError("");
    try {
      const answer = await askAdvisor(question);
      setMessages((m) => [
        ...m,
        { role: "assistant", text: answer.answer, answer },
      ]);
    } catch (x) {
      setError(x instanceof Error ? x.message : "Não foi possível responder.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-5 grid min-h-[620px] gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-3xl border bg-white p-5">
        <h2 className="font-black">Perguntas rápidas</h2>
        <div className="mt-3 space-y-2">
          {[
            "Como vender mais?",
            "Qual campanha está pior?",
            "Qual promoção devo criar?",
            "Quantas reservas abandonadas existem?",
            "Qual horário devo divulgar?",
          ].map((x) => (
            <button
              key={x}
              onClick={() => void submit(undefined, x)}
              className="w-full rounded-xl bg-zinc-50 p-3 text-left text-sm font-semibold hover:bg-violet-50 hover:text-violet-700"
            >
              {x}
            </button>
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col rounded-3xl border bg-white">
        <div className="border-b p-5">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <Bot className="text-violet-600" />
            Converse com seu consultor
          </h2>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md py-16 text-center">
              <Sparkles className="mx-auto text-violet-400" size={38} />
              <h3 className="mt-3 font-black">Pergunte sobre a sua operação</h3>
              <p className="mt-2 text-sm text-zinc-500">
                As respostas usam somente dados reais disponíveis na sua conta.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-3xl rounded-2xl p-4 ${m.role === "user" ? "ml-auto bg-violet-600 text-white" : "bg-zinc-50"}`}
            >
              <p className="whitespace-pre-wrap text-sm leading-6">{m.text}</p>
              {m.answer && (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.answer.evidence.map((e) => (
                      <span
                        key={e}
                        className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-600"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.answer.actions.map((a) => (
                      <ConfirmAction key={a.label} action={a} />
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-zinc-400">
                    {m.answer.mode === "OPENAI"
                      ? "Resposta estruturada pelo provedor de IA"
                      : "Resposta do motor local determinístico"}
                  </p>
                </>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <LoaderCircle className="animate-spin" size={17} />
              Analisando dados...
            </div>
          )}
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
        <form
          onSubmit={(e) => void submit(e)}
          className="flex gap-2 border-t p-3 md:p-4"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pergunte sobre campanhas, vendas ou clientes..."
            className="min-w-0 flex-1 rounded-xl border px-4 outline-none focus:border-violet-500"
          />
          <button
            disabled={busy || q.trim().length < 3}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-600 text-white disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </section>
  );
}

function Simulations({ data }: { data: AdvisorSnapshot }) {
  const [campaignId, setCampaignId] = useState(data.campaigns[0]?.id ?? ""),
    [quantity, setQuantity] = useState("1000"),
    [price, setPrice] = useState(""),
    [discount, setDiscount] = useState(0),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function run(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setResult(
        await simulateAdvisor({
          campaignId: campaignId || undefined,
          quantity: Math.max(1, Number(quantity) || 1),
          price: price ? Number(price) : undefined,
          discountPercent: discount,
        }),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
      <form
        onSubmit={(e) => void run(e)}
        className="space-y-4 rounded-3xl border bg-white p-5 md:p-6"
      >
        <h2 className="text-xl font-black">Simular cenário</h2>
        <label className="block text-sm font-bold">
          Campanha
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="mt-2 h-12 w-full rounded-xl border px-3"
          >
            {data.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Quantidade
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onBlur={() => {
              if (!quantity || Number(quantity) < 1) setQuantity("1");
            }}
            className="mt-2 h-12 w-full rounded-xl border px-3"
          />
        </label>
        <label className="block text-sm font-bold">
          Preço alternativo (opcional)
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Usar preço atual"
            className="mt-2 h-12 w-full rounded-xl border px-3"
          />
        </label>
        <label className="block text-sm font-bold">
          Desconto: {discount}%
          <input
            type="range"
            min={0}
            max={90}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="mt-2 w-full accent-violet-600"
          />
        </label>
        <button
          disabled={busy}
          className="h-12 w-full rounded-xl bg-violet-600 font-bold text-white"
        >
          {busy ? "Calculando..." : "Calcular simulação"}
        </button>
      </form>
      <div className="rounded-3xl border bg-white p-5 md:p-6">
        <h2 className="text-xl font-black">Resultado</h2>
        {result ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
            <div className="sm:col-span-2 rounded-2xl bg-zinc-50 p-4">
              <b>Fórmula</b>
              <p className="mt-1 text-sm">{result.formula}</p>
              <p className="mt-3 text-xs text-zinc-500">{result.disclaimer}</p>
            </div>
          </div>
        ) : (
          <div className="grid h-64 place-items-center text-center text-sm text-zinc-400">
            Configure um cenário para comparar valores.
          </div>
        )}
      </div>
    </div>
  );
}

function Messages({ data }: { data: AdvisorSnapshot }) {
  const [objective, setObjective] = useState("Últimas cotas"),
    [tone, setTone] = useState("Amigável"),
    [campaignId, setCampaignId] = useState(data.campaigns[0]?.id ?? ""),
    [result, setResult] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true);
    try {
      setResult(
        await generateAdvisorMessage({
          objective,
          tone,
          campaignId: campaignId || undefined,
        }),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <section className="space-y-4 rounded-3xl border bg-white p-5 md:p-6">
        <h2 className="text-xl font-black">Gerar mensagem contextual</h2>
        <select
          aria-label="Objetivo da mensagem"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="h-12 w-full rounded-xl border px-3"
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
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Tom da mensagem"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="h-12 w-full rounded-xl border px-3"
        >
          {[
            "Amigável",
            "Profissional",
            "Urgente",
            "Premium",
            "Direto",
            "Elegante",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="Campanha da mensagem"
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="h-12 w-full rounded-xl border px-3"
        >
          {data.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          onClick={() => void generate()}
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 font-bold text-white"
        >
          <Sparkles size={17} />
          {busy ? "Gerando..." : "Gerar mensagem"}
        </button>
      </section>
      <section className="rounded-3xl border bg-white p-5 md:p-6">
        <h2 className="text-xl font-black">Prévia</h2>
        {result ? (
          <div className="mt-4 rounded-2xl bg-zinc-50 p-5">
            <h3 className="font-black">{result.title}</h3>
            <textarea
              value={result.content}
              onChange={(e) =>
                setResult({ ...result, content: e.target.value })
              }
              className="mt-3 min-h-40 w-full resize-y rounded-xl border bg-white p-3 text-sm"
            />
            <p className="mt-2 text-xs text-zinc-500">
              A mensagem pode ser editada. O envio só acontece após confirmação
              na Central de Comunicação.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => navigator.clipboard?.writeText(result.content)}
                className="h-11 rounded-xl border px-4 font-bold"
              >
                Copiar
              </button>
              <Link
                href={result.openUrl}
                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 font-bold text-white"
              >
                Abrir Comunicação
                <ChevronRight size={17} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid h-64 place-items-center text-center text-sm text-zinc-400">
            Escolha o contexto para gerar uma mensagem.
          </div>
        )}
      </section>
    </div>
  );
}

function ConfirmAction({ action }: { action: AdvisorAction }) {
  function confirm(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!window.confirm(action.confirmation)) e.preventDefault();
  }
  return (
    <Link
      href={action.url}
      onClick={confirm}
      className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white"
    >
      {action.label}
    </Link>
  );
}
function AlertCard({ alert }: { alert: AdvisorSnapshot["alerts"][number] }) {
  const color =
    alert.priority === "HIGH"
      ? "bg-red-50 text-red-700"
      : alert.priority === "MEDIUM"
        ? "bg-amber-50 text-amber-700"
        : "bg-blue-50 text-blue-700";
  return (
    <article className="rounded-2xl border p-4">
      <div className="flex gap-3">
        <span
          className={`h-fit rounded-full px-2 py-1 text-[10px] font-black ${color}`}
        >
          {alert.priority === "HIGH"
            ? "ALTA"
            : alert.priority === "MEDIUM"
              ? "MÉDIA"
              : "BAIXA"}
        </span>
        <div className="min-w-0">
          <h3 className="font-black">{alert.title}</h3>
          <p className="mt-1 text-sm text-zinc-500">{alert.detail}</p>
          <p className="mt-2 text-xs font-bold text-zinc-400">
            {alert.evidence}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {alert.actions.map((a) => (
              <ConfirmAction key={a.label} action={a} />
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
      <span className="block truncate text-xs font-bold text-zinc-500">
        {label}
      </span>
      <b className="mt-2 block break-words text-xl md:text-2xl">{value}</b>
      {href && (
        <span className="mt-2 block text-xs font-black text-violet-700">
          Ver reservas →
        </span>
      )}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="min-w-0 rounded-2xl border bg-white p-4 transition hover:border-violet-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
    >
      {body}
    </Link>
  ) : (
    <div className="min-w-0 rounded-2xl border bg-white p-4">{body}</div>
  );
}
function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <span className="text-xs font-bold text-zinc-500">{label}</span>
      <b className="mt-1 block text-lg">{value}</b>
    </div>
  );
}
