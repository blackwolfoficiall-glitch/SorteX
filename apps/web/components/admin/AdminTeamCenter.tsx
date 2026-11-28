"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Copy,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import { authRequest } from "@/lib/auth/client";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { hasAdminPermission } from "@/lib/admin/authorization";

type Member = {
  id: string;
  name: string;
  email: string;
  adminTeamRole: string;
  status: string;
  isActive: boolean;
  lastAccessAt?: string;
  createdAt: string;
};
type Invite = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  invitedBy: { name: string };
};
const roleLabel: Record<string, string> = {
  SUPERADMIN: "Superadministrador",
  ADMIN: "Administrador",
  REGISTRATION_ANALYST: "Analista de cadastro",
  FINANCE: "Financeiro",
  SUPPORT: "Suporte",
  AUDIT: "Auditoria",
};

export default function AdminTeamCenter() {
  const user = useAuthorizedUser();
  const canManage = Boolean(
    user && hasAdminPermission(user, "USERS_WRITE"),
  );
  const [data, setData] = useState<{
    members: Member[];
    invitations: Invite[];
    summary: {
      total: number;
      active: number;
      pending: number;
      inactive: number;
    };
  }>({
    members: [],
    invitations: [],
    summary: { total: 0, active: 0, pending: 0, inactive: 0 },
  });
  const [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [link, setLink] = useState("");
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const visible = data.members.filter((member) =>
    [member.name, roleLabel[member.adminTeamRole], member.isActive ? "Ativo" : "Desativado"].some((term) =>
      term?.toLocaleLowerCase("pt-BR").includes(normalized),
    ),
  );
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setData(
        await authRequest("/api/admin/platform/team", { cache: "no-store" }),
      );
    } catch {
      setLoadError("Não foi possível carregar a equipe.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await authRequest<{
        invitationPath: string;
        message: string;
      }>("/api/admin/platform/team/invite", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          adminTeamRole: form.get("role"),
          message: form.get("message"),
          validityDays: Number(form.get("validityDays") || 7),
          reason: "Convite criado pela gestão da Equipe SorteX",
        }),
      });
      const url = `${window.location.origin}${result.invitationPath}`;
      setLink(url);
      setMessage(result.message);
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar o convite.",
      );
    }
  }
  async function action(id: string, action: string, adminTeamRole?: string) {
    const reason = window.prompt("Informe o motivo desta alteração:");
    if (!reason) return;
    try {
      await authRequest(`/api/admin/platform/team/${id}/action`, {
        method: "POST",
        body: JSON.stringify({ action, adminTeamRole, reason }),
      });
      setMessage("Alteração registrada com auditoria.");
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Não foi possível concluir a ação.",
      );
    }
  }
  async function cancel(id: string) {
    if (!window.confirm("Cancelar este convite?")) return;
    try {
      await authRequest(`/api/admin/platform/team/invitations/${id}/cancel`, {
        method: "POST",
      });
      setMessage("Convite cancelado.");
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Não foi possível cancelar.",
      );
    }
  }
  async function regenerate(id: string) {
    try {
      const result = await authRequest<{
        invitationPath: string;
        message: string;
      }>(`/api/admin/platform/team/invitations/${id}/regenerate`, {
        method: "POST",
      });
      setLink(`${window.location.origin}${result.invitationPath}`);
      setMessage(result.message);
      await load();
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar um novo link.",
      );
    }
  }
  return (
    <PremiumScope className="sx-admin-team">
      <main className="sx-at-wrap">
        <header className="sx-premium-ticket sx-at-hero">
          <Users aria-hidden="true" size={30} />
          <div>
            <p className="sx-at-eyebrow">Equipe SorteX</p>
            <h1 className="sx-premium-title">Gestão da equipe</h1>
            <p>Convites, cargos, acessos e sessões administrativas.</p>
          </div>
          {canManage && <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="sx-premium-button sx-at-invite"
          >
            <Plus size={18} aria-hidden="true" />
            Convidar funcionário
          </button>}
        </header>
        {loadError ? <div className="sx-premium-surface sx-at-state">
          <p role="alert" className="sx-at-error">{loadError}</p>
          <button type="button" className="sx-premium-button" onClick={load}>Tentar novamente</button>
        </div> : loading ? <div className="sx-premium-surface sx-at-state">
          <LoaderCircle className="sx-at-spinner" aria-hidden="true" />
          <p role="status" className="sx-premium-muted">Carregando equipe…</p>
        </div> : <section aria-label="Resumo da equipe" className="sx-at-kpis">
          <Metric
            icon={<Users />}
            label="Total de membros"
            value={data.summary.total}
          />
          <Metric
            icon={<UserCheck />}
            label="Ativos"
            value={data.summary.active}
          />
          <Metric
            icon={<ShieldCheck />}
            label="Convites pendentes"
            value={data.summary.pending}
          />
          <Metric
            icon={<UserMinus />}
            label="Desativados"
            value={data.summary.inactive}
          />
        </section>}
        {open && canManage && (
          <form
            onSubmit={invite}
            className="grid gap-4 rounded-3xl border bg-white p-6 shadow-sm md:grid-cols-2"
          >
            <Field name="name" label="Nome" />
            <Field name="email" label="E-mail" type="email" />
            <label className="text-sm font-bold">
              Cargo
              <select
                name="role"
                className="mt-2 h-12 w-full rounded-xl border px-3"
              >
                {Object.entries(roleLabel).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              name="validityDays"
              label="Validade em dias"
              type="number"
              defaultValue="7"
            />
            <label className="text-sm font-bold md:col-span-2">
              Mensagem opcional
              <textarea
                name="message"
                maxLength={500}
                className="mt-2 min-h-24 w-full rounded-xl border p-3"
              />
            </label>
            <button className="h-12 rounded-xl bg-slate-950 font-bold text-white md:col-span-2">
              Gerar convite local
            </button>
          </form>
        )}
        {link && (
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="font-bold">Link exclusivo criado</p>
            <div className="mt-2 flex gap-2">
              <input
                readOnly
                value={link}
                className="h-11 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm"
              />
              <button
                onClick={() => navigator.clipboard.writeText(link)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 font-bold text-white"
              >
                <Copy size={17} />
                Copiar link
              </button>
            </div>
            <p className="mt-2 text-xs text-violet-700">
              Sandbox local: nenhum e-mail externo foi enviado.
            </p>
          </div>
        )}
        {message && (
          <p className="rounded-xl bg-slate-100 p-3 text-sm">{message}</p>
        )}
        {!loading && !loadError && <>
        <section className="sx-premium-surface sx-at-filter" aria-labelledby="sx-at-filter">
          <h2 className="sx-premium-section" id="sx-at-filter">Funcionários</h2>
          <div>
            <label><span>Pesquisar funcionário</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <button type="button" onClick={load} className="sx-premium-button"><RefreshCw size={17} aria-hidden="true" /> Atualizar</button>
          </div>
          <p role="status" className="sx-premium-muted">{visible.length.toLocaleString("pt-BR")} {visible.length === 1 ? "funcionário" : "funcionários"} {normalized ? "na pesquisa" : "na equipe"}</p>
        </section>
        {visible.length === 0 ? (
          <p className="sx-premium-surface sx-at-state">{normalized ? "Nenhum funcionário encontrado para a pesquisa." : "Nenhum funcionário cadastrado."}</p>
        ) : (
          <section className="sx-at-members" aria-label="Funcionários encontrados">
            {visible.map((member) => (
              <article
                key={member.id}
                className="sx-premium-surface sx-at-member"
              >
                <div className="flex gap-3">
                  <span className="sx-at-avatar" aria-hidden="true">
                    {member.name
                      .split(/\s+/)
                      .map((v) => v[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="sx-premium-section">{member.name}</h3>
                    <p className="sx-premium-muted">
                      {member.email}
                    </p>
                  </div>
                  <span
                    className="sx-premium-badge sx-at-member-state"
                  >
                    {member.isActive ? "Ativo" : "Desativado"}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Info
                    label="Cargo"
                    value={roleLabel[member.adminTeamRole] || "-"}
                  />
                  <Info
                    label="Último acesso"
                    value={
                      member.lastAccessAt
                        ? new Date(member.lastAccessAt).toLocaleString("pt-BR")
                        : "Nunca"
                    }
                  />
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/admin/equipe/${member.id}`} prefetch={false}
                    className="sx-premium-button"
                  >
                    Ver perfil
                  </Link>
                  {canManage && <button
                    onClick={() =>
                      action(
                        member.id,
                        member.isActive ? "DEACTIVATE" : "REACTIVATE",
                      )
                    }
                    className="sx-premium-button"
                  >
                    {member.isActive ? "Desativar" : "Reativar"}
                  </button>}
                  {canManage && <button
                    onClick={() => action(member.id, "REVOKE_SESSIONS")}
                    className="sx-premium-button"
                  >
                    Revogar sessões
                  </button>}
                </div>
              </article>
            ))}
          </section>
        )}
        <h2 className="sx-premium-section">Convites</h2>
        <section className="sx-at-invitations" aria-label="Convites para a equipe">
          {data.invitations.length === 0 ? (
            <p className="sx-premium-surface sx-at-state sx-premium-muted">
              Nenhum convite pendente.
            </p>
          ) : (
            data.invitations.map((invite) => (
              <article
                key={invite.id}
                className="sx-premium-surface sx-at-invitation"
              >
                <div>
                  <p className="font-black">{invite.name}</p>
                  <p className="sx-premium-muted">
                    {invite.email} · {roleLabel[invite.role]}
                  </p>
                  <p className="sx-premium-muted">
                    Validade:{" "}
                    {new Date(invite.expiresAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="sx-at-actions">
                  <span className="sx-premium-badge">
                    {invite.status === "PENDING"
                      ? "Convite pendente"
                      : "Convite expirado"}
                  </span>
                  {canManage && <button
                    onClick={() => regenerate(invite.id)}
                    className="sx-premium-button"
                  >
                    Gerar novo link
                  </button>}
                  {canManage && invite.status === "PENDING" && (
                    <button
                      onClick={() => cancel(invite.id)}
                      className="sx-premium-button sx-at-error"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
        </>}
      </main>
    </PremiumScope>
  );
}
function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <article className="sx-premium-surface sx-at-stat">
      <span aria-hidden="true">{icon}</span>
      <p className="sx-premium-muted">{label}</p>
      <p>{value.toLocaleString("pt-BR")}</p>
    </article>
  );
}
function Field({
  name,
  label,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input
        required
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="mt-2 h-12 w-full rounded-xl border px-3"
      />
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="sx-premium-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
