'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Building2,
  ChevronRight,
  LoaderCircle,
  Search,
  ShieldCheck,
} from 'lucide-react';
import VerificationStatusBadge from '@/components/organizador/VerificationStatusBadge';
import { authRequest } from '@/lib/auth/client';
import type { VerificationStatus } from '@/lib/organizers/types';

type Organizer = {
  id: string;
  userId: string;
  fullName: string;
  organizationName?: string | null;
  cpf: string;
  cnpj?: string | null;
  phone: string;
  city?: string | null;
  state?: string | null;
  verificationStatus: VerificationStatus;
  riskLevel: string;
  riskScore: number;
  currentPlan: string;
  campaignsBlocked: boolean;
  paymentsBlocked: boolean;
  payoutsBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  documents: Array<{ id: string; status: string }>;
  _count: { reviewDecisions: number; internalNoteEntries: number };
  user: {
    email: string;
    status: string;
    isActive: boolean;
    _count: { campaigns: number };
  };
};
type Result = {
  data: Organizer[];
  pagination: { page: number; pages: number; total: number };
};

const statusOptions = {
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
const riskOptions = {
  LOW: 'Baixo risco',
  MEDIUM: 'Médio risco',
  HIGH: 'Alto risco',
  MANUAL_REVIEW: 'Revisão manual',
};
const planOptions = {
  BASIC: 'Inicial',
  PROFESSIONAL: 'Profissional',
  PREMIUM: 'Avançado',
  ENTERPRISE: 'Empresarial',
};

export default function AdminOrganizadoresPage() {
  const [result, setResult] = useState<Result | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [risk, setRisk] = useState('');
  const [plan, setPlan] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page: String(page),
      limit: '25',
      sort: 'recent',
    });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (risk) params.set('riskLevel', risk);
    if (plan) params.set('plan', plan);
    try {
      setResult(
        await authRequest(`/api/admin/platform/organizers?${params}`, {
          cache: 'no-store',
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível carregar os organizadores.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, plan, risk, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    void load();
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-20 md:px-10 lg:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center gap-4">
          <div className="rounded-2xl bg-violet-100 p-3 text-violet-700">
            <ShieldCheck />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-violet-600">Administração</p>
            <h1 className="text-3xl font-black">Central de organizadores</h1>
            <p className="mt-1 text-zinc-500">Cadastro, aprovação, risco, operação e histórico em uma única central.</p>
          </div>
        </header>

        <form onSubmit={submit} className="grid gap-3 rounded-3xl border bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-5">
          <label className="relative md:col-span-2">
            <span className="sr-only">Pesquisar organizadores</span>
            <Search className="absolute left-3 top-3 text-zinc-400" size={19} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, CPF/CNPJ, e-mail ou telefone" className="h-11 w-full rounded-xl border pl-10 pr-3" />
          </label>
          <Select label="Status" value={status} onChange={setStatus} options={statusOptions} />
          <Select label="Plano" value={plan} onChange={setPlan} options={planOptions} />
          <div className="flex gap-2">
            <Select label="Risco" value={risk} onChange={setRisk} options={riskOptions} />
            <button disabled={loading} className="h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50">Filtrar</button>
          </div>
        </form>

        {error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p>{error}</p>
            <button onClick={() => void load()} className="mt-2 font-bold underline">Tentar novamente</button>
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm">
          {loading ? (
            <div className="flex h-56 items-center justify-center" aria-label="Carregando organizadores">
              <LoaderCircle className="animate-spin text-violet-700" />
            </div>
          ) : !result?.data.length ? (
            <div className="p-12 text-center">
              <h2 className="text-xl font-black">Nenhum organizador encontrado</h2>
              <p className="mt-1 text-zinc-500">Revise os filtros ou a pesquisa informada.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {result.data.map((item) => (
                <Link href={`/admin/organizadores/${item.userId}`} key={item.id} className="block p-5 transition hover:bg-violet-50/50">
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-zinc-100 p-3 text-zinc-600"><Building2 /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate font-black">{item.organizationName || item.fullName}</h2>
                        <VerificationStatusBadge status={item.verificationStatus} />
                        {!item.user.isActive && <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700">Conta inativa</span>}
                        {(item.campaignsBlocked || item.paymentsBlocked || item.payoutsBlocked) && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">Com restrições</span>}
                      </div>
                      <p className="mt-1 truncate text-sm text-zinc-500">{item.user.email} · {item.phone}</p>
                      <p className="text-xs text-zinc-400">{item.cnpj || item.cpf} · {item.city || 'Cidade não informada'}/{item.state || '--'}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                        <Info label="Plano" value={planOptions[item.currentPlan as keyof typeof planOptions] || item.currentPlan} />
                        <Info label="Risco" value={`${riskOptions[item.riskLevel as keyof typeof riskOptions] || item.riskLevel} (${item.riskScore})`} />
                        <Info label="Campanhas" value={String(item.user._count.campaigns)} />
                        <Info label="Documentos" value={String(item.documents.length)} />
                        <Info label="Decisões" value={String(item._count.reviewDecisions)} />
                        <Info label="Atualização" value={new Date(item.updatedAt).toLocaleDateString('pt-BR')} />
                      </dl>
                    </div>
                    <ChevronRight className="mt-3 shrink-0 text-zinc-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {result && result.pagination.pages > 1 && (
          <nav aria-label="Paginação" className="flex items-center justify-center gap-3">
            <button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-xl border bg-white px-4 py-2 font-bold disabled:opacity-40">Anterior</button>
            <span className="text-sm text-zinc-600">Página {page} de {result.pagination.pages} · {result.pagination.total} organizadores</span>
            <button disabled={page >= result.pagination.pages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-xl border bg-white px-4 py-2 font-bold disabled:opacity-40">Próxima</button>
          </nav>
        )}
      </div>
    </main>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-11 min-w-0 rounded-xl border px-3"><option value="">Todos — {label}</option>{Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select>;
}
function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="font-bold uppercase text-zinc-400">{label}</dt><dd className="mt-0.5 font-semibold text-zinc-700">{value}</dd></div>;
}
