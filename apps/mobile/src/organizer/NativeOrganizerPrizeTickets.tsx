import React, { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
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
  canManagePrizeTicketDraft,
  deliveryRecordStatus,
  initialPrizeTicketFilters,
  isPrizeTicketsSession,
  loadPrizeTicketCampaigns,
  loadPrizeTicketHistory,
  loadPrizeTicketPage,
  loadPrizeTicketSummary,
  prizeTicketIndicators,
  prizeTicketSorts,
  prizeTicketStates,
  prizeTicketTypes,
  prizeTicketsPath,
  type OrganizerPrizeTicket,
  type PrizeTicketCampaign,
  type PrizeTicketFilters,
  type PrizeTicketPage,
  type PrizeTicketSummary,
  type PrizeTicketEvent,
  type PrizeTicketsClient,
  type PrizeTicketsSession,
} from "./prize-tickets";

type Props = { client: PrizeTicketsClient; session: PrizeTicketsSession };
type Remote<T> =
  { kind: "ok"; data: T } | { kind: "loading" | "error" | "missing" };
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const when = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const isoToLocale = (value: string) => when.format(new Date(value));
const resultLabels = {
  IDENTIFIED: "Identificado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
  DISPUTED: "Em contestação",
} as const;

function useRead<T>(
  key: string,
  read: () => Promise<{ kind: "ok"; data: T } | { kind: "missing" | "stale" }>,
): Remote<T> {
  const [loaded, setLoaded] = useState<{ key: string; value: Remote<T> }>();
  useEffect(() => {
    let current = true;
    void Promise.resolve()
      .then(read)
      .then((value) => {
        if (current && value.kind !== "stale")
          setLoaded({
            key,
            value: value.kind === "ok" ? value : { kind: "missing" },
          });
      })
      .catch(() => {
        if (current) setLoaded({ key, value: { kind: "error" } });
      });
    return () => {
      current = false;
    };
    // The key includes the session revision, all read inputs and retry counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return loaded?.key === key ? loaded.value : { kind: "loading" };
}

function Body({
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
function State({
  title,
  state,
  retry,
}: {
  title: string;
  state: "loading" | "error" | "missing";
  retry: () => void;
}) {
  const theme = usePremiumTheme();
  return (
    <PremiumPanel title={title}>
      {state === "loading" ? (
        <>
          <ActivityIndicator
            accessibilityLabel="Carregando"
            color={theme.accent}
          />
          <Body muted>Carregando…</Body>
        </>
      ) : (
        <>
          <PremiumMessage
            error
            message={
              state === "missing"
                ? "Esse registro não está disponível para esta conta."
                : "Não foi possível consultar os dados agora."
            }
          />
          <PremiumButton title="Tentar novamente" onPress={retry} />
        </>
      )}
    </PremiumPanel>
  );
}
const initial = (campaignId?: string) => ({
  ...initialPrizeTicketFilters,
  campaignId: campaignId ?? "",
});

export function NativeOrganizerPrizeTickets({
  client,
  session,
  campaignId,
  onBrowseCampaignDrafts,
  onOpenDraft,
}: Props & {
  campaignId?: string;
  onBrowseCampaignDrafts?: () => void;
  onOpenDraft?: (campaignId: string) => void;
}) {
  const theme = usePremiumTheme();
  const [draft, setDraft] = useState(() => initial(campaignId));
  const [filters, setFilters] = useState(() => initial(campaignId));
  const [page, setPage] = useState(1);
  const [filtering, setFiltering] = useState(false);
  const [showDrafts, setShowDrafts] = useState(false);
  const focused = useIsFocused();
  const previouslyFocused = useRef(focused);
  const [active, setActive] = useState<OrganizerPrizeTicket | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (focused && !previouslyFocused.current) setAttempt((a) => a + 1);
    previouslyFocused.current = focused;
  }, [focused]);
  const sessionKey = `${session.organizerId}:${session.revision}`;
  const queryKey = `${sessionKey}:${attempt}`;
  const list = useRead<PrizeTicketPage>(
    `${queryKey}:${page}:${JSON.stringify(filters)}`,
    () => loadPrizeTicketPage(client, session, filters, page),
  );
  const summary = useRead<PrizeTicketSummary>(
    `${queryKey}:${filters.campaignId}`,
    () => loadPrizeTicketSummary(client, session, filters.campaignId),
  );
  const campaigns = useRead<PrizeTicketCampaign[]>(queryKey, () =>
    loadPrizeTicketCampaigns(client, session),
  );
  const [error, setError] = useState("");
  const change = (v: Partial<PrizeTicketFilters>) => {
    setDraft((old) => ({ ...old, ...v }));
    setError("");
  };
  const reload = () => setAttempt((a) => a + 1);
  function apply() {
    try {
      prizeTicketsPath(draft, 1);
      setFilters(draft);
      setPage(1);
      setFiltering(false);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Os filtros informados são inválidos.",
      );
    }
  }
  function clear() {
    const base = initial(campaignId);
    setDraft(base);
    setFilters(base);
    setPage(1);
    setError("");
  }
  if (!isPrizeTicketsSession(client, session))
    return (
      <PremiumPage title="Cotas premiadas" top={false} bottom>
        <PremiumMessage
          error
          message="Entre como organizador para consultar suas cotas."
        />
      </PremiumPage>
    );
  if (active)
    return (
      <TicketDetail
        key={active.id}
        client={client}
        session={session}
        item={active}
        back={() => setActive(null)}
      />
    );
  return (
    <PremiumPage title="Cotas premiadas" top={false} bottom>
      <View style={[styles.hero, { backgroundColor: theme.purple }]}>
        <PremiumGradient />
        <Text style={[premiumTypography.label, { color: theme.white }]}>
          Acompanhe suas cotas
        </Text>
        <Text style={[premiumTypography.body, { color: theme.white }]}>
          Configure cotas de rascunhos privados. Nas demais campanhas, consulte
          os resultados e o histórico sem executar apurações, pagamentos ou
          entregas.
        </Text>
      </View>
      {onOpenDraft && (
        <PremiumPanel title="Configurar cotas de um rascunho">
          <Body muted>
            Crie, edite ou remova cotas somente em campanhas próprias nunca
            publicadas.
          </Body>
          <PremiumButton
            filled
            title={showDrafts ? "Fechar rascunhos" : "Escolher rascunho"}
            onPress={() => setShowDrafts((v) => !v)}
          />
          {showDrafts &&
            (campaigns.kind !== "ok" ? (
              <State title="Rascunhos" state={campaigns.kind} retry={reload} />
            ) : (
              <DraftPicker
                campaigns={campaigns.data}
                onOpen={(id) => {
                  if (isPrizeTicketsSession(client, session)) onOpenDraft(id);
                }}
              />
            ))}
        </PremiumPanel>
      )}
      {summary.kind === "ok" ? (
        <PremiumPanel title="Resumo">
          <Body muted>
            {filters.campaignId
              ? "Campanha selecionada"
              : "Todas as suas campanhas"}
            . A busca e os demais filtros só restringem a lista.
          </Body>
          <View style={styles.metrics}>
            {Object.entries(prizeTicketIndicators).map(([k, label]) => (
              <View key={k} style={styles.metric}>
                <Body>{summary.data[k as keyof typeof summary.data]}</Body>
                <Body muted>{label}</Body>
              </View>
            ))}
          </View>
        </PremiumPanel>
      ) : (
        <State title="Resumo" state={summary.kind} retry={reload} />
      )}
      <PremiumButton
        title={filtering ? "Fechar filtros" : "Filtrar cotas"}

        onPress={() => setFiltering((v) => !v)}
      />
      {filtering && (
        <PremiumPanel title="Filtros">
          <PremiumField
            label="Número ou descrição"
            value={draft.search}
            onChangeText={(search) => change({ search })}
            maxLength={120}
          />
          <PremiumField
            label="Criadas desde (DD/MM/AAAA, UTC)"
            value={draft.startDate}
            maxLength={10}
            placeholder="DD/MM/AAAA"
            onChangeText={(startDate) => change({ startDate })}
          />
          <Body>Campanha</Body>
          <View style={styles.choices}>
            <PremiumChoice
              label="Todas"
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
          </View>
          {campaigns.kind !== "ok" && (
            <State title="Campanhas" state={campaigns.kind} retry={reload} />
          )}
          <Body>Status</Body>
          <View style={styles.choices}>
            <PremiumChoice
              label="Todos os status"
              selected={!draft.status}
              onPress={() => change({ status: "" })}
            />
            {Object.entries(prizeTicketStates).map(([key, label]) => (
              <PremiumChoice
                key={key}
                label={label}
                selected={draft.status === key}
                onPress={() =>
                  change({ status: key as PrizeTicketFilters["status"] })
                }
              />
            ))}
          </View>
          <Body>Tipo</Body>
          <View style={styles.choices}>
            <PremiumChoice
              label="Todos os tipos"
              selected={!draft.type}
              onPress={() => change({ type: "" })}
            />
            {Object.entries(prizeTicketTypes).map(([key, label]) => (
              <PremiumChoice
                key={key}
                label={label}
                selected={draft.type === key}
                onPress={() =>
                  change({ type: key as PrizeTicketFilters["type"] })
                }
              />
            ))}
          </View>
          <Body>Ordenação</Body>
          <View style={styles.choices}>
            {Object.entries(prizeTicketSorts).map(([key, label]) => (
              <PremiumChoice
                key={key}
                label={label}
                selected={draft.sort === key}
                onPress={() =>
                  change({ sort: key as PrizeTicketFilters["sort"] })
                }
              />
            ))}
          </View>
          {!!error && <PremiumMessage error message={error} />}
          <PremiumButton title="Aplicar filtros" onPress={apply} />
          <PremiumButton title="Limpar filtros" onPress={clear} />
        </PremiumPanel>
      )}
      {onBrowseCampaignDrafts && (
        <PremiumButton
          title="Ver campanhas e rascunhos"
          onPress={() => {
            if (isPrizeTicketsSession(client, session))
              onBrowseCampaignDrafts();
          }}
        />
      )}
      {list.kind === "ok" ? (
        <PremiumPanel title="Cotas encontradas">
          <Body>
            {list.data.total}{" "}
            {list.data.total === 1
              ? "registro na consulta"
              : "registros na consulta"}
          </Body>
          {!list.data.items.length && (
            <PremiumMessage
              message={
                page > list.data.pages
                  ? "Esta página não existe mais."
                  : "Nenhuma cota corresponde à consulta."
              }
            />
          )}
          {list.data.items.map((item) => (
            <PremiumPanel key={item.id} title={item.description}>
              <Body muted>{item.campaign.title}</Body>
              {campaigns.kind === "ok" &&
                campaigns.data.some(
                  (c) =>
                    c.id === item.campaign.id && canManagePrizeTicketDraft(c),
                ) && <Body muted>Rascunho privado</Body>}
              <Body>
                {prizeTicketStates[item.state]} · {prizeTicketTypes[item.type]}{" "}
                · {money.format(item.value)}
              </Body>
              <Body muted>
                {item.number === null
                  ? "Número não atribuído"
                  : `Número da cota: ${item.number}`}
              </Body>
              <PremiumButton
                title="Ver detalhes e histórico"
                onPress={() => {
                  if (isPrizeTicketsSession(client, session)) setActive(item);
                }}
              />
            </PremiumPanel>
          ))}
          {list.data.pages > 1 && (
            <Body muted>
              Página {page} de {list.data.pages}
            </Body>
          )}
          {page > 1 && (
            <PremiumButton
              title="Cotas anteriores"
              onPress={() =>
                setPage(Math.max(1, Math.min(page - 1, list.data.pages)))
              }
            />
          )}
          {page < list.data.pages && (
            <PremiumButton
              title="Mais cotas"
              onPress={() => setPage((p) => p + 1)}
            />
          )}
        </PremiumPanel>
      ) : (
        <State title="Cotas encontradas" state={list.kind} retry={reload} />
      )}
      <PremiumButton title="Atualizar cotas" onPress={reload} />
    </PremiumPage>
  );
}

function DraftPicker({
  campaigns,
  onOpen,
}: {
  campaigns: PrizeTicketCampaign[];
  onOpen: (id: string) => void;
}) {
  const drafts = campaigns.filter(canManagePrizeTicketDraft);
  return drafts.length ? (
    <>
      {drafts.map((draft) => (
        <PremiumButton
          key={draft.id}
          title={draft.title}
          onPress={() => onOpen(draft.id)}
        />
      ))}
    </>
  ) : (
    <PremiumMessage message="Nenhuma campanha sua está apta à edição aqui. Abra Campanhas para criar um rascunho." />
  );
}
function TicketDetail({
  client,
  session,
  item,
  back,
}: Props & { item: OrganizerPrizeTicket; back: () => void }) {
  const [attempt, setAttempt] = useState(0);
  const delivery = deliveryRecordStatus(item);
  const history = useRead<PrizeTicketEvent[]>(
    `${session.organizerId}:${session.revision}:${item.id}:${attempt}`,
    () => loadPrizeTicketHistory(client, session, item.id),
  );
  return (
    <PremiumPage title="Cota premiada" top={false} bottom>
      <PremiumButton title="Voltar para cotas" onPress={back} />
      {history.kind === "ok" ? (
        <>
          <PremiumPanel title={item.description}>
            <Body muted>{item.campaign.title}</Body>
            <Body>
              {prizeTicketStates[item.state]} · {prizeTicketTypes[item.type]} ·{" "}
              {money.format(item.value)}
            </Body>
            <Body>
              {item.number === null
                ? "Número não atribuído"
                : `Número da cota: ${item.number}`}
            </Body>
            <Body muted>
              {item.quantity} na configuração · {item.foundCount}{" "}
              identificada(s)
            </Body>
            <Body muted>Cadastro: {isoToLocale(item.createdAt)}</Body>
            {item.reservation && (
              <PremiumMessage
                message={`Reserva até ${isoToLocale(item.reservation.expiresAt)}. Reserva não confirma prêmio ou pagamento.`}
              />
            )}
            {item.result && (
              <Body>
                Resultado da cota: {resultLabels[item.result.status]} ·{" "}
                {isoToLocale(item.result.identifiedAt)}
              </Body>
            )}
            {item.result?.winnerLabel && (
              <Body>Participante identificado: {item.result.winnerLabel}</Body>
            )}
            {item.result?.orderReference && (
              <Body muted>
                Referência do pedido: {item.result.orderReference}
              </Body>
            )}
            {delivery === "matched" && item.result?.deliveredAt && (
              <Body muted>
                Marcação de entrega consistente com o resultado ·{" "}
                {isoToLocale(item.result.deliveredAt)}
              </Body>
            )}
            {delivery === "inconsistent" && (
              <PremiumMessage
                error
                message="Há marcação de entrega, mas os registros da cota e do resultado não conferem. Não considere o prêmio entregue."
              />
            )}
            {delivery === "not-recorded" && item.result && (
              <Body muted>Nenhuma entrega confirmada nos registros.</Body>
            )}
            {item.result && (
              <Body muted>
                Consulta dos registros da plataforma. Esta tela não registra
                entregas nem comprova pagamento.
              </Body>
            )}
          </PremiumPanel>
          <PremiumPanel title="Histórico">
            {!history.data.length && (
              <PremiumMessage message="Nenhum evento de histórico registrado para esta cota." />
            )}
            {history.data.map((event) => (
              <View key={event.id}>
                <Body>{event.action}</Body>
                <Body muted>{isoToLocale(event.createdAt)}</Body>
              </View>
            ))}
          </PremiumPanel>
        </>
      ) : (
        <State
          title="Histórico"
          state={history.kind}
          retry={() => setAttempt((a) => a + 1)}
        />
      )}
    </PremiumPage>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 20, overflow: "hidden", padding: 16, gap: 5 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { minWidth: 95, flexBasis: "44%", flexGrow: 1 },
});
