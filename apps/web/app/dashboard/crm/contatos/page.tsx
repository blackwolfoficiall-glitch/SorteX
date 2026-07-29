"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, MessageCircle, Tag, X } from "lucide-react";
import CrmNav from "@/components/crm/CrmNav";
import {
  addContactTag,
  contacts,
  createTask,
  segments,
  tags,
  updateSegment,
  type CrmContact,
  type CrmTag,
  type Segment,
} from "@/lib/crm/client";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";

const statusLabel: Record<string, string> = {
  LEAD: "Lead",
  CUSTOMER: "Cliente",
  VIP: "VIP",
  INACTIVE: "Inativo",
  BLOCKED: "Bloqueado",
};

export default function Contatos() {
  const router = useRouter();
  const query = useSearchParams();
  const cityMissing = query.get("cityMissing") === "1";
  const [items, setItems] = useState<CrmContact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [segmentRows, setSegmentRows] = useState<Segment[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState(query.get("status") || "");
  const [campaignId, setCampaignId] = useState("");
  const [city, setCity] = useState(query.get("city") || "");
  const [tagId, setTagId] = useState("");
  const [minSpent, setMinSpent] = useState("");
  const [order, setOrder] = useState(query.get("order") || "recent");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkTag, setBulkTag] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkSegment, setBulkSegment] = useState("");
  const [selectingAll, setSelectingAll] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allVisibleSelected =
    items.length > 0 && items.every((item) => selectedSet.has(item.id));

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  }
  function toggleAll() {
    setSelected((current) =>
      allVisibleSelected
        ? current.filter((id) => !items.some((item) => item.id === id))
        : Array.from(new Set([...current, ...items.map((item) => item.id)])),
    );
  }
  function communicate(ids = selected) {
    if (!ids.length) return;
    router.push(
      `/dashboard/comunicacao?audience=MANUAL&contactIds=${encodeURIComponent(ids.join(","))}`,
    );
  }
  function queryString(targetPage: number, limit = 20) {
    return new URLSearchParams({
      page: String(targetPage),
      limit: String(limit),
      order,
      ...(debounced ? { search: debounced } : {}),
      ...(status ? { status } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(city ? { city } : {}),
      ...(cityMissing ? { cityMissing: "true" } : {}),
      ...(tagId ? { tagId } : {}),
      ...(minSpent ? { minSpent } : {}),
    }).toString();
  }
  async function selectAllResults() {
    setSelectingAll(true);
    setError("");
    try {
      const first = await contacts(`?${queryString(1, 100)}`);
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, first.pages - 1) }, (_, index) =>
          contacts(`?${queryString(index + 2, 100)}`),
        ),
      );
      setSelected(
        Array.from(
          new Set(
            [first, ...rest]
              .flatMap((result) => result.items)
              .map((item) => item.id),
          ),
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível selecionar os resultados.",
      );
    } finally {
      setSelectingAll(false);
    }
  }
  async function moveToSegment() {
    const segment = segmentRows.find((item) => item.id === bulkSegment);
    if (!segment || !selected.length) return;
    setBulkBusy(true);
    try {
      const previous = Array.isArray(segment.rules.contactIds)
        ? segment.rules.contactIds.map(String)
        : [];
      await updateSegment(segment.id, {
        name: segment.name,
        description: segment.description,
        type: segment.type,
        isDynamic: segment.type === "DYNAMIC",
        rules: {
          ...segment.rules,
          contactIds: Array.from(new Set([...previous, ...selected])),
        },
      });
      setSelected([]);
      setBulkSegment("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível mover os contatos.",
      );
    } finally {
      setBulkBusy(false);
    }
  }
  async function createBulkTask() {
    const title = window
      .prompt("Título da tarefa para os contatos selecionados")
      ?.trim();
    if (!title) return;
    setBulkBusy(true);
    try {
      await Promise.all(
        selected.map((contactId) =>
          createTask({ title, contactId, priority: "MEDIUM" }),
        ),
      );
      setSelected([]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível criar as tarefas.",
      );
    } finally {
      setBulkBusy(false);
    }
  }
  async function applyTag() {
    if (!bulkTag || !selected.length) return;
    setBulkBusy(true);
    setError("");
    try {
      await Promise.all(selected.map((id) => addContactTag(id, bulkTag)));
      setSelected([]);
      setBulkTag("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível adicionar a etiqueta.",
      );
    } finally {
      setBulkBusy(false);
    }
  }
  async function exportSelected() {
    let rows = items.filter((item) => selectedSet.has(item.id));
    if (rows.length < selected.length) {
      const first = await contacts(`?${queryString(1, 100)}`);
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, first.pages - 1) }, (_, index) =>
          contacts(`?${queryString(index + 2, 100)}`),
        ),
      );
      rows = [first, ...rest]
        .flatMap((result) => result.items)
        .filter((item) => selectedSet.has(item.id));
    }
    const csv = [
      "Nome,E-mail,Telefone,Cidade,Estado,Compras,Títulos,Valor gasto",
      ...rows.map((item) =>
        [
          item.name,
          item.email || "",
          item.phone || "",
          item.city || "",
          item.state || "",
          item.totalPurchases,
          item.totalTickets,
          item.totalSpent,
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "contatos-selecionados.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    Promise.all([getMyCampaigns(), tags(), segments()])
      .then(([c, t, s]) => {
        setCampaigns(c);
        setAllTags(t);
        setSegmentRows(s);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const query = new URLSearchParams({
      page: String(page),
      limit: "20",
      order,
      ...(debounced ? { search: debounced } : {}),
      ...(status ? { status } : {}),
      ...(campaignId ? { campaignId } : {}),
      ...(city ? { city } : {}),
      ...(cityMissing ? { cityMissing: "true" } : {}),
      ...(tagId ? { tagId } : {}),
      ...(minSpent ? { minSpent } : {}),
    });
    setError("");
    contacts(`?${query}`)
      .then((result) => {
        setItems(result.items);
        setPages(result.pages || 1);
        setTotal(result.total);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os contatos.",
        ),
      );
  }, [page, order, debounced, status, campaignId, city, cityMissing, tagId, minSpent]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-100 p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase text-violet-700">
              CRM Inteligente
            </p>
            <h1 className="text-3xl font-black">Contatos</h1>
          </div>
          <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-600">
            {total} contatos
          </span>
        </div>
        <div className="mt-4">
          <CrmNav />
        </div>
        {query.get("action") === "new" && (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
            <strong>Adicionar contato ao CRM</strong>
            <p className="mt-1 text-violet-700">
              Os contatos são criados com segurança quando o comprador se
              identifica ou conclui o cadastro. Assim, telefone, consentimento e
              histórico permanecem vinculados à pessoa correta.
            </p>
            <Link
              href="/cadastro/comprador"
              className="mt-3 inline-flex rounded-xl bg-violet-700 px-4 py-2 font-bold text-white"
            >
              Abrir cadastro de comprador
            </Link>
          </div>
        )}
        <section className="mt-5 grid gap-3 rounded-3xl bg-white p-4 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome, telefone ou e-mail"
            className="h-11 rounded-xl border px-3"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border px-3"
          >
            <option value="">Todos os status</option>
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={campaignId}
            onChange={(e) => {
              setCampaignId(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border px-3"
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </select>
          <input
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            placeholder="Cidade"
            className="h-11 rounded-xl border px-3"
          />
          <select
            value={tagId}
            onChange={(e) => {
              setTagId(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border px-3"
          >
            <option value="">Todas as etiquetas</option>
            {allTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            value={minSpent}
            onChange={(e) => {
              setMinSpent(e.target.value);
              setPage(1);
            }}
            placeholder="Gasto mínimo"
            className="h-11 rounded-xl border px-3"
          />
          <select
            value={order}
            onChange={(e) => {
              setOrder(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-xl border px-3"
          >
            <option value="recent">Mais recentes</option>
            <option value="spent">Maiores compradores</option>
          </select>
          <button
            type="button"
            onClick={toggleAll}
            className="h-11 rounded-xl border border-violet-200 px-4 font-bold text-violet-700"
          >
            {allVisibleSelected
              ? "Desmarcar visíveis"
              : "Selecionar todos os visíveis"}
          </button>
          <button
            type="button"
            onClick={() => void selectAllResults()}
            disabled={selectingAll || !total}
            className="h-11 rounded-xl border px-4 font-bold disabled:opacity-40"
          >
            {selectingAll
              ? "Selecionando..."
              : `Selecionar todos os ${total} resultados`}
          </button>
          <button
            type="button"
            disabled={!items.length}
            onClick={() => communicate(items.map((item) => item.id))}
            className="h-11 rounded-xl bg-violet-700 px-4 font-bold text-white disabled:opacity-40"
          >
            📢 Comunicar todos filtrados
          </button>
        </section>
        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>
        )}
        <div className="mt-5 hidden overflow-auto rounded-2xl bg-white md:block">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b text-zinc-500">
                <th className="w-12 p-4">
                  <input
                    aria-label="Selecionar todos os contatos visíveis"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th>Contato</th>
                <th>Localização</th>
                <th>Status</th>
                <th>Compras</th>
                <th>Valor gasto</th>
                <th>Última compra</th>
                <th>Etiquetas</th>
              </tr>
            </thead>
            <tbody>
              {items.map((contact) => (
                <tr key={contact.id} className="border-b">
                  <td className="p-4">
                    <input
                      aria-label={`Selecionar ${contact.name}`}
                      type="checkbox"
                      checked={selectedSet.has(contact.id)}
                      onChange={() => toggle(contact.id)}
                    />
                  </td>
                  <td>
                    <Link
                      href={`/dashboard/crm/contatos/${contact.id}`}
                      className="font-bold text-violet-700"
                    >
                      {contact.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {contact.email} · {contact.phone}
                    </p>
                  </td>
                  <td>
                    {[contact.city, contact.state]
                      .filter(Boolean)
                      .join(" - ") || "—"}
                  </td>
                  <td>{statusLabel[contact.status] || contact.status}</td>
                  <td>{contact.totalPurchases}</td>
                  <td>{money(contact.totalSpent)}</td>
                  <td>
                    {contact.lastPurchaseAt
                      ? new Date(contact.lastPurchaseAt).toLocaleDateString(
                          "pt-BR",
                        )
                      : "—"}
                  </td>
                  <td>
                    {contact.tags?.map(({ tag }) => (
                      <span
                        key={tag.id}
                        className="mr-1 rounded-full bg-violet-50 px-2 py-1 text-xs text-violet-700"
                      >
                        {tag.name}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <Empty />}
        </div>
        <div className="mt-5 grid gap-3 md:hidden">
          {items.map((contact) => (
            <article
              key={contact.id}
              className="rounded-2xl bg-white p-5 shadow-sm"
            >
              <div className="flex justify-between gap-2">
                <label className="flex min-w-0 items-center gap-3">
                  <input
                    aria-label={`Selecionar ${contact.name}`}
                    type="checkbox"
                    checked={selectedSet.has(contact.id)}
                    onChange={() => toggle(contact.id)}
                  />
                  <Link
                    href={`/dashboard/crm/contatos/${contact.id}`}
                    className="truncate font-bold text-violet-700"
                  >
                    {contact.name}
                  </Link>
                </label>
                <span className="text-xs font-bold text-violet-700">
                  {statusLabel[contact.status] || contact.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                {contact.email} · {contact.phone}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <span>
                  Compras: <b>{contact.totalPurchases}</b>
                </span>
                <span>
                  Gasto: <b>{money(contact.totalSpent)}</b>
                </span>
              </div>
            </article>
          ))}
          {!items.length && <Empty />}
        </div>
        {pages > 1 && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              disabled={page === 1}
              onClick={() => setPage((value) => value - 1)}
              className="rounded-xl border bg-white px-4 py-2 font-bold disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-sm">
              Página {page} de {pages}
            </span>
            <button
              disabled={page === pages}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-xl border bg-white px-4 py-2 font-bold disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        )}
        {selected.length > 0 && (
          <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-5xl rounded-2xl border border-violet-200 bg-white p-3 shadow-2xl md:bottom-6 md:flex md:items-center md:gap-3">
            <div className="mb-3 flex items-center justify-between md:mb-0 md:mr-auto">
              <strong>{selected.length} comprador(es) selecionado(s)</strong>
              <button
                className="rounded-lg p-2 md:hidden"
                onClick={() => setSelected([])}
                aria-label="Remover seleção"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                onClick={() => communicate()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white"
              >
                <MessageCircle size={17} />
                Enviar mensagem
              </button>
              <select
                aria-label="Etiqueta para adicionar"
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                className="min-h-11 rounded-xl border px-3 text-sm"
              >
                <option value="">Adicionar etiqueta</option>
                {allTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!bulkTag || bulkBusy}
                onClick={() => void applyTag()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold disabled:opacity-40"
              >
                <Tag size={17} />
                Aplicar
              </button>
              <button
                onClick={() => void exportSelected()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold"
              >
                <Download size={17} />
                Exportar
              </button>
              <select
                aria-label="Segmento de destino"
                value={bulkSegment}
                onChange={(e) => setBulkSegment(e.target.value)}
                className="min-h-11 rounded-xl border px-3 text-sm"
              >
                <option value="">Mover para segmento</option>
                {segmentRows.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
              <button
                disabled={!bulkSegment || bulkBusy}
                onClick={() => void moveToSegment()}
                className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-40"
              >
                Mover
              </button>
              <button
                disabled={bulkBusy}
                onClick={() => void createBulkTask()}
                className="min-h-11 rounded-xl border px-4 text-sm font-bold disabled:opacity-40"
              >
                Criar tarefa
              </button>
              <button
                onClick={() => setSelected([])}
                className="hidden min-h-11 rounded-xl px-4 text-sm font-bold text-zinc-500 md:block"
              >
                Remover seleção
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function Empty() {
  return (
    <p className="p-10 text-center text-zinc-500">Nenhum contato encontrado.</p>
  );
}
