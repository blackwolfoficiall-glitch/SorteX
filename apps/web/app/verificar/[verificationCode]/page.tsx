"use client";

import { use, useEffect, useState } from "react";

type Lookup =
  | { status: "loading" | "notFound" | "error" }
  | { status: "ready"; proof: Record<string, unknown> };

export default function Page({
  params,
}: {
  params: Promise<{ verificationCode: string }>;
}) {
  const { verificationCode } = use(params);
  return <Verification key={verificationCode} code={verificationCode} />;
}

function Verification({ code }: { code: string }) {
  const [lookup, setLookup] = useState<Lookup>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `/api/public/winners/verify/${encodeURIComponent(code)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          setLookup({ status: response.status === 404 ? "notFound" : "error" });
          return;
        }
        const proof: unknown = await response.json();
        if (controller.signal.aborted) return;
        if (
          typeof proof !== "object" ||
          proof === null ||
          !("verificationCode" in proof) ||
          typeof proof.verificationCode !== "string" ||
          !("winningNumber" in proof) ||
          typeof proof.winningNumber !== "string"
        ) {
          setLookup({ status: "error" });
          return;
        }
        setLookup({ status: "ready", proof: proof as Record<string, unknown> });
      } catch {
        if (!controller.signal.aborted) setLookup({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [code]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-950 to-slate-950 p-5 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur md:p-10">
        <div className="flex items-center justify-between">
          <b className="text-2xl">SorteX</b>
          {lookup.status === "ready" && (
            <span className="rounded-full bg-emerald-400/20 px-4 py-2 text-sm font-bold text-emerald-300">
              ✓ Verificação pública
            </span>
          )}
        </div>
        <h1 className="mt-10 text-4xl font-black">Prova de ganhador</h1>
        {lookup.status === "ready" ? (
          <>
            <pre className="mt-6 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/30 p-5 text-sm text-violet-100">
              {JSON.stringify(lookup.proof, null, 2)}
            </pre>
            <p className="mt-6 text-xs text-white/60">
              O hash comprova integridade interna; não é blockchain e não
              substitui a fonte oficial.
            </p>
          </>
        ) : (
          <p role="status" className="mt-6 text-violet-100">
            {lookup.status === "loading"
              ? "Consultando registro auditável..."
              : lookup.status === "notFound"
                ? "Não há prova de ganhador válida para este código."
                : "Não foi possível verificar o resultado agora. Tente novamente."}
          </p>
        )}
      </section>
    </main>
  );
}
