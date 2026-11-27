import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { client } from "../auth/runtime";
import { Button, colors, money, Notice, Page, s } from "../components/ui";
import {
  campaignOrderAmountLabel,
  readBuyerCampaignTitles,
  type CampaignTitleOrder,
} from "./campaign-titles";
import { buyerHistorySession, buyerOrderStatus, type BuyerHistorySession } from "./order-history";
import { titleNumber } from "./purchases";

const heading = "Meus títulos nesta campanha";
const dates = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const pageSize = 40;

type Campaign = { id: string; title: string; totalNumbers: number };
type LoadResult = { version: number } & (
  | { kind: "ready"; orders: CampaignTitleOrder[] }
  | { kind: "error"; message: string }
);

function campaignParam(value: unknown): Campaign | null {
  if (value === null || typeof value !== "object") return null;
  const campaign = value as Partial<Campaign>;
  return typeof campaign.id === "string" && campaign.id.trim() &&
    typeof campaign.title === "string" && campaign.title.trim() &&
    typeof campaign.totalNumbers === "number" &&
    Number.isSafeInteger(campaign.totalNumbers) && campaign.totalNumbers > 0
    ? { id: campaign.id, title: campaign.title, totalNumbers: campaign.totalNumbers }
    : null;
}

export function BuyerCampaignTitlesScreen({
  route,
}: {
  route: { params?: { campaign?: unknown } };
}) {
  useSyncExternalStore(client.subscribe, client.snapshot);
  useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  const focused = useIsFocused();
  const session = buyerHistorySession(client);
  const campaign = campaignParam(route.params?.campaign);
  if (!focused) return null;
  if (!session || !campaign)
    return <Page title={heading}><Notice error message="Abra a campanha com uma sessão de comprador ativa." /></Page>;

  // Account, renewed session epoch, non-focused screens and changed campaigns
  // must not reuse a previously rendered private purchase projection.
  return <CampaignTitles
    key={JSON.stringify([session.buyerId, session.revision, campaign.id])}
    campaign={campaign}
    session={session}
  />;
}

function CampaignTitles({ campaign, session }: { campaign: Campaign; session: BuyerHistorySession }) {
  const { id } = campaign;
  const { buyerId, revision } = session;
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<LoadResult | null>(null);
  const current = result?.version === version ? result : null;
  const refresh = () => setVersion((prior) => prior + 1);

  useEffect(() => {
    let prior = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && prior !== "active") setVersion((value) => value + 1);
      prior = next;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    void readBuyerCampaignTitles(client, { buyerId, revision }, id)
      .then((orders) => {
        if (active && orders !== null) setResult({ version, kind: "ready", orders });
      })
      .catch((error: unknown) => {
        if (active) setResult({
          version, kind: "error",
          message: error instanceof Error ? error.message : "Não foi possível atualizar os títulos.",
        });
      });
    return () => { active = false; };
  }, [id, buyerId, revision, version]);

  return (
    <Page title={heading}>
      <Text style={s.label}>{campaign.title}</Text>
      {!current ? (
        <ActivityIndicator accessibilityLabel="Atualizando títulos da campanha" color={colors.purple} />
      ) : current.kind === "error" ? (
        <View style={s.card}>
          <Notice error message={current.message} />
          <Button title="Tentar novamente" onPress={refresh} />
        </View>
      ) : (
        <>
          {current.orders.length === 0 && <Notice message="Nenhum pedido nesta campanha." />}
          {current.orders.map((order) => (
            <OrderCard key={order.id} order={order} totalNumbers={campaign.totalNumbers} />
          ))}
          <Button secondary title="Atualizar títulos" onPress={refresh} />
        </>
      )}
    </Page>
  );
}

function OrderCard({ order, totalNumbers }: { order: CampaignTitleOrder; totalNumbers: number }) {
  const [page, setPage] = useState<number | null>(null);
  const count = order.numbers.length;
  const start = page === null ? 0 : page * pageSize;
  return (
    <View style={s.card}>
      <Text style={s.label}>{buyerOrderStatus(order.status)}</Text>
      <Text style={s.text}>{order.quantity} {order.quantity === 1 ? "cota no pedido" : "cotas no pedido"} · {dates.format(new Date(order.createdAt))}</Text>
      <Text style={s.text}>{campaignOrderAmountLabel(order.status)}: {money(order.total)}</Text>
      {count === 0 ? (
        <Notice message="Nenhum título confirmado neste pedido." />
      ) : page === null ? (
        <Button secondary title={`Ver números (${count})`} onPress={() => setPage(0)} />
      ) : (
        <>
          <Text style={s.label}>Números confirmados</Text>
          <Text selectable style={s.text}>
            {order.numbers.slice(start, start + pageSize)
              .map((number) => titleNumber(number, totalNumbers)).join(" · ")}
          </Text>
          {count > pageSize && (
            <Notice message={`Mostrando ${start + 1}–${Math.min(start + pageSize, count)} de ${count} títulos.`} />
          )}
          {page > 0 && <Button secondary title="Números anteriores" onPress={() => setPage(page - 1)} />}
          {start + pageSize < count && <Button secondary title="Mais números" onPress={() => setPage(page + 1)} />}
          <Button secondary title="Ocultar números" onPress={() => setPage(null)} />
        </>
      )}
    </View>
  );
}
