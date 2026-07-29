"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Tags, X } from "lucide-react";
import CrmNav from "@/components/crm/CrmNav";
import {
  calculateSegment,
  createSegment,
  createTag,
  deleteSegment,
  deleteTag,
  segments,
  previewSegment,
  tags,
  updateTag,
  updateSegment,
  type CrmTag,
  type Segment,
} from "@/lib/crm/client";

const automatic = [
  "Todos os contatos",
  "Leads",
  "Clientes",
  "VIP",
  "Reservas abandonadas",
  "Pagamento pendente",
  "Compradores dos últimos 7 dias",
  "Compradores dos últimos 30 dias",
];

export default function Segmentos() {
  const query = useSearchParams();
  const [items, setItems] = useState<Segment[]>([]);
  const [tagItems, setTagItems] = useState<CrmTag[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [segmentOpen, setSegmentOpen] = useState(query.get("action") === "new");
  const [editingId, setEditingId] = useState("");
  const [step, setStep] = useState(1);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [minSpent, setMinSpent] = useState("");
  const [minPurchases, setMinPurchases] = useState("");
  const [inactiveDays, setInactiveDays] = useState("");
  const [tagName, setTagName] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () => {
    const [segmentRows, tagRows] = await Promise.all([segments(), tags()]);
    setItems(segmentRows);
    setTagItems(tagRows);
  };
  useEffect(() => {
    void load();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const rules = Object.fromEntries(
      Object.entries({
        status,
        city,
        minSpent: minSpent ? Number(minSpent) : undefined,
        minPurchases: minPurchases ? Number(minPurchases) : undefined,
        inactiveDays: inactiveDays ? Number(inactiveDays) : undefined,
      }).filter(([, value]) => value !== "" && value !== undefined),
    );
    const body = {
      name,
      description: description || undefined,
      type: "DYNAMIC",
      isDynamic: true,
      rules,
    };
    if (editingId) await updateSegment(editingId, body);
    else await createSegment(body);
    setName("");
    setDescription("");
    setEditingId("");
    setSegmentOpen(false);
    setStep(1);
    setMessage(editingId ? "Segmento atualizado." : "Segmento criado.");
    await load();
  }
  function currentRules() {
    return Object.fromEntries(
      Object.entries({
        status,
        city,
        minSpent: minSpent ? Number(minSpent) : undefined,
        minPurchases: minPurchases ? Number(minPurchases) : undefined,
        inactiveDays: inactiveDays ? Number(inactiveDays) : undefined,
      }).filter(([, value]) => value !== "" && value !== undefined),
    );
  }
  async function goToPreview() {
    setPreviewing(true);
    try {
      const result = await previewSegment({
        name: name || "Prévia",
        type: "DYNAMIC",
        isDynamic: true,
        rules: currentRules(),
      });
      setPreviewCount(result.count);
      setStep(3);
    } finally {
      setPreviewing(false);
    }
  }
  function editSegment(segment: Segment) {
    const rules = segment.rules || {};
    setEditingId(segment.id);
    setName(segment.name);
    setDescription(segment.description || "");
    setStatus(String(rules.status || ""));
    setCity(String(rules.city || ""));
    setMinSpent(rules.minSpent == null ? "" : String(rules.minSpent));
    setMinPurchases(
      rules.minPurchases == null ? "" : String(rules.minPurchases),
    );
    setInactiveDays(
      rules.inactiveDays == null ? "" : String(rules.inactiveDays),
    );
    setStep(1);
    setSegmentOpen(true);
  }
  async function submitTag(event: FormEvent) {
    event.preventDefault();
    await createTag({ name: tagName, color: "#7c3aed" });
    setTagName("");
    setTagOpen(false);
    setMessage("Etiqueta criada.");
    await load();
  }
  async function editTag(tag: CrmTag) {
    const name = window.prompt("Novo nome da etiqueta", tag.name)?.trim();
    if (!name || name === tag.name) return;
    await updateTag(tag.id, { name, color: tag.color });
    setMessage("Etiqueta atualizada.");
    await load();
  }
  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-100 p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-sm font-bold uppercase text-violet-700">
          CRM Inteligente
        </p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">Segmentos</h1>
            <p className="text-sm text-zinc-500">
              Públicos dinâmicos que se atualizam conforme as regras.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingId("");
              setName("");
              setDescription("");
              setStep(1);
              setSegmentOpen(true);
            }}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 font-bold text-white sm:w-auto"
          >
            <Plus size={18} />
            Novo segmento
          </button>
        </div>
        <div className="mt-4">
          <CrmNav />
        </div>
        {message && (
          <p className="mt-4 rounded-xl bg-green-50 p-3 text-green-700">
            {message}
          </p>
        )}
        <section className="mt-5">
          <h2 className="text-lg font-black">Segmentos automáticos</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
            {automatic.map((label) => (
              <span
                key={label}
                className="rounded-2xl border bg-white p-3 text-sm font-bold text-zinc-600"
              >
                {label}
              </span>
            ))}
          </div>
        </section>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <section>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {items.map((segment) => (
                <article key={segment.id} className="rounded-2xl bg-white p-5">
                  <div className="flex justify-between gap-3">
                    <div>
                      <strong>{segment.name}</strong>
                      <p className="text-sm text-zinc-500">
                        {segment.contactCount} contatos ·{" "}
                        {segment.type === "DYNAMIC" ? "Dinâmico" : "Manual"}
                      </p>
                    </div>
                    <button
                      onClick={() => deleteSegment(segment.id).then(load)}
                      className="text-sm font-bold text-red-600"
                    >
                      Excluir
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => editSegment(segment)}
                      className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"
                    >
                      <Pencil size={15} />
                      Editar
                    </button>
                    <button
                      onClick={() => calculateSegment(segment.id).then(load)}
                      className="rounded-xl border px-3 py-2 text-sm font-bold"
                    >
                      Recalcular
                    </button>
                    <Link
                      href={`/dashboard/comunicacao?segmentId=${segment.id}`}
                      className="rounded-xl bg-violet-700 px-3 py-2 text-sm font-bold text-white"
                    >
                      Comunicar
                    </Link>
                  </div>
                </article>
              ))}
              {!items.length && (
                <p className="rounded-2xl bg-white p-8 text-center text-zinc-500">
                  Nenhum segmento personalizado.
                </p>
              )}
            </div>
          </section>
          <section className="rounded-3xl bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <Tags size={19} />
                Etiquetas
              </h2>
              <button
                onClick={() => setTagOpen(true)}
                className="rounded-xl border px-3 py-2 text-sm font-bold text-violet-700"
              >
                + Nova etiqueta
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {tagItems.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between rounded-xl bg-zinc-50 p-3"
                >
                  <span className="font-bold">
                    {tag.name}{" "}
                    <small className="text-zinc-400">
                      ({tag._count?.contacts || 0})
                    </small>
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => editTag(tag)}
                      className="text-sm font-bold text-violet-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteTag(tag.id).then(load)}
                      className="text-sm font-bold text-red-600"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        {segmentOpen && (
          <div
            className="fixed inset-0 z-[90] overflow-y-auto bg-black/50 p-3"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={submit}
              className="relative mx-auto my-4 max-w-2xl rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
            >
              <button
                type="button"
                onClick={() => setSegmentOpen(false)}
                className="absolute right-4 top-4 rounded-xl p-2"
                aria-label="Fechar"
              >
                <X />
              </button>
              <p className="text-xs font-black uppercase text-violet-600">
                Etapa {step} de 4
              </p>
              <h2 className="mt-1 text-2xl font-black">
                {editingId ? "Editar segmento" : "Novo segmento"}
              </h2>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full bg-violet-600 transition-all"
                  style={{ width: `${(step / 4) * 100}%` }}
                />
              </div>
              {step === 1 && (
                <div className="mt-6 grid gap-3">
                  <label className="grid gap-1 text-sm font-bold">
                    Nome
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-11 rounded-xl border px-3"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-bold">
                    Descrição opcional
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-24 rounded-xl border p-3"
                    />
                  </label>
                </div>
              )}
              {step === 2 && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-11 rounded-xl border px-3"
                  >
                    <option value="">Qualquer status</option>
                    <option value="LEAD">Lead</option>
                    <option value="CUSTOMER">Cliente</option>
                    <option value="VIP">VIP</option>
                    <option value="INACTIVE">Inativo</option>
                  </select>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Cidade"
                    className="h-11 rounded-xl border px-3"
                  />
                  <input
                    type="number"
                    min="0"
                    value={minSpent}
                    onChange={(e) => setMinSpent(e.target.value)}
                    placeholder="Gasto mínimo"
                    className="h-11 rounded-xl border px-3"
                  />
                  <input
                    type="number"
                    min="0"
                    value={minPurchases}
                    onChange={(e) => setMinPurchases(e.target.value)}
                    placeholder="Compras mínimas"
                    className="h-11 rounded-xl border px-3"
                  />
                  <input
                    type="number"
                    min="1"
                    value={inactiveDays}
                    onChange={(e) => setInactiveDays(e.target.value)}
                    placeholder="Sem comprar há X dias"
                    className="h-11 rounded-xl border px-3"
                  />
                </div>
              )}
              {step === 3 && (
                <div className="mt-6 rounded-2xl bg-violet-50 p-6 text-center">
                  <p className="text-sm font-bold text-violet-700">
                    Prévia calculada no banco
                  </p>
                  <strong className="mt-2 block text-4xl">
                    {previewCount ?? 0}
                  </strong>
                  <p className="mt-1 text-sm text-zinc-600">
                    contato(s) atendem às regras atuais.
                  </p>
                </div>
              )}
              {step === 4 && (
                <div className="mt-6 rounded-2xl border p-5">
                  <strong>Confirmar segmento</strong>
                  <p className="mt-2 text-sm text-zinc-600">
                    {name} será salvo como segmento dinâmico com{" "}
                    {previewCount ?? 0} contato(s) na contagem inicial.
                  </p>
                </div>
              )}
              <div className="mt-6 flex gap-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((value) => value - 1)}
                    className="min-h-11 flex-1 rounded-xl border font-bold"
                  >
                    Voltar
                  </button>
                )}
                {step === 1 ? (
                  <button
                    type="button"
                    disabled={!name.trim()}
                    onClick={() => setStep(2)}
                    className="min-h-11 flex-1 rounded-xl bg-violet-700 font-bold text-white disabled:opacity-40"
                  >
                    Continuar
                  </button>
                ) : step === 2 ? (
                  <button
                    type="button"
                    disabled={previewing}
                    onClick={() => void goToPreview()}
                    className="min-h-11 flex-1 rounded-xl bg-violet-700 font-bold text-white"
                  >
                    {previewing ? "Calculando..." : "Calcular prévia"}
                  </button>
                ) : step === 3 ? (
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="min-h-11 flex-1 rounded-xl bg-violet-700 font-bold text-white"
                  >
                    Continuar
                  </button>
                ) : (
                  <button className="min-h-11 flex-1 rounded-xl bg-violet-700 font-bold text-white">
                    {editingId ? "Salvar alterações" : "Criar segmento"}
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
        {tagOpen && (
          <div
            className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
          >
            <form
              onSubmit={submitTag}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex justify-between">
                <h2 className="text-xl font-black">Nova etiqueta</h2>
                <button
                  type="button"
                  onClick={() => setTagOpen(false)}
                  aria-label="Fechar"
                >
                  <X />
                </button>
              </div>
              <label className="mt-5 grid gap-1 text-sm font-bold">
                Nome
                <input
                  required
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="h-11 rounded-xl border px-3"
                />
              </label>
              <button className="mt-5 min-h-11 w-full rounded-xl bg-violet-700 font-bold text-white">
                Criar etiqueta
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
