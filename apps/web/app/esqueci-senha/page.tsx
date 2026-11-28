"use client";

import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { AuthShell, authInputClass } from "@/components/auth/AuthShell";
import { authRequest } from "@/lib/auth/client";
import PasswordRecoveryAccessScope from "../recuperar-senha/PasswordRecoveryAccessScope";
import styles from "../recuperar-senha/password-recovery.module.css";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await authRequest<{ message: string }>(
        "/api/auth/forgot-password",
        { method: "POST", body: JSON.stringify({ email }) },
      );
      setMessage(response.message);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível enviar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordRecoveryAccessScope>
      <AuthShell
        title="Recupere sua senha"
        description="Informe seu e-mail. Se ele estiver cadastrado, enviaremos um link seguro."
        backHref="/login"
        backLabel="Voltar ao login"
      >
        <form onSubmit={submit} className={styles.form}>
          <label className="block text-sm font-semibold text-zinc-700">
            E-mail da conta
            <input
              className={`${authInputClass} mt-2`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {message && (
            <p className={styles.feedback} role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="sx-auth-alert" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading || Boolean(message)}
            className="sx-auth-submit"
          >
            <Mail size={18} aria-hidden="true" />
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </button>
        </form>
      </AuthShell>
    </PasswordRecoveryAccessScope>
  );
}
