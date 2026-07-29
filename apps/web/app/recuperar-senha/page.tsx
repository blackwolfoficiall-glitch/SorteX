"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { AuthShell, authInputClass } from "@/components/auth/AuthShell";
import { authRequest } from "@/lib/auth/client";

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
    <AuthShell
      title="Crie uma nova senha"
      description="Use pelo menos 8 caracteres e não reutilize uma senha antiga."
      backHref="/login"
      backLabel="Voltar ao login"
    >
      {message ? (
        <div className="space-y-5 text-center">
          <p className="rounded-2xl bg-green-50 p-4 text-sm text-green-700">{message}</p>
          <Link href="/login" className="flex h-14 items-center justify-center rounded-2xl bg-violet-700 font-bold text-white">
            Entrar com a nova senha
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <input className={authInputClass} type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nova senha" required />
          <input className={authInputClass} type="password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirmar nova senha" required />
          {error && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 font-bold text-white disabled:opacity-60">
            <KeyRound size={20} />
            {loading ? "Redefinindo..." : "Redefinir senha"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

function ResetPageLoading() {
  return <main className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700" /></main>;
}
