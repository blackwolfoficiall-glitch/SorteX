"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { authRequest } from "@/lib/auth/client";

const roles: Record<string, string> = {
  SUPERADMIN: "Superadministrador",
  ADMIN: "Administrador",
  REGISTRATION_ANALYST: "Analista de cadastro",
  FINANCE: "Financeiro",
  SUPPORT: "Suporte",
  AUDIT: "Auditoria",
};

export default function AdminInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    authRequest(`/api/admin/invitations/${encodeURIComponent(token)}`, {
      cache: "no-store",
    })
      .then(setInvite)
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível abrir o convite.",
        ),
      );
  }, [token]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await authRequest(
        `/api/admin/invitations/${encodeURIComponent(token)}/accept`,
        {
          method: "POST",
          body: JSON.stringify({
            name: form.get("name"),
            password: form.get("password"),
            passwordConfirmation: form.get("passwordConfirmation"),
          }),
        },
      );
      router.replace("/admin/login?convite=aceito");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível aceitar o convite.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-5">
      <section className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-600 text-white">
            <ShieldCheck />
          </span>
          <div>
            <p className="text-2xl font-black">
              Sorte<span className="text-violet-600">X</span>
            </p>
            <p className="text-sm text-slate-500">Convite da Equipe SorteX</p>
          </div>
        </div>
        {error && !invite ? (
          <div className="mt-8 rounded-2xl bg-red-50 p-4 text-red-700">
            {error}
          </div>
        ) : !invite ? (
          <p className="mt-8 text-slate-500">Validando convite...</p>
        ) : (
          <>
            <div className="mt-7 rounded-2xl border bg-slate-50 p-4 text-sm">
              <p>
                <strong>Convidado por:</strong> {invite.invitedBy}
              </p>
              <p>
                <strong>Cargo:</strong> {roles[invite.role] || invite.role}
              </p>
              <p>
                <strong>E-mail:</strong> {invite.email}
              </p>
              <p>
                <strong>Válido até:</strong>{" "}
                {new Date(invite.expiresAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <Field
                name="name"
                label="Nome completo"
                defaultValue={invite.name}
              />
              <Field name="password" label="Senha" type="password" />
              <Field
                name="passwordConfirmation"
                label="Confirmar senha"
                type="password"
              />
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}
              <p className="text-xs text-slate-500">
                Use ao menos 12 caracteres, com maiúscula, minúscula, número e
                símbolo.
              </p>
              <button
                disabled={saving}
                className="h-12 w-full rounded-xl bg-violet-600 font-black text-white disabled:opacity-60"
              >
                {saving ? "Ativando acesso..." : "Aceitar convite"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
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
    <label className="block text-sm font-bold">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required
        autoComplete={type === "password" ? "new-password" : "name"}
        className="mt-2 h-12 w-full rounded-xl border px-4"
      />
    </label>
  );
}
