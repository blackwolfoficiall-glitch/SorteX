"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Building2, CircleDollarSign, LoaderCircle, ShieldCheck, Ticket, Users, WalletCards } from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import "./admin-overview-premium.css";

type Point = { date: string; value: number };
type Rank = { id: string; title: string; grossRevenue: unknown; organizer: { name: string } };
type Alert = { key: string; count: number; severity: string };
type Data = {
  totals: Record<string, unknown>;
  series: { users: Point[]; campaigns: Point[] };
  topCampaigns: Rank[];
  alerts: Alert[];
};
type Period = "1" | "7" | "30";
type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Data };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integers = new Intl.NumberFormat("pt-BR");
const dateInUtc = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
const card = "sx-premium-surface sx-admin-overview-panel";
const unavailable = "Indisponível";
const alertLabels: Record<string, string> = {
  WEBHOOK_FAILURES: "Falhas de webhook",
  EXPIRED_RESERVATIONS: "Reservas expiradas não baixadas",
  BALANCE_INCONSISTENCY: "Saldos inconsistentes",
  CAMPAIGNS_WITHOUT_RULE: "Campanhas publicadas sem regra registrada",
  PENDING_DRAWS: "Apurações pendentes",
  PENDING_DOCUMENTS: "Documentos pendentes",
  LATE_PAYOUTS: "Repasses em atraso",
};
const severityLabels: Record<string, string> = { CRITICAL: "Crítico", WARNING: "Atenção", INFO: "Informativo" };

function count(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? integers.format(value)
    : unavailable;
}

function money(value: unknown) {
  // Some Decimal fields arrive as strings from the existing BFF. Do not
  // coerce null/empty/error payloads into display zeros.
  if (typeof value === "number")
    return Number.isFinite(value) && Math.abs(value) < 2 ** 46 ? currency.format(value) : unavailable;
  if (typeof value !== "string") return unavailable;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return unavailable;
  const [, sign, whole, fraction = ""] = match;
  const amount = BigInt(whole);
  const signed = sign === "-" ? (amount === BigInt(0) ? -0 : -amount) : amount;
  return currency.formatToParts(signed).map(({ type, value }) =>
    type === "fraction" ? fraction.padEnd(2, "0") : value,
  ).join("");
}

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function rows(value: unknown, test: (row: Record<string, unknown>) => boolean): boolean {
  return Array.isArray(value) && value.every((row) => object(row) && test(row));
}
function isData(value: unknown): value is Data {
  if (!object(value) || !object(value.totals) || !object(value.series)) return false;
  const point = ({ date, value }: Record<string, unknown>) => typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) &&
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  return rows(value.series.users, point) && rows(value.series.campaigns, point) &&
    rows(value.topCampaigns, (row) => typeof row.id === "string" && typeof row.title === "string" &&
      object(row.organizer) && typeof row.organizer.name === "string") &&
    rows(value.alerts, (row) => typeof row.key === "string" && typeof row.severity === "string" &&
      typeof row.count === "number" && Number.isSafeInteger(row.count) && row.count > 0);
}

export default function AdminDashboard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [period, setPeriod] = useState<Period>("30");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ limit: "25" });
    if (period !== "30") query.set("from", new Date(Date.now() - Number(period) * 86400000).toISOString());
    async function load() {
      try {
        const response = await fetch(`/api/admin/platform/dashboard?${query}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setState({ kind: "error", message: response.status === 401 || response.status === 403
            ? "A sessão atual não tem acesso a este painel."
            : "Não foi possível consultar os indicadores do painel." });
          return;
        }
        const data: unknown = await response.json();
        if (controller.signal.aborted) return;
        setState(isData(data)
          ? { kind: "ready", data }
          : { kind: "error", message: "A API retornou um painel incompatível. Nenhum indicador foi exibido." });
      } catch {
        if (!controller.signal.aborted)
          setState({ kind: "error", message: "Não foi possível consultar os indicadores do painel." });
      }
    }
    void load();
    return () => controller.abort();
  }, [period, attempt]);

  return (
    <main className="sx-admin-overview-main">
      <PremiumScope className="sx-admin-overview">
        <header className="sx-premium-ticket sx-admin-overview-hero">
          <div>
            <p className="sx-admin-overview-kicker">Central de operações</p>
            <h1 className="sx-premium-title">Painel administrativo</h1>
            <p>Acompanhe os registros da operação sem executar ações administrativas nesta tela.</p>
          </div>
        </header>

        <section className={card + " sx-admin-overview-filter"} aria-label="Período dos indicadores">
          <div>
            <label htmlFor="sx-admin-overview-period">Período</label>
            <p id="sx-admin-overview-period-help" className="sx-premium-muted">
              Altera o volume de pagamentos aprovados e os gráficos. Cadastros, pendências, alertas e ranking são gerais.
            </p>
          </div>
          <select id="sx-admin-overview-period" aria-describedby="sx-admin-overview-period-help" value={period}
            onChange={(event) => {
              setState({ kind: "loading" });
              setPeriod(event.target.value as Period);
            }}>
            <option value="1">Últimas 24 horas</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
          </select>
        </section>
        {state.kind === "loading" && (
          <p className={card + " sx-admin-overview-state"} role="status">
            <LoaderCircle size={20} aria-hidden="true" className="sx-admin-overview-spinner" /> Consultando indicadores…
          </p>
        )}
        {state.kind === "error" && (
          <section className={card}>
            <p className="sx-admin-overview-error" role="alert">{state.message}</p>
            <button type="button" className="sx-premium-button" data-variant="primary" onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}>Tentar novamente</button>
          </section>
        )}
        {state.kind === "ready" && <Overview data={state.data} />}
      </PremiumScope>
    </main>
  );
}

function Overview({ data }: { data: Data }) {
  const totals = data.totals;
  const pendingOrganizers = count(totals.organizersPending);
  return (
    <>
      <section className={card} aria-labelledby="sx-admin-overview-operation">
        <h2 id="sx-admin-overview-operation" className="sx-premium-section">Operação da plataforma</h2>
        <p className="sx-premium-muted">Contagens gerais do sistema, sem filtro por período.</p>
        <dl className="sx-admin-overview-metrics">
          <Kpi icon={Users} label="Compradores" value={count(totals.buyers)} />
          <Kpi icon={Building2} label="Organizadores" value={count(totals.organizers)}
            detail={pendingOrganizers === unavailable ? undefined : `${pendingOrganizers} pendentes`} />
          <Kpi icon={Ticket} label="Campanhas publicadas" value={count(totals.campaignsPublished)} />
          <Kpi icon={ShieldCheck} label="Organizadores verificados" value={count(totals.organizersVerified)} />
          <Kpi icon={AlertTriangle} label="Repasses pendentes" value={count(totals.pendingPayouts)} />
          <Kpi icon={AlertTriangle} label="Chamados abertos" value={count(totals.openSupport)} />
        </dl>
      </section>
      <section className={card} aria-labelledby="sx-admin-overview-money">
        <h2 id="sx-admin-overview-money" className="sx-premium-section">Indicadores financeiros</h2>
        <dl className="sx-admin-overview-metrics">
          <Kpi icon={CircleDollarSign} label="GMV" value={money(totals.gmv)} detail="Valor dos pagamentos aprovados no período." />
          <Kpi icon={WalletCards} label="Receita SorteX" value={money(totals.sortexRevenue)}
            detail="Taxas no período; a API pode retornar o acumulado na ausência de taxas no recorte." />
        </dl>
      </section>
      <div className="sx-admin-overview-pair">
        <Chart title="Novos usuários" data={data.series.users} />
        <Chart title="Novas campanhas" data={data.series.campaigns} />
      </div>
      <div className="sx-admin-overview-pair">
        <section className={card} aria-labelledby="sx-admin-overview-ranking">
          <h2 id="sx-admin-overview-ranking" className="sx-premium-section">Campanhas com maior faturamento</h2>
          <p className="sx-premium-muted">Ranking acumulado, sem filtro de datas.</p>
          {data.topCampaigns.length ? (
            <ol className="sx-admin-overview-rows">
              {data.topCampaigns.map((campaign) => (
                <li key={campaign.id} className="sx-admin-overview-row">
                  <div><strong>{campaign.title}</strong><p className="sx-premium-muted">{campaign.organizer.name}</p></div>
                  <b>{money(campaign.grossRevenue)}</b>
                </li>
              ))}
            </ol>
          ) : <p className="sx-admin-overview-empty sx-premium-muted">Nenhuma campanha retornada.</p>}
        </section>
        <section className={card} aria-labelledby="sx-admin-overview-alerts">
          <h2 id="sx-admin-overview-alerts" className="sx-premium-section">Alertas operacionais</h2>
          <p className="sx-premium-muted">Verificações internas do sistema, não um atestado de disponibilidade externa.</p>
          {data.alerts.length ? (
            <ul className="sx-admin-overview-alerts">
              {data.alerts.map((alert) => (
                <li key={alert.key} className="sx-admin-overview-row">
                  <div><strong>{alertLabels[alert.key] ?? alert.key.replaceAll("_", " ")}</strong>
                    <p className="sx-admin-overview-severity" data-critical={alert.severity === "CRITICAL" || undefined}>
                      {severityLabels[alert.severity] ?? alert.severity}
                    </p>
                  </div>
                  <b>{count(alert.count)}</b>
                </li>
              ))}
            </ul>
          ) : <p className="sx-admin-overview-empty sx-premium-muted">Nenhum alerta interno detectado.</p>}
        </section>
      </div>
    </>
  );
}

function Kpi({ icon: Icon, label, value, detail }: { icon: typeof Users; label: string; value: string; detail?: string }) {
  return (
    <div className="sx-admin-overview-metric">
      <dt><Icon size={18} aria-hidden="true" /> {label}</dt>
      <dd>{value}{detail && <small className="sx-premium-muted">{detail}</small>}</dd>
    </div>
  );
}

function Chart({ title, data }: { title: string; data: Point[] }) {
  const points = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const day = (date: string) => dateInUtc.format(new Date(`${date}T00:00:00Z`));
  return (
    <section className={card} aria-label={title}>
      <h2 className="sx-premium-section">{title}</h2>
      <p className="sx-premium-muted">Registros criados no período, agrupados por dia UTC.</p>
      {points.length ? (
        <>
          <div className="sx-admin-overview-chart">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={points}>
                <CartesianGrid vertical={false} stroke="var(--sxp-line)" strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={(date) => day(date).slice(0, 5)} tick={{ fill: "var(--sxp-muted)", fontSize: 11 }} />
                <YAxis allowDecimals={false} width={38} tick={{ fill: "var(--sxp-muted)", fontSize: 11 }} />
                <Tooltip labelFormatter={(label) => day(String(label))} formatter={(value) => [String(value), "Registros"]}
                  contentStyle={{ background: "var(--sxp-surface)", color: "var(--sxp-text)", borderColor: "var(--sxp-line)", borderRadius: 12 }} />
                <Area dataKey="value" stroke="var(--sxp-accent)" fill="var(--sxp-tint)" strokeWidth={3} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <details className="sx-admin-overview-chart-details">
            <summary>Consultar valores do gráfico</summary>
            <ul className="sx-admin-overview-rows">
              {points.map((point) => <li key={point.date} className="sx-admin-overview-row"><time dateTime={point.date}>{day(point.date)}</time><b>{count(point.value)}</b></li>)}
            </ul>
          </details>
        </>
      ) : <p className="sx-admin-overview-empty sx-premium-muted">Nenhum registro neste período.</p>}
    </section>
  );
}
