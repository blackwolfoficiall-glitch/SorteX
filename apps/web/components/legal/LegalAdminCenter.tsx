"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  Copy,
  Download,
  Eye,
  FileClock,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  adminLegalDocument,
  adminLegalDocuments,
  deleteLegalDocument,
  legalAction,
  legalHistory,
  legalUsers,
  saveLegalDocument,
  type LegalDocument,
} from "@/lib/legal/client";
const empty = {
  title: "Título",
  subtitle: "Subtítulo",
  slug: "novo-documento",
  category: "GERAL",
  content: {
    html: "<p>Este conteúdo será definido posteriormente pela equipe jurídica da SorteX.</p>",
  },
  required: false,
  changeSummary: "",
};
type Draft = {
  title: string;
  subtitle: string | null;
  slug: string;
  category: string;
  content: { html?: string; blocks?: Array<{ text?: string }> };
  required: boolean;
  changeSummary: string | null;
  [key: string]: unknown;
};
type PanelRow = Record<string, unknown> & { id?: string; version?: number };
export default function LegalAdminCenter() {
  const [list, setList] = useState<LegalDocument[]>([]),
    [selected, setSelected] = useState<LegalDocument | null>(null),
    [draft, setDraft] = useState<Draft>(empty),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [dirty, setDirty] = useState(false),
    [preview, setPreview] = useState(false),
    [device, setDevice] = useState("desktop"),
    [panel, setPanel] = useState<{ title: string; rows: PanelRow[] } | null>(
      null,
    ),
    [feedback, setFeedback] = useState("");
  const editor = useRef<HTMLDivElement>(null),
    upload = useRef<HTMLInputElement>(null);
  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    return adminLegalDocuments(q.size ? `?${q}` : "")
      .then(setList)
      .catch(() => setFeedback("Não foi possível carregar os documentos."))
      .finally(() => setLoading(false));
  }, [search, status]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 200);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!dirty || !selected) return;
    const timer = setTimeout(() => {
      setSaving(true);
      saveLegalDocument(selected.id, draft)
        .then((saved) => {
          setSelected(saved);
          setDraft({ ...saved, content: saved.content });
          setDirty(false);
          setFeedback("Rascunho salvo automaticamente.");
        })
        .catch(() => setFeedback("Não foi possível salvar automaticamente."))
        .finally(() => setSaving(false));
    }, 1200);
    return () => clearTimeout(timer);
  }, [dirty, selected, draft]);
  async function open(item: LegalDocument) {
    const full = await adminLegalDocument(item.id);
    setSelected(full);
    setDraft(toDraft(full));
    setDirty(false);
  }
  function change(key: string, value: unknown) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }
  async function persist() {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await saveLegalDocument(selected?.id, draft);
      setSelected(saved);
      setDraft(toDraft(saved));
      setDirty(false);
      setFeedback("Documento salvo.");
      await load();
    } catch {
      setFeedback("Não foi possível salvar o documento.");
    } finally {
      setSaving(false);
    }
  }
  async function action(name: string) {
    if (!selected) return;
    if (name === "delete") {
      if (!confirm("Excluir este documento?")) return;
      await deleteLegalDocument(selected.id);
      setSelected(null);
      setDraft(empty);
      await load();
      return;
    }
    if (name === "history") {
      setPanel({
        title: "Histórico de versões",
        rows: (await legalHistory(selected.id)).map((row) => ({
          ...row,
        })) as PanelRow[],
      });
      return;
    }
    if (name === "acceptances" || name === "pending-users") {
      setPanel({
        title:
          name === "acceptances"
            ? "Usuários que aceitaram"
            : "Usuários pendentes",
        rows: (await legalUsers(selected.id, name)) as PanelRow[],
      });
      return;
    }
    const updated = await legalAction(
      selected.id,
      name,
      name === "publish" ? { changeSummary: draft.changeSummary } : {},
    );
    setSelected(updated);
    setDraft(toDraft(updated));
    await load();
    setFeedback("Ação concluída.");
  }
  function command(name: string, value?: string) {
    editor.current?.focus();
    document.execCommand(name, false, value);
    change("content", { html: editor.current?.innerHTML || "" });
  }
  function insert(kind: string) {
    const value = prompt(
      kind === "createLink"
        ? "Informe o link:"
        : kind === "insertImage"
          ? "Informe a URL da imagem:"
          : "Conteúdo:",
    );
    if (!value) return;
    if (kind === "table")
      command(
        "insertHTML",
        `<table><tbody><tr><td>${escapeHtml(value)}</td><td>Texto</td></tr></tbody></table>`,
      );
    else command(kind, value);
  }
  async function uploadAsset(file?: File) {
    if (!file) return;
    const form = new FormData();
    form.set("file", file);
    setSaving(true);
    try {
      const response = await fetch("/api/legal/admin/assets", {
        method: "POST",
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      command("insertImage", payload.url);
      setFeedback("Imagem enviada e inserida no documento.");
    } catch (cause) {
      setFeedback(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enviar a imagem.",
      );
    } finally {
      setSaving(false);
      if (upload.current) upload.current.value = "";
    }
  }
  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
              Configurações
            </p>
            <h1 className="mt-2 text-3xl font-black">Central Jurídica</h1>
            <p className="mt-2 text-zinc-500">
              Documentos, versões, publicação e aceites da plataforma.
            </p>
          </div>
          <button
            onClick={() => {
              setSelected(null);
              setDraft({ ...empty, slug: `novo-documento-${Date.now()}` });
              setDirty(false);
            }}
            className="rounded-xl bg-violet-700 px-5 py-3 font-black text-white"
          >
            <Plus className="mr-2 inline" size={18} />
            Criar documento
          </button>
        </div>
        <div className="mt-6 grid gap-5 xl:grid-cols-[340px_1fr]">
          <aside className="rounded-3xl border bg-white p-4">
            <div className="relative">
              <Search
                className="absolute left-3 top-3.5 text-zinc-400"
                size={17}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pesquisar"
                className="min-h-11 w-full rounded-xl border pl-9 pr-3"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border px-3"
            >
              <option value="">Todos os status</option>
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="ARCHIVED">Arquivado</option>
            </select>
            <div className="mt-3 max-h-[68vh] space-y-2 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-sm">Carregando…</p>
              ) : (
                list.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void open(item)}
                    className={`w-full rounded-xl border p-3 text-left ${selected?.id === item.id ? "border-violet-600 bg-violet-50" : "hover:bg-zinc-50"}`}
                  >
                    <strong className="block text-sm">{item.title}</strong>
                    <span className="mt-1 block text-xs text-zinc-500">
                      v{item.version} · {label(item.status)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>
          <section className="rounded-3xl border bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                aria-live="polite"
                className="text-xs font-bold text-zinc-500"
              >
                {saving
                  ? "Salvando…"
                  : dirty
                    ? "Alterações não salvas"
                    : feedback || "Tudo salvo"}
              </span>
              <div className="flex flex-wrap gap-2">
                <Small
                  icon={<Eye />}
                  text="Preview"
                  onClick={() => setPreview(true)}
                />
                <Small
                  icon={<Save />}
                  text="Salvar"
                  onClick={() => void persist()}
                  disabled={saving}
                />
                {selected && (
                  <>
                    <Small
                      icon={<Send />}
                      text="Publicar"
                      onClick={() => void action("publish")}
                    />
                    <Small
                      icon={<Copy />}
                      text="Duplicar"
                      onClick={() => void action("duplicate")}
                    />
                    <Small
                      icon={<Archive />}
                      text="Arquivar"
                      onClick={() => void action("archive")}
                    />
                  </>
                )}
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Título">
                <input
                  value={draft.title || ""}
                  onChange={(e) => change("title", e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Slug">
                <input
                  value={draft.slug || ""}
                  onChange={(e) =>
                    change(
                      "slug",
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                    )
                  }
                  className="input"
                />
              </Field>
              <Field label="Subtítulo">
                <input
                  value={draft.subtitle || ""}
                  onChange={(e) => change("subtitle", e.target.value)}
                  className="input"
                />
              </Field>
              <Field label="Categoria">
                <input
                  value={draft.category || ""}
                  onChange={(e) => change("category", e.target.value)}
                  className="input"
                />
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={Boolean(draft.required)}
                onChange={(e) => change("required", e.target.checked)}
              />
              Aceite obrigatório
            </label>
            <div className="mt-5 rounded-2xl border">
              <div className="flex flex-wrap gap-1 border-b bg-zinc-50 p-2">
                {[
                  ["bold", "B"],
                  ["italic", "I"],
                  ["underline", "U"],
                  ["insertUnorderedList", "Lista"],
                  ["insertOrderedList", "1. Lista"],
                  ["formatBlock", "Citação"],
                  ["insertHorizontalRule", "Separador"],
                  ["formatBlock", "Código"],
                ].map(([cmd, text], index) => (
                  <button
                    key={`${cmd}-${index}`}
                    onClick={() =>
                      command(
                        cmd,
                        cmd === "formatBlock"
                          ? text === "Código"
                            ? "pre"
                            : "blockquote"
                          : undefined,
                      )
                    }
                    className="rounded-lg border bg-white px-3 py-2 text-xs font-bold"
                  >
                    {text}
                  </button>
                ))}
                <button onClick={() => insert("createLink")} className="tool">
                  Link
                </button>
                <button
                  onClick={() => upload.current?.click()}
                  className="tool"
                >
                  Enviar imagem
                </button>
                <input
                  ref={upload}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) =>
                    void uploadAsset(event.target.files?.[0])
                  }
                />
                <button onClick={() => insert("table")} className="tool">
                  Tabela
                </button>
                <button
                  onClick={() => command("formatBlock", "h3")}
                  className="tool"
                >
                  Destaque
                </button>
              </div>
              <div
                ref={editor}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) =>
                  change("content", { html: e.currentTarget.innerHTML })
                }
                dangerouslySetInnerHTML={{
                  __html:
                    draft.content?.html ||
                    draft.content?.blocks
                      ?.map((block) => `<p>${escapeHtml(block.text || "")}</p>`)
                      .join("") ||
                    "",
                }}
                className="legal-content min-h-80 p-5 outline-none"
              />
            </div>
            <Field label="Resumo das alterações">
              <textarea
                value={draft.changeSummary || ""}
                onChange={(e) => change("changeSummary", e.target.value)}
                className="input mt-2 min-h-24"
              />
            </Field>
            {selected && (
              <div className="mt-5 flex flex-wrap gap-2">
                <Small
                  icon={<FileClock />}
                  text="Histórico"
                  onClick={() => void action("history")}
                />
                <Small
                  icon={<Undo2 />}
                  text="Aceites"
                  onClick={() => void action("acceptances")}
                />
                <Small
                  text="Pendentes"
                  onClick={() => void action("pending-users")}
                />
                <Small
                  icon={<Download />}
                  text="Exportar PDF"
                  onClick={() =>
                    window.open(
                      `/api/legal/admin/${selected.id}/pdf`,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                />
                <Small
                  icon={<Trash2 />}
                  text="Excluir"
                  onClick={() => void action("delete")}
                />
              </div>
            )}
          </section>
        </div>
      </div>
      {preview && (
        <Preview
          title={draft.title}
          subtitle={draft.subtitle || ""}
          html={draft.content?.html || ""}
          device={device}
          setDevice={setDevice}
          close={() => setPreview(false)}
        />
      )}{" "}
      {panel && (
        <Panel
          {...panel}
          close={() => setPanel(null)}
          restore={
            selected
              ? (version) =>
                  void legalAction(selected.id, "restore", { version }).then(
                    (updated) => {
                      setSelected(updated);
                      setDraft(toDraft(updated));
                      setPanel(null);
                    },
                  )
              : undefined
          }
        />
      )}
    </main>
  );
}
function Small({
  text,
  onClick,
  icon,
  disabled,
}: {
  text: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-10 rounded-xl border px-3 text-xs font-black disabled:opacity-50"
    >
      {icon && (
        <span className="mr-1 inline [&_svg]:inline [&_svg]:h-4 [&_svg]:w-4">
          {icon}
        </span>
      )}
      {text}
    </button>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-bold">
      {label}
      {children}
    </label>
  );
}
function Preview({
  title,
  subtitle,
  html,
  device,
  setDevice,
  close,
}: {
  title: string;
  subtitle: string;
  html: string;
  device: string;
  setDevice: (v: string) => void;
  close: () => void;
}) {
  const width = device === "mobile" ? 390 : device === "tablet" ? 768 : 1100;
  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-black/60 p-4">
      <div className="mx-auto max-w-6xl rounded-3xl bg-zinc-100 p-4">
        <div className="flex justify-between">
          <div className="flex gap-2">
            {["mobile", "tablet", "desktop"].map((item) => (
              <button
                key={item}
                onClick={() => setDevice(item)}
                className={`rounded-xl px-4 py-2 text-sm font-bold ${device === item ? "bg-violet-700 text-white" : "bg-white"}`}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            onClick={close}
            className="rounded-xl bg-white px-4 font-bold"
          >
            Fechar
          </button>
        </div>
        <article
          style={{ maxWidth: width }}
          className="legal-content mx-auto mt-4 min-h-[70vh] bg-white p-8 shadow"
        >
          <h1 className="text-4xl font-black">{title}</h1>
          <p className="mt-2 text-zinc-500">{subtitle}</p>
          <div className="mt-8" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </div>
    </div>
  );
}
function Panel({
  title,
  rows,
  close,
  restore,
}: {
  title: string;
  rows: PanelRow[];
  close: () => void;
  restore?: (version: number) => void;
}) {
  return (
    <div className="fixed inset-0 z-[110] bg-black/50 p-4">
      <div className="mx-auto max-h-[90vh] max-w-3xl overflow-auto rounded-3xl bg-white p-6">
        <div className="flex justify-between">
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={close}>Fechar</button>
        </div>
        <div className="mt-5 space-y-2">
          {rows.map((row, index) => (
            <div
              key={row.id || index}
              className="rounded-xl border p-4 text-sm"
            >
              <pre className="whitespace-pre-wrap font-sans">
                {JSON.stringify(row, null, 2)}
              </pre>
              {restore && row.version && (
                <button
                  onClick={() => restore(Number(row.version))}
                  className="mt-2 font-bold text-violet-700"
                >
                  Restaurar esta versão
                </button>
              )}
            </div>
          ))}
          {!rows.length && <p>Nenhum registro encontrado.</p>}
        </div>
      </div>
    </div>
  );
}
function toDraft(value: LegalDocument): Draft {
  return {
    title: value.title,
    subtitle: value.subtitle,
    slug: value.slug,
    category: value.category,
    content: value.content || { html: "" },
    required: value.required,
    changeSummary: value.changeSummary,
  };
}
function label(value: string) {
  return value === "PUBLISHED"
    ? "Publicado"
    : value === "ARCHIVED"
      ? "Arquivado"
      : "Rascunho";
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ]!,
  );
}
