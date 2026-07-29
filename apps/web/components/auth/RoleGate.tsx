"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthApiError, authRequest, getCurrentUser } from "@/lib/auth/client";
import type {
  AdminPermission,
  AuthUser,
  UserRole,
} from "@/lib/auth/types";
import { hasAdminPermission } from "@/lib/admin/authorization";

const AuthorizedUserContext = createContext<AuthUser | null>(null);

export function useAuthorizedUser() {
  return useContext(AuthorizedUserContext);
}

export function RoleGate({
  allowed,
  requiredPermission,
  children,
}: {
  allowed: UserRole[];
  requiredPermission?: AdminPermission;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const allowedRoles = allowed.join(",");

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        if (
          !allowedRoles.split(",").includes(currentUser.role) ||
          (currentUser.role === "ADMIN" && !currentUser.adminTeamRole)
        ) {
          router.replace(
            currentUser.role === "BUYER"
              ? "/comprador"
              : currentUser.role === "ADMIN"
                ? "/admin/login"
                : "/dashboard",
          );
          return;
        }
        setUser(currentUser);
      })
      .catch((cause) => {
        if (!active) return;
        if (cause instanceof AuthApiError && cause.status === 401) {
          router.replace(
            allowedRoles.split(",").includes("ADMIN")
              ? "/admin/login"
              : "/login",
          );
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar seus dados.",
        );
      });
    return () => {
      active = false;
    };
  }, [allowedRoles, attempt, router]);

  async function logout() {
    await authRequest("/api/auth/logout", { method: "POST" }).catch(
      () => undefined,
    );
    router.replace("/login");
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 px-4">
        <section className="w-full max-w-md rounded-3xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-black">Não foi possível carregar seus dados.</h1>
          <p className="mt-2 text-sm text-zinc-600">{error}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setError("");
                setUser(null);
                setAttempt((value) => value + 1);
              }}
              className="rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="rounded-xl border px-4 py-3 text-sm font-bold"
            >
              Voltar ao início
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700"
            >
              Sair da conta
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <div
            className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700"
            aria-label="Validando acesso"
          />
          <p className="mt-3 text-sm text-zinc-600">Carregando sua conta...</p>
        </div>
      </main>
    );
  }

  if (
    user.role === "ADMIN" &&
    !hasAdminPermission(user, requiredPermission)
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 px-4">
        <section className="w-full max-w-md rounded-3xl border bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-black">Acesso não autorizado</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Seu papel na Equipe SorteX não possui permissão para acessar esta
            área.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/admin/dashboard")}
            className="mt-5 rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white"
          >
            Voltar ao painel
          </button>
        </section>
      </main>
    );
  }

  return (
    <AuthorizedUserContext.Provider value={user}>
      {children}
    </AuthorizedUserContext.Provider>
  );
}
