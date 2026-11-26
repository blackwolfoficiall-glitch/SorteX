import React, { useEffect, useState } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import type { SortexClient } from "../api/client";
import { Button, colors, money, Notice, Page, s } from "../components/ui";
import {
  buyerOrderStatus,
  readBuyerOrderHistory,
  type BuyerHistoryOrder,
  type BuyerHistorySession,
} from "./order-history";

type HistoryState =
  | { generation: number; kind: "ready"; orders: BuyerHistoryOrder[] }
  | { generation: number; kind: "error"; message: string };

const dates = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

/** The focused parent mounts this screen anew for each focus/account epoch. */
export function NativeBuyerOrderHistory({
  client, session, onOrder,
}: {
  client: SortexClient;
  session: BuyerHistorySession;
  onOrder: (orderId: string) => void;
}) {
  const { buyerId, revision } = session;
  const [generation, setGeneration] = useState(0);
  const [loaded, setLoaded] = useState<HistoryState | null>(null);
  const current = loaded?.generation === generation ? loaded : null;
  const refresh = () => setGeneration((previous) => previous + 1);

  useEffect(() => {
    let previous = AppState.currentState;
    const event = AppState.addEventListener("change", (next) => {
      if (next === "active" && previous !== "active") {
        setGeneration((version) => version + 1);
      }
      previous = next;
    });
    return () => event.remove();
  }, []);

  useEffect(() => {
    let active = true;
    void readBuyerOrderHistory(client, { buyerId, revision })
      .then((orders) => {
        if (active && orders !== null) setLoaded({ generation, kind: "ready", orders });
      })
      .catch((error: unknown) => {
        if (active) {
          setLoaded({
            generation, kind: "error",
            message: error instanceof Error ? error.message : "Não foi possível atualizar os pedidos.",
          });
        }
      });
    return () => { active = false; };
  }, [client, buyerId, revision, generation]);

  return (
    <Page title="Pedidos">
      {!current ? (
        <ActivityIndicator accessibilityLabel="Atualizando pedidos" color={colors.purple} />
      ) : current.kind === "error" ? (
        <View style={s.card}>
          <Notice error message={current.message} />
          <Button title="Tentar novamente" onPress={refresh} />
        </View>
      ) : (
        <>
          {current.orders.length === 0 && <Notice message="Nenhum pedido encontrado." />}
          {current.orders.map((order) => (
            <View key={order.id} style={s.card}>
              <Text style={s.label}>{order.campaignTitle}</Text>
              <Text style={s.text}>{money(order.total)} · {buyerOrderStatus(order.status)}</Text>
              <Notice
                message={`${order.quantity} ${order.quantity === 1 ? "cota no pedido" : "cotas no pedido"} · ${dates.format(new Date(order.createdAt))}`}
              />
              <Button secondary title="Ver pedido e títulos" onPress={() => onOrder(order.id)} />
            </View>
          ))}
          <Button secondary title="Atualizar pedidos" onPress={refresh} />
        </>
      )}
    </Page>
  );
}
