'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LoaderCircle, RefreshCw, Search, ShieldAlert, UsersRound, X } from 'lucide-react';
import PremiumScope from '@/components/premium/PremiumScope';
import { useAuthorizedUser } from '@/components/auth/RoleGate';
import { hasAdminPermission } from '@/lib/admin/authorization';
import type { AdminPermission } from '@/lib/auth/types';

type Mode = 'users' | 'campaigns' | 'payments' | 'reports' | 'winners' | 'content' | 'settings' | 'audit-logs' | 'support' | 'health';
type OperationalMode = 'users' | 'campaigns' | 'payments' | 'reports' | 'winners' | 'support';
type Row = Record<string, unknown> & { id?: string };
type PageResult = { data: Row[]; pagination: { page: number; pages: number; total: number } };
type Config = {
  title: string;
  subtitle: string;
  read: AdminPermission;
  write: AdminPermission;
  search: string;
  status?: string[];
};

const configs: Record<OperationalMode, Config> = {
  campaigns: { title: 'Moderação de campanhas', subtitle: 'Revisão, bloqueios e destaques', read: 'CAMPAIGNS_REVIEW', write: 'CAMPAIGNS_REVIEW', search: 'Título da campanha', status: ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'SOLD_OUT', 'DRAWN', 'FINISHED', 'CANCELLED'] },
  payments: { title: 'Pagamentos', subtitle: 'Transações e eventos sem dados sensíveis', read: 'FINANCE_READ', write: 'FINANCE_WRITE', search: 'ID, referência ou participante', status: ['CREATED', 'PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK'] },
  users: { title: 'Usuários', subtitle: 'Compradores, organizadores e administradores', read: 'USERS_READ', write: 'USERS_WRITE', search: 'Nome, e-mail, CPF, CNPJ ou telefone', status: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED'] },
  support: { title: 'Suporte', subtitle: 'Chamados, prioridades e respostas da equipe', read: 'SUPPORT_WRITE', write: 'SUPPORT_WRITE', search: 'Assunto ou descrição', status: ['OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'] },
  winners: { title: 'Ganhadores', subtitle: 'Entrega, disputa e divulgação', read: 'DRAWS_REVIEW', write: 'DRAWS_REVIEW', search: 'Prêmio, ganhador, campanha ou número', status: ['IDENTIFIED', 'PENDING_CONTACT', 'CONTACTED', 'CLAIMED', 'PAYMENT_PENDING', 'DELIVERED', 'CONFIRMED_BY_WINNER', 'NOT_CLAIMED', 'CANCELLED', 'DISPUTED'] },
  reports: { title: 'Denúncias', subtitle: 'Análise e resolução rastreável', read: 'SUPPORT_WRITE', write: 'SUPPORT_WRITE', search: 'Motivo, descrição ou entidade', status: ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] },
};

export default function AdminResourcePage({ mode, premiumUsers = false }: { mode: Mode; premiumUsers?: boolean }) {
  if (!(mode in configs)) return <LegacyResource mode={mode} />;
  return <OperationalResource mode={mode as OperationalMode} premiumUsers={premiumUsers && mode === 'users'} />;
}

function OperationalResource({ mode, premiumUsers }: { mode: OperationalMode; premiumUsers: boolean }) {
  const config = configs[mode];
  const user = useAuthorizedUser();
  const canWrite = Boolean(user && hasAdminPermission(user, config.write));
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('recent');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [userListUnavailable, setUserListUnavailable] = useState(false);
  const userListRequest = useRef(0);

  const load = useCallback(async () => {
    const request = premiumUsers ? ++userListRequest.current : 0;
    const isCurrent = () => !premiumUsers || request === userListRequest.current;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20', sort });
      if (search.trim()) query.set('search', search.trim());
      if (status) query.set('status', status);
      if (from) query.set('from', new Date(`${from}T00:00:00`).toISOString());
      if (to) query.set('to', new Date(`${to}T23:59:59`).toISOString());
      const result = await api<PageResult>(`${mode}?${query}`);
      if (!isCurrent()) return;
      if (premiumUsers) setUserListUnavailable(false);
      setRows(result.data ?? []);
      setPages(result.pagination?.pages || 1);
      setTotal(result.pagination?.total || 0);
    } catch (cause) {
      if (!isCurrent()) return;
      if (premiumUsers) setUserListUnavailable(true);
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar esta área.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [from, mode, page, premiumUsers, search, sort, status, to]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(task);
      if (premiumUsers) userListRequest.current += 1;
    };
  }, [load, premiumUsers]);

  async function openDetail(row: Row) {
    try {
      setDetail(await api<Row>(`${mode}/${row.id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível abrir os detalhes.');
    }
  }

  async function action(id: string, actionName: string) {
    const reason = window.prompt('Informe o motivo obrigatório desta ação:');
    if (!reason || reason.trim().length < 5) return;
    if (!window.confirm('Confirma esta ação? Ela ficará registrada na auditoria.')) return;
    const request = actionRequest(mode, id, actionName, reason);
    try {
      await api(request.path, { method: 'POST', body: JSON.stringify(request.body) });
      setNotice('Ação concluída e registrada no histórico administrativo.');
      setDetail(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'A ação foi recusada.');
    }
  }

  async function reply(id: string) {
    const message = window.prompt('Resposta ao usuário:');
    if (!message?.trim()) return;
    try {
      await api(`support/${id}/messages`, { method: 'POST', body: JSON.stringify({ message }) });
      setNotice('Resposta enviada e registrada.');
      setDetail(await api<Row>(`support/${id}`));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível enviar a resposta.');
    }
  }

  if (premiumUsers) {
    const filtering = Boolean(search.trim() || status || from || to);
    const statusText = loading ? 'Carregando usuários…'
      : userListUnavailable ? 'Listagem indisponível.'
      : `${total.toLocaleString('pt-BR')} ${total === 1 ? 'usuário' : 'usuários'} ${filtering ? 'nos filtros aplicados' : 'no cadastro'}`;
    return <>
      <PremiumScope className="sx-admin-users">
        <main className="sx-au-wrap">
          <header className="sx-premium-ticket sx-au-hero">
            <UsersRound aria-hidden="true" size={30} />
            <div>
              <p className="sx-au-eyebrow">Administração</p>
              <h1 className="sx-premium-title">{config.title}</h1>
              <p>{config.subtitle}</p>
            </div>
            <button type="button" onClick={load} disabled={loading} className="sx-premium-button sx-au-refresh">
              <RefreshCw aria-hidden="true" size={17} /> Atualizar listagem
            </button>
          </header>
          <section className="sx-premium-surface sx-au-filters" aria-labelledby="sx-au-filters">
            <h2 id="sx-au-filters" className="sx-premium-section">Filtros</h2>
            <div className="sx-au-fields">
              <label className="sx-au-search">
                <span>Pesquisar usuários</span>
                <span className="sx-au-input">
                  <Search aria-hidden="true" size={17} />
                  <input type="search" value={search} aria-describedby="sx-au-search-hint" onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
                </span>
              </label>
              <label>
                <span>Status</span>
                <select aria-label="Filtrar status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                  <option value="">Todos os status</option>
                  {config.status?.map((item) => <option key={item} value={item}>{userStatuses[item] ?? item}</option>)}
                </select>
              </label>
              <label>
                <span>Ordenação</span>
                <select aria-label="Ordenar" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                  <option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option>
                </select>
              </label>
              <label><span>Data inicial</span><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
              <label><span>Data final</span><input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
            </div>
            <p id="sx-au-search-hint" className="sx-premium-muted">Pesquise por nome, e-mail, CPF, CNPJ ou telefone.</p>
          </section>
          <section className="sx-au-results" aria-labelledby="sx-au-results">
            <header>
              <h2 id="sx-au-results" className="sx-premium-section">Resultados</h2>
              <p role="status" className="sx-premium-muted">{statusText}</p>
            </header>
            {error && (
              <div className="sx-premium-surface sx-au-state sx-au-error">
                <p role="alert">{error}</p>
                <button type="button" onClick={load} className="sx-premium-button">Tentar novamente</button>
              </div>
            )}
            {notice && <p role="status" className="sx-premium-surface sx-au-state">{notice}</p>}
            {loading ? (
              <div aria-hidden="true" className="sx-premium-surface sx-au-state">
                <LoaderCircle className="sx-au-spinner" size={24} />
              </div>
            ) : !userListUnavailable && (rows.length ? (
              <ul className="sx-au-list" role="list">
                {rows.map((row) => {
                  const presenter = present('users', row);
                  const nextAction = primaryAction('users', presenter.status);
                  return (
                    <li key={String(row.id)} className="sx-premium-surface sx-au-row">
                      <div className="sx-au-identity">
                        <h3 className="sx-premium-section"><button type="button" className="sx-au-name" onClick={() => void openDetail(row)}>{presenter.title}</button></h3>
                        {presenter.subtitle && <p className="sx-premium-muted">{presenter.subtitle}</p>}
                      </div>
                      <dl className="sx-au-meta">
                        <div><dt>Perfil</dt><dd>{userRoles[String(row.role)] ?? String(row.role ?? '—')}</dd></div>
                        <div><dt>Localidade</dt><dd>{[row.city, row.state].filter(Boolean).join(' / ') || '—'}</dd></div>
                        <div><dt>Status</dt><dd><span className="sx-premium-badge">{userStatuses[presenter.status] ?? presenter.status}</span></dd></div>
                        <div><dt>Cadastro</dt><dd>{formatDate(row.createdAt ?? row.requestedAt)}</dd></div>
                      </dl>
                      <div className="sx-au-actions">
                        <button type="button" className="sx-premium-button" onClick={() => void openDetail(row)}>Detalhes</button>
                        {canWrite && nextAction && <button type="button" className="sx-premium-button" onClick={() => void action(String(row.id), nextAction)}>{actionLabel(nextAction)}</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="sx-premium-surface sx-au-state">Nenhum registro encontrado para os filtros informados.</p>)}
            {!loading && !userListUnavailable && pages > 1 && (
              <nav aria-label="Paginação" className="sx-au-pages">
                <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="sx-premium-button">Anterior</button>
                <span className="sx-premium-muted">Página {page} de {pages}</span>
                <button type="button" disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="sx-premium-button">Próxima</button>
              </nav>
            )}
          </section>
        </main>
      </PremiumScope>
      {detail && <DetailDrawer mode={mode} data={detail} canWrite={canWrite} close={() => setDetail(null)} action={action} reply={reply} />}
    </>;
  }

  return <main className="p-5 pt-20 lg:p-8"><div className="mx-auto max-w-7xl">
    <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">Administração</p>
    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="text-3xl font-black">{config.title}</h1><p className="mt-1 text-slate-500">{config.subtitle}</p></div>
      <button onClick={load} disabled={loading} aria-label="Atualizar listagem" className="rounded-xl border bg-white p-3 disabled:opacity-50"><RefreshCw size={18} className={loading ? 'animate-spin' : ''} /></button>
    </div>
    {error && <Feedback tone="error" message={error} retry={load} />}
    {notice && <Feedback tone="success" message={notice} />}
    <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="relative xl:col-span-2"><span className="sr-only">Pesquisar</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={config.search} className="w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm" /></label>
        {config.status ? <select aria-label="Filtrar status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-xl border px-3 py-2 text-sm"><option value="">Todos os status</option>{config.status.map((item) => <option key={item}>{item}</option>)}</select> : <div />}
        <select aria-label="Ordenar" value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option></select>
        <div className="flex gap-2"><input type="date" aria-label="Data inicial" value={from} onChange={(event) => setFrom(event.target.value)} className="min-w-0 rounded-xl border px-2 py-2 text-sm" /><input type="date" aria-label="Data final" value={to} onChange={(event) => setTo(event.target.value)} className="min-w-0 rounded-xl border px-2 py-2 text-sm" /></div>
      </div>
      <p className="mt-3 text-xs text-slate-500">{total} registro(s) encontrado(s).</p>
    </section>
    {loading ? <Loading /> : rows.length ? <ResourceTable mode={mode} rows={rows} canWrite={canWrite} detail={openDetail} action={action} reply={reply} /> : <Empty />}
    {!loading && pages > 1 && <nav aria-label="Paginação" className="mt-5 flex items-center justify-end gap-3"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronLeft /></button><span className="text-sm">Página {page} de {pages}</span><button disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border bg-white p-2 disabled:opacity-40"><ChevronRight /></button></nav>}
  </div>{detail && <DetailDrawer mode={mode} data={detail} canWrite={canWrite} close={() => setDetail(null)} action={action} reply={reply} />}</main>;
}

function ResourceTable({ mode, rows, canWrite, detail, action, reply }: { mode: OperationalMode; rows: Row[]; canWrite: boolean; detail: (row: Row) => void; action: (id: string, action: string) => void; reply: (id: string) => void }) {
  return <div className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Registro</th><th>Contexto</th><th>Status</th><th>Data</th><th>Ações</th></tr></thead><tbody>{rows.map((row) => {
    const presenter = present(mode, row);
    return <tr key={String(row.id)} className="border-t align-top"><td className="px-4 py-4"><button onClick={() => detail(row)} className="font-bold text-violet-700 hover:underline">{presenter.title}</button><p className="mt-1 max-w-sm text-xs text-slate-500">{presenter.subtitle}</p></td><td>{presenter.context}</td><td><span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">{presenter.status}</span></td><td>{formatDate(row.createdAt ?? row.requestedAt)}</td><td><div className="flex flex-wrap gap-2"><button onClick={() => detail(row)} className="rounded-lg border px-3 py-2 text-xs font-bold">Detalhes</button>{canWrite && mode === 'support' && <button onClick={() => reply(String(row.id))} className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-bold text-white">Responder</button>}{canWrite && primaryAction(mode, presenter.status) && <button onClick={() => action(String(row.id), primaryAction(mode, presenter.status)!)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white">{actionLabel(primaryAction(mode, presenter.status)!)}</button>}</div></td></tr>;
  })}</tbody></table></div>;
}

function DetailDrawer({ mode, data, canWrite, close, action, reply }: { mode: OperationalMode; data: Row; canWrite: boolean; close: () => void; action: (id: string, action: string) => void; reply: (id: string) => void }) {
  const audit = Array.isArray(data.audit)
    ? data.audit as Row[]
    : Array.isArray(data.auditLogs)
      ? data.auditLogs as Row[]
      : [];
  const messages = Array.isArray(data.messages) ? data.messages as Row[] : [];
  const actions = availableActions(mode, String(data.status ?? ''));
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="dialog" aria-modal="true" aria-label={`Detalhes de ${configs[mode].title}`}><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
    <div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase text-violet-600">Detalhes</p><h2 className="text-xl font-black">{present(mode, data).title}</h2></div><button onClick={close} aria-label="Fechar detalhes" className="rounded-lg p-2 hover:bg-slate-100"><X /></button></div>
    <dl className="mt-6 grid gap-3 sm:grid-cols-2">{Object.entries(data).filter(([key, value]) => !['audit', 'messages', 'metadata', 'password', 'pixQrCode', 'pixCopyPaste'].includes(key) && value != null && typeof value !== 'object').map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-500">{fieldLabel(key)}</dt><dd className="mt-1 break-words text-sm">{formatValue(key, value)}</dd></div>)}</dl>
    {canWrite && <div className="mt-6 flex flex-wrap gap-2">{mode === 'support' && <button onClick={() => reply(String(data.id))} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white">Responder chamado</button>}{actions.map((item) => <button key={item} onClick={() => action(String(data.id), item)} className="rounded-xl border px-4 py-2 text-sm font-bold">{actionLabel(item)}</button>)}</div>}
    {messages.length > 0 && <History title="Mensagens" rows={messages} label="message" />}
    <History title="Histórico administrativo" rows={audit} label="action" />
  </aside></div>;
}

function actionRequest(mode: OperationalMode, id: string, action: string, reason: string) {
  if (mode === 'campaigns') return { path: `campaigns/${id}/action`, body: { action, reason } };
  if (mode === 'users') return { path: `users/${id}/action`, body: { action, reason } };
  if (mode === 'payments') return { path: `payments/${id}/review`, body: { reason, note: reason } };
  if (mode === 'reports') return { path: `reports/${id}/resolve`, body: { status: action, resolution: reason } };
  if (mode === 'winners') return { path: `winners/${id}/action`, body: { status: action, reason } };
  return { path: `support/${id}/action`, body: { status: action, reason } };
}
function availableActions(mode: OperationalMode, status: string): string[] {
  if (mode === 'campaigns') return ['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'PAUSE', 'REACTIVATE', 'BLOCK_PURCHASES', 'UNBLOCK_PURCHASES'];
  if (mode === 'users') return ['ACTIVATE', 'SUSPEND', 'BLOCK', 'UNBLOCK', 'REVOKE_SESSIONS'];
  if (mode === 'payments') return ['REVIEW'];
  if (mode === 'reports') return ['RESOLVED', 'DISMISSED'];
  if (mode === 'winners') return ['DISPUTED', 'DELIVERED'];
  return status === 'CLOSED' ? ['OPEN'] : ['IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED'];
}
function primaryAction(mode: OperationalMode, status: string) { return availableActions(mode, status)[0]; }
function actionLabel(action: string) { return ({ APPROVE: 'Aprovar', REJECT: 'Rejeitar', REQUEST_CHANGES: 'Solicitar ajustes', PAUSE: 'Pausar', REACTIVATE: 'Reativar', BLOCK_PURCHASES: 'Bloquear compras', UNBLOCK_PURCHASES: 'Liberar compras', ACTIVATE: 'Ativar', SUSPEND: 'Suspender', BLOCK: 'Bloquear', UNBLOCK: 'Desbloquear', REVOKE_SESSIONS: 'Encerrar sessões', REVIEW: 'Marcar para revisão', RESOLVED: 'Resolver', DISMISSED: 'Descartar', DISPUTED: 'Sinalizar disputa', DELIVERED: 'Confirmar entrega', OPEN: 'Reabrir', IN_PROGRESS: 'Iniciar atendimento', WAITING_CUSTOMER: 'Aguardar cliente', CLOSED: 'Fechar' } as Record<string, string>)[action] ?? action; }

const userStatuses: Readonly<Record<string, string>> = {
  ACTIVE: 'Ativo', INACTIVE: 'Inativo', SUSPENDED: 'Suspenso', BLOCKED: 'Bloqueado',
};
const userRoles: Readonly<Record<string, string>> = {
  ADMIN: 'Administrador', BUYER: 'Comprador', ORGANIZER: 'Organizador',
};

function present(mode: OperationalMode, row: Row) {
  const organizer = row.organizer as Row | undefined, buyer = row.buyer as Row | undefined, campaign = row.campaign as Row | undefined;
  if (mode === 'campaigns') return { title: String(row.title ?? row.id), subtitle: String(organizer?.name ?? ''), context: `${row.soldNumbers ?? 0}/${row.totalNumbers ?? 0} títulos`, status: String(row.status ?? '—') };
  if (mode === 'payments') return { title: String(row.externalReference ?? row.id), subtitle: String(buyer?.name ?? buyer?.email ?? ''), context: `${formatMoney(row.amount)} · ${String(row.method ?? '')}`, status: String(row.status ?? '—') };
  if (mode === 'users') return { title: String(row.name ?? row.id), subtitle: String(row.email ?? ''), context: `${String(row.role ?? '')} · ${String(row.city ?? '—')}/${String(row.state ?? '—')}`, status: String(row.status ?? '—') };
  if (mode === 'support') return { title: String(row.subject ?? row.id), subtitle: String(row.description ?? ''), context: String(row.priority ?? '—'), status: String(row.status ?? '—') };
  if (mode === 'winners') return { title: String(row.prizeName ?? row.id), subtitle: String(buyer?.name ?? ''), context: `${String(campaign?.title ?? '')} · ${String(row.winningNumber ?? '')}`, status: String(row.status ?? '—') };
  return { title: String(row.reason ?? row.id), subtitle: String(row.description ?? ''), context: `${String(row.entityType ?? '')} · ${String(row.entityId ?? '')}`, status: String(row.status ?? '—') };
}

function History({ title, rows, label }: { title: string; rows: Row[]; label: string }) { return <section className="mt-7"><h3 className="font-black">{title}</h3><div className="mt-3 space-y-3">{rows.map((row, index) => <div key={String(row.id ?? index)} className="rounded-xl border p-3 text-sm"><b>{String(row[label] ?? 'Registro')}</b><p className="mt-1 text-slate-500">{String((row.actor as Row | undefined)?.name ?? row.senderUserId ?? '')} {formatDate(row.createdAt)}</p></div>)}{!rows.length && <p className="text-sm text-slate-500">Nenhum registro disponível.</p>}</div></section>; }
function Feedback({ tone, message, retry }: { tone: 'error' | 'success'; message: string; retry?: () => void }) { return <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-4 flex justify-between rounded-xl p-4 ${tone === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}><span>{message}</span>{retry && <button onClick={retry} className="font-bold underline">Tentar novamente</button>}</div>; }
function Loading() { return <div className="grid h-64 place-items-center"><LoaderCircle aria-label="Carregando" className="animate-spin text-violet-600" /></div>; }
function Empty() { return <div className="mt-6 rounded-3xl border bg-white p-14 text-center"><ShieldAlert className="mx-auto text-slate-300" size={42} /><p className="mt-3 text-slate-500">Nenhum registro encontrado para os filtros informados.</p></div>; }
function formatDate(value: unknown) { return value ? new Date(String(value)).toLocaleString('pt-BR') : '—'; }
function formatMoney(value: unknown) { return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function formatValue(key: string, value: unknown) { if (key.toLowerCase().includes('at')) return formatDate(value); if (['amount', 'total', 'prizeValue'].includes(key)) return formatMoney(value); return String(value); }
function fieldLabel(value: string) { return value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()); }

function LegacyResource({ mode }: { mode: Mode }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const task = window.setTimeout(async () => {
      try {
        const response = await api<unknown>(mode);
        if (Array.isArray(response)) setRows(response);
        else if (response && typeof response === 'object') {
          const data = response as Record<string, unknown>;
          setRows(Array.isArray(data.data) ? data.data as Row[] : [...(Array.isArray(data.banners) ? data.banners as Row[] : []), ...(Array.isArray(data.notices) ? data.notices as Row[] : []), ...(Array.isArray(data.pages) ? data.pages as Row[] : [])]);
        }
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar esta área.'); }
      finally { setLoading(false); }
    }, 0);
    return () => window.clearTimeout(task);
  }, [mode]);
  return <main className="p-5 pt-20 lg:p-8"><div className="mx-auto max-w-7xl"><p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">Administração</p><h1 className="mt-2 text-3xl font-black">{mode}</h1>{error && <Feedback tone="error" message={error} />}{loading ? <Loading /> : rows.length ? <div className="mt-6 grid gap-3">{rows.map((row, index) => <div key={String(row.id ?? row.key ?? index)} className="rounded-2xl border bg-white p-5"><b>{String(row.title ?? row.key ?? row.action ?? row.id)}</b><p className="text-sm text-slate-500">{String(row.status ?? row.description ?? '')}</p></div>)}</div> : <Empty />}</div></main>;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/platform/${path}`, { ...init, headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(payload.message) ? payload.message.join(' ') : payload.message ?? 'Não foi possível concluir a solicitação.');
  return payload;
}
