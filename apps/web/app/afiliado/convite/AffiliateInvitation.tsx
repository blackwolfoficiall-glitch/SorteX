"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthApiError, authRequest, getCurrentUser } from "@/lib/auth/client";

const login = "/login?next=%2Fafiliado%2Fconvite%2Fcontinuar";
const storeKey = "sortex:affiliate-invite";
const timeoutMs = 15 * 60 * 1000;
const codePattern = /^[a-f0-9]{10}$/i;

type InviteScreen =
  | { kind: "loading" | "missing" | "unavailable" }
  | { kind: "sign-in" | "ready"; code: string }
  | { kind: "accepted"; status: "ACTIVE" | "PENDING" };

function forget() {
  try { sessionStorage.removeItem(storeKey); } catch { /* unavailable storage */ }
}

function continuationCode(): string | undefined {
  try {
    const pending = JSON.parse(sessionStorage.getItem(storeKey) ?? "null") as
      { code?: unknown; expiresAt?: unknown } | null;
    if (pending && typeof pending.code === "string" && codePattern.test(pending.code) &&
      typeof pending.expiresAt === "number" && pending.expiresAt > Date.now()) return pending.code;
  } catch { /* missing or unavailable storage */ }
  forget();
}

export default function AffiliateInvitation({ initialCode }: { initialCode?: string }) {
  const [screen, setScreen] = useState<InviteScreen>({ kind: "loading" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    const resolve = async (): Promise<InviteScreen> => {
      const code = initialCode === undefined ? continuationCode() : initialCode;
      if (!code || !codePattern.test(code)) return { kind: "missing" };
      try {
        await getCurrentUser();
        return { kind: "ready", code };
      } catch (cause) {
        return cause instanceof AuthApiError && cause.status === 401
          ? { kind: "sign-in", code }
          : { kind: "unavailable" };
      }
    };
    void resolve().then((result) => { if (active) setScreen(result); });
    return () => { active = false; };
  }, [initialCode]);

  async function signIn(code: string, switchAccount = false) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      sessionStorage.setItem(storeKey, JSON.stringify({
        code, expiresAt: Date.now() + timeoutMs,
      }));
      if (switchAccount) await authRequest("/api/auth/logout", { method: "POST" });
      window.location.replace(login);
    } catch {
      setError("Não foi possível continuar nesta aba. Entre no painel e reabra o link original do convite.");
      setBusy(false);
      submitting.current = false;
    }
  }

  async function accept(code: string) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await authRequest<{ status: "ACTIVE" | "PENDING" }>(
        "/api/affiliates/affiliates/invite/accept",
        { method: "POST", cache: "no-store", body: JSON.stringify({ code }) },
      );
      if (result.status !== "ACTIVE" && result.status !== "PENDING") {
        throw new Error("Não foi possível confirmar o vínculo. Confira o painel antes de tentar de novo.");
      }
      forget();
      setScreen({ kind: "accepted", status: result.status });
    } catch (cause) {
      if (cause instanceof AuthApiError && cause.status === 401) {
        setScreen({ kind: "sign-in", code });
      } else {
        if (cause instanceof AuthApiError && (cause.status === 400 || cause.status === 404)) forget();
        setError(cause instanceof AuthApiError && cause.status === 403
          ? "Use a conta vinculada ao e-mail que recebeu o convite."
          : cause instanceof Error ? cause.message : "Não foi possível aceitar o convite.");
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-5">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <p className="font-bold text-violet-700">SorteX Afiliados</p>
        <h1 className="mt-3 text-3xl font-black">Você recebeu um convite</h1>
        <p className="mt-3 text-zinc-600">Revise e aceite o convite para vincular o programa à sua conta.</p>
        {screen.kind === "loading" && <p role="status" className="mt-4">Verificando sua sessão…</p>}
        {screen.kind === "missing" && (
          <p role="status" className="mt-4 rounded-xl bg-violet-50 p-3 text-sm">
            Não há convite disponível nesta aba. Reabra o link original do convite.
          </p>
        )}
        {screen.kind === "unavailable" && (
          <p role="alert" className="mt-4 rounded-xl bg-violet-50 p-3 text-sm">
            Não foi possível confirmar sua sessão. Tente novamente.
          </p>
        )}
        {screen.kind === "sign-in" && (
          <button type="button" disabled={busy} onClick={() => void signIn(screen.code)}
            className="mt-6 min-h-14 w-full rounded-xl bg-violet-700 px-4 font-bold text-white disabled:opacity-50">
            Entrar com e-mail e voltar ao convite
          </button>
        )}
        {screen.kind === "ready" && (
          <>
            <button type="button" disabled={busy} onClick={() => void accept(screen.code)}
              className="mt-6 min-h-14 w-full rounded-xl bg-violet-700 font-bold text-white disabled:opacity-50">
              Aceitar convite
            </button>
            <button type="button" disabled={busy} onClick={() => void signIn(screen.code, true)}
              className="mt-3 min-h-11 w-full rounded-xl border font-bold text-violet-700 disabled:opacity-50">
              Trocar de conta
            </button>
          </>
        )}
        {screen.kind === "accepted" && (
          <p role="status" className="mt-4 rounded-xl bg-violet-50 p-3 text-sm">
            {screen.status === "ACTIVE"
              ? "Convite aceito. Você já pode divulgar."
              : "Convite aceito e enviado para aprovação do organizador."}
          </p>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">{error}</p>}
        <Link href="/afiliado" prefetch={false} className="mt-4 block font-bold text-violet-700">Abrir painel</Link>
      </section>
    </main>
  );
}
