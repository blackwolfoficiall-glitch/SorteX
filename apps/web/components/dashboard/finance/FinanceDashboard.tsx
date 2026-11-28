"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { loadOrganizerFinanceDashboard } from "@/lib/finance/load-organizer-finance-dashboard";
import PremiumScope from "@/components/premium/PremiumScope";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Landmark,
  LoaderCircle,
  ReceiptText,
  Wallet,
} from "lucide-react";
import "./finance-premium.css";

type Overview = {
  balance: {
    gross: number;
    net: number;
    available: number;
    pending: number;
    blocked: number;
    platformFees: number;
    gatewayFees: number;
  };
  periods: {
    today: { gross: number };
    currentMonth: { gross: number };
  };
};
type Entry = {
  id: string;
  type: string;
  direction: "CREDIT" | "DEBIT";
  status: string;
  amount: number;
  description: string;
  createdAt: string;
  campaign?: { title: string } | null;
};
type Campaign = {
  id: string;
  grossRevenue: number;
  platformFees: number;
  gatewayFees: number;
  netRevenue: number;
  campaign: { title: string };
};
type Statement = {
  data: Entry[];
  pagination: { total: number };
};
type Data = { overview: Overview; statement: Statement; campaigns: Campaign[] };
type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Data };
type Period = "7" | "30" | "90" | "365" | "custom";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (value: number) => brl.format(value);
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const card = "sx-premium-surface sx-finance-panel";

export default function FinanceDashboard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const active = () => !controller.signal.aborted;
    loadOrganizerFinanceDashboard<Overview, Statement, Campaign[]>(
      <T,>(url: string) => get<T>(url, controller.signal),
      active,
    )
      .then((result) => {
        if (active() && result) setState({ kind: "ready", data: result });
      })
      .catch((cause: unknown) => {
        if (active())
          setState({
            kind: "error",
            message: cause instanceof FinanceReadError ? cause.message : "Não foi possível consultar o financeiro.",
          });
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <PremiumScope className="sx-finance">
      {state.kind === "ready" ? (
        <FinanceContent {...state.data} />
      ) : (
        <div className="sx-finance-content">
          <FinanceHeader />
          {state.kind === "loading" ? (
            <div className={card} role="status">
              <LoaderCircle className="sx-finance-loader" size={21} aria-hidden="true" />
              <p>Consultando saldo, taxas e extrato…</p>
            </div>
          ) : (
            <div className={card}>
              <p className="sx-finance-error" role="alert">{state.message}</p>
              <button type="button" className="sx-premium-button sx-finance-retry" onClick={() => {
                setState({ kind: "loading" });
                setAttempt((n) => n + 1);
              }}>Tentar novamente</button>
            </div>
          )}
        </div>
      )}
    </PremiumScope>
  );
}

function FinanceContent({ overview, statement, campaigns }: Data) {
  const [period, setPeriod] = useState<Period>("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const invalidRange = period === "custom" && !!startDate && !!endDate && startDate > endDate;
  const { balance } = overview;
  const entries = statement.data;
  const partial = statement.pagination.total > entries.length;

  const filteredEntries = useMemo(() => {
    if (invalidRange) return [];
    const now = new Date();
    const start = period === "custom"
      ? startDate ? new Date(`${startDate}T00:00:00`) : null
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(period) + 1);
    const end = period === "custom" && endDate ? new Date(`${endDate}T23:59:59.999`) : now;
    return entries.filter((entry) => {
      const date = new Date(entry.createdAt);
      return (!start || date >= start) && date <= end;
    });
  }, [entries, period, startDate, endDate, invalidRange]);

  const totals = useMemo(() => {
    const byType = (direction: Entry["direction"], ...types: string[]) =>
      sumBRL(filteredEntries.filter((entry) => entry.direction === direction && types.includes(entry.type)));
    // Gross, net and fees can be informational rows for the same payment.
    // Never add gross and net together or subtract already-deducted fees again.
    return {
      grossSales: byType("CREDIT", "GROSS_SALE"),
      netRevenue: byType("CREDIT", "ORGANIZER_NET_REVENUE"),
      platformFees: byType("DEBIT", "PLATFORM_FEE"),
      gatewayFees: byType("DEBIT", "GATEWAY_FEE"),
      reversals: byType("DEBIT", "REFUND", "CHARGEBACK"),
    };
  }, [filteredEntries]);

  const chart = useMemo(() => {
    const map = new Map<number, Entry[]>();
    filteredEntries
      .filter((entry) => entry.type === "ORGANIZER_NET_REVENUE" && entry.direction === "CREDIT")
      .forEach((entry) => {
        const date = new Date(entry.createdAt);
        const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const group = map.get(day) ?? [];
        group.push(entry);
        map.set(day, group);
      });
    return [...map]
      .sort(([a], [b]) => a - b)
      .map(([date, group]) => ({
        date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date),
        value: sumBRL(group),
      }));
  }, [filteredEntries]);

  const chartSupported = chart.every((day) => day.value !== null);

  function exportExcel() {
    const rows = filteredEntries.map((entry) => [
      dateTime.format(new Date(entry.createdAt)),
      entry.description,
      entry.campaign?.title ?? "",
      entry.direction === "CREDIT" ? "Receita" : "Despesa",
      entry.status,
      entry.amount.toFixed(2).replace(".", ","),
    ]);
    const note = partial
      ? `Recorte de até ${entries.length} lançamentos recentes de ${statement.pagination.total} no histórico.`
      : "Lançamentos correspondentes ao filtro da tela.";
    const table = [
      ["Data", "Descrição", "Campanha", "Movimento", "Status", "Valor"],
      ...rows,
    ]
      .map((row, index) => {
        const tag = index ? "td" : "th";
        return `<tr>${row.map((value) => `<${tag}>${htmlCell(value)}</${tag}>`).join("")}</tr>`;
      })
      .join("");
    const content = `<html><head><meta charset="utf-8"></head><body><p>${htmlCell(note)}</p><table>${table}</table></body></html>`;
    downloadFile(`sortex-extrato-${new Date().toISOString().slice(0, 10)}.xls`, content, "application/vnd.ms-excel;charset=utf-8");
  }

  return (
    <div className="sx-finance-content">
      <FinanceHeader>
        <div className="sx-finance-exports">
          <button type="button" onClick={() => window.print()} className="sx-premium-button">
            <Download size={17} aria-hidden="true" /> Exportar PDF
          </button>
          <button type="button" onClick={exportExcel} disabled={invalidRange} className="sx-premium-button" data-variant="primary" aria-describedby="sx-finance-range-note">
            <FileSpreadsheet size={17} aria-hidden="true" /> Exportar Excel
          </button>
        </div>
      </FinanceHeader>

      <section className="sx-finance-distribution" aria-label="Posição contábil interna">
        <div className="sx-premium-ticket sx-finance-ticket">
          <span className="sx-finance-ticket-icon"><Wallet size={21} aria-hidden="true" /></span>
          <div>
            <h2>Disponibilidade no controle interno</h2>
            <p className="sx-finance-ticket-amount">{money(balance.available)}</p>
            <p className="sx-finance-ticket-detail">Posição contábil da SorteX, não um saldo bancário. Confira recebimentos e prazos de liquidação diretamente no seu gateway.</p>
          </div>
          <dl className="sx-finance-ticket-splits">
            <div><dt>Pendente no controle</dt><dd>{money(balance.pending)}</dd></div>
            <div><dt>Bloqueado no controle</dt><dd>{money(balance.blocked)}</dd></div>
          </dl>
        </div>
        <dl className="sx-finance-metrics">
          <Metric icon={ReceiptText} label="Vendas do dia" value={overview.periods.today.gross} />
          <Metric icon={CalendarRange} label="Vendas do mês" value={overview.periods.currentMonth.gross} />
          <Metric icon={Landmark} label="Faturamento bruto acumulado" value={balance.gross} />
          <Metric icon={Wallet} label="Receita líquida registrada acumulada" value={balance.net} />
        </dl>
      </section>

      <section className={card} aria-labelledby="sx-finance-fees">
        <h2 className="sx-premium-section" id="sx-finance-fees">Taxas acumuladas</h2>
        <p className="sx-premium-muted">Valores registrados em toda a operação, sem filtro por período. A taxa do gateway pode incluir estimativas; confira a cobrança efetiva no gateway.</p>
        <dl className="sx-finance-fees">
          <Summary label="Taxa SorteX" value={balance.platformFees} />
          <Summary label="Taxa do gateway registrada" value={balance.gatewayFees} />
        </dl>
      </section>

      <section className={card} aria-labelledby="sx-finance-filter">
        <h2 className="sx-premium-section" id="sx-finance-filter">Consultar extrato</h2>
        <p className="sx-premium-muted" id="sx-finance-range-note">
          {partial
            ? `O filtro e as exportações usam os ${entries.length} lançamentos mais recentes de ${statement.pagination.total} no histórico, não o extrato completo.`
            : "O filtro é aplicado aos lançamentos do extrato."}
          {" As datas do filtro e do gráfico seguem o horário do seu dispositivo."}
        </p>
        <div className="sx-finance-filters">
          <div className="sx-finance-field"><label htmlFor="sx-finance-period-select">Período</label>
            <select id="sx-finance-period-select" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Últimos 12 meses</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          {period === "custom" && <>
            <div className="sx-finance-field"><label htmlFor="sx-finance-from">De</label><input id="sx-finance-from" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-invalid={invalidRange} aria-describedby={invalidRange ? "sx-finance-invalid-range" : undefined} /></div>
            <div className="sx-finance-field"><label htmlFor="sx-finance-to">Até</label><input id="sx-finance-to" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-invalid={invalidRange} aria-describedby={invalidRange ? "sx-finance-invalid-range" : undefined} /></div>
          </>}
        </div>
        {invalidRange && <p role="alert" className="sx-finance-error" id="sx-finance-invalid-range">A data inicial deve ser anterior ou igual à data final.</p>}
      </section>

      {!invalidRange && (
        <section className={card} aria-labelledby="sx-finance-period">
          <h2 className="sx-premium-section" id="sx-finance-period">Movimentos no recorte</h2>
          <p className="sx-premium-muted" role="status">{filteredEntries.length} {filteredEntries.length === 1 ? "lançamento exibido" : "lançamentos exibidos"}. Bruto, líquido, taxas e estornos são lançamentos distintos, inclusive para um mesmo pagamento. Estes valores não devem ser somados entre si e não equivalem a saldo bancário nem a lucro.</p>
          <dl className="sx-finance-period">
            <Summary label="Vendas brutas registradas" value={totals.grossSales} tone="positive" />
            <Summary label="Receita líquida registrada" value={totals.netRevenue} tone="positive" />
            <Summary label="Taxa SorteX no recorte" value={totals.platformFees} />
            <Summary label="Taxa do gateway registrada no recorte" value={totals.gatewayFees} />
            <Summary label="Estornos e contestações" value={totals.reversals} tone="negative" />
          </dl>
        </section>
      )}

      <div className="sx-finance-charts">
        <section className={card} aria-labelledby="sx-finance-history">
          <h2 className="sx-premium-section" id="sx-finance-history">Histórico financeiro</h2>
          <p className="sx-premium-muted">Receita líquida registrada, com estornos e contestações exibidos separadamente no recorte.</p>
          {chart.length && chartSupported ? (
            <div className="sx-finance-chart">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="sx-finance-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--sxp-accent)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--sxp-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--sxp-line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "var(--sxp-muted)", fontSize: 11 }} />
                  <YAxis width={42} tick={{ fill: "var(--sxp-muted)", fontSize: 11 }} />
                  <Tooltip formatter={(value) => [money(Number(value)), "Receita líquida"]} contentStyle={{ background: "var(--sxp-surface)", borderColor: "var(--sxp-line)", color: "var(--sxp-text)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="var(--sxp-accent)" fill="url(#sx-finance-gradient)" strokeWidth={3} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <Empty>{invalidRange ? "Corrija as datas para visualizar o gráfico." : !chartSupported ? "Há valores fora do limite de precisão do gráfico neste recorte." : "Sem receita líquida registrada neste recorte."}</Empty>}
        </section>

        <section className={card} aria-labelledby="sx-finance-campaigns">
          <h2 className="sx-premium-section" id="sx-finance-campaigns">Campanhas por faturamento</h2>
          <p className="sx-premium-muted">Valores acumulados das primeiras seis campanhas, sem filtro por período.</p>
          {campaigns.length ? (
            <ul className="sx-finance-ranking">
              {campaigns.slice(0, 6).map((campaign) => (
                <li key={campaign.id}>
                  <div className="sx-finance-row"><strong>{campaign.campaign.title}</strong><span>Líquido {money(campaign.netRevenue)}</span></div>
                  <div className="sx-finance-track" aria-hidden="true"><div style={{ width: `${Math.max(0, Math.min(100, balance.gross > 0 ? (100 * campaign.grossRevenue) / balance.gross : 0))}%` }} /></div>
                  <p className="sx-premium-muted">Bruto {money(campaign.grossRevenue)} · SorteX {money(campaign.platformFees)} · Gateway {money(campaign.gatewayFees)}</p>
                </li>
              ))}
            </ul>
          ) : <Empty>Nenhuma campanha com faturamento registrado.</Empty>}
        </section>
      </div>

      <section className={card} aria-labelledby="sx-finance-statement">
        <h2 className="sx-premium-section" id="sx-finance-statement">Extrato</h2>
        <p className="sx-premium-muted">Lançamentos do recorte selecionado, com data e situação registradas no sistema.</p>
        {filteredEntries.length ? (
          <ul className="sx-finance-statement">
            {filteredEntries.map((entry) => {
              const credit = entry.direction === "CREDIT";
              const Icon = credit ? ArrowUpRight : ArrowDownRight;
              const date = new Date(entry.createdAt);
              return (
                <li key={entry.id}>
                  <span className="sx-finance-entry-icon" data-tone={credit ? "positive" : "negative"}><Icon size={19} aria-hidden="true" /></span>
                  <div className="sx-finance-entry-description">
                    <strong>{entry.description}</strong>
                    <p className="sx-premium-muted">{entry.campaign?.title && <>{entry.campaign.title} · </>}<time dateTime={entry.createdAt}>{dateTime.format(date)}</time></p>
                    <p className="sx-premium-muted">{entry.status}</p>
                  </div>
                  <strong className="sx-finance-entry-value" data-tone={credit ? "positive" : "negative"}>
                    <span className="sr-only">{credit ? "Crédito" : "Débito"} </span>
                    <span aria-hidden="true">{credit ? "+" : "−"} </span>{money(entry.amount)}
                  </strong>
                </li>
              );
            })}
          </ul>
        ) : <Empty>{invalidRange ? "Corrija as datas para consultar o extrato." : partial ? "Nenhum lançamento do recorte recente corresponde a este período." : "Nenhum lançamento no período selecionado."}</Empty>}
      </section>
    </div>
  );
}

function FinanceHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sx-finance-header">
      <div>
        <p className="sx-premium-badge">Gestão financeira</p>
        <h1 className="sx-premium-title">Financeiro SorteX</h1>
        <p className="sx-premium-muted">Acompanhe vendas, taxas e lançamentos. Os recebimentos são conferidos no seu gateway.</p>
      </div>
      {children}
    </header>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: number }) {
  return (
    <div className={card}>
      <dt><Icon size={18} aria-hidden="true" /> {label}</dt>
      <dd>{money(value)}</dd>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number | null; tone?: "positive" | "negative" }) {
  return <div><dt>{label}</dt><dd data-tone={tone}>{value === null ? "Valor indisponível" : money(value)}</dd></div>;
}
function Empty({ children }: { children: ReactNode }) { return <p className="sx-finance-empty sx-premium-muted">{children}</p>; }
function htmlCell(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function downloadFile(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }

class FinanceReadError extends Error {}
async function get<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (response.status === 401 || response.status === 403)
    throw new FinanceReadError("A sessão não permite consultar este financeiro. Entre com uma conta de organizador autorizada.");
  if (response.status === 404 || response.status === 501)
    throw new FinanceReadError("O financeiro não está disponível nesta versão da API. Nenhum valor foi exibido.");
  if (!response.ok) throw new FinanceReadError("Não foi possível consultar o financeiro. Tente novamente.");
  const data: unknown = await response.json().catch(() => null);
  const decoded = decodeFinanceResponse(url, data);
  if (decoded === null)
    throw new FinanceReadError("A API retornou dados financeiros incompatíveis. Nenhum valor foi exibido.");
  return decoded as T;
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const title = (value: unknown) => object(value) && typeof value.title === "string";

// Stay below the binary64 precision boundary where cent increments can
// become indistinguishable. Larger legacy values must not silently round.
const maxDisplayCents = 100_000_000_000_000;
function sumBRL(entries: Entry[]): number | null {
  const sum = entries.reduce((cash, entry) => cash + BigInt(Math.round(entry.amount * 100)), BigInt(0));
  const cents = Number(sum);
  return Math.abs(cents) <= maxDisplayCents ? cents / 100 : null;
}

// The legacy Prisma JSON may serialize monetary Decimal columns as strings.
function amount(value: unknown): number | null {
  if (typeof value !== "number" &&
      (typeof value !== "string" || !/^-?\d+(?:\.\d{1,2})?$/.test(value))) return null;
  const numeric = Number(value);
  const cents = Math.round(numeric * 100);
  if (Math.abs(cents) > maxDisplayCents || !Number.isSafeInteger(cents)) return null;
  return Math.abs(cents / 100 - numeric) <= Math.abs(numeric) * Number.EPSILON
    ? cents / 100
    : null;
}
function monetaryFields(source: Record<string, unknown>, fields: readonly string[]) {
  const values: Record<string, number> = {};
  for (const field of fields) {
    const value = amount(source[field]);
    if (value === null) return null;
    values[field] = value;
  }
  return values;
}

function decodeFinanceResponse(url: string, data: unknown): unknown | null {
  if (url === "/api/finance/overview") {
    if (!object(data) || !object(data.balance) || !object(data.periods)) return null;
    const balance = monetaryFields(data.balance, ["gross", "net", "available", "pending", "blocked", "platformFees", "gatewayFees"]);
    const periods: Record<string, { gross: number }> = {};
    for (const name of ["today", "currentMonth"]) {
      const period = data.periods[name];
      if (!object(period)) return null;
      const gross = amount(period.gross);
      if (gross === null) return null;
      periods[name] = { gross };
    }
    return balance ? { balance, periods } : null;
  }
  if (url === "/api/finance/campaigns") {
    if (!Array.isArray(data)) return null;
    const campaigns = [];
    for (const campaign of data) {
      if (!object(campaign) || typeof campaign.id !== "string" || !title(campaign.campaign)) return null;
      const amounts = monetaryFields(campaign, ["grossRevenue", "platformFees", "gatewayFees", "netRevenue"]);
      if (!amounts) return null;
      campaigns.push({ id: campaign.id, campaign: campaign.campaign, ...amounts });
    }
    return campaigns;
  }
  if (!object(data) || !Array.isArray(data.data) || !object(data.pagination)) return null;
  const { total } = data.pagination;
  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < data.data.length) return null;
  const entries = [];
  for (const entry of data.data) {
    if (!object(entry) || typeof entry.id !== "string" || typeof entry.description !== "string" ||
      typeof entry.type !== "string" || typeof entry.status !== "string" ||
      (entry.direction !== "CREDIT" && entry.direction !== "DEBIT") ||
      typeof entry.createdAt !== "string" || !Number.isFinite(Date.parse(entry.createdAt)) ||
      (entry.campaign != null && !title(entry.campaign))) return null;
    const money = amount(entry.amount);
    if (money === null || money < 0) return null;
    entries.push({ ...entry, amount: money });
  }
  return { data: entries, pagination: { total } };
}
