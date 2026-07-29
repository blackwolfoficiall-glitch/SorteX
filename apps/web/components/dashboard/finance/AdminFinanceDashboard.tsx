'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeDollarSign,
  Building2,
  CircleDollarSign,
  Download,
  LoaderCircle,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuthorizedUser } from '@/components/auth/RoleGate';
import { hasAdminPermission } from '@/lib/admin/authorization';

type Tab = 'payouts' | 'ledger' | 'accounts' | 'adjustments' | 'subscriptions' | 'reconciliation';
type Row = Record<string, unknown> & { id?: string };
type PageResult = { data: Row[]; pagination: { page: number; pages: number; total: number } };
type Overview = {
  platform?: { lifetimeNetRevenue: number };
  organizers?: { lifetimeGrossRevenue: number; availableBalance: number };
  pendingPayouts: number;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'payouts', label: 'Repasses' },
  { id: 'ledger', label: 'Livro financeiro' },
  { id: 'accounts', label: 'Contas' },
  { id: 'adjustments', label: 'Ajustes' },
  { id: 'subscriptions', label: 'Assinaturas e planos' },
  { id: 'reconciliation', label: 'Conciliação' },
];
const card = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm';
const money = (value: unknown = 0) =>
  Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString('pt-BR') : '—';
const text = (value: unknown) => value == null || value === '' ? '—' : String(value);

export default function AdminFinanceDashboard() {
  const user = useAuthorizedUser();
  const canWrite = Boolean(user && hasAdminPermission(user, 'FINANCE_WRITE'));
  const canReview = Boolean(user && hasAdminPermission(user, 'PAYOUTS_REVIEW'));
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab>('payouts');
  const [rows, setRows] = useState<Row[]>([]);
  const [reconciliation, setReconciliation] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20', sort });
      if (search) query.set('search', search);
      if (status) {
        const key = tab === 'payouts' ? 'payoutStatus' : tab === 'accounts' ? 'accountStatus' : 'subscriptionStatus';
        query.set(key, status);
      }
      const [summary, result] = await Promise.all([
        api<Overview>('overview'),
        api<PageResult | Row>(`${tab}?${query}`),
      ]);
      setOverview(summary);
      if (tab === 'reconciliation') {
        setReconciliation(result as Row);
        setRows([]);
        setPages(1);
      } else {
        const paged = result as PageResult;
        setRows(paged.data ?? []);
        setPages(paged.pagination?.pages || 1);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o financeiro.');
    } finally {
      setLoading(false);
    }
  }, [page, search, sort, status, tab]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  function changeTab(next: Tab) {
    setTab(next);
    setPage(1);
    setSearch('');
    setStatus('');
    setDetail(null);
  }

  async function openDetail(row: Row) {
    if (!row.id) return;
    try {
      setDetail(await api<Row>(`${tab}/${row.id}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir os detalhes.');
    }
  }

  async function mutate(path: string, promptLabel: string) {
    const reason = window.prompt(promptLabel);
    if (!reason?.trim()) return;
    if (!window.confirm('Confirma esta ação administrativa? Ela ficará registrada na auditoria.')) return;
    try {
      await api(path, { method: 'POST', body: JSON.stringify({ reason }) });
      setNotice('Ação concluída e registrada na auditoria.');
      setDetail(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a ação.');
    }
  }

  async function createAdjustment() {
    const accountId = window.prompt('ID da conta financeira:');
    const amount = window.prompt('Valor do ajuste:');
    const direction = window.prompt('Direção (CREDIT ou DEBIT):')?.toUpperCase();
    const reason = window.prompt('Motivo obrigatório:');
    if (!accountId || !amount || !reason || !['CREDIT', 'DEBIT'].includes(direction ?? '')) return;
    try {
      await api('adjustments', {
        method: 'POST',
        body: JSON.stringify({ accountId, amount: Number(amount.replace(',', '.')), direction, reason }),
      });
      setNotice('Ajuste registrado no livro financeiro e na auditoria.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o ajuste.');
    }
  }

  async function exportCsv() {
    const resource = tab === 'payouts' || tab === 'ledger' || tab === 'adjustments' ? tab : null;
    if (!resource) return;
    const response = await fetch(`/api/admin/finance/export/${resource}?search=${encodeURIComponent(search)}&sort=${sort}`);
    if (!response.ok) return setError('Não foi possível exportar os dados.');
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sortex-${resource}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">Administração SorteX</p>
        <h1 className="mt-2 text-3xl font-black">Controle financeiro</h1>
        <p className="mt-1 text-slate-500">Repasses, saldos, assinaturas e conciliação com trilha de auditoria.</p>
        {error && <Feedback tone="error" message={error} action={load} />}
        {notice && <Feedback tone="success" message={notice} />}

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={CircleDollarSign} label="Receita SorteX" value={money(overview?.platform?.lifetimeNetRevenue)} />
          <Kpi icon={BadgeDollarSign} label="GMV organizadores" value={money(overview?.organizers?.lifetimeGrossRevenue)} />
          <Kpi icon={Building2} label="Saldo disponível" value={money(overview?.organizers?.availableBalance)} />
          <Kpi icon={ShieldCheck} label="Repasses pendentes" value={String(overview?.pendingPayouts ?? 0)} />
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Áreas financeiras">
          {tabs.map((item) => (
            <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => changeTab(item.id)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${tab === item.id ? 'bg-violet-700 text-white' : 'border bg-white text-slate-600'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <section className={`${card} mt-3`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="text-lg font-black">{tabs.find((item) => item.id === tab)?.label}</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              {tab !== 'reconciliation' && (
                <>
                  <label className="relative">
                    <span className="sr-only">Pesquisar</span>
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                      placeholder="Pesquisar" className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm sm:w-56" />
                  </label>
                  {(tab === 'payouts' || tab === 'accounts' || tab === 'subscriptions') && (
                    <input value={status} onChange={(event) => { setStatus(event.target.value.toUpperCase()); setPage(1); }}
                      placeholder="Filtrar status" aria-label="Filtrar status" className="rounded-xl border px-3 py-2 text-sm" />
                  )}
                  <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar"
                    className="rounded-xl border px-3 py-2 text-sm">
                    <option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option>
                    {(tab === 'ledger' || tab === 'adjustments') && <><option value="amount_desc">Maior valor</option><option value="amount_asc">Menor valor</option></>}
                  </select>
                </>
              )}
              {canWrite && tab === 'adjustments' && <button onClick={createAdjustment} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white">Novo ajuste</button>}
              {['payouts', 'ledger', 'adjustments'].includes(tab) && <button onClick={exportCsv} className="flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"><Download className="h-4 w-4" /> Exportar</button>}
            </div>
          </div>

          {loading ? <Loading /> : tab === 'reconciliation' ? <Reconciliation data={reconciliation} /> :
            rows.length ? <FinanceTable tab={tab} rows={rows} canReview={canReview} canWrite={canWrite} openDetail={openDetail} mutate={mutate} /> :
              <p className="py-14 text-center text-slate-500">Nenhum registro encontrado para os filtros informados.</p>}

          {!loading && tab !== 'reconciliation' && pages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3">
              <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button>
              <span className="text-sm">Página {page} de {pages}</span>
              <button disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Próxima</button>
            </div>
          )}
        </section>
      </div>
      {detail && <DetailPanel data={detail} close={() => setDetail(null)} />}
    </main>
  );
}

function FinanceTable({ tab, rows, canReview, canWrite, openDetail, mutate }: {
  tab: Tab; rows: Row[]; canReview: boolean; canWrite: boolean;
  openDetail: (row: Row) => void; mutate: (path: string, label: string) => Promise<void>;
}) {
  return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
    <thead className="text-slate-500"><tr><th className="py-3">Registro</th><th>Responsável</th><th>Valor / plano</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead>
    <tbody>{rows.map((row, index) => {
      const organizer = row.organizer as Row | undefined;
      const account = row.account as Row | undefined;
      const plan = row.selectedPlan as Row | undefined;
      const status = text(row.status);
      return <tr key={String(row.id ?? index)} className="border-t">
        <td className="py-4"><button onClick={() => openDetail(row)} className="font-bold text-violet-700 hover:underline">{text(row.reference ?? row.reason ?? row.id)}</button><br /><span className="text-xs text-slate-500">{text(row.type ?? row.direction)}</span></td>
        <td>{text(organizer?.name ?? account?.ownerId ?? row.ownerId ?? (row.createdBy as Row | undefined)?.name)}</td>
        <td className="font-semibold">{row.amount != null ? money(row.amount) : text(plan?.name ?? row.plan ?? row.currency)}</td>
        <td>{status}</td><td>{date(row.requestedAt ?? row.createdAt ?? row.startedAt)}</td>
        <td><div className="flex gap-2">
          <button onClick={() => openDetail(row)} className="rounded-lg border px-3 py-2 text-xs font-bold">Detalhes</button>
          {tab === 'payouts' && canReview && status === 'REQUESTED' && <>
            <button onClick={() => mutate(`payouts/${row.id}/approve`, 'Justificativa da aprovação:')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Aprovar</button>
            <button onClick={() => mutate(`payouts/${row.id}/reject`, 'Motivo da rejeição:')} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white">Rejeitar</button>
          </>}
          {tab === 'accounts' && canWrite && <button onClick={() => mutate(`accounts/${row.id}/${status === 'BLOCKED' ? 'unblock' : 'block'}`, `Motivo para ${status === 'BLOCKED' ? 'desbloquear' : 'bloquear'} a conta:`)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">{status === 'BLOCKED' ? 'Desbloquear' : 'Bloquear'}</button>}
        </div></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

function DetailPanel({ data, close }: { data: Row; close: () => void }) {
  const audit = Array.isArray(data.audit) ? data.audit as Row[] : [];
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="dialog" aria-modal="true" aria-label="Detalhes financeiros">
    <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="text-xl font-black">Detalhes e histórico</h2><button onClick={close} aria-label="Fechar detalhes" className="rounded-lg p-2 hover:bg-slate-100"><X /></button></div>
      <dl className="mt-6 grid grid-cols-2 gap-4">{Object.entries(data).filter(([key, value]) => !['audit', 'metadata', 'destinationSnapshot'].includes(key) && typeof value !== 'object').map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">{key}</dt><dd className="mt-1 break-words text-sm">{text(value)}</dd></div>)}</dl>
      <h3 className="mt-7 font-black">Auditoria</h3>
      <div className="mt-3 space-y-3">{audit.map((item, index) => <div key={String(item.id ?? index)} className="rounded-xl border p-3 text-sm"><b>{text(item.action)}</b><p className="text-slate-500">{text((item.actor as Row | undefined)?.name)} · {date(item.createdAt)}</p></div>)}{!audit.length && <p className="text-sm text-slate-500">Nenhum evento administrativo registrado.</p>}</div>
    </div>
  </div>;
}

function Reconciliation({ data }: { data: Row | null }) {
  if (!data) return null;
  return <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <Kpi icon={CircleDollarSign} label="Pagamentos aprovados" value={money(data.paymentTotal)} />
    <Kpi icon={BadgeDollarSign} label="Lançamentos brutos" value={money(data.ledgerTotal)} />
    <Kpi icon={Building2} label="Diferença" value={money(data.difference)} />
    <Kpi icon={ShieldCheck} label="Situação" value={data.balanced ? 'Conciliado' : 'Divergência encontrada'} />
  </div>;
}
function Kpi({ icon: Icon, label, value }: { icon: typeof CircleDollarSign; label: string; value: string }) {
  return <div className={card}><Icon className="text-violet-600" /><p className="mt-5 text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}
function Loading() { return <div className="grid min-h-56 place-items-center"><LoaderCircle aria-label="Carregando" className="animate-spin text-violet-700" /></div>; }
function Feedback({ tone, message, action }: { tone: 'error' | 'success'; message: string; action?: () => void }) {
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-4 flex items-center justify-between rounded-xl p-3 ${tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}><span>{message}</span>{action && <button onClick={action} className="font-bold underline">Tentar novamente</button>}</div>;
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/finance/${path}`, { ...init, headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message ?? 'Não foi possível concluir a operação financeira.');
  return payload;
}
