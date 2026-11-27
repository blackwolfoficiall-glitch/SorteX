'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import PremiumScope from '@/components/premium/PremiumScope';
import { useAuthorizedUser } from '@/components/auth/RoleGate';
import { hasAdminPermission } from '@/lib/admin/authorization';

type Tab = 'payouts' | 'ledger' | 'accounts' | 'adjustments' | 'subscriptions' | 'reconciliation';
type Row = Record<string, unknown> & { id?: string };
type PageResult = { data: Row[]; pagination: { page: number; pages: number; total: number } };
type Overview = {
  platform?: { lifetimeNetRevenue: number | string | null };
  organizers?: { lifetimeGrossRevenue: number | string | null; availableBalance: number | string | null };
  pendingPayouts: number | null;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'payouts', label: 'Repasses' },
  { id: 'ledger', label: 'Livro financeiro' },
  { id: 'accounts', label: 'Contas' },
  { id: 'adjustments', label: 'Ajustes' },
  { id: 'subscriptions', label: 'Assinaturas e planos' },
  { id: 'reconciliation', label: 'Conciliação' },
];
const unavailable = 'Não informado';
const ledgerFeeLabels: Readonly<Record<string, string>> = {
  PLATFORM_FEE: 'Taxa da plataforma (lançamento interno)',
  GATEWAY_FEE: 'Taxa do gateway (lançamento interno)',
  MONTHLY_PLAN_FEE: 'Mensalidade do plano (lançamento interno)',
};
function amount(value: unknown, currency?: unknown) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value))) return unavailable;
  const n = Number(value);
  // The API serializes financial aggregates as numbers. Beyond this threshold a cent is not reliably representable.
  if (!Number.isFinite(n) || Math.abs(n) >= 2 ** 46) return unavailable;
  const digits = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)
    ? n.toLocaleString('pt-BR', { ...digits, style: 'currency', currency })
    : n.toLocaleString('pt-BR', digits);
}
function count(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('pt-BR') : unavailable;
}
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadedTab, setLoadedTab] = useState<Tab | null>(null);
  const listRequest = useRef(0);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const request = ++listRequest.current;
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
      if (request !== listRequest.current) return;
      setLoadedTab(tab);
      setOverview(summary);
      setLoadFailed(false);
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
      if (request !== listRequest.current) return;
      setLoadedTab(tab);
      setLoadFailed(true);
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o financeiro.');
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }, [page, search, sort, status, tab]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(task);
      listRequest.current += 1;
    };
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

  const updating = loading || loadedTab !== tab;
  return <>
    <PremiumScope className="sx-admin-finance">
      <main className="sx-af-wrap">
        <header className="sx-premium-ticket sx-af-hero">
          <CircleDollarSign size={30} aria-hidden="true" />
          <div>
            <p className="sx-af-eyebrow">Administração SorteX</p>
            <h1 className="sx-premium-title">Controle financeiro</h1>
            <p>Consulte repasses, contas, assinaturas e conciliação interna.</p>
          </div>
        </header>
        {error && <Feedback tone="error" message={error} action={load} />}
        {notice && <Feedback tone="success" message={notice} />}
        <section className="sx-af-summary" aria-labelledby="sx-af-summary">
          <h2 className="sx-premium-section" id="sx-af-summary">Resumo financeiro</h2>
          <p className="sx-premium-muted">Os saldos são internos e não comprovam repasse ou saque. Os totais dos organizadores não são separados nem convertidos por moeda.</p>
          {updating ? <p role="status" className="sx-premium-muted">Carregando indicadores financeiros…</p> : loadFailed ? (
            <p role="status" className="sx-premium-muted">Resumo financeiro indisponível.</p>
          ) : (
            <dl className="sx-af-kpis">
              <Kpi icon={CircleDollarSign} label="Receita líquida acumulada da SorteX" value={amount(overview?.platform?.lifetimeNetRevenue, 'BRL')} hint="Conta interna da plataforma em BRL." />
              <Kpi icon={BadgeDollarSign} label="Volume bruto acumulado dos organizadores" value={amount(overview?.organizers?.lifetimeGrossRevenue)} hint="Total do sistema sem separação por moeda." />
              <Kpi icon={Building2} label="Saldo interno disponível dos organizadores" value={amount(overview?.organizers?.availableBalance)} hint="Total do sistema sem separação por moeda." />
              <Kpi icon={ShieldCheck} label="Solicitações de repasse pendentes" value={count(overview?.pendingPayouts)} hint="Solicitadas ou em análise. Não representa valor pago." />
            </dl>
          )}
        </section>
        <div className="sx-af-tabs" role="tablist" aria-label="Áreas financeiras">
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" id={`sx-af-tab-${item.id}`} aria-controls="sx-af-panel" aria-selected={tab === item.id}
              onClick={() => changeTab(item.id)} className="sx-premium-button">{item.label}</button>
          ))}
        </div>

        <section id="sx-af-panel" role="tabpanel" aria-labelledby={`sx-af-tab-${tab}`} className="sx-premium-surface sx-af-panel">
          <header className="sx-af-toolbar">
            <h2 className="sx-premium-section">{tabs.find((item) => item.id === tab)?.label}</h2>
            <div className="sx-af-filters">
              {tab !== 'reconciliation' && (
                <>
                  <label className="sx-af-search">
                    <span className="sr-only">Pesquisar</span>
                    <Search aria-hidden="true" size={17} />
                    <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Pesquisar" />
                  </label>
                  {(tab === 'payouts' || tab === 'accounts' || tab === 'subscriptions') && (
                    <input value={status} onChange={(event) => { setStatus(event.target.value.toUpperCase()); setPage(1); }}
                      placeholder="Filtrar status" aria-label="Filtrar status" />
                  )}
                  <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar">
                    <option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option>
                    {(tab === 'ledger' || tab === 'adjustments') && <><option value="amount_desc">Maior valor</option><option value="amount_asc">Menor valor</option></>}
                  </select>
                </>
              )}
              {canWrite && tab === 'adjustments' && <button type="button" onClick={createAdjustment} className="sx-premium-button" data-variant="primary">Novo ajuste</button>}
              {['payouts', 'ledger', 'adjustments'].includes(tab) && <button type="button" onClick={exportCsv} className="sx-premium-button"><Download size={17} aria-hidden="true" /> Exportar</button>}
            </div>
          </header>

          {updating ? <Loading /> : loadFailed ? (
            <p className="sx-af-empty sx-premium-muted">Não foi possível consultar esta área.</p>
          ) : tab === 'reconciliation' ? <Reconciliation data={reconciliation} /> :
            rows.length ? <FinanceTable tab={tab} rows={rows} canReview={canReview} canWrite={canWrite} openDetail={openDetail} mutate={mutate} /> :
              <p className="sx-af-empty sx-premium-muted">Nenhum registro encontrado para os filtros informados.</p>}
          {!updating && !loadFailed && tab !== 'reconciliation' && pages > 1 && (
            <nav aria-label="Paginação" className="sx-af-pages">
              <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="sx-premium-button">Anterior</button>
              <span className="sx-premium-muted">Página {page} de {pages}</span>
              <button type="button" disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="sx-premium-button">Próxima</button>
            </nav>
          )}
        </section>
      </main>
    </PremiumScope>
    {detail && <DetailPanel data={detail} close={() => setDetail(null)} />}
  </>;
}

function FinanceTable({ tab, rows, canReview, canWrite, openDetail, mutate }: {
  tab: Tab; rows: Row[]; canReview: boolean; canWrite: boolean;
  openDetail: (row: Row) => void; mutate: (path: string, label: string) => Promise<void>;
}) {
  return <ul className="sx-af-table" role="list">{rows.map((row, index) => {
    const organizer = row.organizer as Row | undefined;
    const account = row.account as Row | undefined;
    const plan = row.selectedPlan as Row | undefined;
    const status = text(row.status);
    return <li key={String(row.id ?? index)} className="sx-premium-surface sx-af-row">
      <div className="sx-af-item">
        <button type="button" onClick={() => openDetail(row)} className="sx-af-record">{text(row.reference ?? row.reason ?? row.id)}</button>
        <p className="sx-premium-muted">{ledgerFeeLabels[String(row.type)] ?? text(row.type ?? row.direction)}</p>
      </div>
      <dl className="sx-af-data">
        <div><dt>Responsável</dt><dd>{text(organizer?.name ?? account?.ownerId ?? row.ownerId ?? (row.createdBy as Row | undefined)?.name)}</dd></div>
        <div><dt>Valor / plano</dt><dd>{row.amount != null ? amount(row.amount, row.currency ?? account?.currency) : text(plan?.name ?? row.plan ?? row.currency)}</dd></div>
        <div><dt>Status</dt><dd><span className="sx-premium-badge">{status}</span></dd></div>
        <div><dt>Data</dt><dd>{date(row.requestedAt ?? row.createdAt ?? row.startedAt)}</dd></div>
      </dl>
      <div className="sx-af-actions">
        <button type="button" onClick={() => openDetail(row)} className="sx-premium-button">Detalhes</button>
        {tab === 'payouts' && canReview && status === 'REQUESTED' && <>
          <button type="button" onClick={() => mutate(`payouts/${row.id}/approve`, 'Justificativa da aprovação:')} className="sx-premium-button">Aprovar</button>
          <button type="button" onClick={() => mutate(`payouts/${row.id}/reject`, 'Motivo da rejeição:')} className="sx-premium-button">Rejeitar</button>
        </>}
        {tab === 'accounts' && canWrite && <button type="button" onClick={() => mutate(`accounts/${row.id}/${status === 'BLOCKED' ? 'unblock' : 'block'}`, `Motivo para ${status === 'BLOCKED' ? 'desbloquear' : 'bloquear'} a conta:`)} className="sx-premium-button">{status === 'BLOCKED' ? 'Desbloquear' : 'Bloquear'}</button>}
      </div>
    </li>;
  })}</ul>;
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
  if (!data) return <p className="sx-af-empty sx-premium-muted">Conciliação interna indisponível.</p>;
  return <div className="sx-af-reconcile">
    <p className="sx-premium-muted">Comparação entre pagamentos aprovados e lançamentos brutos concluídos na SorteX, sem separação por moeda. Não confirma liquidação no provedor.</p>
    <dl className="sx-af-kpis">
      <Kpi icon={CircleDollarSign} label="Pagamentos aprovados" value={amount(data.paymentTotal)} />
      <Kpi icon={BadgeDollarSign} label="Lançamentos brutos concluídos" value={amount(data.ledgerTotal)} />
      <Kpi icon={Building2} label="Diferença interna" value={amount(data.difference)} />
      <Kpi icon={ShieldCheck} label="Conciliação interna" value={data.balanced === true ? 'Totais internos iguais' : data.balanced === false ? 'Divergência encontrada' : unavailable} />
    </dl>
  </div>;
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof CircleDollarSign; label: string; value: string; hint?: string }) {
  return <div className="sx-premium-surface sx-af-kpi">
    <Icon aria-hidden="true" size={20} />
    <dt className="sx-premium-muted">{label}</dt>
    <dd>{value}{hint && <span className="sx-premium-muted">{hint}</span>}</dd>
  </div>;
}

function Loading() {
  return <div role="status" className="sx-af-empty sx-premium-muted"><LoaderCircle className="sx-af-spinner" aria-hidden="true" /> Carregando registros…</div>;
}

function Feedback({ tone, message, action }: { tone: 'error' | 'success'; message: string; action?: () => void }) {
  return <div className={`sx-premium-surface sx-af-feedback sx-af-${tone}`}>
    <span role={tone === 'error' ? 'alert' : 'status'}>{message}</span>
    {action && <button type="button" onClick={action} className="sx-premium-button">Tentar novamente</button>}
  </div>;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/finance/${path}`, { ...init, headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message ?? 'Não foi possível concluir a operação financeira.');
  return payload;
}
