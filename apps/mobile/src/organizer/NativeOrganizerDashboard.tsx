import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { client } from "../auth/runtime";
import { Button, Notice, Page, colors, money, s } from "../components/ui";
import {
  loadOrganizerDashboard,
  organizerDashboardSession,
  type Dashboard,
  type DashboardCampaign,
  type DashboardSession,
} from "./dashboard";

type Actions = {
  onCampaigns: () => void;
  onCampaign: (campaign: DashboardCampaign) => void;
  onFinance: () => void;
};
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
const campaignStatus: Record<DashboardCampaign["status"], string> = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Em análise",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
  SOLD_OUT: "Esgotada",
  DRAWN: "Apurada",
  FINISHED: "Finalizada",
  CANCELLED: "Cancelada",
};

export function OrganizerDashboardHome({
  greeting,
  ...actions
}: Actions & { greeting: string }) {
  const focused = useIsFocused();
  useSyncExternalStore(client.subscribe, client.snapshot);
  useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  const session = organizerDashboardSession(client);
  return (
    <Page title={greeting}>
      <Notice message="Desenvolvimento · somente dados sintéticos" />
      {focused && session ? (
        <DashboardContent
          key={`${session.organizerId}:${session.revision}`}
          session={session}
          {...actions}
        />
      ) : null}
    </Page>
  );
}

type State = { kind: "loading" | "error" } | { kind: "ok"; data: Dashboard };

function DashboardContent({
  session: { organizerId, revision },
  onCampaigns,
  onCampaign,
  onFinance,
}: Actions & { session: DashboardSession }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const request = useRef<symbol | null>(null);
  const load = useCallback(async () => {
    if (request.current) return;
    const ticket = Symbol();
    request.current = ticket;
    setState({ kind: "loading" });
    try {
      const data = await loadOrganizerDashboard(client, {
        organizerId,
        revision,
      });
      if (request.current === ticket && data) setState({ kind: "ok", data });
    } catch {
      if (request.current === ticket) setState({ kind: "error" });
    } finally {
      if (request.current === ticket) request.current = null;
    }
  }, [organizerId, revision]);

  useEffect(() => {
    void load();
    return () => {
      request.current = null;
    };
  }, [load]);

  return (
    <>
      <Button secondary title="Minhas campanhas" onPress={onCampaigns} />
      <Button
        secondary
        title="Consultar financeiro e extrato"
        onPress={onFinance}
      />
      {state.kind === "loading" && (
        <ActivityIndicator
          accessibilityLabel="Carregando painel do organizador"
          color={colors.purple}
        />
      )}
      {state.kind === "error" && (
        <View style={s.card}>
          <Notice
            error
            message="Não foi possível carregar os indicadores do painel. Nenhum total foi exibido."
          />
          <Button
            secondary
            title="Tentar novamente"
            onPress={() => void load()}
          />
        </View>
      )}
      {state.kind === "ok" && (
        <>
          <View style={s.card}>
            <Text accessibilityRole="header" style={s.label}>
              Visão geral
            </Text>
            <Text style={s.text}>
              Campanhas cadastradas: {state.data.campaigns.length}
            </Text>
            <Text style={s.text}>
              Campanhas ativas: {state.data.summary.activeCampaigns}
            </Text>
            <Text style={s.muted}>
              Publicadas ou esgotadas, sem bloqueio de publicação.
            </Text>
            <Text style={s.text}>
              Títulos em pedidos pagos: {state.data.summary.soldTickets}
            </Text>
            <Text style={s.text}>
              Compradores únicos com pedidos pagos:{" "}
              {state.data.summary.participants}
            </Text>
          </View>
          <View style={s.card}>
            <Text accessibilityRole="header" style={s.label}>
              Valor bruto dos pedidos pagos registrados
            </Text>
            <Text style={s.title}>
              {money(state.data.summary.grossRevenue)}
            </Text>
            <Text style={s.muted}>
              Não é saldo disponível, repasse ou liquidação do provedor.
              Consulte o financeiro para os saldos internos.
            </Text>
          </View>
          {state.data.campaigns.length === 0 ? (
            <Notice message="Você ainda não tem campanhas." />
          ) : (
            <Text accessibilityRole="header" style={s.label}>
              Campanhas recentes
            </Text>
          )}
          {state.data.campaigns.slice(0, 3).map((campaign) => (
            <View style={s.card} key={campaign.id}>
              <Text accessibilityRole="header" style={s.label}>
                {campaign.title}
              </Text>
              <Text style={s.text}>
                {campaign.publicationBlocked
                  ? "Publicação bloqueada"
                  : campaignStatus[campaign.status]}
              </Text>
              <Text style={s.muted}>
                {campaign.soldNumbers} de {campaign.totalNumbers} títulos
                registrados como vendidos
              </Text>
              <Button
                secondary
                title="Ver campanha"
                onPress={() => onCampaign(campaign)}
              />
            </View>
          ))}
          <Text style={s.muted}>
            Atualizado em {date.format(new Date(state.data.generatedAt))}
          </Text>
          <Button
            secondary
            title="Atualizar painel"
            onPress={() => void load()}
          />
        </>
      )}
    </>
  );
}
