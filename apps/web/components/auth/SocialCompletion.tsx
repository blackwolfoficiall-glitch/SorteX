"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, LoaderCircle, Ticket } from "lucide-react";
import { AuthShell } from "./AuthShell";
import RegistrationForm from "./RegistrationForm";
import { authRequest, getCurrentUser } from "@/lib/auth/client";
type Pending = {
  provider: string;
  name: string | null;
  email: string;
  linkRequired: boolean;
};
export default function SocialCompletion() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [role, setRole] = useState<"BUYER" | "ORGANIZER" | null>(null);
  const [account, setAccount] = useState<{
    name: string;
    email: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  useEffect(() => {
    authRequest<Pending>("/api/auth/social/pending")
      .then(setPending)
      .catch((error) => setError(error.message));
    getCurrentUser()
      .then((user) => setAccount({ name: user.name, email: user.email }))
      .catch(() => undefined);
  }, []);
  async function link() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError("");
    try {
      await authRequest("/api/auth/social/link", { method: "POST" });
      window.location.assign("/login");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível vincular.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (pending && !pending.linkRequired && !linkMode && role)
    return <RegistrationForm role={role} social={pending} />;
  return (
    <AuthShell
      title={
        pending?.linkRequired
          ? "Preserve sua conta existente"
          : "Como você quer continuar?"
      }
      description="Sua identidade social não altera o perfil nem os dados de uma conta existente."
      backHref="/login"
    >
      {!pending && !error && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <LoaderCircle size={16} className="animate-spin" />
          Confirmando sua identidade…
        </p>
      )}
      {error && (
        <p role="alert" className="sx-auth-alert">
          {error}
        </p>
      )}
      {pending?.linkRequired || linkMode ? (
        <div className="space-y-5 text-sm leading-7 text-zinc-600">
          <p>
            {pending?.linkRequired
              ? "Já existe uma conta com o e-mail confirmado pelo provedor. Nenhuma conta foi unida."
              : "Você escolheu vincular à sua conta existente, preservando seus dados."}{" "}
            Para vincular, entre na conta SorteX que deseja manter e confirme a
            ação.
          </p>
          {!account ? (
            <Link
              className="sx-auth-submit"
              href="/login?next=%2Fcadastro%2Fcompletar"
            >
              Entrar na conta existente
            </Link>
          ) : (
            <>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-xs leading-6 text-violet-950">
                <p>
                  Identidade do provedor: <strong>{pending?.email}</strong>
                </p>
                <p>
                  Conta SorteX que será mantida:{" "}
                  <strong>{account.email}</strong> ({account.name})
                </p>
              </div>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Quero vincular esta identidade{" "}
                {pending?.provider === "google" ? "Google" : "Apple"} à conta
                SorteX em que acabei de entrar.
              </label>
              <button
                type="button"
                className="sx-auth-submit"
                disabled={!confirmed || busy}
                onClick={link}
              >
                {busy ? "Vinculando…" : "Confirmar vínculo"}
              </button>
              <p className="text-xs">
                O vínculo exige login feito nos últimos 10 minutos. Seu ID,
                e-mail, histórico e papel não serão substituídos.
              </p>
            </>
          )}
        </div>
      ) : (
        pending && (
          <>
            <div className="sx-choice-grid">
              {(
                [
                  [
                    "BUYER",
                    "Comprador",
                    "Participar de campanhas e acompanhar títulos.",
                    Ticket,
                  ],
                  [
                    "ORGANIZER",
                    "Organizador",
                    "Criar e administrar campanhas com perfil PF ou PJ.",
                    Building2,
                  ],
                ] as const
              ).map(([value, title, description, Icon]) => (
                <button
                  type="button"
                  className="sx-choice-card text-left"
                  key={value}
                  onClick={() => setRole(value)}
                >
                  <Icon size={24} />
                  <div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </div>
                  <ArrowRight size={18} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLinkMode(true)}
              className="sx-card-link"
            >
              Já tenho uma conta — quero vincular esta identidade
            </button>
          </>
        )
      )}
      {!pending && error && (
        <Link className="sx-card-link" href="/login">
          Voltar ao acesso <ArrowRight size={16} />
        </Link>
      )}
    </AuthShell>
  );
}
