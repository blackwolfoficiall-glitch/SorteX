"use client";

import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { AuthShell, authInputClass } from "@/components/auth/AuthShell";
import { authRequest } from "@/lib/auth/client";

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
    <AuthShell
      title="Recupere sua senha"
      description="Informe seu e-mail. Se ele estiver cadastrado, enviaremos um link seguro."
      backHref="/login"
      backLabel="Voltar ao login"
    >
      <form onSubmit={submit} className="space-y-4">
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
          <p className="rounded-2xl bg-green-50 p-4 text-sm text-green-700">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || Boolean(message)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 font-bold text-white disabled:opacity-60"
        >
          <Mail size={20} />
          {loading ? "Enviando..." : "Enviar link de recuperação"}
        </button>
      </form>
    </AuthShell>
  );
}
