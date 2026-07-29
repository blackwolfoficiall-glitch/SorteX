"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import CrmNav from "@/components/crm/CrmNav";
import {
  contacts,
  createTask,
  tasks,
  updateTaskStatus,
} from "@/lib/crm/client";

const statusLabel: Record<string, string> = {
  OPEN: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};
const priorityLabel: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export default function Tarefas() {
  const query = useSearchParams();
  const [now] = useState(() => Date.now());
  const [items, setItems] = useState<any[]>([]);
  const [contactRows, setContactRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueAt, setDueAt] = useState("");
  const [contactId, setContactId] = useState("");
  const [filter, setFilter] = useState(query.get("status") || "");
  const load = () =>
    Promise.all([tasks(), contacts("?limit=100")]).then(
      ([taskRows, result]) => {
        setItems(taskRows);
        setContactRows(result.items);
      },
    );
  useEffect(() => {
    void load();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await createTask({
      title,
      description: description || undefined,
      priority,
      dueAt: dueAt || undefined,
      contactId: contactId || undefined,
    });
    setTitle("");
    setDescription("");
    setDueAt("");
    await load();
  }
  const visible = filter
    ? items.filter((item) =>
        filter === "overdue"
          ? item.status !== "COMPLETED" &&
            item.status !== "CANCELLED" &&
            item.dueAt &&
            new Date(item.dueAt).getTime() < now
          : item.status === filter,
      )
    : items;
  return (
    <main className="min-h-screen bg-zinc-100 p-5 md:p-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-black">Tarefas</h1>
        <CrmNav />
        <form
          onSubmit={submit}
          className="mt-5 grid gap-3 rounded-3xl bg-white p-6 md:grid-cols-2"
        >
          <input
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Título"
            className="h-11 rounded-xl border px-3"
          />
          <select
            value={contactId}
            onChange={(event) => setContactId(event.target.value)}
            className="h-11 rounded-xl border px-3"
          >
            <option value="">Sem contato vinculado</option>
            {contactRows.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.name}
              </option>
            ))}
          </select>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Descrição"
            className="min-h-24 rounded-xl border p-3 md:col-span-2"
          />
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="h-11 rounded-xl border px-3"
          >
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="h-11 rounded-xl border px-3"
          />
          <button className="rounded-xl bg-violet-700 px-5 py-3 font-bold text-white md:col-span-2">
            Criar tarefa
          </button>
        </form>
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {[
            ["", "Todas"],
            ["OPEN", "Pendentes"],
            ["IN_PROGRESS", "Em andamento"],
            ["COMPLETED", "Concluídas"],
            ["CANCELLED", "Canceladas"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold ${filter === value ? "bg-violet-700 text-white" : "bg-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {visible.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-5">
              <div className="flex justify-between gap-3">
                <div>
                  <strong>{item.title}</strong>
                  <p className="text-xs text-zinc-500">
                    {priorityLabel[item.priority]} · {statusLabel[item.status]}
                  </p>
                </div>
                {item.contact?.name && (
                  <span className="text-xs font-bold text-violet-700">
                    {item.contact.name}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="mt-3 text-sm text-zinc-600">{item.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {item.status === "OPEN" && (
                  <button
                    onClick={() =>
                      updateTaskStatus(item.id, "IN_PROGRESS").then(load)
                    }
                    className="text-sm font-bold text-violet-700"
                  >
                    Iniciar
                  </button>
                )}
                {item.status !== "COMPLETED" && item.status !== "CANCELLED" && (
                  <button
                    onClick={() =>
                      updateTaskStatus(item.id, "COMPLETED").then(load)
                    }
                    className="text-sm font-bold text-green-700"
                  >
                    Concluir
                  </button>
                )}
                {item.status !== "CANCELLED" && item.status !== "COMPLETED" && (
                  <button
                    onClick={() =>
                      updateTaskStatus(item.id, "CANCELLED").then(load)
                    }
                    className="text-sm font-bold text-red-600"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
