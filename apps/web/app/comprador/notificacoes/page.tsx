"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, CircleAlert, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./notifications-premium.module.css";
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

  const unread = items?.filter((item) => !item.readAt).length ?? 0;

  return (
    <PremiumScope className={styles.scope}>
      <section aria-busy={busy} aria-labelledby="buyer-notifications-title" className={styles.layout}>
        <header className={styles.hero}>
          <div className={styles.identity}>
            <span className={styles.heroIcon}><Bell size={23} aria-hidden="true" /></span>
            <div>
              <p className={styles.eyebrow}>Sua conta</p>
              <h1 id="buyer-notifications-title" className="sx-premium-title">Notificações</h1>
              <p className={styles.muted}>100 notificações mais recentes da sua conta.</p>
            </div>
          </div>
          {!!items?.length && (
            <div className={styles.tools}>
              <span className={styles.badge}>
                {unread === 1 ? "1 não lida" : `${unread} não lidas`}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void update({ all: true })}
                className={styles.control}
              >
                <CheckCheck size={16} aria-hidden="true" /> Marcar todas como lidas
              </button>
            </div>
          )}
        </header>

        {busy && (
          <p role="status" className={styles.feedback}>
            <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
            Atualizando notificações…
          </p>
        )}
        {error && (
          <p role="alert" className={styles.feedback}>
            <CircleAlert size={18} aria-hidden="true" /> {error}
          </p>
        )}
        {!!items?.length && (
          <ul className={styles.list} aria-label="Caixa de notificações" role="list">
            {items.map((item) => (
              <li key={item.id} className={styles.notice} data-unread={!item.readAt}>
                <span className={styles.noticeIcon} aria-hidden="true">
                  {item.readAt ? <Check size={16} /> : <Bell size={16} />}
                </span>
                <div className={styles.noticeBody}>
                  <h2>{item.title}</h2>
                  <p className={styles.message}>{item.message}</p>
                  <p className={styles.metadata}>
                    <span className={styles.badge}>{item.readAt ? "Lida" : "Não lida"}</span>
                    <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("pt-BR")}</time>
                  </p>
                  {!item.readAt && (
                    <button
                      type="button"
                      disabled={busy}
                      aria-label={`Marcar como lida: ${item.title}`}
                      onClick={() => void update({ id: item.id })}
                      className={styles.control}
                    >
                      <Check size={16} aria-hidden="true" /> Marcar como lida
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {items?.length === 0 && !busy && (
          <div className={styles.empty}>
            <Inbox size={27} aria-hidden="true" />
            <h2 className="sx-premium-section">Nenhuma notificação.</h2>
          </div>
        )}
        {!busy && (
          <div className={styles.footer}>
            <button type="button" onClick={() => void update()} className={styles.control}>
              <RefreshCw size={16} aria-hidden="true" />
              {error ? "Tentar novamente" : "Atualizar notificações"}
            </button>
          </div>
        )}
      </section>
    </PremiumScope>
  );
}
