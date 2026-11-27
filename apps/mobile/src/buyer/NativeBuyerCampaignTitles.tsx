import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { client } from "../auth/runtime";
import { money } from "../components/ui";
import {
  PremiumButton,
  PremiumGradient,
  PremiumMessage,
  PremiumPage,
  PremiumPanel,
  premiumTypography,
  usePremiumTheme,
} from "../theme/premium";
import {
  campaignOrderAmountLabel,
  campaignTitlePage,
  campaignTitlePageSize,
  confirmedCampaignTitleCount,
  readBuyerCampaignTitles,
  type CampaignTitleOrder,
} from "./campaign-titles";
import { buyerHistorySession, buyerOrderStatus, type BuyerHistorySession } from "./order-history";
import { titleNumber } from "./purchases";

const heading = "Meus títulos nesta campanha";
const dates = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const countFormat = new Intl.NumberFormat("pt-BR");

type Campaign = { id: string; title: string; totalNumbers: number };
type LoadResult = { version: number } & (
  { kind: "ready"; orders: CampaignTitleOrder[] } | { kind: "error" }
);

function campaignParam(value: unknown): Campaign | null {
  if (value === null || typeof value !== "object") return null;
  const campaign = value as Partial<Campaign>;
  return typeof campaign.id === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(campaign.id) &&
    typeof campaign.title === "string" &&
    campaign.title.trim() &&
    typeof campaign.totalNumbers === "number" &&
    Number.isSafeInteger(campaign.totalNumbers) &&
    campaign.totalNumbers > 0
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
    return (
      <PremiumPage title={heading} top={false} bottom>
        <PremiumMessage error message="Abra a campanha com uma sessão de comprador ativa." />
      </PremiumPage>
    );

  // Account, renewed session epoch, non-focused screens and changed campaigns
  // must not reuse a previously rendered private purchase projection.
  return (
    <CampaignTitles
      key={JSON.stringify([session.buyerId, session.revision, campaign.id, campaign.totalNumbers])}
      campaign={campaign}
      session={session}
    />
  );
}

function CampaignTitles({
  campaign,
  session,
}: {
  campaign: Campaign;
  session: BuyerHistorySession;
}) {
  const theme = usePremiumTheme();
  const { id, totalNumbers } = campaign;
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
    void readBuyerCampaignTitles(client, { buyerId, revision }, id, totalNumbers)
      .then((orders) => {
        if (active && orders !== null) setResult({ version, kind: "ready", orders });
      })
      .catch(() => {
        if (active) setResult({ version, kind: "error" });
      });
    return () => {
      active = false;
    };
  }, [id, totalNumbers, buyerId, revision, version]);

  return (
    <PremiumPage title={heading} top={false} bottom>
      <View style={[styles.hero, { backgroundColor: theme.purple }]}>
        <PremiumGradient />
        <Text style={[premiumTypography.label, { color: theme.white }]}>Campanha</Text>
        <Text
          accessibilityRole="header"
          style={[premiumTypography.section, { color: theme.white }]}
        >
          {campaign.title}
        </Text>
        {current?.kind === "ready" && current.orders.length > 0 && (
          <TitleSummary orders={current.orders} />
        )}
      </View>
      {!current ? (
        <PremiumPanel>
          <ActivityIndicator
            accessibilityLabel="Atualizando títulos da campanha"
            color={theme.accent}
          />
          <PremiumMessage message="Consultando seus pedidos nesta campanha…" />
        </PremiumPanel>
      ) : current.kind === "error" ? (
        <PremiumPanel title="Títulos indisponíveis">
          <PremiumMessage
            error
            message="Não foi possível consultar seus títulos. Nenhum número foi exibido."
          />
          <PremiumButton title="Tentar novamente" onPress={refresh} />
        </PremiumPanel>
      ) : (
        <>
          {current.orders.length === 0 ? (
            <PremiumPanel title="Nenhum pedido nesta campanha.">
              <PremiumMessage message="Os títulos aparecem aqui depois que o pagamento é confirmado." />
            </PremiumPanel>
          ) : (
            <>
              <Text
                accessibilityRole="header"
                style={[premiumTypography.section, { color: theme.text }]}
              >
                Pedidos da campanha
              </Text>
              <PremiumMessage message="Consulte apenas os títulos confirmados dos seus pedidos nesta campanha." />
              {current.orders.map((order) => (
                <OrderCard key={order.id} order={order} totalNumbers={totalNumbers} />
              ))}
            </>
          )}
          <PremiumButton title="Atualizar títulos" onPress={refresh} />
        </>
      )}
    </PremiumPage>
  );
}

function TitleSummary({ orders }: { orders: CampaignTitleOrder[] }) {
  const theme = usePremiumTheme();
  const confirmed = confirmedCampaignTitleCount(orders);
  return (
    <View style={styles.summary}>
      <View style={styles.metric}>
        <Text style={[premiumTypography.label, { color: theme.white }]}>Títulos confirmados</Text>
        <Text style={[premiumTypography.title, { color: theme.white }]}>
          {countFormat.format(confirmed)}
        </Text>
      </View>
      <View style={styles.metric}>
        <Text style={[premiumTypography.label, { color: theme.white }]}>
          Pedidos nesta campanha
        </Text>
        <Text style={[premiumTypography.title, { color: theme.white }]}>
          {countFormat.format(orders.length)}
        </Text>
      </View>
    </View>
  );
}

function OrderCard({ order, totalNumbers }: { order: CampaignTitleOrder; totalNumbers: number }) {
  const theme = usePremiumTheme();
  const [page, setPage] = useState<number | null>(null);
  const count = order.numbers.length;
  const paid = order.status === "PAID";
  const visible = page === null ? null : campaignTitlePage(order.numbers, page);
  return (
    <PremiumPanel>
      <View style={[styles.badge, { backgroundColor: theme.tint }]}>
        <Text style={[premiumTypography.label, { color: paid ? theme.success : theme.text }]}>
          {buyerOrderStatus(order.status)}
        </Text>
      </View>
      <PremiumMessage
        message={`${order.quantity} ${order.quantity === 1 ? "cota no pedido" : "cotas no pedido"} · ${dates.format(new Date(order.createdAt))}`}
      />
      <Text style={[premiumTypography.label, { color: theme.text }]}>
        {campaignOrderAmountLabel(order.status)}: {money(order.total)}
      </Text>
      {count === 0 ? (
        <PremiumMessage
          message={
            paid
              ? "Pagamento confirmado, mas nenhum número pôde ser confirmado nesta consulta. Atualize os títulos."
              : "Nenhum título confirmado neste pedido."
          }
        />
      ) : visible ? (
        <>
          <View style={[styles.numbers, { backgroundColor: theme.bg, borderColor: theme.line }]}>
            <Text
              accessibilityRole="header"
              style={[premiumTypography.label, { color: theme.text }]}
            >
              Números confirmados
            </Text>
            <Text selectable style={[styles.code, { color: theme.text }]}>
              {visible.entries.map((number) => titleNumber(number, totalNumbers)).join(" · ")}
            </Text>
            {count > campaignTitlePageSize && (
              <PremiumMessage
                message={`Mostrando ${visible.first}–${visible.last} de ${visible.total} títulos.`}
              />
            )}
          </View>
          {visible.hasPrevious && (
            <PremiumButton
              title="Números anteriores"
              onPress={() => page !== null && setPage(page - 1)}
            />
          )}
          {visible.hasNext && (
            <PremiumButton
              title="Mais números"
              onPress={() => page !== null && setPage(page + 1)}
            />
          )}
          <PremiumButton title="Ocultar números" onPress={() => setPage(null)} />
        </>
      ) : (
        <PremiumButton
          filled
          title={`Ver números (${countFormat.format(count)})`}
          onPress={() => setPage(0)}
        />
      )}
    </PremiumPanel>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 18, borderRadius: 24, overflow: "hidden", gap: 8 },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  metric: { flexBasis: 134, flexGrow: 1, gap: 4 },
  badge: { alignSelf: "flex-start", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  numbers: { gap: 8, padding: 14, borderRadius: 15, borderWidth: 1 },
  code: { fontSize: 16, lineHeight: 25, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
