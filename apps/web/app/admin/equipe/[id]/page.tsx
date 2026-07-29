"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { authRequest } from "@/lib/auth/client";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { hasAdminPermission } from "@/lib/admin/authorization";

const roles: Record<string, string> = {
  SUPERADMIN: "Superadministrador",
  ADMIN: "Administrador",
  REGISTRATION_ANALYST: "Analista de cadastro",
  FINANCE: "Financeiro",
  SUPPORT: "Suporte",
  AUDIT: "Auditoria",
};
export default function AdminMemberPage() {
  const user = useAuthorizedUser();
  const canManage = Boolean(
    user && hasAdminPermission(user, "USERS_WRITE"),
  );
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [member, setMember] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    authRequest(`/api/admin/platform/users/${id}`, { cache: "no-store" })
      .then(setMember)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar o perfil.",
        ),
      );
  }, [id]);
  async function action(action: string, adminTeamRole?: string) {
    const reason = window.prompt("Informe o motivo desta alteração:");
    if (!reason) return;
    try {
      await authRequest(`/api/admin/platform/team/${id}/action`, {
        method: "POST",
        body: JSON.stringify({ action, adminTeamRole, reason }),
      });
      setMember(
        await authRequest(`/api/admin/platform/users/${id}`, {
          cache: "no-store",
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível concluir a ação.",
      );
    }
  }
  return (
    <main className="p-5 pt-20 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 font-bold"
        >
          <ArrowLeft size={18} />
          Voltar
        </button>
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>
        )}
        {!member ? (
          <LoaderCircle className="mx-auto animate-spin text-violet-600" />
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-4 rounded-3xl border bg-white p-6 shadow-sm">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-violet-100 text-xl font-black text-violet-700">
                {member.name
                  .split(/\s+/)
                  .map((v: string) => v[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div className="flex-1">
                <h1 className="text-2xl font-black">{member.name}</h1>
                <p className="text-slate-500">{member.email}</p>
                <p className="mt-1 text-sm font-bold text-violet-700">
                  {roles[member.adminTeamRole] || "Sem cargo administrativo"}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${member.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
              >
                {member.isActive ? "Ativo" : "Desativado"}
              </span>
            </header>
            <section className="grid gap-4 md:grid-cols-3">
              <Card
                label="Data de entrada"
                value={new Date(member.createdAt).toLocaleString("pt-BR")}
              />
              <Card
                label="Último acesso"
                value={
                  member.lastAccessAt
                    ? new Date(member.lastAccessAt).toLocaleString("pt-BR")
                    : "Nunca"
                }
              />
              <Card
                label="Sessões ativas"
                value={String(member.sessions?.length || 0)}
              />
            </section>
            {canManage && <section className="rounded-3xl border bg-white p-6">
              <h2 className="text-xl font-black">Acesso e cargo</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <select
                  defaultValue={member.adminTeamRole}
                  onChange={(e) => action("CHANGE_ROLE", e.target.value)}
                  className="h-11 rounded-xl border px-3"
                >
                  {Object.entries(roles).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    action(member.isActive ? "DEACTIVATE" : "REACTIVATE")
                  }
                  className="rounded-xl border px-4 font-bold"
                >
                  {member.isActive ? "Desativar acesso" : "Reativar acesso"}
                </button>
                <button
                  onClick={() => action("REVOKE_SESSIONS")}
                  className="rounded-xl border px-4 font-bold"
                >
                  Revogar sessões
                </button>
              </div>
            </section>}
            <section className="rounded-3xl border bg-white p-6">
              <h2 className="text-xl font-black">
                Ações administrativas recentes
              </h2>
              <div className="mt-4 space-y-3">
                {member.auditLogs?.length ? (
                  member.auditLogs.map((log: any) => (
                    <article
                      key={log.id}
                      className="rounded-xl bg-slate-50 p-3 text-sm"
                    >
                      <p className="font-bold">{log.action}</p>
                      <p className="text-slate-500">
                        {new Date(log.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="text-slate-500">Nenhuma ação registrada.</p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
function Card({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border bg-white p-5">
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className="mt-2 font-black">{value}</p>
    </article>
  );
}
