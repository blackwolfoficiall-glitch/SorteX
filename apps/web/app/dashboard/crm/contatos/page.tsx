"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, MessageCircle, Tag, X } from "lucide-react";
import { CrmWorkspace, CrmNotice } from "@/components/crm/CrmWorkspace";
import ui from "@/components/crm/crm-workspace-premium.module.css";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
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
  const organizer = useAuthorizedUser();
  return organizer ? <ContactsView key={organizer.id} /> : null;
}

function ContactsView() {
  const router = useRouter();
  const query = useSearchParams();
  const cityMissing = query.get("cityMissing") === "1";
  const [items, setItems] = useState<CrmContact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [segmentRows, setSegmentRows] = useState<Segment[]>([]);
  const [search, setSearch] = useState(query.get("search") || "");
  const [debounced, setDebounced] = useState(query.get("search") || "");
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
  const [listError, setListError] = useState("");
  const [filtersError, setFiltersError] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [filtersRefresh, setFiltersRefresh] = useState(0);
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
      `/dashboard/comunicacao?tab=new&audience=MANUAL&contactIds=${encodeURIComponent(ids.join(","))}`,
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
      setFeedback("Contatos adicionados ao segmento.");
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
      setFeedback("Tarefas criadas.");
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
      setFeedback("Etiqueta aplicada.");
      setRefresh((value) => value + 1);
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
    if (bulkBusy) return;
    setBulkBusy(true);
    setError("");
    try {
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
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Não foi possível exportar os contatos selecionados.");
    } finally {
      setBulkBusy(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    setFiltersError(false);
    Promise.all([getMyCampaigns(), tags(), segments()])
      .then(([c, t, s]) => {
        if (!active) return;
        setCampaigns(c);
        setAllTags(t);
        setSegmentRows(s);
      })
      .catch(() => {
        if (active) setFiltersError(true);
      });
    return () => {
      active = false;
    };
  }, [filtersRefresh]);

  useEffect(() => {
    let active = true;
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
    setLoading(true);
    setListError("");
    contacts(`?${query}`)
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setPages(result.pages || 1);
        setTotal(result.total);
      })
      .catch(() => {
        if (active) setListError("Não foi possível carregar os contatos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    page,
    order,
    debounced,
    status,
    campaignId,
    city,
    cityMissing,
    tagId,
    minSpent,
    refresh,
  ]);
  const listReady = !loading && !listError;
  const label =
    total === 1 ? "1 contato encontrado" : `${total} contatos encontrados`;

  return (
    <CrmWorkspace
      title="Contatos"
      subtitle="Encontre compradores pelo histórico e organize sua lista com etiquetas e segmentos."
      actions={
        <span className={ui.heroCount}>
          {loading || listError ? "Contatos do CRM" : label}
        </span>
      }
    >
      {query.get("action") === "new" && (
        <section className={`sx-premium-surface ${ui.panel}`}>
          <h2 className="sx-premium-section">Adicionar contato ao CRM</h2>
          <p className="sx-premium-muted">
            Os contatos são criados quando o comprador se identifica ou conclui
            o cadastro. Seus dados, consentimento e histórico permanecem
            vinculados à pessoa correta.
          </p>
          <div>
            <Link href="/cadastro/comprador" className="sx-premium-button">
              Abrir cadastro de comprador
            </Link>
          </div>
        </section>
      )}
      <section
        className={`sx-premium-surface ${ui.panel}`}
        aria-labelledby="crm-contact-filter-title"
      >
        <div className={ui.row}>
          <h2 id="crm-contact-filter-title" className="sx-premium-section">
            Filtros de contatos
          </h2>
          {cityMissing && (
            <span className="sx-premium-badge">Sem cidade cadastrada</span>
          )}
        </div>
        <div className={ui.filters}>
          <label className={ui.fieldLabel}>
            Buscar contato
            <input
              className={ui.field}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, telefone ou e-mail"
            />
          </label>
          <label className={ui.fieldLabel}>
            Status
            <select
              className={ui.field}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os status</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.fieldLabel}>
            Campanha
            <select
              className={ui.field}
              value={campaignId}
              onChange={(e) => {
                setCampaignId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as campanhas</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.title}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.fieldLabel}>
            Cidade
            <input
              className={ui.field}
              value={city}
              placeholder="Cidade"
              onChange={(e) => {
                setCity(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className={ui.fieldLabel}>
            Etiqueta
            <select
              className={ui.field}
              value={tagId}
              onChange={(e) => {
                setTagId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas as etiquetas</option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <label className={ui.fieldLabel}>
            Gasto mínimo
            <input
              className={ui.field}
              type="number"
              min="0"
              value={minSpent}
              placeholder="Gasto mínimo"
              onChange={(e) => {
                setMinSpent(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className={ui.fieldLabel}>
            Ordenar por
            <select
              className={ui.field}
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                setPage(1);
              }}
            >
              <option value="recent">Mais recentes</option>
              <option value="spent">Maiores compradores</option>
            </select>
          </label>
        </div>
        {filtersError && (
          <CrmNotice kind="error">
            Algumas opções de filtro não puderam ser carregadas.
            <p>
              <button
                type="button"
                className="sx-premium-button"
                onClick={() => setFiltersRefresh((n) => n + 1)}
              >
                Recarregar opções
              </button>
            </p>
          </CrmNotice>
        )}
        <div className={ui.actions}>
          <button
            type="button"
            className="sx-premium-button"
            onClick={toggleAll}
            disabled={!listReady || !items.length}
          >
            {allVisibleSelected
              ? "Desmarcar visíveis"
              : "Selecionar todos os visíveis"}
          </button>
          <button
            type="button"
            className="sx-premium-button"
            onClick={() => void selectAllResults()}
            disabled={!listReady || selectingAll || !total}
          >
            {selectingAll
              ? "Selecionando..."
              : `Selecionar todos os ${total} resultados`}
          </button>
          <button
            type="button"
            className="sx-premium-button"
            data-variant="ghost"
            disabled={!listReady || !items.length}
            onClick={() => communicate(items.map((item) => item.id))}
          >
            Preparar comunicação dos contatos visíveis
          </button>
        </div>
      </section>
      {error && <CrmNotice kind="error">{error}</CrmNotice>}
      {feedback && <CrmNotice kind="success">{feedback}</CrmNotice>}
      {selected.length > 0 && (
        <section
          className={`sx-premium-surface ${ui.selection}`}
          aria-labelledby="crm-contact-selection"
        >
          <div className={ui.row}>
            <h2
              className="sx-premium-section"
              id="crm-contact-selection"
              aria-live="polite"
            >
              {selected.length} comprador(es) selecionado(s)
            </h2>
            <button
              type="button"
              className="sx-premium-button"
              onClick={() => setSelected([])}
            >
              <X size={16} aria-hidden="true" /> Remover seleção
            </button>
          </div>
          <div className={ui.actions}>
            <button
              type="button"
              className="sx-premium-button"
              data-variant="primary"
              onClick={() => communicate()}
            >
              <MessageCircle size={17} aria-hidden="true" /> Preparar
              comunicação
            </button>
            <button
              type="button"
              className="sx-premium-button"
              disabled={bulkBusy}
              onClick={() => void exportSelected()}
            >
              <Download size={17} aria-hidden="true" /> Exportar
            </button>
            <button
              type="button"
              className="sx-premium-button"
              disabled={bulkBusy}
              onClick={() => void createBulkTask()}
            >
              Criar tarefa
            </button>
          </div>
          <div className={ui.actions}>
            <label className={ui.fieldLabel}>
              Etiqueta para adicionar
              <select
                className={ui.field}
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
              >
                <option value="">Escolher etiqueta</option>
                {allTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="sx-premium-button"
              disabled={!bulkTag || bulkBusy}
              onClick={() => void applyTag()}
            >
              <Tag size={17} aria-hidden="true" /> Aplicar etiqueta
            </button>
            <label className={ui.fieldLabel}>
              Segmento de destino
              <select
                className={ui.field}
                value={bulkSegment}
                onChange={(e) => setBulkSegment(e.target.value)}
              >
                <option value="">Escolher segmento</option>
                {segmentRows.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="sx-premium-button"
              disabled={!bulkSegment || bulkBusy}
              onClick={() => void moveToSegment()}
            >
              Mover para segmento
            </button>
          </div>
        </section>
      )}
      {loading && <CrmNotice>Carregando contatos…</CrmNotice>}
      {listError && (
        <CrmNotice kind="error">
          {listError}
          <p>
            <button
              type="button"
              className="sx-premium-button"
              onClick={() => setRefresh((n) => n + 1)}
            >
              Tentar novamente
            </button>
          </p>
        </CrmNotice>
      )}
      {listReady && !items.length && (
        <p className={ui.empty}>Nenhum contato encontrado.</p>
      )}
      {listReady && items.length > 0 && (
        <>
          <section
            className={`sx-premium-surface ${ui.tableWrap}`}
            aria-label="Tabela de contatos"
          >
            <table className={ui.table}>
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="Selecionar todos os contatos visíveis"
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                    />
                  </th>
                  {[
                    "Contato",
                    "Localização",
                    "Status",
                    "Compras",
                    "Valor gasto",
                    "Última compra",
                    "Etiquetas",
                  ].map((heading) => (
                    <th key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        aria-label={`Selecionar ${item.name}`}
                        type="checkbox"
                        checked={selectedSet.has(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                    </td>
                    <td>
                      <ContactLink item={item} />
                      <p className={ui.label}>{contactChannel(item)}</p>
                    </td>
                    <td>{location(item)}</td>
                    <td>
                      <Status item={item} />
                    </td>
                    <td>{item.totalPurchases}</td>
                    <td>{money(item.totalSpent)}</td>
                    <td>{lastPurchase(item)}</td>
                    <td>
                      <ContactTags item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className={`${ui.cards} ${ui.contactCards}`}>
            {items.map((item) => (
              <article
                key={item.id}
                className={`sx-premium-surface ${ui.panel}`}
              >
                <div className={ui.contactHeader}>
                  <label className={ui.pick}>
                    <input
                      aria-label={`Selecionar ${item.name}`}
                      type="checkbox"
                      checked={selectedSet.has(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                  </label>
                  <div>
                    <ContactLink item={item} />
                    <p className={ui.label}>{contactChannel(item)}</p>
                  </div>
                  <Status item={item} />
                </div>
                <dl className={ui.metricGrid}>
                  <div className={ui.inset}>
                    <dt className={ui.label}>Compras</dt>
                    <dd>
                      <strong>{item.totalPurchases}</strong>
                    </dd>
                  </div>
                  <div className={ui.inset}>
                    <dt className={ui.label}>Valor gasto</dt>
                    <dd>
                      <strong>{money(item.totalSpent)}</strong>
                    </dd>
                  </div>
                  <div className={ui.inset}>
                    <dt className={ui.label}>Localização</dt>
                    <dd>{location(item)}</dd>
                  </div>
                  <div className={ui.inset}>
                    <dt className={ui.label}>Última compra</dt>
                    <dd>{lastPurchase(item)}</dd>
                  </div>
                </dl>
                <ContactTags item={item} />
              </article>
            ))}
          </div>
        </>
      )}
      {listReady && pages > 1 && (
        <nav className={ui.actions} aria-label="Paginação dos contatos">
          <button
            type="button"
            disabled={page === 1}
            className="sx-premium-button"
            onClick={() => setPage((n) => n - 1)}
          >
            Anterior
          </button>
          <span className={ui.label}>
            Página {page} de {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            className="sx-premium-button"
            onClick={() => setPage((n) => n + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </CrmWorkspace>
  );
}

function ContactLink({ item }: { item: CrmContact }) {
  return (
    <Link className={ui.textLink} href={`/dashboard/crm/contatos/${item.id}`}>
      {item.name}
    </Link>
  );
}
function Status({ item }: { item: CrmContact }) {
  return (
    <span className={`sx-premium-badge ${ui.badge}`}>
      {statusLabel[item.status] || item.status}
    </span>
  );
}
function ContactTags({ item }: { item: CrmContact }) {
  return (
    <div className={ui.actions} aria-label="Etiquetas">
      {item.tags?.map(({ tag }) => (
        <span key={tag.id} className="sx-premium-badge">
          {tag.name}
        </span>
      ))}
    </div>
  );
}
function contactChannel(item: CrmContact) {
  return (
    [item.email, item.phone].filter(Boolean).join(" · ") ||
    "Sem canal cadastrado"
  );
}
function location(item: CrmContact) {
  return [item.city, item.state].filter(Boolean).join(" - ") || "—";
}
function lastPurchase(item: CrmContact) {
  return item.lastPurchaseAt
    ? new Date(item.lastPurchaseAt).toLocaleDateString("pt-BR")
    : "—";
}
function money(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
