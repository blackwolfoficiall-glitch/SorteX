import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  PremiumButton,
  PremiumChoice,
  PremiumField,
  PremiumGradient,
  PremiumMessage,
  PremiumPage,
  PremiumPanel,
  premiumTypography,
  usePremiumTheme,
} from "../theme/premium";
import {
  initialOrderFilters,
  loadOrganizerOrderCampaigns,
  loadOrganizerOrderDetail,
  loadOrganizerOrders,
  organizerOrdersPath,
  orderMethods,
  orderSorts,
  orderStatuses,
  sameOrganizerOrdersSession,
  type OrderCampaign,
  type OrderFilters,
  type OrganizerOrderDetail,
  type OrganizerOrderRow,
  type OrganizerOrdersClient,
  type OrganizerOrdersPage,
  type OrganizerOrdersSession,
} from "./orders";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const when = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});
const shortId = (id: string) => "#" + id.slice(-8).toUpperCase();
const qtyLabel = (quantity: number) =>
  `${quantity} ${quantity === 1 ? "título" : "títulos"}`;
type Read<T> =
  { kind: "ok"; data: T } | { kind: "missing" | "error" | "loading" };
type ReadResult<T> = { key: string; state: Read<T> };
type BaseProps = {
  client: OrganizerOrdersClient;
  session: OrganizerOrdersSession;
};

function useScopedResult<T>(
  key: string,
  read: () => Promise<{ kind: "ok"; data: T } | { kind: "stale" | "missing" }>,
) {
  const [result, setResult] = useState<ReadResult<T>>();
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(read)
      .then((state) => {
        if (active && state.kind !== "stale")
          setResult({
            key,
            state: state.kind === "ok" ? state : { kind: "missing" },
          });
      })
      .catch(() => {
        if (active) setResult({ key, state: { kind: "error" } });
      });
    return () => {
      active = false;
    };
    // key identifies the settled inputs (session, page, filters, retry).
    // Each effect keeps the read closure for that key and can only commit while active.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result?.key === key ? result.state : ({ kind: "loading" } as const);
}

export function NativeOrganizerOrders({
  client,
  session,
  campaignId,
  onOrder,
}: BaseProps & {
  campaignId?: string;
  onOrder: (orderId: string) => void;
}) {
  const theme = usePremiumTheme();
  const { organizerId, revision } = session;
  const scope = `${organizerId}:${revision}`;
  const baseline = { ...initialOrderFilters, campaignId: campaignId ?? "" };
  const [openFilters, setOpenFilters] = useState(false);
  const [draft, setDraft] = useState<OrderFilters>(baseline);
  const [applied, setApplied] = useState<OrderFilters>(baseline);
  const [problem, setProblem] = useState("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [campaignsAttempt, setCampaignsAttempt] = useState(0);
  const list = useScopedResult<OrganizerOrdersPage>(
    `${scope}:${page}:${attempt}:${JSON.stringify(applied)}`,
    () => loadOrganizerOrders(client, session, applied, page),
  );
  const campaigns = useScopedResult<OrderCampaign[]>(
    `${scope}:${campaignsAttempt}`,
    () => loadOrganizerOrderCampaigns(client, session),
  );
  const active = sameOrganizerOrdersSession(client, session);
  const title = campaignId ? "Pedidos e participantes" : "Pedidos";
  function change(patch: Partial<OrderFilters>) {
    setDraft((current) => ({ ...current, ...patch }));
    setProblem("");
  }
  function apply() {
    if (!active) return;
    try {
      organizerOrdersPath(draft, 1);
      setApplied(draft);
      setPage(1);
      setAttempt((previous) => previous + 1);
      setProblem("");
      setOpenFilters(false);
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Confira os filtros.",
      );
    }
  }
  const reload = () => setAttempt((current) => current + 1);
  if (!active) return <NotSigned title={title} />;
  return (
    <PremiumPage title={title} top={false} bottom>
      <View style={[styles.hero, { backgroundColor: theme.purple }]}>
        <PremiumGradient />
        <Text style={[premiumTypography.label, { color: theme.white }]}>
          Vendas e reservas
        </Text>
        <Text style={[premiumTypography.body, { color: theme.white }]}>
          Acompanhe os pedidos da sua operação. Esta tela não altera pagamentos.
        </Text>
      </View>
      <PremiumButton
        title={openFilters ? "Fechar filtros" : "Filtros de pedidos"}
        onPress={() => setOpenFilters((value) => !value)}
      />
      {openFilters && (
        <PremiumPanel title="Filtros">
          <PremiumField
            label="Nome ou e-mail do comprador"
            value={draft.search}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={120}
            onChangeText={(search) => change({ search })}
          />
          <Label>Campanha</Label>
          <Chips>
            <PremiumChoice
              label="Todas as campanhas"
              selected={!draft.campaignId}
              onPress={() => change({ campaignId: "" })}
            />
            {campaigns.kind === "ok" &&
              campaigns.data.map((item) => (
                <PremiumChoice
                  key={item.id}
                  label={item.title}
                  selected={draft.campaignId === item.id}
                  onPress={() => change({ campaignId: item.id })}
                />
              ))}
          </Chips>
          {(campaigns.kind === "error" || campaigns.kind === "missing") && (
            <>
              <PremiumMessage message="A lista de campanhas não está disponível. Os outros filtros continuam funcionando." />
              <PremiumButton
                title="Recarregar campanhas"
                onPress={() => setCampaignsAttempt((value) => value + 1)}
              />
            </>
          )}
          <Label>Status</Label>
          <Chips>
            <PremiumChoice
              label="Todos os status"
              selected={!draft.status}
              onPress={() => change({ status: "" })}
            />
            {(Object.keys(orderStatuses) as (keyof typeof orderStatuses)[]).map(
              (key) => (
                <PremiumChoice
                  key={key}
                  label={orderStatuses[key]}
                  selected={draft.status === key}
                  onPress={() => change({ status: key })}
                />
              ),
            )}
          </Chips>
          <Label>Método de pagamento</Label>
          <Chips>
            <PremiumChoice
              label="Todos os métodos"
              selected={!draft.method}
              onPress={() => change({ method: "" })}
            />
            {(Object.keys(orderMethods) as (keyof typeof orderMethods)[]).map(
              (key) => (
                <PremiumChoice
                  key={key}
                  label={orderMethods[key]}
                  selected={draft.method === key}
                  onPress={() => change({ method: key })}
                />
              ),
            )}
          </Chips>
          <PremiumField
            label="Data inicial (DD/MM/AAAA)"
            value={draft.from}
            placeholder="DD/MM/AAAA"
            maxLength={10}
            onChangeText={(from) => change({ from })}
          />
          <PremiumField
            label="Data final (DD/MM/AAAA)"
            value={draft.to}
            placeholder="DD/MM/AAAA"
            maxLength={10}
            onChangeText={(to) => change({ to })}
          />
          <Label muted>Datas da consulta em UTC.</Label>
          <PremiumField
            label="Valor mínimo"
            keyboardType="decimal-pad"
            value={draft.minValue}
            onChangeText={(minValue) => change({ minValue })}
          />
          <PremiumField
            label="Valor máximo"
            keyboardType="decimal-pad"
            value={draft.maxValue}
            onChangeText={(maxValue) => change({ maxValue })}
          />
          <Label>Ordenação</Label>
          <Chips>
            {(Object.keys(orderSorts) as (keyof typeof orderSorts)[]).map(
              (key) => (
                <PremiumChoice
                  key={key}
                  label={orderSorts[key]}
                  selected={draft.sort === key}
                  onPress={() => change({ sort: key })}
                />
              ),
            )}
          </Chips>
          {!!problem && <PremiumMessage error message={problem} />}
          <PremiumButton title="Aplicar filtros" filled onPress={apply} />
          <PremiumButton
            title="Limpar filtros"
            onPress={() => {
              setDraft(initialOrderFilters);
              setApplied(initialOrderFilters);
              setPage(1);
              reload();
              setProblem("");
              setOpenFilters(false);
            }}
          />
        </PremiumPanel>
      )}
      {list.kind === "loading" && <Loading label="Carregando pedidos…" />}
      {list.kind === "missing" && (
        <ReadError
          title="Pedidos indisponíveis"
          message="A API não disponibilizou esta consulta. Nenhum total foi calculado."
          onRetry={reload}
        />
      )}
      {list.kind === "error" && (
        <ReadError
          title="Falha ao consultar pedidos"
          message="Confira a conexão ou entre novamente. Nenhum total foi calculado."
          onRetry={reload}
        />
      )}
      {list.kind === "ok" && (
        <>
          <Summary data={list.data} />
          <PremiumPanel title="Pedidos encontrados">
            <Label>
              {list.data.total}{" "}
              {list.data.total === 1
                ? "pedido na consulta"
                : "pedidos na consulta"}
            </Label>
            {list.data.items.length === 0 && (
              <PremiumMessage
                message={
                  page > Math.max(list.data.pages, 1)
                    ? "Esta página não existe mais. Volte para continuar."
                    : "Nenhum pedido corresponde à consulta."
                }
              />
            )}
            {list.data.items.map((item) => (
              <OrderCard
                key={item.id}
                item={item}
                onPress={() => {
                  if (sameOrganizerOrdersSession(client, session))
                    onOrder(item.id);
                }}
              />
            ))}
            {list.data.pages > 1 && page <= list.data.pages && (
              <Label muted>
                Página {page} de {list.data.pages}
              </Label>
            )}
            {page > 1 && (
              <PremiumButton
                title="Pedidos anteriores"
                onPress={() =>
                  setPage(Math.max(1, Math.min(page - 1, list.data.pages)))
                }
              />
            )}
            {page < list.data.pages && (
              <PremiumButton
                title="Mais pedidos"
                onPress={() => setPage(page + 1)}
              />
            )}
          </PremiumPanel>
          <PremiumButton title="Atualizar pedidos" onPress={reload} />
        </>
      )}
    </PremiumPage>
  );
}

export function NativeOrganizerOrderDetail({
  client,
  session,
  orderId,
}: BaseProps & { orderId: string }) {
  const [attempt, setAttempt] = useState(0);
  const detail = useScopedResult<OrganizerOrderDetail>(
    `${session.organizerId}:${session.revision}:${orderId}:${attempt}`,
    () => loadOrganizerOrderDetail(client, session, orderId),
  );
  if (!sameOrganizerOrdersSession(client, session))
    return <NotSigned title="Pedido" />;
  const reload = () => setAttempt((current) => current + 1);
  return (
    <PremiumPage title="Pedido" top={false} bottom>
      {detail.kind === "loading" && (
        <Loading label="Carregando detalhes do pedido…" />
      )}
      {detail.kind === "missing" && (
        <ReadError
          title="Pedido indisponível"
          message="O pedido não foi encontrado nesta conta."
          onRetry={reload}
        />
      )}
      {detail.kind === "error" && (
        <ReadError
          title="Falha na consulta"
          message="Não foi possível carregar os detalhes do pedido."
          onRetry={reload}
        />
      )}
      {detail.kind === "ok" && <OrderDetails item={detail.data} />}
    </PremiumPage>
  );
}

function Summary({ data }: { data: OrganizerOrdersPage }) {
  return (
    <PremiumPanel title="Resumo da sua conta">
      {data.summary ? (
        <>
          <Label>
            Vendas aprovadas: {money.format(data.summary.approvedSales)}
          </Label>
          <Label>Reservas pendentes: {data.summary.pendingReservations}</Label>
          <Label>Pedidos hoje: {data.summary.ordersToday}</Label>
          <Label>
            Receita do período: {money.format(data.summary.periodRevenue)}
          </Label>
          <Label muted>
            Valores brutos. Só as datas alteram a receita do período; os demais
            filtros alteram a lista.
          </Label>
        </>
      ) : (
        <PremiumMessage message="Resumo não disponibilizado pela API. Isso não significa zero." />
      )}
    </PremiumPanel>
  );
}

function OrderCard({
  item,
  onPress,
}: {
  item: OrganizerOrderRow;
  onPress: () => void;
}) {
  const theme = usePremiumTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.bg, borderColor: theme.line },
      ]}
    >
      <Label>{item.campaign.title}</Label>
      <Label muted>
        {shortId(item.id)} · {when.format(new Date(item.createdAt))} UTC
      </Label>
      <Label>
        {money.format(item.total)} · {orderStatuses[item.status]} ·{" "}
        {qtyLabel(item.quantity)}
      </Label>
      <Label muted>
        {item.buyerName} ·{" "}
        {item.payment
          ? orderMethods[item.payment.method]
          : "Pagamento não iniciado"}
      </Label>
      {!!item.affiliate && <Label muted>Afiliado: {item.affiliate}</Label>}
      <PremiumButton title="Ver pedido e títulos" onPress={onPress} />
    </View>
  );
}

function OrderDetails({ item }: { item: OrganizerOrderDetail }) {
  return (
    <>
      <PremiumPanel title={item.campaign.title}>
        <Label>
          {shortId(item.id)} · {orderStatuses[item.status]}
        </Label>
        <Label>Valor do pedido: {money.format(item.total)}</Label>
        <Label>
          {qtyLabel(item.quantity)} · {when.format(new Date(item.createdAt))}{" "}
          UTC
        </Label>
        <Label>Participante: {item.buyerName}</Label>
        {!!item.buyerEmail && <Label muted>E-mail: {item.buyerEmail}</Label>}
        {!!item.buyerPhone && <Label muted>Telefone: {item.buyerPhone}</Label>}
        {!!item.affiliate && <Label muted>Afiliado: {item.affiliate}</Label>}
      </PremiumPanel>
      <PremiumPanel title="Títulos">
        {item.registeredTickets === null ? (
          <PremiumMessage message="A API não informou a quantidade de títulos registrados." />
        ) : (
          <Label>
            {qtyLabel(item.registeredTickets)} registrados no pedido.
          </Label>
        )}
        <Label muted>
          A numeração individual não é fornecida a esta tela pela API do
          organizador.
        </Label>
      </PremiumPanel>
      <PremiumPanel title="Histórico do pedido">
        <Label>Criado: {when.format(new Date(item.createdAt))} UTC</Label>
        {item.payment && (
          <Label>
            Pagamento iniciado: {orderMethods[item.payment.method]} ·{" "}
            {when.format(new Date(item.payment.createdAt))} UTC
          </Label>
        )}
        {item.approvedAt && (
          <Label>
            Pagamento aprovado: {when.format(new Date(item.approvedAt))} UTC
          </Label>
        )}
        {item.events.map((event, index) => (
          <Label key={`${event.type}:${event.createdAt}:${index}`} muted>
            {event.type.replace(/_/g, " ").toLowerCase()} ·{" "}
            {when.format(new Date(event.createdAt))} UTC
          </Label>
        ))}
        {!item.events.length && (
          <Label muted>Nenhum evento adicional registrado.</Label>
        )}
        {item.payment?.method === "PIX" && (
          <PremiumMessage message="O código Pix é protegido e fica disponível somente no pagamento do comprador." />
        )}
      </PremiumPanel>
    </>
  );
}

function Label({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  const theme = usePremiumTheme();
  return (
    <Text
      style={[
        muted ? premiumTypography.body : premiumTypography.label,
        { color: muted ? theme.muted : theme.text },
      ]}
    >
      {children}
    </Text>
  );
}
function Chips({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={styles.chips}
    >
      {children}
    </ScrollView>
  );
}
function Loading({ label }: { label: string }) {
  const theme = usePremiumTheme();
  return (
    <PremiumPanel>
      <ActivityIndicator accessibilityLabel={label} color={theme.accent} />
      <Label muted>{label}</Label>
    </PremiumPanel>
  );
}
function ReadError({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <PremiumPanel title={title}>
      <PremiumMessage error message={message} />
      <PremiumButton title="Tentar novamente" onPress={onRetry} />
    </PremiumPanel>
  );
}
function NotSigned({ title }: { title: string }) {
  return (
    <PremiumPage title={title} top={false} bottom>
      <PremiumMessage
        error
        message="Somente organizadores com sessão ativa podem consultar pedidos."
      />
    </PremiumPage>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 8, padding: 16, borderRadius: 20, overflow: "hidden" },
  chips: { gap: 8, paddingBottom: 4 },
  card: { gap: 8, padding: 12, borderRadius: 15, borderWidth: 1 },
});
