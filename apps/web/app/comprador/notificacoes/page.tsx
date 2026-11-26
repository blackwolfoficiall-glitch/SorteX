"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getNotifications,
  readAllNotifications,
  readNotification,
} from "@/lib/buyer/client";
import type { BuyerNotification } from "@/lib/buyer/types";

type Mark = { all: true } | { id: string };

export default function Notifications() {
  const [items, setItems] = useState<BuyerNotification[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const active = useRef<symbol | null>(null);

  const update = useCallback(async (mark?: Mark) => {
    if (active.current) return;
    const request = Symbol();
    active.current = request;
    setError("");
    setBusy(true);
    try {
      if (mark) {
        if ("all" in mark) await readAllNotifications();
        else await readNotification(mark.id);
      }
      if (active.current !== request) return;
      const inbox = await getNotifications();
      if (active.current === request) setItems(inbox);
    } catch {
      if (active.current === request) {
        setItems(null);
        setError(
          mark
            ? "Não foi possível confirmar a leitura. Atualize a caixa para conferir."
            : "Não foi possível carregar a caixa de notificações.",
        );
      }
    } finally {
      if (active.current === request) {
        active.current = null;
        setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    void update();
    return () => {
      active.current = null;
    };
  }, [update]);

  return (
    <section aria-busy={busy} className="mx-auto max-w-3xl p-5 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-black">Notificações</h1>
        {!!items?.length && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void update({ all: true })}
            className="text-sm font-bold text-violet-700 disabled:opacity-50"
          >
            Marcar todas como lidas
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-600">
        100 notificações mais recentes da sua conta.
      </p>
      {busy && (
        <p role="status" className="mt-4 text-sm text-zinc-600">
          Atualizando notificações…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="mt-6 space-y-3">
        {items?.map((item) => (
          <li
            key={item.id}
            className={`rounded-2xl border p-4 ${item.readAt ? "bg-white" : "border-violet-200 bg-violet-50"}`}
          >
            <h2 className="font-bold [overflow-wrap:anywhere]">{item.title}</h2>
            <p className="mt-1 text-sm text-zinc-600 [overflow-wrap:anywhere]">
              {item.message}
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              {item.readAt ? "Lida" : "Não lida"} ·{" "}
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString("pt-BR")}
              </time>
            </p>
            {!item.readAt && (
              <button
                type="button"
                disabled={busy}
                aria-label={`Marcar como lida: ${item.title}`}
                onClick={() => void update({ id: item.id })}
                className="mt-3 rounded-lg border border-violet-200 px-3 py-2 text-sm font-bold text-violet-700 disabled:opacity-50"
              >
                Marcar como lida
              </button>
            )}
          </li>
        ))}
      </ul>
      {items?.length === 0 && !busy && (
        <p className="rounded-3xl bg-white p-10 text-center text-zinc-500">
          Nenhuma notificação.
        </p>
      )}
      {!busy && (
        <button
          type="button"
          onClick={() => void update()}
          className="mt-4 text-sm font-bold text-violet-700"
        >
          {error ? "Tentar novamente" : "Atualizar notificações"}
        </button>
      )}
    </section>
  );
}
