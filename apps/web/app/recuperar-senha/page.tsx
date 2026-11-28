"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import { AuthShell, authInputClass } from "@/components/auth/AuthShell";
import { authRequest } from "@/lib/auth/client";
import PasswordRecoveryAccessScope from "./PasswordRecoveryAccessScope";
import styles from "./password-recovery.module.css";

export default function RecuperarSenhaPage() {
  return (
    <Suspense fallback={<ResetPageLoading />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!token) return setError("O link de recuperação é inválido ou está incompleto.");
    if (password !== confirmation) return setError("As senhas não conferem.");
    setLoading(true);
    try {
      const response = await authRequest<{ message: string }>(
        "/api/auth/reset-password",
        { method: "POST", body: JSON.stringify({ token, password }) },
      );
      setMessage(response.message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível redefinir a senha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordRecoveryAccessScope>
      <AuthShell
        title="Crie uma nova senha"
        description="Use pelo menos 8 caracteres e não reutilize uma senha antiga."
        backHref="/login"
        backLabel="Voltar ao login"
      >
        {message ? (
          <div className={styles.success}>
            <p className={styles.feedback} role="status">{message}</p>
            <Link href="/login" className="sx-auth-submit">
              Entrar com a nova senha
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className={styles.form}>
            <label>
              Nova senha
              <input
                className={`${authInputClass} mt-2`}
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nova senha"
                required
              />
            </label>
            <label>
              Confirmar nova senha
              <input
                className={`${authInputClass} mt-2`}
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder="Confirmar nova senha"
                required
              />
            </label>
            {error && <p className="sx-auth-alert" role="alert">{error}</p>}
            <button type="submit" disabled={loading} className="sx-auth-submit">
              <KeyRound size={18} aria-hidden="true" />
              {loading ? "Redefinindo..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </AuthShell>
    </PasswordRecoveryAccessScope>
  );
}

function ResetPageLoading() {
  return (
    <PasswordRecoveryAccessScope>
      <main className={styles.loading} role="status">
        <LoaderCircle size={24} className="animate-spin" aria-hidden="true" />
        Carregando acesso…
      </main>
    </PasswordRecoveryAccessScope>
  );
}
