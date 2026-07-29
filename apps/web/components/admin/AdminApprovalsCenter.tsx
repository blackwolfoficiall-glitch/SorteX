'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileWarning,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { authRequest } from '@/lib/auth/client';

type Item = {
  id: string;
  userId: string;
  fullName: string;
  organizationName?: string;
  cpf: string;
  cnpj?: string;
  phone: string;
  city?: string;
  state?: string;
  currentPlan: string;
  verificationStatus: string;
  riskLevel: string;
  riskScore: number;
  createdAt: string;
  documents: Array<{ id: string; status: string }>;
  user: { email: string; createdAt: string };
};
type Result = {
  data: Item[];
  pagination: { page: number; pages: number; total: number };
  summary: {
    pending: number;
    underReview: number;
    corrections: number;
    documents: number;
    highRisk: number;
    approvedToday: number;
    rejectedToday: number;
  };
};

const statuses: Record<string, string> = {
  PENDING: 'Aguardando análise',
  UNDER_REVIEW: 'Em análise',
  CORRECTION_REQUESTED: 'Correção solicitada',
  DOCUMENT_REQUESTED: 'Documentação solicitada',
  VERIFIED: 'Aprovado',
  REJECTED: 'Reprovado',
  SUSPENDED: 'Suspenso',
  BLOCKED: 'Bloqueado',
  CLOSED: 'Encerrado',
};
const risks: Record<string, string> = {
  LOW: 'Baixo risco',
  MEDIUM: 'Médio risco',
  HIGH: 'Alto risco',
  MANUAL_REVIEW: 'Revisão manual',
};

export default function AdminApprovalsCenter() {
  const [result, setResult] = useState<Result | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [risk, setRisk] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('priority');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      limit: '20',
      page: String(page),
      sort,
    });
    if (query) params.set('search', query);
    if (status) params.set('status', status);
    if (risk) params.set('riskLevel', risk);
    if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
    try {
      setResult(
        await authRequest(`/api/admin/platform/approvals?${params}`, {
          cache: 'no-store',
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível carregar a fila.',
      );
    } finally {
      setLoading(false);
    }
  }, [from, page, query, risk, sort, status, to]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function decide(item: Item, nextStatus: string) {
    const label =
      nextStatus === 'VERIFIED'
        ? 'aprovação'
        : nextStatus === 'REJECTED'
          ? 'rejeição'
          : nextStatus === 'CORRECTION_REQUESTED'
            ? 'solicitação de correção'
            : nextStatus === 'DOCUMENT_REQUESTED'
              ? 'solicitação de novo documento'
              : 'início da análise';
    const reason = window.prompt(
      `Informe o motivo da ${label}. Ele será registrado no histórico:`,
      nextStatus === 'UNDER_REVIEW'
        ? 'Análise iniciada pela Equipe SorteX.'
        : '',
    );
    if (!reason?.trim()) {
      setError('Informe o motivo para concluir a decisão administrativa.');
      return;
    }
    if (!window.confirm(`Confirma a ${label} de ${item.fullName}?`)) return;
    setBusyId(item.id);
    setError('');
    try {
      await authRequest(
        `/api/admin/platform/organizers/${item.userId}/decision`,
        {
          method: 'POST',
          body: JSON.stringify({ status: nextStatus, reason: reason.trim() }),
        },
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível concluir a ação.',
      );
    } finally {
      setBusyId('');
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void load();
  }

  return (
    <main className="p-5 pt-20 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
            Equipe SorteX
          </p>
          <h1 className="mt-2 text-3xl font-black">Fila de aprovações</h1>
          <p className="mt-1 text-slate-500">
            Solicitações que exigem análise, correção ou documentação.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Metric icon={<Clock3 />} label="Aguardando" value={result?.summary.pending || 0} />
          <Metric icon={<UserCheck />} label="Em análise" value={result?.summary.underReview || 0} />
          <Metric icon={<RefreshCw />} label="Correções" value={result?.summary.corrections || 0} />
          <Metric icon={<FileWarning />} label="Documentos" value={result?.summary.documents || 0} />
          <Metric icon={<AlertTriangle />} label="Alto risco" value={result?.summary.highRisk || 0} />
          <Metric icon={<CheckCircle2 />} label="Aprovados hoje" value={result?.summary.approvedToday || 0} />
          <Metric icon={<ShieldCheck />} label="Reprovados hoje" value={result?.summary.rejectedToday || 0} />
        </section>

        <form
          onSubmit={submit}
          className="grid gap-3 rounded-3xl border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-7"
        >
          <label className="relative md:col-span-2">
            <span className="sr-only">Pesquisar solicitações</span>
            <Search className="absolute left-3 top-3 text-slate-400" size={19} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, e-mail, telefone, CPF ou CNPJ"
              className="h-11 w-full rounded-xl border pl-10 pr-3"
            />
          </label>
          <Select value={status} onChange={setStatus} options={statuses} empty="Status da fila" />
          <Select value={risk} onChange={setRisk} options={risks} empty="Todos os riscos" />
          <label className="text-xs font-bold text-slate-500">
            De
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" />
          </label>
          <label className="text-xs font-bold text-slate-500">
            Até
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" />
          </label>
          <div className="flex gap-2">
            <Select
              value={sort}
              onChange={setSort}
              options={{
                priority: 'Prioridade',
                oldest: 'Mais antigos',
                recent: 'Mais recentes',
                risk_desc: 'Maior risco',
                risk_asc: 'Menor risco',
              }}
              empty="Ordenação"
            />
            <button disabled={loading} className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50">
              Filtrar
            </button>
          </div>
        </form>

        {error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p>{error}</p>
            <button onClick={() => void load()} className="mt-2 font-bold underline">
              Tentar novamente
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid min-h-64 place-items-center" aria-label="Carregando solicitações">
            <LoaderCircle className="animate-spin text-violet-600" />
          </div>
        ) : !result?.data.length ? (
          <div className="rounded-3xl border border-dashed bg-white p-12 text-center">
            <h2 className="text-xl font-black">Nenhuma solicitação encontrada</h2>
            <p className="mt-1 text-slate-500">A fila está vazia para os filtros selecionados.</p>
          </div>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {result.data.map((item) => (
              <article key={item.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-100 font-black text-violet-700">
                    {item.fullName.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-black">{item.organizationName || item.fullName}</h2>
                    <p className="truncate text-sm text-slate-500">{item.user.email} · {item.phone}</p>
                    <p className="text-xs text-slate-400">{item.city || '-'} / {item.state || '-'} · {item.cnpj ? 'Pessoa jurídica' : 'Pessoa física'}</p>
                  </div>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">
                    {statuses[item.verificationStatus]}
                  </span>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Info label="Plano" value={item.currentPlan} />
                  <Info label="Risco" value={`${risks[item.riskLevel]} (${item.riskScore})`} />
                  <Info label="Documentos" value={String(item.documents.length)} />
                  <Info label="Aguardando" value={waiting(item.createdAt)} />
                </dl>
                <div className="relative z-10 mt-5 flex flex-wrap gap-2">
                  <Link href={`/admin/organizadores/${item.userId}`} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white">
                    Abrir análise
                  </Link>
                  {[
                    ['UNDER_REVIEW', 'Assumir'],
                    ['CORRECTION_REQUESTED', 'Solicitar correção'],
                    ['DOCUMENT_REQUESTED', 'Solicitar documento'],
                    ['VERIFIED', 'Aprovar'],
                    ['REJECTED', 'Reprovar'],
                  ].map(([nextStatus, label]) => (
                    <button
                      key={nextStatus}
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void decide(item, nextStatus)}
                      className="rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-50"
                    >
                      {busyId === item.id ? 'Processando…' : label}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>
        )}

        {result && result.pagination.pages > 1 && (
          <nav aria-label="Paginação" className="flex items-center justify-center gap-3">
            <button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-xl border bg-white px-4 py-2 font-bold disabled:opacity-40">
              Anterior
            </button>
            <span className="text-sm text-slate-600">Página {page} de {result.pagination.pages}</span>
            <button disabled={page >= result.pagination.pages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-xl border bg-white px-4 py-2 font-bold disabled:opacity-40">
              Próxima
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <article className="rounded-2xl border bg-white p-4 shadow-sm"><span className="text-violet-600">{icon}</span><p className="mt-2 text-2xl font-black">{value}</p><p className="text-xs text-slate-500">{label}</p></article>;
}
function Select({ value, onChange, options, empty }: { value: string; onChange: (value: string) => void; options: Record<string, string>; empty: string }) {
  return <select aria-label={empty} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 min-w-0 rounded-xl border px-3"><option value="">{empty}</option>{Object.entries(options).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 font-semibold">{value || '-'}</dd></div>;
}
function waiting(value: string) {
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
  return days < 1 ? 'Menos de 1 dia' : `${days} dia(s)`;
}
