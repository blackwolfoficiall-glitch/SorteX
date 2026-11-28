'use client';

import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import {
  Building2,
  ChevronRight,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import VerificationStatusBadge from '@/components/organizador/VerificationStatusBadge';
import PremiumScope from '@/components/premium/PremiumScope';
import { AuthApiError, authRequest } from '@/lib/auth/client';
import type { VerificationStatus } from '@/lib/organizers/types';
import './organizers-premium.css';

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
  INCOMPLETE: 'Cadastro incompleto',
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

type Filters = { search: string; status: string; risk: string; plan: string };
type Query = Filters & { page: number };
type Outcome = { query: Query; result: Result } | { query: Query; error: string };

const emptyFilters: Filters = { search: '', status: '', risk: '', plan: '' };
const formatCount = new Intl.NumberFormat('pt-BR');

export default function AdminOrganizadoresPage() {
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [query, setQuery] = useState<Query>({ ...emptyFilters, page: 1 });
  const [outcome, setOutcome] = useState<Outcome>();

  const current = outcome?.query === query ? outcome : undefined;
  const result = current && 'result' in current ? current.result : undefined;
  const error = current && 'error' in current ? current.error : undefined;
  const loading = !current;
  const filtering = Boolean(query.search || query.status || query.risk || query.plan);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(query.page), limit: '25', sort: 'recent' });
    if (query.search) params.set('search', query.search);
    if (query.status) params.set('status', query.status);
    if (query.risk) params.set('riskLevel', query.risk);
    if (query.plan) params.set('plan', query.plan);
    void authRequest<Result>(`/api/admin/platform/organizers?${params}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setOutcome({ query, result: data });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const error =
          cause instanceof AuthApiError && cause.status === 401
            ? 'Sua sessão expirou. Entre novamente para consultar os organizadores.'
            : cause instanceof AuthApiError && cause.status === 403
              ? 'Você não tem permissão para consultar os organizadores.'
              : 'Não foi possível carregar os organizadores.';
        setOutcome({ query, error });
      });
    return () => controller.abort();
  }, [query]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery({ ...draft, search: draft.search.trim(), page: 1 });
  }

  function reset() {
    setDraft(emptyFilters);
    setQuery({ ...emptyFilters, page: 1 });
  }

  return (
    <PremiumScope className="sx-admin-organizers">
      <main className="sx-ao-wrap">
        <header className="sx-premium-ticket sx-ao-hero">
          <ShieldCheck aria-hidden="true" size={30} />
          <div>
            <p className="sx-ao-eyebrow">Administração</p>
            <h1 className="sx-premium-title">Central de organizadores</h1>
            <p>Consulte cadastros, verificações, risco e restrições. Abra um cadastro para ver o histórico.</p>
          </div>
        </header>

        <form onSubmit={submit} className="sx-premium-surface sx-ao-filter" aria-labelledby="sx-ao-filter-title">
          <h2 id="sx-ao-filter-title" className="sx-premium-section"><SlidersHorizontal aria-hidden="true" size={18} /> Filtros</h2>
          <div className="sx-ao-fields">
            <label className="sx-ao-search">
              <span>Pesquisar organizadores</span>
              <span className="sx-ao-input">
                <Search aria-hidden="true" size={19} />
                <input type="search" aria-describedby="sx-ao-search-hint" value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} />
              </span>
            </label>
            <Select label="Status" value={draft.status} onChange={(status) => setDraft({ ...draft, status })} options={statusOptions} />
            <Select label="Plano" value={draft.plan} onChange={(plan) => setDraft({ ...draft, plan })} options={planOptions} />
            <Select label="Risco" value={draft.risk} onChange={(risk) => setDraft({ ...draft, risk })} options={riskOptions} />
          </div>
          <p id="sx-ao-search-hint" className="sx-premium-muted">Pesquise por nome, CPF/CNPJ, e-mail ou telefone.</p>
          <div className="sx-ao-actions">
            <button type="submit" data-variant="primary" className="sx-premium-button">Filtrar</button>
            <button type="button" onClick={reset} className="sx-premium-button">Limpar filtros</button>
          </div>
        </form>

        <section aria-labelledby="sx-ao-results-title" className="sx-ao-results">
          <header>
            <h2 id="sx-ao-results-title" className="sx-premium-section">Resultados</h2>
            <p role="status" className="sx-premium-muted">
              {loading ? 'Carregando organizadores…' : result
                ? `${formatCount.format(result.pagination.total)} ${result.pagination.total === 1 ? 'organizador' : 'organizadores'} ${filtering ? 'nos filtros aplicados' : 'no cadastro'}`
                : 'Resultados indisponíveis.'}
            </p>
          </header>

          {loading ? (
            <div className="sx-premium-surface sx-ao-state" aria-hidden="true">
              <LoaderCircle className="sx-ao-spinner" size={24} />
            </div>
          ) : error ? (
            <div className="sx-premium-surface sx-ao-state sx-ao-error">
              <p role="alert">{error}</p>
              <button type="button" className="sx-premium-button" onClick={() => setQuery({ ...query })}>Tentar novamente</button>
            </div>
          ) : !result?.data.length ? (
            <div className="sx-premium-surface sx-ao-state">
              <h3 className="sx-premium-section">Nenhum organizador encontrado</h3>
              <p className="sx-premium-muted">
                {filtering ? 'Revise os filtros ou a pesquisa informada.' : 'Não há resultados nesta página.'}
              </p>
            </div>
          ) : (
            <ul className="sx-ao-list">
              {result.data.map((item) => (
                <li key={item.id}>
                  <Link href={`/admin/organizadores/${item.userId}`} prefetch={false} className="sx-premium-surface sx-ao-card">
                    <span className="sx-ao-card-icon"><Building2 aria-hidden="true" size={21} /></span>
                    <div className="sx-ao-card-body">
                      <h3 className="sx-premium-section">{item.organizationName || item.fullName}</h3>
                      <div className="sx-ao-badges">
                        <VerificationStatusBadge status={item.verificationStatus} />
                        {!item.user.isActive && <span className="sx-premium-badge sx-ao-inactive">Conta inativa</span>}
                        {(item.campaignsBlocked || item.paymentsBlocked || item.payoutsBlocked) && <span className="sx-premium-badge">Com restrições</span>}
                      </div>
                      <p className="sx-premium-muted">{item.user.email} · {item.phone}</p>
                      <p className="sx-premium-muted">{item.cnpj || item.cpf} · {item.city || 'Cidade não informada'}/{item.state || '--'}</p>
                      <dl className="sx-ao-details">
                        <Info label="Plano" value={planOptions[item.currentPlan as keyof typeof planOptions] || item.currentPlan} />
                        <Info label="Risco" value={`${riskOptions[item.riskLevel as keyof typeof riskOptions] || item.riskLevel} (${item.riskScore})`} />
                        <Info label="Campanhas" value={formatCount.format(item.user._count.campaigns)} />
                        <Info label="Documentos" value={formatCount.format(item.documents.length)} />
                        <Info label="Decisões" value={formatCount.format(item._count.reviewDecisions)} />
                        <Info label="Atualização" value={new Date(item.updatedAt).toLocaleDateString('pt-BR')} />
                      </dl>
                    </div>
                    <ChevronRight aria-hidden="true" className="sx-ao-arrow" size={19} />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {result && result.pagination.pages > 1 && (
            <nav aria-label="Paginação" className="sx-ao-pages">
              <button type="button" disabled={result.pagination.page <= 1} onClick={() => setQuery({ ...query, page: result.pagination.page - 1 })} className="sx-premium-button">Anterior</button>
              <span className="sx-premium-muted">Página {result.pagination.page} de {result.pagination.pages}</span>
              <button type="button" disabled={result.pagination.page >= result.pagination.pages} onClick={() => setQuery({ ...query, page: result.pagination.page + 1 })} className="sx-premium-button">Próxima</button>
            </nav>
          )}
        </section>
      </main>
    </PremiumScope>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Record<string, string> }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos — {label}</option>
        {Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}
