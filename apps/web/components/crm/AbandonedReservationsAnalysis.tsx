"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Bot, Filter, Search, Sparkles, X } from "lucide-react";
import {
  abandonedReservations,
  type AbandonedReservation,
  type AbandonedReservationsResult,
} from "@/lib/crm/client";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";

const emptySummary: AbandonedReservationsResult["summary"] = {
  total: 0,
  uniqueBuyers: 0,
  potentialValue: 0,
  totalTickets: 0,
  recoveryRate: null,
};

export default function AbandonedReservationsAnalysis({
  fromAi = false,
}: {
  fromAi?: boolean;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [items, setItems] = useState<AbandonedReservation[]>([]),
    [summary, setSummary] = useState(emptySummary);
  const [campaignId, setCampaignId] = useState(params.get("campaignId") || ""),
    [search, setSearch] = useState(""),
    [city, setCity] = useState(""),
    [minValue, setMinValue] = useState(""),
    [minQuantity, setMinQuantity] = useState(""),
    [status, setStatus] = useState("");
  const [page, setPage] = useState(Number(params.get("page")) || 1),
    [pages, setPages] = useState(1),
    [selected, setSelected] = useState<string[]>([]),
    [filtersOpen, setFiltersOpen] = useState(false),
    [detail, setDetail] = useState<AbandonedReservation | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    getMyCampaigns()
      .then(setCampaigns)
      .catch(() => setError("Não foi possível carregar as campanhas."));
  }, []);
  useEffect(() => {
    const next = new URLSearchParams(params.toString());
    if (campaignId) next.set("campaignId", campaignId);
    else next.delete("campaignId");
    next.set("page", String(page));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [campaignId, page, pathname, router, params]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(campaignId ? { campaignId } : {}),
      ...(city ? { city } : {}),
      ...(minValue ? { minSpent: minValue } : {}),
    });
    abandonedReservations(`?${query}`)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setPages(result.pages || 1);
        setSummary(result.summary || emptySummary);
      })
      .catch(
        () =>
          active &&
          setError("Não foi possível carregar as reservas abandonadas."),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [campaignId, city, minValue, page, reloadKey]);
  const visible = useMemo(
    () =>
      items.filter((item) => {
        const term = search.trim().toLowerCase();
        if (
          term &&
          ![item.buyer, item.city, item.campaign.title].some((value) =>
            value?.toLowerCase().includes(term),
          )
        )
          return false;
        if (minQuantity && item.quantity < Number(minQuantity)) return false;
        if (status && item.contactStatus !== status) return false;
        return true;
      }),
    [items, search, minQuantity, status],
  );
  const selectable = visible.filter((item) => item.contactId),
    allSelected =
      selectable.length > 0 &&
      selectable.every((item) => selected.includes(item.id));
  const selectedContacts = selectable
    .filter((item) => selected.includes(item.id))
    .map((item) => item.contactId)
    .filter(Boolean)
    .join(",");
  const communicationUrl = (item?: AbandonedReservation, ai = false) => {
    const contactIds = item?.contactId || selectedContacts;
    const cid = item?.campaign.id || campaignId;
    return `/dashboard/comunicacao?tab=new&objective=ABANDONED&audience=${contactIds ? "MANUAL" : "ABANDONED"}${contactIds ? `&contactIds=${encodeURIComponent(contactIds)}` : ""}${cid ? `&campaignId=${cid}` : ""}${ai ? "&ai=1" : ""}&origin=abandoned-analysis`;
  };
  function clear() {
    setSearch("");
    setCity("");
    setMinValue("");
    setMinQuantity("");
    setStatus("");
    setCampaignId("");
    setPage(1);
  }
  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-100 p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        {fromAi && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-500">
              <Link
                href="/dashboard/comunicacao?tab=overview"
                className="font-bold text-violet-700"
              >
                Comunicação
              </Link>
              <span className="mx-2">›</span>Reservas abandonadas
            </div>
            <Link
              href="/dashboard/comunicacao?tab=overview"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"
            >
              <ArrowLeft size={16} />
              Voltar para Comunicação
            </Link>
          </div>
        )}
        <header>
          <p className="text-sm font-black uppercase tracking-wide text-violet-700">
            Análise da IA SorteX
          </p>
          <h1 className="mt-1 text-3xl font-black">Reservas abandonadas</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Visualize compradores que reservaram títulos, mas não concluíram o
            pagamento.
          </p>
        </header>
        <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Summary label="Reservas" value={summary.total} />
          <Summary label="Compradores únicos" value={summary.uniqueBuyers} />
          <Summary
            label="Valor potencial"
            value={money(summary.potentialValue)}
          />
          <Summary label="Títulos" value={summary.totalTickets} />
          <Summary
            label="Campanha"
            value={
              campaignId
                ? campaigns.find((c) => c.id === campaignId)?.title ||
                  "Selecionada"
                : "Todas"
            }
          />
          <Summary
            label="Taxa de recuperação"
            value={
              summary.recoveryRate === null ? "—" : `${summary.recoveryRate}%`
            }
          />
        </section>
        <section className="mt-5 rounded-2xl border bg-white p-4">
          <div className="flex gap-2 sm:hidden">
            <button
              onClick={() => setFiltersOpen(true)}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border font-bold"
            >
              <Filter size={17} />
              Filtros
            </button>
            <button
              onClick={clear}
              className="min-h-11 rounded-xl px-4 text-sm font-bold text-violet-700"
            >
              Limpar
            </button>
          </div>
          <div
            className={`${filtersOpen ? "fixed inset-0 z-50 grid content-start overflow-y-auto bg-white p-4" : "hidden"} gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-6`}
          >
            <div className="flex items-center justify-between sm:hidden">
              <h2 className="text-xl font-black">Filtros</h2>
              <button
                onClick={() => setFiltersOpen(false)}
                aria-label="Fechar filtros"
              >
                <X />
              </button>
            </div>
            <select
              aria-label="Campanha"
              value={campaignId}
              onChange={(e) => {
                setCampaignId(e.target.value);
                setPage(1);
              }}
              className="input"
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <label className="relative">
              <Search
                className="absolute left-3 top-3 text-zinc-400"
                size={17}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Comprador, cidade ou campanha"
                className="input pl-9"
              />
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Cidade"
              className="input"
            />
            <input
              type="number"
              min="0"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              placeholder="Valor mínimo"
              className="input"
            />
            <input
              type="number"
              min="0"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              placeholder="Quantidade mínima"
              className="input"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input"
            >
              <option value="">Todos os contatos</option>
              <option>Não contatada</option>
              <option>Mensagem preparada</option>
              <option>Mensagem enviada</option>
              <option>Recuperada</option>
              <option>Opt-out</option>
            </select>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
              <button
                onClick={() => setFiltersOpen(false)}
                className="h-11 flex-1 rounded-xl bg-violet-700 font-bold text-white sm:hidden"
              >
                Aplicar filtros
              </button>
              <button
                onClick={clear}
                className="hidden h-11 rounded-xl border px-4 font-bold sm:block"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        </section>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-4 font-bold">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() =>
                setSelected(
                  allSelected ? [] : selectable.map((item) => item.id),
                )
              }
            />
            Selecionar resultados visíveis
          </label>
          <span className="text-sm font-bold text-zinc-500">
            {selected.length} selecionada(s)
          </span>
        </div>
        {selected.length > 0 && (
          <div className="sticky bottom-3 z-30 mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-zinc-950 p-3 text-white shadow-xl">
            <b className="mr-auto">
              {selected.length} reserva(s) selecionada(s)
            </b>
            <Link
              href={communicationUrl()}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold"
            >
              Criar comunicação
            </Link>
            <Link
              href={communicationUrl(undefined, true)}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"
            >
              Gerar com IA
            </Link>
            <Link
              href="/dashboard/crm/automacoes?template=abandoned"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold"
            >
              Criar automação
            </Link>
            <button
              onClick={() => setSelected([])}
              className="rounded-xl px-3 py-2 text-sm font-bold"
            >
              Limpar seleção
            </button>
          </div>
        )}
        <section className="mt-4 grid gap-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl bg-white"
              />
            ))
          ) : error ? (
            <div className="rounded-2xl bg-white p-10 text-center">
              <p className="font-bold">{error}</p>
              <button
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 rounded-xl bg-violet-700 px-4 py-2 font-bold text-white"
              >
                Tentar novamente
              </button>
            </div>
          ) : (
            visible.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border bg-white p-4 shadow-sm"
              >
                <div className="flex gap-3">
                  <input
                    aria-label={`Selecionar reserva de ${item.buyer}`}
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="font-black">{item.buyer}</h2>
                        <p className="text-xs text-zinc-500">
                          {[item.city, item.state]
                            .filter(Boolean)
                            .join(" — ") || "Cidade não informada"}{" "}
                          · {item.phone || "Telefone indisponível"} ·{" "}
                          {item.email || "E-mail indisponível"}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800">
                        ○ {item.contactStatus}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
                      <Info label="Campanha" value={item.campaign.title} />
                      <Info label="Reserva" value={date(item.reservedAt)} />
                      <Info label="Expiração" value={date(item.expiresAt)} />
                      <Info
                        label="Quantidade"
                        value={`${item.quantity} títulos`}
                      />
                      <Info label="Valor" value={money(item.amount)} />
                      <Info
                        label="Pagamento"
                        value={payment(item.paymentMethod)}
                      />
                      <Info
                        label="Tentativas"
                        value={String(item.recoveryAttempts)}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={communicationUrl(item)}
                        className="rounded-xl bg-violet-700 px-3 py-2 text-sm font-bold text-white"
                      >
                        Criar mensagem
                      </Link>
                      <Link
                        href={communicationUrl(item, true)}
                        className="inline-flex items-center gap-1 rounded-xl border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700"
                      >
                        <Sparkles size={15} />
                        Gerar com IA
                      </Link>
                      <button
                        onClick={() => setDetail(item)}
                        className="rounded-xl border px-3 py-2 text-sm font-bold"
                      >
                        Abrir detalhes
                      </button>
                      <Link
                        href="/dashboard/crm/automacoes?template=abandoned"
                        className="rounded-xl border px-3 py-2 text-sm font-bold"
                      >
                        Adicionar à automação
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
          {!loading && !error && !visible.length && (
            <div className="rounded-2xl bg-white p-10 text-center">
              <Bot className="mx-auto text-zinc-300" />
              <h2 className="mt-3 font-black">
                Nenhuma reserva abandonada encontrada nesta campanha.
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Quando compradores reservarem títulos e não concluírem o
                pagamento, eles aparecerão aqui.
              </p>
            </div>
          )}
        </section>
        {pages > 1 && (
          <nav className="mt-5 flex items-center justify-center gap-3">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-sm">
              {page} de {pages}
            </span>
            <button
              disabled={page === pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border bg-white px-4 py-2 disabled:opacity-40"
            >
              Próxima
            </button>
          </nav>
        )}
      </div>
      {detail && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40"
          onClick={() => setDetail(null)}
        >
          <aside
            className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-black uppercase text-violet-700">
                  Detalhes da reserva
                </p>
                <h2 className="text-2xl font-black">{detail.buyer}</h2>
              </div>
              <button onClick={() => setDetail(null)} aria-label="Fechar">
                <X />
              </button>
            </div>
            <div className="mt-6 space-y-3">
              <Info label="Campanha" value={detail.campaign.title} />
              <Info label="Quantidade" value={`${detail.quantity} títulos`} />
              <Info label="Valor" value={money(detail.amount)} />
              <Info label="Reserva" value={date(detail.reservedAt)} />
              <Info label="Expiração" value={date(detail.expiresAt)} />
              <Info label="Pagamento" value={payment(detail.paymentMethod)} />
              <Info label="Status" value={detail.contactStatus} />
              <Info
                label="Motivo conhecido"
                value={detail.failureReason || "Não informado"}
              />
            </div>
            <p className="mt-5 rounded-xl bg-zinc-50 p-4 text-xs text-zinc-500">
              Por privacidade, esta análise não exibe telefone completo, e-mail
              completo nem os números reservados.
            </p>
            <div className="mt-5 grid gap-2">
              <Link
                href={communicationUrl(detail)}
                className="rounded-xl bg-violet-700 p-3 text-center font-bold text-white"
              >
                Criar comunicação
              </Link>
              <Link
                href="/dashboard/crm/automacoes?template=abandoned"
                className="rounded-xl border p-3 text-center font-bold"
              >
                Criar automação
              </Link>
              <Link
                href={`/campanha/${detail.campaign.slug}`}
                className="rounded-xl border p-3 text-center font-bold"
              >
                Abrir campanha
              </Link>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}
function Summary({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="min-w-0 rounded-2xl border bg-white p-4">
      <p className="text-xs font-bold text-zinc-500">{label}</p>
      <strong className="mt-2 block break-words text-xl font-black">
        {value}
      </strong>
    </article>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold text-zinc-400">{label}</dt>
      <dd className="mt-1 break-words font-bold text-zinc-800">{value}</dd>
    </div>
  );
}
function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function date(value: string) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Não informado";
}
function payment(value: string | null) {
  return (
    (
      { PIX: "Pix", CREDIT_CARD: "Cartão", CARD: "Cartão" } as Record<
        string,
        string
      >
    )[value || ""] || "Não informado"
  );
}
