import React, { useEffect, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { client } from "../auth/runtime";
import { money } from "../components/ui";
import { NativeOrganizerCampaignLifecycle } from "../components/NativeOrganizerCampaignLifecycle";
import { isEditableOrganizerCampaign } from "../domain/organizer-draft";
import {
  PremiumButton,
  PremiumGradient,
  PremiumMessage,
  PremiumPage,
  PremiumPanel,
  premiumTypography,
  usePremiumTheme,
} from "../theme/premium";
import { organizerDashboardSession, type DashboardSession } from "./dashboard";
import {
  campaignStateLabel,
  loadOrganizerWorkspace,
  parseOwnedCampaign,
  parseOwnedCampaignList,
  validCampaignId,
  type OrganizerCampaignView,
} from "./campaign-workspace";

type LoadState<T> = { kind: "loading" } | { kind: "error" } | { kind: "ready"; value: T };

function useActiveOrganizer() {
  useSyncExternalStore(client.subscribe, client.snapshot);
  useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  const focused = useIsFocused();
  const session = organizerDashboardSession(client);
  return focused && session ? session : null;
}

function useWorkspace<T>(
  session: DashboardSession,
  path: string,
  decode: (data: unknown, organizerId: string) => T,
) {
  const { organizerId, revision } = session;
  const [attempt, retry] = useState(0);
  const [record, set] = useState<{ attempt: number; value: LoadState<T> }>();
  useEffect(() => {
    let active = true;
    void loadOrganizerWorkspace(client, { organizerId, revision }, path, decode)
      .then((value) => {
        if (active && value !== null) set({ attempt, value: { kind: "ready", value } });
      })
      .catch(() => {
        if (active) set({ attempt, value: { kind: "error" } });
      });
    return () => {
      active = false;
    };
  }, [attempt, organizerId, revision, path, decode]);
  const state: LoadState<T> = record?.attempt === attempt ? record.value : { kind: "loading" };
  return { state, refresh: () => retry((value) => value + 1) };
}

function StatusBadge({ status }: { status: string }) {
  const t = usePremiumTheme();
  return (
    <View style={[styles.badge, { backgroundColor: t.tint }]}>
      <Text style={[premiumTypography.label, { color: t.accent }]}>
        {campaignStateLabel(status)}
      </Text>
    </View>
  );
}

function CampaignProgress({ progress }: { progress: OrganizerCampaignView["progress"] }) {
  const t = usePremiumTheme();
  if (!progress) return null;
  const quantity = new Intl.NumberFormat("pt-BR");
  return (
    <View style={styles.progress}>
      <Text style={[premiumTypography.body, { color: t.muted }]}>
        {quantity.format(progress.sold)} de {quantity.format(progress.total)} títulos vendidos
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Percentual de títulos vendidos"
        accessibilityValue={{ min: 0, max: 100, now: progress.percent }}
        style={[styles.track, { backgroundColor: t.tint }]}
      >
        {progress.percent > 0 && (
          <View
            style={[styles.fill, { width: `${progress.percent}%`, backgroundColor: t.purple }]}
          />
        )}
      </View>
    </View>
  );
}

function WorkspaceError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <PremiumPanel>
      <PremiumMessage error message={message} />
      <PremiumButton title="Tentar novamente" onPress={onRetry} />
    </PremiumPanel>
  );
}

function Loading() {
  const t = usePremiumTheme();
  return <ActivityIndicator color={t.accent} accessibilityLabel="Carregando campanhas" />;
}

export function NativeOrganizerCampaignList({
  onNew,
  onOpen,
}: {
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const session = useActiveOrganizer();
  return (
    <PremiumPage title="Campanhas">
      {session && (
        <CampaignList
          key={`${session.organizerId}:${session.revision}`}
          session={session}
          onNew={onNew}
          onOpen={onOpen}
        />
      )}
    </PremiumPage>
  );
}

function CampaignList({
  session,
  onNew,
  onOpen,
}: {
  session: DashboardSession;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const t = usePremiumTheme();
  const { state, refresh } = useWorkspace(session, "/campaigns/my", parseOwnedCampaignList);
  return (
    <>
      <View style={[styles.hero, { backgroundColor: t.purple }]}>
        <PremiumGradient />
        <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.white }]}>
          Suas campanhas
        </Text>
        <Text style={[premiumTypography.body, { color: t.white }]}>
          Acompanhe a situação e edite suas campanhas em um só lugar.
        </Text>
        <PremiumButton
          title="Criar rascunho"
          testID="sortex-organizer-campaign-new"
          onPress={onNew}
        />
      </View>
      {state.kind === "loading" && <Loading />}
      {state.kind === "error" && (
        <WorkspaceError message="Não foi possível consultar suas campanhas." onRetry={refresh} />
      )}
      {state.kind === "ready" && (
        <>
          {!state.value.length && (
            <PremiumPanel>
              <PremiumMessage message="Você ainda não tem campanhas. Crie um rascunho para começar." />
            </PremiumPanel>
          )}
          {state.value.map((item) => (
            <PremiumPanel key={item.id} title={item.title}>
              <StatusBadge status={item.status} />
              {item.publicationBlocked === true && (
                <PremiumMessage message="Publicação bloqueada." />
              )}
              <PremiumMessage
                message={
                  item.shortDescription || item.mainPrizeName || "Confira os dados da campanha."
                }
              />
              {item.numberPrice !== undefined && (
                <Text style={[premiumTypography.label, { color: t.text }]}>
                  {money(item.numberPrice)} por título
                </Text>
              )}
              <CampaignProgress progress={item.progress} />
              <PremiumButton
                title="Ver campanha"
                testID={`sortex-organizer-campaign-open-${item.id}`}
                onPress={() => onOpen(item.id)}
              />
            </PremiumPanel>
          ))}
        </>
      )}
    </>
  );
}

export function NativeOrganizerCampaignDetails({
  campaignId,
  onEdit,
  onPrizes,
  onOrders,
}: {
  campaignId: unknown;
  onEdit: (id: string) => void;
  onPrizes: (id: string) => void;
  onOrders: (id: string) => void;
}) {
  const session = useActiveOrganizer();
  return (
    <PremiumPage title="Detalhes da campanha" top={false} bottom>
      {session &&
        (validCampaignId(campaignId) ? (
          <CampaignDetails
            key={`${session.organizerId}:${session.revision}:${campaignId}`}
            session={session}
            campaignId={campaignId}
            onEdit={onEdit}
            onPrizes={onPrizes}
            onOrders={onOrders}
          />
        ) : (
          <PremiumMessage error message="Abra a campanha novamente pela lista." />
        ))}
    </PremiumPage>
  );
}

function CampaignDetails({
  session,
  campaignId,
  onEdit,
  onPrizes,
  onOrders,
}: {
  session: DashboardSession;
  campaignId: string;
  onEdit: (id: string) => void;
  onPrizes: (id: string) => void;
  onOrders: (id: string) => void;
}) {
  const decode = React.useCallback(
    (data: unknown, organizerId: string) => parseOwnedCampaign(data, organizerId, campaignId),
    [campaignId],
  );
  const { state, refresh } = useWorkspace(
    session,
    `/campaigns/${encodeURIComponent(campaignId)}`,
    decode,
  );
  if (state.kind === "loading") return <Loading />;
  if (state.kind === "error")
    return (
      <WorkspaceError
        message="Não foi possível confirmar os dados desta campanha."
        onRetry={refresh}
      />
    );
  const campaign = state.value;
  return (
    <>
      <PremiumPanel title={campaign.title}>
        <StatusBadge status={campaign.status} />
        {campaign.publicationBlocked === true && <PremiumMessage message="Publicação bloqueada." />}
        <PremiumMessage
          message={campaign.description || campaign.shortDescription || "Sem descrição adicional."}
        />
        {campaign.numberPrice !== undefined && (
          <PremiumMessage message={`Título: ${money(campaign.numberPrice)}`} />
        )}
        <PremiumMessage message={`Prêmio: ${campaign.mainPrizeName || "Consulte o regulamento"}`} />
        <CampaignProgress progress={campaign.progress} />
      </PremiumPanel>
      <PremiumPanel title="Regulamento">
        <PremiumMessage message={campaign.regulation || "Não informado."} />
      </PremiumPanel>
      {isEditableOrganizerCampaign(campaign.status) && (
        <PremiumButton
          filled
          title={campaign.status === "DRAFT" ? "Editar rascunho" : "Editar campanha"}
          testID="sortex-organizer-campaign-edit"
          onPress={() => onEdit(campaignId)}
        />
      )}
      {campaign.status === "DRAFT" && campaign.publishedAt === null && (
        <PremiumButton title="Gerenciar cotas premiadas" onPress={() => onPrizes(campaignId)} />
      )}
      <NativeOrganizerCampaignLifecycle
        client={client}
        accountId={session.organizerId}
        campaign={campaign}
        onRefresh={refresh}
      />
      <PremiumButton
        title="Acompanhar pedidos e participantes"
        onPress={() => onOrders(campaignId)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 24, overflow: "hidden", padding: 16, gap: 10 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 18 },
  progress: { gap: 5 },
  track: { height: 8, overflow: "hidden", borderRadius: 8 },
  fill: { height: "100%", borderRadius: 8 },
});
