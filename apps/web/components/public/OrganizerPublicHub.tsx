"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  Search,
  ShieldCheck,
  Trophy,
} from "lucide-react";

type Winner = {
  id: string;
  prizeName: string;
  winningNumber: string;
  publicDisplayName: string | null;
  publicCity: string | null;
  status: string;
  deliveredAt: string | null;
  createdAt: string;
};
type Campaign = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  status: string;
  coverImageUrl: string | null;
  salesStartAt: string | null;
  salesEndAt: string | null;
  drawDate: string | null;
  createdAt: string;
  draws: Array<{
    status: string;
    winningNumber: string;
    executedAt: string;
    confirmedAt: string | null;
  }>;
  winners: Winner[];
};
type Profile = {
  organizer: {
    id: string;
    name: string;
    verified: boolean;
    logoUrl: string | null;
    brand: {
      publicPhone?: string | null;
      publicEmail?: string | null;
      themeMode?: string;
      primaryColor?: string;
    } | null;
    socialLinks: Array<{
      id: string;
      type: string;
      label: string | null;
      url: string;
    }>;
  };
  campaigns: Campaign[];
  totals: { campaigns: number; winners: number };
};
type View = "campaigns" | "winners" | "audit" | "contact";

const viewTitle: Record<View, string> = {
  campaigns: "Campanhas",
  winners: "Ganhadores",
  audit: "Auditoria",
  contact: "Contato",
};

export default function OrganizerPublicHub({
  organizerId,
  view,
  returnTo,
}: {
  organizerId: string;
  view: View;
  returnTo: string;
}) {
  const [data, setData] = useState<Profile | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("ALL");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/public/organizers/${encodeURIComponent(organizerId)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(setData)
      .catch((error) => {
        if (error?.name !== "AbortError")
          setError("Não foi possível carregar esta área.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [organizerId]);
  const campaigns = useMemo(
    () =>
      data?.campaigns.filter(
        (item) =>
          (status === "ALL" || campaignGroup(item) === status) &&
          item.title
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
      ) || [],
    [data, query, status],
  );
  const winners = useMemo(
    () =>
      data?.campaigns.flatMap((campaign) =>
        campaign.winners.map((winner) => ({
          ...winner,
          campaign: campaign.title,
        })),
      ) || [],
    [data],
  );
  if (loading)
    return (
      <main className="min-h-screen bg-zinc-50 p-5">
        <div className="mx-auto h-72 max-w-5xl animate-pulse rounded-3xl bg-zinc-200" />
      </main>
    );
  if (error || !data)
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 p-5">
        <div className="text-center">
          <p className="font-bold">{error || "Organizador não encontrado."}</p>
          <button
            onClick={() => location.reload()}
            className="mt-4 rounded-xl bg-violet-700 px-5 py-3 font-black text-white"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    );
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-900">
      <div className="mx-auto max-w-6xl">
        <Link
          href={safeReturn(returnTo)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 font-bold hover:bg-white"
        >
          <ChevronLeft />
          Voltar para a campanha
        </Link>
        <header className="mt-3 rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border bg-violet-50 text-2xl font-black text-violet-700">
              {data.organizer.logoUrl ? (
                <Image
                  src={`/api/organizer/logo/${data.organizer.id}`}
                  alt={`Logo de ${data.organizer.name}`}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              ) : (
                data.organizer.name.trim().charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-2xl font-black">{data.organizer.name}</h1>
              {data.organizer.verified && (
                <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
                  <CheckCircle2 size={16} />
                  Organizador verificado
                </p>
              )}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric
              label="Campanhas realizadas"
              value={data.totals.campaigns}
            />
            <Metric label="Total de ganhadores" value={data.totals.winners} />
          </div>
        </header>
        <nav
          className="mt-5 flex gap-2 overflow-x-auto pb-2"
          aria-label="Áreas públicas"
        >
          {(["campaigns", "winners", "audit", "contact"] as View[]).map(
            (item) => (
              <Link
                key={item}
                href={`/o/${organizerId}?view=${item}&returnTo=${encodeURIComponent(safeReturn(returnTo))}`}
                aria-current={view === item ? "page" : undefined}
                className={`shrink-0 rounded-xl px-4 py-3 text-sm font-black ${view === item ? "bg-violet-700 text-white" : "border bg-white"}`}
              >
                {viewTitle[item]}
              </Link>
            ),
          )}
        </nav>
        <section className="mt-4 rounded-3xl border bg-white p-5 sm:p-7">
          <h2 className="text-2xl font-black">{viewTitle[view]}</h2>
          {view === "campaigns" && (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="relative">
                  <span className="sr-only">Pesquisar campanhas</span>
                  <Search
                    className="absolute left-3 top-3.5 text-zinc-400"
                    size={18}
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Pesquisar campanhas"
                    className="min-h-12 w-full rounded-xl border pl-10 pr-3"
                  />
                </label>
                <select
                  aria-label="Filtrar campanhas"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="min-h-12 rounded-xl border px-3"
                >
                  <option value="ALL">Todas</option>
                  <option value="ACTIVE">Ativas</option>
                  <option value="SCHEDULED">Agendadas</option>
                  <option value="ENDED">Encerradas</option>
                </select>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((item) => (
                  <Link
                    key={item.id}
                    href={`/campanha/${item.slug}`}
                    className="overflow-hidden rounded-2xl border transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {item.coverImageUrl ? (
                      <Image
                        src={`/api${item.coverImageUrl}`}
                        alt=""
                        width={560}
                        height={300}
                        unoptimized
                        className="aspect-video w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-video bg-violet-100" />
                    )}
                    <div className="p-4">
                      <span className="text-xs font-black text-violet-700">
                        {groupLabel(campaignGroup(item))}
                      </span>
                      <h3 className="mt-1 font-black">{item.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-zinc-500">
                        {item.shortDescription || "Conheça esta campanha."}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              {!campaigns.length && (
                <Empty text="Nenhuma campanha encontrada." />
              )}
            </>
          )}
          {view === "winners" && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {winners.map((item) => (
                <article key={item.id} className="rounded-2xl border p-5">
                  <Trophy className="text-amber-500" />
                  <h3 className="mt-3 font-black">{item.prizeName}</h3>
                  <p className="mt-1 text-sm">
                    {item.publicDisplayName || "Nome preservado"} ·{" "}
                    {item.publicCity || "Cidade não informada"}
                  </p>
                  <p className="mt-3 font-mono text-sm">
                    Cota {item.winningNumber}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    {new Date(item.createdAt).toLocaleDateString("pt-BR")} ·{" "}
                    {deliveryLabel(item.status, item.deliveredAt)}
                  </p>
                  <p className="mt-2 text-xs font-bold text-violet-700">
                    {item.campaign}
                  </p>
                </article>
              ))}
              {!winners.length && (
                <Empty text="Nenhum ganhador público registrado." />
              )}
            </div>
          )}
          {view === "audit" && (
            <div className="mt-5 space-y-4">
              {data.campaigns.map((item) => (
                <article key={item.id} className="rounded-2xl border p-5">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="shrink-0 text-emerald-600" />
                    <div>
                      <h3 className="font-black">{item.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        Método e regra registrados na publicação. Resultados
                        exibidos somente após confirmação oficial.
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <Info
                      label="Registro"
                      value={new Date(item.createdAt).toLocaleDateString(
                        "pt-BR",
                      )}
                    />
                    <Info
                      label="Situação"
                      value={groupLabel(campaignGroup(item))}
                    />
                    <Info
                      label="Resultado"
                      value={
                        item.draws[0]?.winningNumber || "Aguardando sorteio"
                      }
                    />
                  </dl>
                </article>
              ))}
              {!data.campaigns.length && (
                <Empty text="Nenhum registro público disponível." />
              )}
            </div>
          )}
          {view === "contact" && <Contact profile={data} />}
        </section>
      </div>
    </main>
  );
}

function Contact({ profile }: { profile: Profile }) {
  const links = profile.organizer.socialLinks;
  const phone = profile.organizer.brand?.publicPhone,
    email = profile.organizer.brand?.publicEmail;
  const items = [
    ...(phone ? [{ label: "Telefone", url: `tel:${phone}` }] : []),
    ...(email ? [{ label: "E-mail", url: `mailto:${email}` }] : []),
    ...links.map((item) => ({ label: socialLabel(item.type), url: item.url })),
  ];
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <a
          key={`${item.label}-${item.url}`}
          href={item.url}
          target={item.url.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          className="rounded-2xl border p-5 font-black hover:border-violet-300 hover:bg-violet-50"
        >
          {item.label}
        </a>
      ))}
      {!items.length && <Empty text="Nenhum contato público configurado." />}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <strong className="text-2xl">{value}</strong>
      <span className="mt-1 block text-xs font-bold text-zinc-500">
        {label}
      </span>
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold text-zinc-500">{label}</dt>
      <dd className="mt-1 font-black">{value}</dd>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="col-span-full rounded-2xl bg-zinc-50 p-8 text-center font-bold text-zinc-500">
      {text}
    </p>
  );
}
function campaignGroup(item: Campaign) {
  const now = Date.now();
  if (item.salesStartAt && new Date(item.salesStartAt).getTime() > now)
    return "SCHEDULED";
  return ["DRAWN", "FINISHED", "SOLD_OUT"].includes(item.status) ||
    Boolean(item.salesEndAt && new Date(item.salesEndAt).getTime() < now)
    ? "ENDED"
    : "ACTIVE";
}
function groupLabel(value: string) {
  return value === "ACTIVE"
    ? "Ativa"
    : value === "SCHEDULED"
      ? "Agendada"
      : "Encerrada";
}
function deliveryLabel(status: string, deliveredAt: string | null) {
  return deliveredAt || status === "DELIVERED"
    ? "Prêmio entregue"
    : "Entrega em acompanhamento";
}
function socialLabel(type: string) {
  return (
    (
      {
        INSTAGRAM: "Instagram",
        FACEBOOK: "Facebook",
        TIKTOK: "TikTok",
        YOUTUBE: "YouTube",
        WHATSAPP: "WhatsApp",
        SITE: "Site",
      } as Record<string, string>
    )[type] || type
  );
}
function safeReturn(value: string) {
  return value.startsWith("/campanha/") ? value : "/";
}
