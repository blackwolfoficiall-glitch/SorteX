"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { AuthShell, authInputClass } from "@/components/auth/AuthShell";
import { AuthApiError, authRequest } from "@/lib/auth/client";
import type { AuthUser } from "@/lib/auth/types";
import { getCurrentPlan } from "@/lib/organizer-platform/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const { user } = await authRequest<{ user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const session = await authRequest<AuthUser>("/api/auth/me", {
        cache: "no-store",
      });
      if (session.id !== user.id) {
        throw new Error("A sessão criada não corresponde ao usuário autenticado.");
      }
      const requestedPath = searchParams.get("next");
      let destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
        ? requestedPath
        : user.role === "BUYER"
          ? "/comprador"
          : user.role === "ADMIN"
            ? "/admin/dashboard"
            : "/dashboard";
      if (user.role === "ORGANIZER" && !requestedPath) {
        try {
          const plan = await getCurrentPlan();
          destination =
            plan.profile.onboardingStatus === "IDENTITY_SETUP"
              ? "/dashboard/personalizacao?onboarding=1"
              : destination;
        } catch (cause) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[SorteX login] plano não carregado após autenticação", {
              status: cause instanceof AuthApiError ? cause.status : undefined,
              fallback: "/dashboard",
            });
          }
          destination = "/dashboard";
        }
      }
      if (process.env.NODE_ENV !== "production") {
        console.info("[SorteX login] redirecionamento", {
          role: user.role,
          destination,
          sessionVerified: true,
        });
      }
      window.location.assign(destination);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Entre na sua conta"
      description="Acesse sua área de comprador ou organizador com segurança."
      backHref="/"
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-semibold text-zinc-700">
          E-mail
          <input
            className={`${authInputClass} mt-2`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            required
          />
        </label>

        <label className="block text-sm font-semibold text-zinc-700">
          Senha
          <div className="relative mt-2">
            <input
              className={`${authInputClass} pr-12`}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </label>

        <div className="text-right">
          <Link href="/esqueci-senha" className="text-sm font-semibold text-violet-700">
            Esqueci minha senha
          </Link>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-700 to-purple-600 font-bold text-white disabled:opacity-60"
        >
          <LogIn size={20} />
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-center text-sm text-zinc-500">
          Ainda não tem conta?{" "}
          <Link href="/escolha" className="font-bold text-violet-700">
            Cadastre-se
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function AuthPageLoading() {
  return <main className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700" /></main>;
}
