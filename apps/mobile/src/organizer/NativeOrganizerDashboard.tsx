import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Svg, { Line, Polyline } from "react-native-svg";
import { client } from "../auth/runtime";
import { money } from "../components/ui";
import {
  PremiumButton, PremiumGradient, PremiumPage, premiumShadow, premiumTypography, usePremiumTheme,
} from "../theme/premium";
import {
  loadOrganizerDashboard, organizerDashboardSession,
  type Dashboard, type DashboardCampaign, type DashboardSession,
} from "./dashboard";
import { chartFor, dayInSaoPaulo, loadDashboardPeriod, parseCustomPeriod, periodFor,
  type Period, type PeriodDashboard, type PeriodKey } from "./dashboard-period";

type Actions = {
  onCampaigns: () => void;
  onCampaign: (campaign: DashboardCampaign) => void;
  onCreate: () => void;
  onFinance: () => void;
  onPayout: () => void;
  onProfile: () => void;
  onCopilot: () => void;
  onNotifications: () => void;
  onDraw: () => void;
  onShare: () => void;
};
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const count = new Intl.NumberFormat("pt-BR");
const campaignStatus: Record<DashboardCampaign["status"], string> = {
  DRAFT: "Rascunho", PENDING_REVIEW: "Em análise", PUBLISHED: "Publicada", PAUSED: "Pausada",
  SOLD_OUT: "Esgotada", DRAWN: "Apurada", FINISHED: "Finalizada", CANCELLED: "Cancelada",
};
const filters = [["today", "Hoje"], ["week", "7 dias"], ["month", "30 dias"],
  ["year", "12 meses"], ["custom", "Personalizado"]] as const;

export function OrganizerDashboardHome({ greeting, initial, ...actions }: Actions & { greeting: string; initial: string }) {
  const focused = useIsFocused();
  useSyncExternalStore(client.subscribe, client.snapshot);
  useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  const session = organizerDashboardSession(client);
  const t = usePremiumTheme();
  return (
    <PremiumPage>
      <View style={styles.header}>
        <Text accessibilityLabel="SorteX" style={[styles.logo, { color: t.text }]}>Sorte<Text style={{ color: t.accent }}>X</Text></Text>
        <HeaderAction title="Notificações" icon="🔔" onPress={actions.onNotifications} />
        <HeaderAction title="Perfil" icon={initial} filled onPress={actions.onProfile} />
      </View>
      <View style={[styles.badge, { backgroundColor: t.tint }]}>
        <Text style={[premiumTypography.label, { color: t.accent }]}>Ambiente de homologação</Text>
      </View>
      <View>
        <Text accessibilityRole="header" style={[premiumTypography.title, { color: t.text }]}>{greeting} 👋</Text>
        <Text style={[premiumTypography.body, { color: t.muted, marginTop: 4 }]}>Acompanhe sua operação.</Text>
      </View>
      {focused && session && (
        <DashboardContent key={`${session.organizerId}:${session.revision}`} session={session} {...actions} />
      )}
    </PremiumPage>
  );
}

type State = { kind: "loading" | "error" } | { kind: "ok"; data: Dashboard };
type PeriodState = { kind: "loading" | "error" | "legacy" } | { kind: "ok"; data: PeriodDashboard };

function DashboardContent({ session: { organizerId, revision }, ...actions }: Actions & { session: DashboardSession }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [selected, setSelected] = useState<PeriodKey>("week");
  const [custom, setCustom] = useState<Period | null>(null);
  const [inputs, setInputs] = useState({ start: "", end: "" });
  const [customError, setCustomError] = useState(false);
  const [periodState, setPeriodState] = useState<{ key: string; result: PeriodState } | null>(null);
  const [periodRetry, setPeriodRetry] = useState(0);
  const request = useRef<symbol | null>(null);
  const load = useCallback(async () => {
    if (request.current) return;
    const ticket = Symbol();
    request.current = ticket;
    setState({ kind: "loading" });
    try {
      const data = await loadOrganizerDashboard(client, { organizerId, revision });
      if (request.current === ticket && data) setState({ kind: "ok", data });
    } catch {
      if (request.current === ticket) setState({ kind: "error" });
    } finally {
      if (request.current === ticket) request.current = null;
    }
  }, [organizerId, revision]);

  useEffect(() => {
    void load();
    return () => { request.current = null; };
  }, [load]);

  const dashboard = state.kind === "ok" ? state.data : null;
  const today = dashboard ? dayInSaoPaulo(dashboard.generatedAt) : null;
  const period = today ? (selected === "custom" ? custom : periodFor(selected, today)) : null;
  const start = period?.start, end = period?.end;
  const key = start && end ? `${dashboard?.generatedAt}:${start}:${end}:${periodRetry}` : null;

  useEffect(() => {
    if (!key || !start || !end) return;
    let active = true;
    void loadDashboardPeriod(client, { organizerId, revision }, { start, end }).then((result) => {
      if (active && result.kind !== "stale") setPeriodState({ key, result });
    }).catch(() => {
      if (active) setPeriodState({ key, result: { kind: "error" } });
    });
    return () => { active = false; };
  }, [key, start, end, organizerId, revision]);

  const current = periodState?.key === key ? periodState?.result : undefined;
  const useLegacy = current?.kind === "legacy";
  const utcDay = dashboard?.generatedAt.slice(0, 10);
  const legacyPeriod = useLegacy && utcDay && today && period ?
    (selected === "custom" ? period : periodFor(selected, utcDay)) : null;
  const safeLegacyPeriod = legacyPeriod && utcDay &&
    legacyPeriod.start >= periodFor("year", utcDay).start && legacyPeriod.end <= utcDay ? legacyPeriod : null;
  const chart = current?.kind === "ok" && current.data.revenueHistory && period
    ? chartFor(current.data.revenueHistory, period)
    : dashboard?.revenueHistory && safeLegacyPeriod ? chartFor(dashboard.revenueHistory, safeLegacyPeriod) : null;
  const revenue = current?.kind === "ok" ? current.data.summary.grossRevenue :
    useLegacy && chart ? chart.reduce((sum, value) => sum + value, 0) : undefined;
  const summary = current?.kind === "ok" ? current.data.summary : useLegacy ? dashboard?.summary : null;
  const t = usePremiumTheme();

  return (
    <>
      {state.kind === "loading" && (
        <ActivityIndicator accessibilityLabel="Carregando painel do organizador" color={t.accent} />
      )}
      {state.kind === "error" && (
        <View style={[styles.surface, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text accessibilityRole="alert" style={[premiumTypography.body, { color: t.text }]}>Não foi possível carregar o painel. Nenhum total foi exibido.</Text>
          <PremiumButton title="Tentar novamente" onPress={() => void load()} />
        </View>
      )}
      {dashboard && (
        <>
          <View style={[styles.ticketShell, premiumShadow, { backgroundColor: t.blue }]}>
            <View style={styles.ticket}>
              <PremiumGradient />
              <View pointerEvents="none" style={[styles.notchLeft, { backgroundColor: t.bg }]} />
              <View pointerEvents="none" style={[styles.notchRight, { backgroundColor: t.bg }]} />
              <Text style={styles.ticketCaption}>Vendas confirmadas · {filters.find(([filter]) => filter === selected)?.[1]}</Text>
              <Text accessibilityRole="header" style={styles.ticketValue}>{revenue === undefined ? "—" : money(revenue)}</Text>
              {chart ? <RevenueChart values={chart} /> :
                <Text style={styles.ticketMuted}>{!period ? "Selecione um período." :
                  current?.kind === "error" ? "Não foi possível carregar o período." :
                  current?.kind === "legacy" ? "Histórico indisponível para este período." :
                  !current ? "Carregando período…" : "Evolução não disponível para este período."}</Text>}
              {useLegacy && chart && <Text style={styles.ticketMuted}>Histórico por datas em UTC.</Text>}
              {current?.kind === "ok" && <Text style={styles.ticketMuted}>Datas de Brasília.</Text>}
              {current?.kind === "error" && <PremiumButton title="Tentar carregar período novamente" onPress={() => setPeriodRetry((value) => value + 1)} />}
              <View style={styles.ticketRule} />
              {useLegacy && <Text style={styles.ticketMuted}>Totais abaixo abrangem todo o histórico.</Text>}
              <View style={styles.ticketMetrics}>
                <TicketMetric label="Títulos" value={summary ? count.format(summary.soldTickets) : "—"} />
                <TicketMetric label="Participantes" value={summary ? count.format(summary.participants) : "—"} />
                <TicketMetric label="Ticket médio" value={summary?.averageTicket === undefined ? "—" : money(summary.averageTicket)} />
              </View>
            </View>
          </View>
          <Text style={[premiumTypography.body, { color: t.muted }]}>Valor bruto de pedidos pagos. Não representa saldo disponível ou repasse.</Text>
          <View style={[styles.filters, { backgroundColor: t.surface, borderColor: t.line }]}>
            {filters.map(([filter, label]) => (
              <Pressable key={filter} accessibilityRole="radio" accessibilityState={{ checked: selected === filter }}
                accessibilityLabel={label} onPress={() => setSelected(filter)}
                style={[styles.filter, selected === filter && { backgroundColor: t.selected }]}>
                <Text style={[premiumTypography.label, { textAlign: "center", color: selected === filter ? t.white : t.muted }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {selected === "custom" && (
            <View style={[styles.surface, { backgroundColor: t.surface, borderColor: t.line }]}>
              {([["start", "Data inicial"], ["end", "Data final"]] as const).map(([field, label]) => (
                <View key={field}>
                  <Text style={[premiumTypography.label, { color: t.text, marginBottom: 4 }]}>{label}</Text>
                  <TextInput accessibilityLabel={label} placeholder="DD/MM/AAAA" placeholderTextColor={t.muted}
                    value={inputs[field]} maxLength={10}
                    onChangeText={(value) => {
                      const parts = value.replace(/[^0-9]/g, "").slice(0, 8).match(/^(\d{0,2})(\d{0,2})(\d{0,4})$/);
                      setInputs((old) => ({ ...old, [field]: parts?.slice(1).filter(Boolean).join("/") ?? "" }));
                      setCustom(null);
                      setCustomError(false);
                    }}
                    keyboardType="number-pad"
                    style={[styles.input, { borderColor: t.line, color: t.text }]} />
                </View>
              ))}
              {customError && <Text accessibilityRole="alert" style={{ color: t.text }}>Informe datas válidas, em ordem, até hoje e em um intervalo de até 367 dias.</Text>}
              <PremiumButton title="Aplicar período" onPress={() => {
                const result = today ? parseCustomPeriod(inputs.start, inputs.end, today) : null;
                setCustom(result);
                setCustomError(!result);
              }} />
            </View>
          )}
        </>
      )}
      <View style={styles.quickRow}>
        <QuickAction title="Criar" icon="＋" onPress={actions.onCreate} />
        <QuickAction title="Sortear" icon="🏆" hint="Consultar disponibilidade da apuração" onPress={actions.onDraw} />
        <QuickAction title="Divulgar" icon="🔗" onPress={actions.onShare} />
        <QuickAction title="Sacar" icon="💸" hint="Consultar disponibilidade e abrir o financeiro" onPress={actions.onPayout} />
      </View>
      <View style={[styles.copilot, { backgroundColor: t.deep }]}>
        <PremiumGradient from="#191238" to="#402087" />
        <Text style={[premiumTypography.label, { color: "#DCCFFF" }]}>✦ Copilot</Text>
        <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.white }]}>IA SorteX ainda não conectada</Text>
        <Text style={[premiumTypography.body, { color: "#EBE4FF" }]}>Recomendações da operação serão exibidas após a validação de um provedor. Nenhuma ação é executada automaticamente.</Text>
        <PremiumButton title="Abrir Copilot" filled onPress={actions.onCopilot} />
      </View>
      {dashboard && (
        <>
          <View style={[styles.surface, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.text }]}>Visão geral</Text>
            <Text style={[premiumTypography.body, { color: t.text }]}>{count.format(dashboard.campaigns.length)} campanhas · {count.format(dashboard.summary.activeCampaigns)} ativas</Text>
            <PremiumButton title="Minhas campanhas" onPress={actions.onCampaigns} />
            <PremiumButton title="Consultar financeiro e extrato" onPress={actions.onFinance} />
          </View>
          <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.text }]}>Campanhas recentes</Text>
          {!dashboard.campaigns.length && <Text style={{ color: t.muted }}>Você ainda não tem campanhas.</Text>}
          {dashboard.campaigns.slice(0, 3).map((campaign) => (
            <View style={[styles.surface, { backgroundColor: t.surface, borderColor: t.line }]} key={campaign.id}>
              <Text accessibilityRole="header" style={[premiumTypography.label, { color: t.text }]}>{campaign.title}</Text>
              <Text style={[premiumTypography.body, { color: t.muted }]}>
                {campaign.publicationBlocked ? "Publicação bloqueada" : campaignStatus[campaign.status]} · {campaign.soldNumbers} de {campaign.totalNumbers} títulos registrados como vendidos
              </Text>
              <PremiumButton title="Ver campanha" onPress={() => actions.onCampaign(campaign)} />
            </View>
          ))}
          <Text style={{ color: t.muted }}>Atualizado em {date.format(new Date(dashboard.generatedAt))}</Text>
          <PremiumButton title="Atualizar painel" onPress={() => void load()} />
        </>
      )}
    </>
  );
}

function RevenueChart({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const coords = (values.length > 1 ? values : [values[0], values[0]]).map((value, i, series) =>
    `${3 + (294 * i) / (series.length - 1)},${47 - ((value ?? 0) * 42) / max}`).join(" ");
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Evolução das vendas em ${values.length} pontos. Maior valor: ${money(Math.max(0, ...values))}.`}>
      <Svg width="100%" height={46} viewBox="0 0 300 52" preserveAspectRatio="none" accessible={false}>
        <Line x1="0" x2="300" y1="50" y2="50" stroke="#FFFFFF" strokeOpacity={0.45} strokeDasharray="4 5" />
        <Polyline points={coords} fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

function TicketMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.ticketMuted}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function HeaderAction({ title, icon, onPress, filled = false }: { title: string; icon: string; onPress: () => void; filled?: boolean }) {
  const t = usePremiumTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}
      style={({ pressed }) => [styles.headerButton, { backgroundColor: filled ? t.purple : t.surface,
        borderColor: filled ? t.purple : t.line, opacity: pressed ? 0.75 : 1 }]}>
      {filled && <PremiumGradient />}
      <Text accessible={false} style={{ fontSize: 19, fontWeight: "800", color: filled ? t.white : t.text }}>{icon}</Text>
    </Pressable>
  );
}

function QuickAction({ title, hint, icon, onPress }: { title: string; hint?: string; icon: string; onPress: () => void }) {
  const t = usePremiumTheme();
  const { width, fontScale } = useWindowDimensions();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint} onPress={onPress}
      style={({ pressed }) => [styles.quickAction, { opacity: pressed ? 0.7 : 1,
        flexBasis: fontScale > 1.3 || width < 330 ? "45%" : "22%" }]}>
      <View style={[styles.quickIcon, premiumShadow, { borderColor: t.line, backgroundColor: t.surface }]}>
        <Text accessible={false} allowFontScaling={false} style={{ fontSize: 24, color: t.text }}>{icon}</Text>
      </View>
      <Text style={[premiumTypography.label, { color: t.text, textAlign: "center" }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  logo: { flex: 1, fontSize: 26, fontWeight: "900", letterSpacing: -1.2 },
  headerButton: { width: 46, height: 46, borderRadius: 14, borderWidth: 1, overflow: "hidden",
    alignItems: "center", justifyContent: "center" },
  badge: { alignSelf: "flex-start", borderRadius: 30, paddingVertical: 5, paddingHorizontal: 11 },
  ticketShell: { borderRadius: 26 },
  ticket: { borderRadius: 26, padding: 20, gap: 9, overflow: "hidden" },
  notchLeft: { position: "absolute", top: "56%", left: -9, width: 18, height: 18, borderRadius: 9 },
  notchRight: { position: "absolute", top: "56%", right: -9, width: 18, height: 18, borderRadius: 9 },
  ticketCaption: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  ticketValue: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", letterSpacing: -1.1 },
  ticketMuted: { color: "#F2EEFF", fontSize: 13, lineHeight: 18 },
  ticketRule: { borderBottomWidth: 1, borderStyle: "dashed", borderColor: "#FFFFFF80" },
  ticketMetrics: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 7 },
  metric: { gap: 3, minWidth: 65 },
  metricValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  filters: { borderWidth: 1, borderRadius: 16, padding: 4, gap: 3, flexDirection: "row", flexWrap: "wrap" },
  filter: { minHeight: 44, paddingHorizontal: 9, borderRadius: 12, justifyContent: "center", flexGrow: 1 },
  surface: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 8 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 7 },
  quickAction: { alignItems: "center", gap: 7, minHeight: 76 },
  quickIcon: { width: 52, height: 52, borderRadius: 18, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  copilot: { borderRadius: 22, padding: 15, gap: 9, overflow: "hidden" },
});
