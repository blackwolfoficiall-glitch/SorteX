"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState, type ReactNode } from "react";
import { parsePublicProof, type PublicProof } from "./public-proof";

type Lookup =
  | { status: "loading" | "notFound" | "error" }
  | { status: "ready"; proof: PublicProof };

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
          { cache: "no-store", signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setLookup({ status: response.status === 404 ? "notFound" : "error" });
          return;
        }
        const proof = parsePublicProof(await response.json(), code);
        if (controller.signal.aborted) return;
        setLookup(proof ? { status: "ready", proof } : { status: "error" });
      } catch {
        if (!controller.signal.aborted) setLookup({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [code]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-950 to-slate-950 p-5 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur md:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <b className="text-2xl">SorteX</b>
          {lookup.status === "ready" && (
            <span className="rounded-full bg-emerald-400/20 px-4 py-2 text-sm font-bold text-emerald-300">
              ✓ Verificação pública
            </span>
          )}
        </div>
        <h1 className="mt-10 text-4xl font-black">Prova de ganhador</h1>
        {lookup.status === "ready" ? (
          <ProofSummary proof={lookup.proof} />
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

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-violet-200">{label}</dt>
      <dd className="mt-1 break-words">{children}</dd>
    </div>
  );
}

function CodeCopy({ code }: { code: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(code);
      setFeedback("Código copiado.");
    } catch {
      input.current?.focus();
      input.current?.select();
      input.current?.setSelectionRange(0, code.length);
      setFeedback("Código selecionado. Use a opção de copiar do seu dispositivo.");
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-white/10 p-4">
      <label htmlFor="public-verification-code" className="block text-sm font-bold text-violet-200">
        Código público de verificação
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          ref={input}
          id="public-verification-code"
          type="text"
          readOnly
          spellCheck={false}
          autoCapitalize="none"
          value={code}
          className="min-w-0 flex-1 select-text rounded-lg bg-black/30 px-3 py-2 font-mono text-sm text-white"
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-lg bg-violet-300 px-4 py-2 text-sm font-bold text-violet-950 hover:bg-violet-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-200"
        >
          Copiar código
        </button>
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-violet-200">{feedback}</p>
    </div>
  );
}

function ProofSummary({ proof }: { proof: PublicProof }) {
  return (
    <>
      <div className="mt-6 rounded-2xl bg-black/30 p-5">
        <h2 className="font-bold text-emerald-300">Apuração confirmada</h2>
        <p className="mt-2 text-sm text-violet-100">
          Este registro confirma o resultado do sorteio. Não comprova pagamento ou repasse do prêmio.
        </p>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <Fact label="Número ganhador">
            <strong className="block break-all font-mono text-3xl tracking-wide">{proof.winningNumber}</strong>
          </Fact>
          {proof.prizeName && <Fact label="Prêmio">{proof.prizeName}</Fact>}
          {proof.title && (
            <Fact label="Campanha">
              {proof.campaignPath ? (
                <Link href={proof.campaignPath} prefetch={false} className="underline underline-offset-4">
                  {proof.title}
                </Link>
              ) : proof.title}
            </Fact>
          )}
          {proof.organizerName && <Fact label="Organizador">{proof.organizerName}</Fact>}
          {proof.publicName && <Fact label="Nome público">{proof.publicName}</Fact>}
          {proof.publicCity && <Fact label="Cidade divulgada">{proof.publicCity}</Fact>}
          <Fact label="Confirmação (horário de Brasília)">{proof.confirmedAt}</Fact>
          <Fact label="Situação do prêmio">
            {proof.deliveryConfirmed
              ? "Recebimento confirmado pelo ganhador"
              : proof.prizeStatus ?? "Não informada no registro público"}
          </Fact>
        </dl>
      </div>
      <CodeCopy code={proof.code} />
      <details className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-5">
        <summary className="cursor-pointer font-bold">Detalhes da apuração</summary>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          {proof.extraction && <Fact label="Extração da Loteria Federal">{proof.extraction}</Fact>}
          {proof.ruleVersion && <Fact label="Versão da regra">{proof.ruleVersion}</Fact>}
          {proof.outputLength && <Fact label="Dígitos da regra">{proof.outputLength}</Fact>}
          {proof.normalization && <Fact label="Normalização">{proof.normalization}</Fact>}
          {proof.rawResult && <Fact label="Resultado bruto">{proof.rawResult}</Fact>}
          {proof.normalizedResult && <Fact label="Resultado normalizado">{proof.normalizedResult}</Fact>}
        </dl>
        {proof.originalPrizes.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-violet-200">Prêmios originais da extração</h3>
            <ol className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
              {proof.originalPrizes.map((prize, index) => (
                <li key={index}>{index + 1}º: {prize}</li>
              ))}
            </ol>
          </div>
        )}
        {proof.steps.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-violet-200">Etapas da regra registrada</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-violet-100">
              {proof.steps.map((step, index) => (
                <li key={index}>
                  {step.position} do {step.prize}º prêmio
                  {step.reverse ? ", valor invertido" : ""}
                  {step.complement ? ", complemento de 9" : ""}
                  {step.digit !== undefined ? `: ${step.digit}` : ""}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="mt-4 text-sm text-violet-100">O registro público não detalha as etapas da regra.</p>
        )}
        {proof.source && (
          <a
            href={proof.source}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-sm font-semibold text-violet-200 underline underline-offset-4"
          >
            Consultar extração na fonte oficial da CAIXA
          </a>
        )}
        <p className="mt-5 text-sm font-semibold text-violet-200">Hash de auditoria</p>
        <code className="mt-1 block select-text break-all text-sm">{proof.hash}</code>
        <p className="mt-4 text-xs text-white/70">
          O hash permite conferir a integridade do registro interno. Não é blockchain nem substitui a fonte oficial.
        </p>
      </details>
    </>
  );
}
