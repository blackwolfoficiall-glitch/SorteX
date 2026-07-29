"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import CrmNav from "@/components/crm/CrmNav";
import {
  addContactTag,
  addNote,
  contact,
  createTask,
  removeContactTag,
  setContactStatus,
  tags,
  type CrmTag,
} from "@/lib/crm/client";

export default function Perfil() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>();
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [note, setNote] = useState("");
  const [tagId, setTagId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [message, setMessage] = useState("");
  const load = async () => {
    const [next, tagRows] = await Promise.all([contact(id), tags()]);
    setData(next);
    setAllTags(tagRows);
  };
  useEffect(() => {
    void load();
  }, [id]);
  async function submitNote(event: FormEvent) {
    event.preventDefault();
    await addNote(id, note);
    setNote("");
    setMessage("Nota adicionada.");
    await load();
  }
  async function applyTag() {
    if (!tagId) return;
    await addContactTag(id, tagId);
    setTagId("");
    await load();
  }
  async function addTask(event: FormEvent) {
    event.preventDefault();
    await createTask({ title: taskTitle, contactId: id, priority: "MEDIUM" });
    setTaskTitle("");
    setMessage("Tarefa criada.");
    await load();
  }
  if (!data) return <p className="p-10">Carregando perfil...</p>;
  const purchases = data.user?.purchases || [];
  const approved = purchases.filter((purchase: any) =>
    purchase.payments.some((payment: any) => payment.status === "APPROVED"),
  );
  const average = approved.length ? data.totalSpent / approved.length : 0;
  return (
    <main className="min-h-screen bg-zinc-100 p-4 md:p-10">
      <div className="mx-auto max-w-7xl">
        <CrmNav />
        {message && (
          <p className="mt-4 rounded-xl bg-green-50 p-3 text-green-700">
            {message}
          </p>
        )}
        <section className="mt-5 rounded-3xl bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-violet-700">Perfil 360º</p>
              <h1 className="text-3xl font-black">{data.name}</h1>
              <p className="text-zinc-500">
                {data.email} · {data.phone} ·{" "}
                {[data.city, data.state].filter(Boolean).join(" - ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setContactStatus(id, "VIP").then(load)}
                className="rounded-xl bg-amber-100 px-4 py-2 font-bold text-amber-800"
              >
                Marcar como VIP
              </button>
              <Link
                href={`/dashboard/comunicacao?contactId=${id}`}
                className="rounded-xl bg-violet-700 px-4 py-2 font-bold text-white"
              >
                Abrir comunicação
              </Link>
              <Link
                href={`/dashboard/comunicacao?contactId=${id}&ai=1`}
                className="rounded-xl border border-violet-200 bg-white px-4 py-2 font-bold text-violet-700"
              >
                ✨ Sugerir mensagem
              </Link>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Compras aprovadas" value={approved.length} />
            <Stat label="Total gasto" value={money(data.totalSpent)} />
            <Stat label="Ticket médio" value={money(average)} />
            <Stat
              label="Última atividade"
              value={
                data.lastInteractionAt
                  ? new Date(data.lastInteractionAt).toLocaleDateString("pt-BR")
                  : "—"
              }
            />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <strong className="text-sm">Etiquetas:</strong>
            {data.tags.map(({ tag }: any) => (
              <button
                key={tag.id}
                onClick={() => removeContactTag(id, tag.id).then(load)}
                title="Remover etiqueta"
                className="rounded-full bg-violet-50 px-3 py-1 text-sm font-bold text-violet-700"
              >
                {tag.name} ×
              </button>
            ))}
            <select
              value={tagId}
              onChange={(event) => setTagId(event.target.value)}
              className="h-9 rounded-xl border px-2 text-sm"
            >
              <option value="">Adicionar etiqueta</option>
              {allTags
                .filter(
                  (tag) =>
                    !data.tags.some(
                      (current: any) => current.tag.id === tag.id,
                    ),
                )
                .map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
            </select>
            <button
              onClick={applyTag}
              disabled={!tagId}
              className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>
        </section>
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section className="rounded-3xl bg-white p-6">
            <h2 className="text-lg font-black">Compras, reservas e títulos</h2>
            <div className="mt-3 space-y-3">
              {purchases.map((purchase: any) => (
                <div key={purchase.id} className="rounded-2xl border p-4">
                  <div className="flex justify-between gap-3">
                    <strong>{purchase.campaign.title}</strong>
                    <span className="text-xs font-bold text-violet-700">
                      {translate(purchase.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {purchase.quantity} títulos ·{" "}
                    {money(Number(purchase.total))}
                  </p>
                  <p className="mt-2 break-words text-xs text-zinc-500">
                    Números:{" "}
                    {purchase.tickets
                      .map((ticket: any) => ticket.number)
                      .join(", ") || "—"}
                  </p>
                  <p className="mt-1 text-xs">
                    Pagamentos:{" "}
                    {purchase.payments
                      .map((payment: any) => translate(payment.status))
                      .join(", ") || "Nenhum"}
                  </p>
                </div>
              ))}
              {!purchases.length && <Empty text="Nenhuma compra ou reserva." />}
            </div>
          </section>
          <section className="rounded-3xl bg-white p-6">
            <h2 className="text-lg font-black">Histórico de comunicação</h2>
            <div className="mt-3 space-y-3">
              {data.outboundMessages?.map((item: any) => (
                <div key={item.id} className="rounded-2xl bg-zinc-50 p-4">
                  <div className="flex justify-between">
                    <strong>{translate(item.channel)}</strong>
                    <span className="text-xs font-bold">
                      {translate(item.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm">{item.subject || item.content}</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))}
              {!data.outboundMessages?.length && (
                <Empty text="Nenhuma comunicação registrada." />
              )}
            </div>
          </section>
          <section className="rounded-3xl bg-white p-6">
            <h2 className="font-black">Interações</h2>
            {data.interactions.map((item: any) => (
              <div key={item.id} className="border-b py-3">
                <strong>{item.title}</strong>
                <p className="text-xs text-zinc-500">
                  {new Date(item.occurredAt).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </section>
          <section className="rounded-3xl bg-white p-6">
            <h2 className="font-black">Notas e tarefas</h2>
            <form onSubmit={submitNote}>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                required
                placeholder="Adicionar nota"
                className="mt-3 min-h-20 w-full rounded-xl border p-3"
              />
              <button className="mt-2 rounded-xl bg-violet-700 px-4 py-2 font-bold text-white">
                Adicionar nota
              </button>
            </form>
            <form onSubmit={addTask} className="mt-5 flex gap-2">
              <input
                required
                value={taskTitle}
                onChange={(event) => setTaskTitle(event.target.value)}
                placeholder="Nova tarefa"
                className="h-11 flex-1 rounded-xl border px-3"
              />
              <button className="rounded-xl bg-zinc-900 px-4 font-bold text-white">
                Criar
              </button>
            </form>
            {data.notes.map((item: any) => (
              <p key={item.id} className="mt-3 rounded-xl bg-zinc-50 p-3">
                {item.content}
              </p>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-violet-50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-zinc-400">{text}</p>;
}
function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function translate(value: string) {
  return (
    (
      {
        APPROVED: "Aprovado",
        PENDING: "Pendente",
        AWAITING_PAYMENT: "Aguardando pagamento",
        EXPIRED: "Expirada",
        PAID: "Paga",
        WHATSAPP: "WhatsApp",
        EMAIL: "E-mail",
        SMS: "SMS",
        SKIPPED: "Simulada",
        QUEUED: "Agendada",
        CANCELLED: "Cancelada",
      } as Record<string, string>
    )[value] || value
  );
}
