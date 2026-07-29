"use client";

import { useEffect, useMemo, useState } from "react";
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

type Overview = {
  balance: {
    gross: number;
    net: number;
    available: number;
    platformFees: number;
    gatewayFees: number;
  };
  periods: {
    today: { gross: number; net: number };
    last7Days: { gross: number; net: number };
    currentMonth: { gross: number; net: number };
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
  campaign?: { title: string };
  payment?: { provider: string; method: string };
};
type Campaign = {
  id: string;
  grossRevenue: number;
  platformFees: number;
  gatewayFees: number;
  netRevenue: number;
  estimatedProfit: number;
  campaign: { title: string };
};
type Period = "7" | "30" | "90" | "365" | "custom";

const money = (value = 0) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const card = "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm";

export default function FinanceDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      get<Overview>("/api/finance/overview"),
      get<{ data: Entry[] }>("/api/finance/statement?limit=100"),
      get<Campaign[]>("/api/finance/campaigns"),
    ])
      .then(([nextOverview, statement, nextCampaigns]) => {
        if (!active) return;
        setOverview(nextOverview);
        setEntries(statement.data);
        setCampaigns(nextCampaigns);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Falha ao carregar o financeiro.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const now = new Date();
    const start = period === "custom"
      ? startDate ? new Date(`${startDate}T00:00:00`) : null
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(period) + 1);
    const end = period === "custom" && endDate
      ? new Date(`${endDate}T23:59:59.999`)
      : now;
    return entries.filter((entry) => {
      const date = new Date(entry.createdAt);
      return (!start || date >= start) && date <= end;
    });
  }, [entries, period, startDate, endDate]);

  const totals = useMemo(() => {
    const total = (direction: Entry["direction"]) =>
      filteredEntries
        .filter((entry) => entry.direction === direction)
        .reduce((sum, entry) => sum + entry.amount, 0);
    const byType = (type: string) =>
      filteredEntries
        .filter((entry) => entry.type === type)
        .reduce((sum, entry) => sum + entry.amount, 0);
    const revenue = total("CREDIT");
    const expenses = total("DEBIT");
    return {
      revenue,
      expenses,
      platformFees: byType("PLATFORM_FEE"),
      gatewayFees: byType("GATEWAY_FEE"),
      net: revenue - expenses,
    };
  }, [filteredEntries]);

  const chart = useMemo(() => {
    const map = new Map<string, number>();
    filteredEntries
      .filter((entry) => entry.type === "ORGANIZER_NET_REVENUE")
      .forEach((entry) => {
        const key = entry.createdAt.slice(0, 10);
        map.set(key, (map.get(key) ?? 0) + entry.amount);
      });
    return [...map]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date: new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
        value,
      }));
  }, [filteredEntries]);

  function exportExcel() {
    const rows = filteredEntries.map((entry) => [
      new Date(entry.createdAt).toLocaleString("pt-BR"),
      entry.description,
      entry.campaign?.title ?? "",
      entry.direction === "CREDIT" ? "Receita" : "Despesa",
      entry.status,
      entry.amount.toFixed(2).replace(".", ","),
    ]);
    const table = [
      ["Data", "Descrição", "Campanha", "Movimento", "Status", "Valor"],
      ...rows,
    ]
      .map(
        (row, index) =>
          `<tr>${row
            .map(
              (value) =>
                `<${index ? "td" : "th"}>${htmlCell(value)}</${index ? "td" : "th"}>`,
            )
            .join("")}</tr>`,
      )
      .join("");
    const content = `<html><head><meta charset="utf-8"></head><body><table>${table}</table></body></html>`;
    downloadFile(
      `sortex-extrato-${new Date().toISOString().slice(0, 10)}.xls`,
      content,
      "application/vnd.ms-excel;charset=utf-8",
    );
  }

  if (loading)
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoaderCircle className="animate-spin text-violet-700" />
      </div>
    );

  const balance = overview?.balance ?? {
    gross: 0,
    net: 0,
    available: 0,
    platformFees: 0,
    gatewayFees: 0,
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-7 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">Gestão financeira</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Financeiro SorteX</h1>
            <p className="mt-1 text-slate-500">Vendas, taxas e extrato do gateway conectado.</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-bold"><Download size={17} /> Exportar PDF</button>
            <button onClick={exportExcel} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white"><FileSpreadsheet size={17} /> Exportar Excel</button>
          </div>
        </header>

        {error && <p className="mt-5 rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Wallet} label="Saldo disponível" value={money(balance.available)} tone="green" />
          <Metric icon={ReceiptText} label="Vendas do dia" value={money(overview?.periods.today.gross)} tone="violet" />
          <Metric icon={CalendarRange} label="Vendas do mês" value={money(overview?.periods.currentMonth.gross)} tone="violet" />
          <Metric icon={Landmark} label="Faturamento bruto" value={money(balance.gross)} tone="violet" />
        </section>

        <section className={`${card} mt-6 print:hidden`}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-bold text-slate-600">Período
              <select value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="h-11 rounded-xl border px-3 text-sm font-normal">
                <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="365">Últimos 12 meses</option><option value="custom">Personalizado</option>
              </select>
            </label>
            {period === "custom" && <><label className="grid gap-1 text-xs font-bold text-slate-600">De<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 rounded-xl border px-3 text-sm font-normal" /></label><label className="grid gap-1 text-xs font-bold text-slate-600">Até<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 rounded-xl border px-3 text-sm font-normal" /></label></>}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Summary label="Receitas" value={totals.revenue} tone="green" />
          <Summary label="Despesas" value={totals.expenses} tone="red" />
          <Summary label="Taxa SorteX" value={totals.platformFees} tone="red" />
          <Summary label="Taxa Gateway" value={totals.gatewayFees} tone="red" />
          <Summary label="Valor líquido" value={totals.net} tone="violet" />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className={card}><h2 className="text-lg font-black">Histórico financeiro</h2><p className="text-sm text-slate-500">Receita líquida registrada no período</p><div className="mt-6 h-72">{chart.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="finance" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} /><stop offset="95%" stopColor="#7c3aed" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(value) => money(Number(value))} /><Area type="monotone" dataKey="value" stroke="#7c3aed" fill="url(#finance)" strokeWidth={3} /></AreaChart></ResponsiveContainer> : <Empty />}</div></div>
          <div className={card}><h2 className="text-lg font-black">Campanhas por faturamento</h2><div className="mt-4 space-y-4">{campaigns.length ? campaigns.slice(0, 6).map((campaign) => <div key={campaign.id}><div className="flex justify-between gap-3 text-sm"><b>{campaign.campaign.title}</b><span className="font-bold text-emerald-700">{money(campaign.netRevenue)}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(100, balance.gross ? (100 * campaign.grossRevenue) / balance.gross : 0)}%` }} /></div><p className="mt-1 text-xs text-slate-500">Bruto {money(campaign.grossRevenue)} · SorteX {money(campaign.platformFees)} · Gateway {money(campaign.gatewayFees)}</p></div>) : <Empty />}</div></div>
        </section>

        <section className={`${card} mt-6`}><h2 className="text-lg font-black">Extrato</h2><p className="text-sm text-slate-500">Lançamentos e histórico financeiro do período selecionado</p><div className="mt-4 divide-y">{filteredEntries.length ? filteredEntries.map((entry) => <div key={entry.id} className="flex items-center justify-between gap-3 py-4"><div className="flex min-w-0 items-center gap-3"><span className={`shrink-0 rounded-xl p-2 ${entry.direction === "CREDIT" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>{entry.direction === "CREDIT" ? <ArrowUpRight /> : <ArrowDownRight />}</span><div className="min-w-0"><p className="truncate text-sm font-bold">{entry.description}</p><p className="truncate text-xs text-slate-500">{entry.campaign?.title ?? entry.status} · {new Date(entry.createdAt).toLocaleString("pt-BR")}</p></div></div><strong className={`shrink-0 ${entry.direction === "CREDIT" ? "text-emerald-600" : "text-red-600"}`}>{entry.direction === "CREDIT" ? "+" : "−"} {money(entry.amount)}</strong></div>) : <Empty />}</div></section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Wallet; label: string; value: string; tone: "green" | "violet" }) { const color = tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"; return <div className={card}><span className={`inline-flex rounded-2xl p-3 ${color}`}><Icon /></span><p className="mt-5 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function Summary({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "violet" }) { const color = { green: "text-emerald-600", red: "text-red-600", violet: "text-violet-700" }[tone]; return <div className={card}><p className="text-sm text-slate-500">{label}</p><p className={`mt-2 text-xl font-black ${color}`}>{money(value)}</p></div>; }
function Empty() { return <p className="py-8 text-center text-sm text-slate-400">Ainda não há dados reais neste período.</p>; }
function htmlCell(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function downloadFile(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
async function get<T>(url: string): Promise<T> { const response = await fetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Erro financeiro."); return data; }
