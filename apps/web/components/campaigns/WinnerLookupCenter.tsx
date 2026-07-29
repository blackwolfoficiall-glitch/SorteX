"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Download,
  History,
  LoaderCircle,
  Search,
  Share2,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { authRequest } from "@/lib/auth/client";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";

type Mode = "AUTOMATIC" | "MANUAL";
type LookupResult = {
  mode: Mode;
  campaign: { id: string; title: string };
  calculatedNumber: string;
  winningNumber: string;
  prize: { name: string; value: number | null };
  buyer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    state: string | null;
    profileImageUrl: string | null;
  };
  purchase: {
    id: string;
    createdAt: string;
    status: string;
    total: number;
    payment: {
      status: string;
      method: string;
      approvedAt: string | null;
    } | null;
  };
  consultedAt: string;
};
type LookupHistory = {
  id: string;
  action: string;
  newData: {
    mode?: Mode;
    informedNumber?: string;
    resolvedNumber?: number;
    found?: boolean;
  } | null;
  createdAt: string;
  actor: { name: string; role: string } | null;
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function WinnerLookupCenter() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [mode, setMode] = useState<Mode>("AUTOMATIC");
  const [number, setNumber] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [history, setHistory] = useState<LookupHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const campaign = useMemo(
    () => campaigns.find((item) => item.id === campaignId) ?? null,
    [campaignId, campaigns],
  );

  useEffect(() => {
    getMyCampaigns()
      .then((items) => {
        setCampaigns(items);
        const firstId = items[0]?.id ?? "";
        setCampaignId(firstId);
        if (firstId) void loadHistory(firstId);
      })
      .catch(() => setError("Não foi possível carregar suas campanhas."))
      .finally(() => setLoading(false));
  }, []);

  function selectCampaign(id: string) {
    setCampaignId(id);
    setResult(null);
    setError("");
    if (!id) {
      setHistory([]);
      return;
    }
    void loadHistory(id);
  }

  async function loadHistory(id: string) {
    try {
      setHistory(
        await authRequest<LookupHistory[]>(
          `/api/draws/campaigns/${id}/winner-lookup/history`,
          { cache: "no-store" },
        ),
      );
    } catch {
      setHistory([]);
    }
  }

  async function lookup() {
    if (!campaignId || (mode === "MANUAL" && !number.trim())) return;
    setSearching(true);
    setError("");
    setResult(null);
    try {
      const path =
        mode === "AUTOMATIC"
          ? `/api/draws/campaigns/${campaignId}/winner-lookup/automatic`
          : `/api/draws/campaigns/${campaignId}/winner-lookup/manual`;
      const found = await authRequest<LookupResult>(path, {
        method: "POST",
        body:
          mode === "MANUAL"
            ? JSON.stringify({ winningNumber: number.trim() })
            : undefined,
      });
      setResult(found);
      await loadHistory(campaignId);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível consultar o ganhador.",
      );
      await loadHistory(campaignId);
    } finally {
      setSearching(false);
    }
  }

  async function copyResult() {
    if (!result) return;
    await navigator.clipboard.writeText(resultText(result));
    toast.success("Resultado copiado.");
  }

  async function shareResult() {
    if (!result) return;
    const text = resultText(result);
    if (navigator.share) {
      await navigator
        .share({ title: `Ganhador — ${result.campaign.title}`, text })
        .catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success("Resultado copiado para compartilhar.");
  }

  function generateCard() {
    if (!result) return;
    const svg = winnerCard(result);
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ganhador-${result.winningNumber}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Card do ganhador gerado.");
  }

  return (
    <main className="mx-auto max-w-7xl pb-14">
      <header className="rounded-[32px] bg-gradient-to-br from-violet-950 via-violet-800 to-fuchsia-700 p-6 text-white shadow-xl sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-200">
              Apuração segura
            </p>
            <h1 className="mt-3 text-3xl font-black sm:text-4xl">Ganhadores</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100 sm:text-base">
              Calcule o resultado pela regra publicada ou localize o comprador
              de um número informado durante uma transmissão.
            </p>
          </div>
          <Trophy className="text-amber-300" size={58} />
        </div>
      </header>

      <section className="mt-6 grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="h-fit rounded-3xl border bg-white p-5 shadow-sm">
          <label className="text-sm font-bold">
            Campanha
            <select
              value={campaignId}
              onChange={(event) => selectCampaign(event.target.value)}
              disabled={loading}
              className="mt-2 min-h-12 w-full rounded-xl border px-3"
            >
              {!campaigns.length && <option value="">Nenhuma campanha</option>}
              {campaigns.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="mt-6">
            <legend className="text-sm font-bold">Forma de apuração</legend>
            <div className="mt-2 grid gap-2">
              <ModeButton
                active={mode === "AUTOMATIC"}
                icon={<Sparkles />}
                title="Resultado automático"
                text="Usa a regra publicada e o resultado verificado."
                onClick={() => {
                  setMode("AUTOMATIC");
                  setResult(null);
                  setError("");
                }}
              />
              <ModeButton
                active={mode === "MANUAL"}
                icon={<Search />}
                title="Resultado manual"
                text="Consulta um título sem alterar o sorteio."
                onClick={() => {
                  setMode("MANUAL");
                  setResult(null);
                  setError("");
                }}
              />
            </div>
          </fieldset>

          {mode === "MANUAL" && (
            <label className="mt-6 block text-sm font-bold">
              Número vencedor
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                value={number}
                onChange={(event) =>
                  setNumber(event.target.value.replace(/\D/g, ""))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") void lookup();
                }}
                placeholder="Ex.: 54873"
                className="mt-2 min-h-14 w-full rounded-xl border px-4 font-mono text-xl font-black outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              />
            </label>
          )}

          <button
            type="button"
            onClick={() => void lookup()}
            disabled={
              searching ||
              !campaignId ||
              (mode === "MANUAL" && !number.trim())
            }
            className="mt-6 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 font-black text-white disabled:opacity-50"
          >
            {searching ? (
              <LoaderCircle className="animate-spin" size={19} />
            ) : mode === "AUTOMATIC" ? (
              <Sparkles size={19} />
            ) : (
              <Search size={19} />
            )}
            {mode === "AUTOMATIC" ? "Buscar resultado" : "Ver ganhador"}
          </button>
          <p className="mt-3 text-xs leading-5 text-zinc-500">
            A consulta manual identifica o comprador do título e não registra
            um resultado oficial.
          </p>
        </aside>

        <div>
          {loading ? (
            <div className="h-96 animate-pulse rounded-3xl bg-zinc-200" />
          ) : error ? (
            <div
              role="alert"
              className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-800"
            >
              <Search className="mx-auto" size={42} />
              <p className="mt-4 font-bold">{error}</p>
            </div>
          ) : result ? (
            <WinnerStage
              result={result}
              copy={() => void copyResult()}
              share={() => void shareResult()}
              generate={generateCard}
            />
          ) : (
            <div className="grid min-h-96 place-items-center rounded-3xl border border-dashed bg-white p-8 text-center">
              <div>
                <UserRound className="mx-auto text-violet-300" size={58} />
                <h2 className="mt-5 text-xl font-black">
                  {campaign
                    ? "Pronto para localizar o ganhador"
                    : "Nenhuma campanha disponível"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                  Selecione a forma de apuração e revise o resultado antes de
                  compartilhar.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <History className="text-violet-700" />
          <div>
            <h2 className="text-xl font-black">Histórico de consultas</h2>
            <p className="text-sm text-zinc-500">
              Registro automático de modo, número, responsável, data e hora.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-2">
          {history.map((item) => (
            <article
              key={item.id}
              className="grid gap-2 rounded-2xl bg-zinc-50 p-4 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <div>
                <strong>
                  {item.action.endsWith("MANUAL")
                    ? "Resultado manual"
                    : "Resultado automático"}
                </strong>
                <p className="mt-1 text-xs text-zinc-500">
                  {item.actor?.name ?? "Responsável não disponível"}
                </p>
              </div>
              <span className="font-mono font-black">
                {String(
                  item.newData?.resolvedNumber ??
                    item.newData?.informedNumber ??
                    "—",
                )}
              </span>
              <span className="text-xs text-zinc-500">
                {new Date(item.createdAt).toLocaleString("pt-BR")}
              </span>
            </article>
          ))}
          {!history.length && (
            <p className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">
              Nenhuma consulta registrada para esta campanha.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function ModeButton({
  active,
  icon,
  title,
  text,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-h-20 items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${
        active
          ? "border-violet-600 bg-violet-50 text-violet-950"
          : "hover:border-violet-300"
      }`}
    >
      <span className="text-violet-700 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
      <span>
        <strong className="block text-sm">{title}</strong>
        <span className="mt-1 block text-xs leading-4 text-zinc-500">
          {text}
        </span>
      </span>
    </button>
  );
}

function WinnerStage({
  result,
  copy,
  share,
  generate,
}: {
  result: LookupResult;
  copy: () => void;
  share: () => void;
  generate: () => void;
}) {
  const payment = result.purchase.payment;
  return (
    <section className="overflow-hidden rounded-[32px] border border-emerald-200 bg-white shadow-xl">
      <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-violet-800 px-5 py-10 text-center text-white sm:px-8">
        <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_center,rgba(255,255,255,.2),transparent_55%)]" />
        <CheckCircle2 className="relative mx-auto text-emerald-100" size={56} />
        <p className="relative mt-4 text-sm font-black uppercase tracking-[0.2em]">
          Ganhador localizado
        </p>
        <strong className="relative mt-3 block font-mono text-5xl font-black tracking-wider sm:text-7xl">
          {result.winningNumber}
        </strong>
        {result.calculatedNumber !== result.winningNumber && (
          <p className="relative mt-2 text-xs text-emerald-100">
            Número calculado {result.calculatedNumber}, aplicado conforme a
            política publicada da campanha.
          </p>
        )}
      </div>
      <div className="p-5 sm:p-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-100 text-3xl font-black text-violet-700">
            {result.buyer.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.buyer.profileImageUrl}
                alt={`Foto de ${result.buyer.name}`}
                className="h-full w-full object-cover"
              />
            ) : (
              result.buyer.name.trim().charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-3xl font-black">{result.buyer.name}</h2>
            <p className="mt-1 text-zinc-500">
              {[result.buyer.city, result.buyer.state]
                .filter(Boolean)
                .join(" — ") || "Localidade não informada"}
            </p>
            <p className="mt-2 text-sm font-bold text-violet-700">
              {result.prize.name}
              {result.prize.value != null
                ? ` · ${money.format(result.prize.value)}`
                : ""}
            </p>
          </div>
        </div>
        <dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Pedido" value={`#${result.purchase.id.slice(-8).toUpperCase()}`} />
          <Info
            label="Data da compra"
            value={new Date(result.purchase.createdAt).toLocaleString("pt-BR")}
          />
          <Info
            label="Pagamento"
            value={payment?.status ?? result.purchase.status}
          />
          <Info label="Contato" value={result.buyer.phone ?? result.buyer.email} />
          <Info
            label="Consulta"
            value={new Date(result.consultedAt).toLocaleString("pt-BR")}
          />
          <Info
            label="Modo"
            value={result.mode === "AUTOMATIC" ? "Automático" : "Manual"}
          />
        </dl>
        <div className="mt-7 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={copy}
            className="min-h-12 rounded-xl border px-4 font-black hover:bg-zinc-50"
          >
            <Clipboard className="mr-2 inline" size={18} />
            Copiar resultado
          </button>
          <button
            type="button"
            onClick={share}
            className="min-h-12 rounded-xl border px-4 font-black hover:bg-zinc-50"
          >
            <Share2 className="mr-2 inline" size={18} />
            Compartilhar
          </button>
          <button
            type="button"
            onClick={generate}
            className="min-h-12 rounded-xl bg-violet-700 px-4 font-black text-white"
          >
            <Download className="mr-2 inline" size={18} />
            Gerar card
          </button>
        </div>
        <Link
          href={`/dashboard/pedidos/${result.purchase.id}`}
          className="mt-4 block text-center text-sm font-bold text-violet-700"
        >
          Abrir pedido completo
        </Link>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <dt className="text-xs font-bold text-zinc-500">{label}</dt>
      <dd className="mt-1 break-words font-black">{value}</dd>
    </div>
  );
}

function resultText(result: LookupResult) {
  return [
    `Ganhador — ${result.campaign.title}`,
    `Número: ${result.winningNumber}`,
    `Nome: ${result.buyer.name}`,
    `Cidade: ${[result.buyer.city, result.buyer.state].filter(Boolean).join(" — ") || "Não informada"}`,
    `Prêmio: ${result.prize.name}`,
  ].join("\n");
}

function winnerCard(result: LookupResult) {
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, (char) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      };
      return entities[char];
    });
  const place =
    [result.buyer.city, result.buyer.state].filter(Boolean).join(" — ") ||
    "Localidade não informada";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#4c1d95"/><stop offset="1" stop-color="#a21caf"/></linearGradient></defs>
  <rect width="1080" height="1080" rx="64" fill="url(#g)"/>
  <text x="540" y="150" text-anchor="middle" fill="#ddd6fe" font-family="Arial" font-size="38" font-weight="700">GANHADOR LOCALIZADO</text>
  <text x="540" y="390" text-anchor="middle" fill="white" font-family="monospace" font-size="150" font-weight="900">${escape(result.winningNumber)}</text>
  <circle cx="540" cy="570" r="90" fill="#ede9fe"/>
  <text x="540" y="605" text-anchor="middle" fill="#6d28d9" font-family="Arial" font-size="92" font-weight="900">${escape(result.buyer.name.charAt(0).toUpperCase())}</text>
  <text x="540" y="735" text-anchor="middle" fill="white" font-family="Arial" font-size="58" font-weight="900">${escape(result.buyer.name)}</text>
  <text x="540" y="805" text-anchor="middle" fill="#e9d5ff" font-family="Arial" font-size="34">${escape(place)}</text>
  <text x="540" y="900" text-anchor="middle" fill="#fef3c7" font-family="Arial" font-size="40" font-weight="700">${escape(result.prize.name)}</text>
  <text x="540" y="990" text-anchor="middle" fill="white" font-family="Arial" font-size="30">SorteX · ${escape(result.campaign.title)}</text>
</svg>`;
}
