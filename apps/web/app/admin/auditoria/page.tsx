"use client";

import { type FormEvent, useEffect, useState } from "react";
import { FileClock, LoaderCircle } from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import { AuthApiError, authRequest } from "@/lib/auth/client";
import "./admin-audit-premium.css";

type AuditRow = { id: string; entityId?: string | null; entityType?: string | null; action?: string | null; createdAt?: string | null };
type Result = { data: AuditRow[]; pagination: { page: number; total: number; pages: number } };
type Filter = { action: string; from: string; to: string };
type Query = Filter & { page: number };
type Outcome = { query: Query; result: Result } | { query: Query; error: string };

const defaults: Filter = { action: "", from: "", to: "" };
const dateDisplay = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "UTC" });

export default function Page() {
  const [draft, setDraft] = useState<Filter>(defaults);
  const [query, setQuery] = useState<Query>({ ...defaults, page: 1 });
  const [outcome, setOutcome] = useState<Outcome>();
  const [validation, setValidation] = useState("");
  const current = outcome?.query === query ? outcome : undefined;
  const result = current && "result" in current ? current.result : undefined;
  const failure = current && "error" in current ? current.error : undefined;
  const updating = !current;
  const filtering = Boolean(query.action || query.from || query.to);

  useEffect(() => {
    const request = new AbortController();
    const params = new URLSearchParams({ page: String(query.page), limit: "25", sort: "recent" });
    if (query.action) params.set("action", query.action);
    if (query.from) params.set("from", `${query.from}T00:00:00.000Z`);
    if (query.to) params.set("to", `${query.to}T23:59:59.999Z`);
    void authRequest<Result>(`/api/admin/platform/audit-logs?${params}`, { cache: "no-store", signal: request.signal })
      .then((data) => {
        if (!request.signal.aborted) setOutcome({ query, result: data });
      })
      .catch((cause: unknown) => {
        if (request.signal.aborted) return;
        const error = cause instanceof AuthApiError && cause.status === 403
          ? "Você não tem permissão para consultar a auditoria."
          : cause instanceof AuthApiError && cause.status === 401
            ? "Sua sessão expirou. Entre novamente para consultar a auditoria."
            : "Não foi possível consultar os registros.";
        setOutcome({ query, error });
      });
    return () => request.abort();
  }, [query]);

  function apply(event: FormEvent) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setValidation("A data final deve ser igual ou posterior à data inicial.");
      return;
    }
    setValidation("");
    setQuery({ ...draft, action: draft.action.trim(), page: 1 });
  }

  function reset() {
    setValidation("");
    setDraft(defaults);
    setQuery({ ...defaults, page: 1 });
  }

  return (
    <PremiumScope className="sx-admin-audit">
      <main className="sx-aa-wrap">
        <header className="sx-premium-ticket sx-aa-hero">
          <FileClock size={30} aria-hidden="true" />
          <div>
            <p className="sx-aa-eyebrow">Administração</p>
            <h1 className="sx-premium-title">Auditoria</h1>
            <p>Consulte o histórico de ações administrativas.</p>
          </div>
          <button type="button" className="sx-premium-button sx-aa-refresh" onClick={() => setQuery({ ...query })}>Atualizar</button>
        </header>
        <form className="sx-premium-surface sx-aa-filters" aria-labelledby="sx-aa-filters" onSubmit={apply}>
          <h2 id="sx-aa-filters" className="sx-premium-section">Filtros da auditoria</h2>
          <div className="sx-aa-fields">
            <label><span>Pesquisar ação</span><input type="search" value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })} /></label>
            <label><span>Data inicial</span><input type="date" max="9999-12-31" value={draft.from} aria-describedby="sx-aa-date-note" onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
            <label><span>Data final</span><input type="date" max="9999-12-31" value={draft.to} aria-describedby="sx-aa-date-note" onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
          </div>
          <p id="sx-aa-date-note" className="sx-premium-muted">Datas e horários em UTC. Os dois dias do intervalo são incluídos.</p>
          {validation && <p role="alert" className="sx-aa-error">{validation}</p>}
          <div className="sx-aa-actions">
            <button type="submit" className="sx-premium-button" data-variant="primary">Filtrar</button>
            <button type="button" className="sx-premium-button" onClick={reset}>Limpar filtros</button>
          </div>
        </form>
        <section aria-labelledby="sx-aa-records" className="sx-aa-records">
          <header>
            <h2 id="sx-aa-records" className="sx-premium-section">Registros</h2>
            <p role="status" className="sx-premium-muted">
              {updating ? "Carregando registros…" : result
                ? `${result.pagination.total.toLocaleString("pt-BR")} ${result.pagination.total === 1 ? "registro" : "registros"} ${filtering ? "nos filtros aplicados" : "no histórico"}`
                : "Histórico indisponível."}
            </p>
          </header>
          {updating ? (
            <div className="sx-premium-surface sx-aa-state" aria-hidden="true">
              <LoaderCircle className="sx-aa-spinner" size={24} />
            </div>
          ) : failure ? (
            <div className="sx-premium-surface sx-aa-state">
              <p role="alert" className="sx-aa-error">{failure}</p>
              <button type="button" className="sx-premium-button" onClick={() => setQuery({ ...query })}>Tentar novamente</button>
            </div>
          ) : !result?.data.length ? (
            <p className="sx-premium-surface sx-aa-state">Nenhum registro encontrado.</p>
          ) : (
            <ul role="list" className="sx-aa-list">
              {result.data.map((event) => {
                const stamp = event.createdAt && Number.isFinite(Date.parse(event.createdAt)) ? event.createdAt : null;
                return <li key={event.id} className="sx-premium-surface sx-aa-entry">
                  <h3 className="sx-premium-section">{event.action || "Ação não informada"}</h3>
                  <dl>
                    <div><dt>Entidade</dt><dd>{event.entityType || "—"}</dd></div>
                    <div><dt>Registro</dt><dd>{event.entityId || "—"}</dd></div>
                    <div><dt>Ocorrência (UTC)</dt><dd>{stamp ? <time dateTime={stamp}>{dateDisplay.format(new Date(stamp))}</time> : "—"}</dd></div>
                  </dl>
                </li>;
              })}
            </ul>
          )}
          {result && result.pagination.pages > 1 && (
            <nav aria-label="Paginação" className="sx-aa-actions">
              <button type="button" disabled={result.pagination.page <= 1} className="sx-premium-button" onClick={() => setQuery({ ...query, page: result.pagination.page - 1 })}>Anterior</button>
              <span className="sx-premium-muted">Página {result.pagination.page} de {result.pagination.pages}</span>
              <button type="button" disabled={result.pagination.page >= result.pagination.pages} className="sx-premium-button" onClick={() => setQuery({ ...query, page: result.pagination.page + 1 })}>Próxima</button>
            </nav>
          )}
        </section>
      </main>
    </PremiumScope>
  );
}
