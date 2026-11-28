import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { client } from "../auth/runtime";
import { colors, Button, Notice, Page, s } from "../components/ui";
import {
  buyerInboxSession,
  readBuyerInbox,
  type BuyerInboxSession,
} from "./inbox";
import type { BuyerNotification } from "../../../../packages/contracts/src/buyer-inbox";

const dates = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function BuyerInboxScreen() {
  useSyncExternalStore(client.subscribe, client.snapshot);
  useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  const session = buyerInboxSession(client);
  return session ? (
    <NativeBuyerInbox
      key={`${session.buyerId}:${session.revision}`}
      session={session}
    />
  ) : (
    <Page title="Notificações">
      <Notice
        error
        message="Entre como comprador para consultar suas notificações."
      />
    </Page>
  );
}

type Mark = Parameters<typeof readBuyerInbox>[2];
function NativeBuyerInbox({ session }: { session: BuyerInboxSession }) {
  const { buyerId, revision } = session;
  const [items, setItems] = useState<BuyerNotification[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const active = useRef<symbol | null>(null);
  const update = useCallback(
    async (mark?: Mark) => {
      if (active.current) return;
      const request = Symbol();
      active.current = request;
      setError("");
      setBusy(true);
      try {
        const inbox = await readBuyerInbox(client, { buyerId, revision }, mark);
        if (active.current === request && inbox) setItems(inbox);
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
    },
    [buyerId, revision],
  );

  useEffect(() => {
    void update();
    return () => {
      active.current = null;
    };
  }, [update]);

  return (
    <Page title="Notificações">
      <Text style={s.muted}>100 notificações mais recentes da sua conta.</Text>
      {busy && (
        <ActivityIndicator
          accessibilityLabel="Atualizando notificações"
          color={colors.purple}
        />
      )}
      {!!error && <Notice error message={error} />}
      {items?.length === 0 && !busy && (
        <Notice message="Nenhuma notificação." />
      )}
      {!!items?.length && (
        <Button
          secondary
          title="Marcar todas como lidas"
          disabled={busy}
          onPress={() => void update({ kind: "all" })}
        />
      )}
      {items?.map((item) => (
        <View style={s.card} key={item.id}>
          <Text accessibilityRole="header" style={s.label}>
            {item.title}
          </Text>
          <Text style={s.text}>{item.message}</Text>
          <Text style={s.muted}>
            {item.readAt ? "Lida" : "Não lida"} ·{" "}
            {dates.format(new Date(item.createdAt))}
          </Text>
          {!item.readAt && (
            <Button
              secondary
              title="Marcar como lida"
              disabled={busy}
              onPress={() => void update({ kind: "one", id: item.id })}
            />
          )}
        </View>
      ))}
      {!busy && (
        <Button
          secondary
          title={error ? "Tentar novamente" : "Atualizar notificações"}
          onPress={() => void update()}
        />
      )}
    </Page>
  );
}
