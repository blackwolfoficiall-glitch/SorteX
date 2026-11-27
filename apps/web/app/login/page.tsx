"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Eye, EyeOff, LoaderCircle, LogIn } from "lucide-react";
import SocialAccess from "@/components/auth/SocialAccess";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./login-premium.module.css";
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

function localLoginPath(value: string | null, origin: string) {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;
  try {
    const target = new URL(value, origin);
    // Compare the browser's normalized origin, then return the vetted absolute
    // address instead of re-interpreting the original path on navigation.
    return target.origin === origin && !target.username && !target.password
      ? target.href
      : null;
  } catch {
    return null;
  }
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
      const { user } = await authRequest<{ user: AuthUser }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        },
      );
      const session = await authRequest<AuthUser>("/api/auth/me", {
        cache: "no-store",
      });
      if (session.id !== user.id) {
        throw new Error(
          "A sessão criada não corresponde ao usuário autenticado.",
        );
      }
      const requestedPath = localLoginPath(
        searchParams.get("next"),
        window.location.origin,
      );
      let destination =
        requestedPath ??
        (user.role === "BUYER"
          ? "/comprador"
          : user.role === "ADMIN"
            ? "/admin/dashboard"
            : "/dashboard");
      if (user.role === "ORGANIZER" && !requestedPath) {
        try {
          const plan = await getCurrentPlan();
          destination =
            plan.profile.onboardingStatus === "IDENTITY_SETUP"
              ? "/dashboard/personalizacao?onboarding=1"
              : destination;
        } catch (cause) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              "[SorteX login] plano não carregado após autenticação",
              {
                status:
                  cause instanceof AuthApiError ? cause.status : undefined,
                fallback: "/dashboard",
              },
            );
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
      setError(
        cause instanceof Error ? cause.message : "Não foi possível entrar.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <PremiumScope className={styles.scope}>
      <AuthShell
        title="Entre na sua conta"
        description="Acesse sua área de comprador ou organizador com segurança."
        backHref="/"
      >
        <SocialAccess />
        {searchParams.get("social_error") && (
          <p role="alert" className="sx-auth-alert mb-5">
            {searchParams.get("social_error") === "cancelled"
              ? "O acesso com o provedor foi cancelado. Você pode tentar novamente ou usar e-mail."
              : searchParams.get("social_error") === "unavailable"
                ? "Este provedor aguarda configuração. Continue com e-mail e senha."
                : "Não foi possível validar esse acesso. Inicie novamente; sua conta existente foi preservada."}
          </p>
        )}
        <form onSubmit={submit} className={styles.form}>
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
                className={styles.visibility}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </label>

          <div className="text-right">
            <Link
              href="/esqueci-senha"
              className="text-sm font-semibold text-violet-700"
            >
              Esqueci minha senha
            </Link>
          </div>

          {error && (
            <p role="alert" className="sx-auth-alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="sx-auth-submit">
            {loading ? (
              <LoaderCircle size={17} aria-hidden="true" className="animate-spin" />
            ) : (
              <LogIn size={17} aria-hidden="true" />
            )}
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
    </PremiumScope>
  );
}

function AuthPageLoading() {
  return (
    <PremiumScope className={styles.scope}>
      <main className={styles.loading} role="status">
        <LoaderCircle size={28} aria-hidden="true" className="animate-spin" />
        Carregando acesso…
      </main>
    </PremiumScope>
  );
}
