"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { hasAdminPermission } from "@/lib/admin/authorization";

type Mode = "content" | "settings" | "health" | "audit-logs";
type Row = Record<string, unknown> & { id?: string; key?: string };
const details = {
  content: ["Conteúdo", "Banners, avisos e páginas institucionais"],
  settings: [
    "Configurações gerais",
    "Parâmetros persistidos e auditados da plataforma",
  ],
  health: ["Saúde do sistema", "Inconsistências e filas que exigem atenção"],
  "audit-logs": ["Auditoria", "Histórico imutável das ações administrativas"],
} as const;

export default function AdminOperationsCenter({ mode }: { mode: Mode }) {
  const user = useAuthorizedUser();
  const canWrite = Boolean(
    user &&
    hasAdminPermission(
      user,
      mode === "content" ? "CONTENT_WRITE" : "SETTINGS_WRITE",
    ),
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams();
      if (search && mode === "audit-logs") query.set("search", search);
      const response = await api<unknown>(
        `${mode}${query.size ? `?${query}` : ""}`,
      );
      if (Array.isArray(response)) setRows(response);
      else {
        const data = response as Record<string, unknown>;
        if (Array.isArray(data.data)) setRows(data.data as Row[]);
        else
          setRows([
            ...(Array.isArray(data.banners)
              ? (data.banners as Row[]).map((row) => ({
                  ...row,
                  recordType: "banner",
                }))
              : []),
            ...(Array.isArray(data.notices)
              ? (data.notices as Row[]).map((row) => ({
                  ...row,
                  recordType: "notice",
                }))
              : []),
            ...(Array.isArray(data.pages)
              ? (data.pages as Row[]).map((row) => ({
                  ...row,
                  recordType: "page",
                }))
              : []),
            ...(Array.isArray(data.featured) ? (data.featured as Row[]) : []),
          ]);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar esta área.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode, search]);
  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);
  const shown =
    mode === "audit-logs"
      ? rows
      : rows.filter((row) =>
          JSON.stringify(row).toLowerCase().includes(search.toLowerCase()),
        );
  async function editSetting(row?: Row) {
    const key = row?.key
      ? String(row.key)
      : window.prompt("Chave da configuração:");
    if (!key) return;
    const raw = window.prompt(
      "Valor em JSON:",
      JSON.stringify(row?.value ?? {}, null, 2),
    );
    if (!raw) return;
    const reason = window.prompt("Motivo obrigatório da alteração:");
    if (
      !reason ||
      reason.trim().length < 5 ||
      !window.confirm(`Confirma a atualização de ${key}?`)
    )
      return;
    try {
      await api(`settings/${encodeURIComponent(key)}`, {
        method: "POST",
        body: JSON.stringify({
          value: JSON.parse(raw),
          category: String(row?.category ?? "GERAL"),
          description: row?.description,
          isPublic: Boolean(row?.isPublic),
          reason,
        }),
      });
      setNotice("Configuração salva e registrada na auditoria.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Valor JSON inválido ou não aceito.",
      );
    }
  }
  async function createContent() {
    const type = window.prompt("Tipo: banner, aviso ou página")?.toLowerCase();
    const title = window.prompt("Título:");
    const reason = window.prompt("Motivo obrigatório:");
    if (!type || !title || !reason || reason.trim().length < 5) return;
    try {
      if (type === "banner")
        await api("content/banners", {
          method: "POST",
          body: JSON.stringify({ title, isActive: true, reason }),
        });
      else if (type === "aviso")
        await api("content/notices", {
          method: "POST",
          body: JSON.stringify({
            title,
            message: window.prompt("Mensagem:") ?? "",
            isActive: true,
            reason,
          }),
        });
      else
        await api("content/pages", {
          method: "POST",
          body: JSON.stringify({
            slug: title
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/[^a-z0-9]+/g, "-"),
            title,
            type: "INSTITUTIONAL",
            content: window.prompt("Conteúdo:") ?? "",
            isPublished: false,
            reason,
          }),
        });
      setNotice("Conteúdo persistido e auditado.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o conteúdo.",
      );
    }
  }
  async function editContent(row: Row) {
    const title = window.prompt("Título:", String(row.title ?? ""));
    const reason = window.prompt("Motivo obrigatório da alteração:");
    if (
      !title ||
      !reason ||
      reason.trim().length < 5 ||
      !window.confirm("Confirma a alteração do conteúdo?")
    )
      return;
    try {
      if (row.recordType === "banner")
        await api(`content/banners/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            subtitle: row.subtitle,
            imageUrl: row.imageUrl,
            linkUrl: row.linkUrl,
            isActive: row.isActive,
            sortOrder: row.sortOrder,
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            reason,
          }),
        });
      else if (row.recordType === "notice")
        await api(`content/notices/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            message: row.message,
            level: row.level,
            isActive: row.isActive,
            reason,
          }),
        });
      else if (row.recordType === "page")
        await api("content/pages", {
          method: "POST",
          body: JSON.stringify({
            slug: row.slug,
            title,
            type: row.type,
            content: row.content,
            isPublished: row.isPublished,
            reason,
          }),
        });
      setNotice("Conteúdo atualizado e registrado na auditoria.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar o conteúdo.",
      );
    }
  }
  const [title, subtitle] = details[mode];
  return (
    <main className="p-5 pt-20 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
              Administração
            </p>
            <h1 className="mt-2 text-3xl font-black">{title}</h1>
            <p className="mt-1 text-slate-500">{subtitle}</p>
          </div>
          <div className="flex gap-2">
            {canWrite && mode === "settings" && (
              <button
                onClick={() => void editSetting()}
                className="rounded-xl bg-violet-700 px-4 py-3 font-bold text-white"
              >
                <Plus className="mr-2 inline" size={17} />
                Nova configuração
              </button>
            )}
            {canWrite && mode === "content" && (
              <button
                onClick={() => void createContent()}
                className="rounded-xl bg-violet-700 px-4 py-3 font-bold text-white"
              >
                <Plus className="mr-2 inline" size={17} />
                Novo conteúdo
              </button>
            )}
            <button
              onClick={load}
              aria-label="Atualizar"
              className="rounded-xl border bg-white p-3"
            >
              <RefreshCw />
            </button>
          </div>
        </header>
        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-4 text-red-700"
          >
            {error}
            <button onClick={load} className="ml-3 font-bold underline">
              Tentar novamente
            </button>
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="mt-4 rounded-xl bg-emerald-50 p-4 text-emerald-700"
          >
            {notice}
          </div>
        )}
        {mode !== "health" && (
          <label className="relative mt-6 block max-w-xl">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={18}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar"
              className="h-11 w-full rounded-xl border bg-white pl-10 pr-3"
            />
          </label>
        )}
        {loading ? (
          <div className="grid h-64 place-items-center">
            <LoaderCircle className="animate-spin text-violet-600" />
          </div>
        ) : shown.length ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-4">Registro</th>
                  <th>Categoria / entidade</th>
                  <th>Status / ação</th>
                  <th>Atualização</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row, index) => (
                  <tr
                    key={String(row.id ?? row.key ?? index)}
                    className="border-t"
                  >
                    <td className="p-4 font-bold">
                      {String(
                        row.title ?? row.key ?? row.entityId ?? "Registro",
                      )}
                    </td>
                    <td>
                      {String(
                        row.category ?? row.entityType ?? row.severity ?? "—",
                      )}
                    </td>
                    <td>
                      {String(row.status ?? row.action ?? row.count ?? "—")}
                    </td>
                    <td>
                      {row.updatedAt || row.createdAt
                        ? new Date(
                            String(row.updatedAt ?? row.createdAt),
                          ).toLocaleString("pt-BR")
                        : "—"}
                    </td>
                    <td>
                      {mode === "settings" && canWrite ? (
                        <button
                          onClick={() => void editSetting(row)}
                          className="rounded-lg border px-3 py-2 text-xs font-bold"
                        >
                          Editar
                        </button>
                      ) : mode === "content" &&
                        canWrite &&
                        row.recordType !== "featured" ? (
                        <button
                          onClick={() => void editContent(row)}
                          className="rounded-lg border px-3 py-2 text-xs font-bold"
                        >
                          Editar
                        </button>
                      ) : (
                        <ShieldCheck className="text-slate-300" size={18} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border bg-white p-12 text-center text-slate-500">
            Nenhum registro encontrado.
          </div>
        )}
      </div>
    </main>
  );
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/platform/${path}`, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      payload.message ?? "Não foi possível concluir a solicitação.",
    );
  return payload;
}
