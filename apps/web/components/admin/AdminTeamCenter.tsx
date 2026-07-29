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
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await authRequest("/api/admin/platform/team", { cache: "no-store" }),
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar a equipe.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
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
    <main className="p-5 pt-20 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
              Equipe SorteX
            </p>
            <h1 className="mt-2 text-3xl font-black">Gestão da equipe</h1>
            <p className="mt-1 text-slate-500">
              Convites, cargos, acessos e sessões administrativas.
            </p>
          </div>
          {canManage && <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-violet-600 px-5 font-bold text-white"
          >
            <Plus size={18} />
            Convidar funcionário
          </button>}
        </header>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        </section>
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black">Funcionários</h2>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-bold"
          >
            <RefreshCw size={17} />
            Atualizar
          </button>
        </div>
        {loading ? (
          <LoaderCircle className="mx-auto animate-spin text-violet-600" />
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {data.members.map((member) => (
              <article
                key={member.id}
                className="rounded-3xl border bg-white p-5 shadow-sm"
              >
                <div className="flex gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-violet-100 font-black text-violet-700">
                    {member.name
                      .split(/\s+/)
                      .map((v) => v[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black">{member.name}</h3>
                    <p className="truncate text-sm text-slate-500">
                      {member.email}
                    </p>
                  </div>
                  <span
                    className={`h-fit rounded-full px-3 py-1 text-xs font-black ${member.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
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
                    href={`/admin/equipe/${member.id}`}
                    className="rounded-lg border px-3 py-2 text-sm font-bold"
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
                    className="rounded-lg border px-3 py-2 text-sm font-bold"
                  >
                    {member.isActive ? "Desativar" : "Reativar"}
                  </button>}
                  {canManage && <button
                    onClick={() => action(member.id, "REVOKE_SESSIONS")}
                    className="rounded-lg border px-3 py-2 text-sm font-bold"
                  >
                    Revogar sessões
                  </button>}
                </div>
              </article>
            ))}
          </section>
        )}
        <h2 className="text-xl font-black">Convites</h2>
        <section className="space-y-3">
          {data.invitations.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-500">
              Nenhum convite pendente.
            </p>
          ) : (
            data.invitations.map((invite) => (
              <article
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-4"
              >
                <div>
                  <p className="font-black">{invite.name}</p>
                  <p className="text-sm text-slate-500">
                    {invite.email} · {roleLabel[invite.role]}
                  </p>
                  <p className="text-xs text-slate-400">
                    Validade:{" "}
                    {new Date(invite.expiresAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                    {invite.status === "PENDING"
                      ? "Convite pendente"
                      : "Convite expirado"}
                  </span>
                  {canManage && <button
                    onClick={() => regenerate(invite.id)}
                    className="rounded-lg border px-3 py-2 text-sm font-bold"
                  >
                    Gerar novo link
                  </button>}
                  {canManage && invite.status === "PENDING" && (
                    <button
                      onClick={() => cancel(invite.id)}
                      className="rounded-lg border px-3 py-2 text-sm font-bold text-red-600"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
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
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <span className="text-violet-600">{icon}</span>
      <p className="mt-4 text-3xl font-black">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
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
      <dt className="text-xs font-bold uppercase text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
