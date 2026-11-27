import React, { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Stop } from "react-native-svg";
import { client } from "../auth/runtime";
import { money } from "../components/ui";
import {
  PremiumButton, PremiumGradient, PremiumPage, premiumShadow, premiumTypography, usePremiumTheme,
} from "../theme/premium";
import {
  loadOrganizerDashboard, organizerDashboardSession,
  type Dashboard, type DashboardCampaign, type DashboardSession,
} from "./dashboard";
import { OrganizerIcon, type OrganizerIconName } from "./OrganizerIcons";
import { organizerChartBounds, organizerRevenueGeometry } from "./premium-chart";
import { DEFAULT_DASHBOARD_PERIOD, chartBucketsFor, dayInSaoPaulo, legacyHistoryCovers, legacyUtcRange, loadDashboardPeriod, parseCustomPeriod, periodFor,
  type Period, type PeriodDashboard, type PeriodKey, type RevenueBucket } from "./dashboard-period";

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
const dateLabel = (day: string) => day.split("-").reverse().join("/");
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
      <View style={styles.hero}>
        <View style={styles.header}>
          <Text accessibilityLabel="SorteX" style={[styles.logo, { color: t.text }]}>Sorte<Text style={{ color: t.accent }}>X</Text></Text>
          <HeaderAction title="Notificações" hint="Consultar a disponibilidade das notificações do organizador" onPress={actions.onNotifications} />
          <HeaderAction title="Perfil" initial={initial} onPress={actions.onProfile} />
        </View>
        <View style={[styles.badge, { backgroundColor: t.tint }]}>
          <Text style={[premiumTypography.label, { color: t.accent, fontSize: 12 }]}>Ambiente de homologação</Text>
        </View>
        <View>
          <Text accessibilityRole="header" style={[premiumTypography.title, { color: t.text }]}>{greeting}</Text>
          <Text style={[premiumTypography.body, { color: t.muted, marginTop: 3 }]}>Acompanhe sua operação em um só lugar.</Text>
        </View>
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
  const [selected, setSelected] = useState<PeriodKey>(DEFAULT_DASHBOARD_PERIOD);
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
  const displayRange = useLegacy
    ? legacyUtcRange(dashboard?.generatedAt, selected, custom)
    : current?.kind === "ok" ? current.data.period : null;
  const legacyHistory = useLegacy && displayRange && legacyHistoryCovers(dashboard?.generatedAt, displayRange)
    ? dashboard?.revenueHistory : undefined;
  const history = current?.kind === "ok" ? current.data.revenueHistory : legacyHistory;
  const buckets = chartBucketsFor(history, displayRange);
  const chart = buckets.length ? buckets.map(({ revenue }) => revenue) : null;
  const revenue = current?.kind === "ok" ? current.data.summary.grossRevenue :
    useLegacy && chart ? chart.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100 : undefined;
  const rangeCaption = displayRange
    ? `Intervalo: ${dateLabel(displayRange.start)} a ${dateLabel(displayRange.end)} · ${useLegacy ? "UTC" : "Brasília"}`
    : null;
  const summary = current?.kind === "ok" ? current.data.summary : useLegacy ? dashboard?.summary : null;
  // Legacy dashboard summary has no period paid-order count; it must not be estimated from revenue.
  const paidOrders = current?.kind === "ok" ? current.data.summary.paidOrders : undefined;
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
          <View style={styles.salesHeading}>
            <View style={styles.salesHeadingText}>
              <Text style={[premiumTypography.label, { color: t.accent, fontSize: 12 }]}>VENDAS CONFIRMADAS</Text>
              <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.text }]}>Desempenho de vendas</Text>
            </View>
            <View style={[styles.headingIcon, { backgroundColor: t.tint }]}><OrganizerIcon name="ticket" color={t.accent} /></View>
          </View>
          <View accessibilityRole="radiogroup" accessibilityLabel="Período das vendas" style={[styles.filters, { backgroundColor: t.surface, borderColor: t.line }]}>
            {filters.map(([filter, label]) => (
              <Pressable key={filter} accessibilityRole="radio" accessibilityState={{ checked: selected === filter }} aria-checked={selected === filter}
                accessibilityLabel={label} onPress={() => setSelected(filter)}
                style={[styles.filter, { backgroundColor: selected === filter ? t.selected : t.tint }]}>
                <Text style={[premiumTypography.label, { fontSize: 12, textAlign: "center", color: selected === filter ? t.white : t.text }]}>{label}</Text>
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
          <View style={[styles.ticketShell, premiumShadow, { backgroundColor: t.blue }]}>
            <View style={styles.ticket}>
              <PremiumGradient />
              <View pointerEvents="none" style={[styles.notchLeft, { backgroundColor: t.bg }]} />
              <View pointerEvents="none" style={[styles.notchRight, { backgroundColor: t.bg }]} />
              <View style={styles.ticketLabelRow}>
                <OrganizerIcon name="ticket" color={t.white} size={19} />
                <Text style={styles.ticketCaption}>Total bruto confirmado · {filters.find(([filter]) => filter === selected)?.[1]}</Text>
              </View>
              {rangeCaption && <Text style={styles.ticketMuted}>{rangeCaption}</Text>}
              <Text accessibilityRole="header" style={styles.ticketValue}>{revenue === undefined ? "—" : money(revenue)}</Text>
              {chart ? <RevenueChart values={chart} /> :
                <Text style={styles.ticketMuted}>{!period ? "Selecione um período." :
                  current?.kind === "error" ? "Não foi possível carregar o período." :
                  current?.kind === "legacy" ? "Histórico indisponível para este período." :
                  !current ? "Carregando período…" : "Evolução não disponível para este período."}</Text>}
              {useLegacy && <Text style={styles.ticketMuted}>Na versão anterior, os filtros de receita usam os dias UTC do servidor.</Text>}
              {current?.kind === "error" && <PremiumButton title="Tentar carregar período novamente" onPress={() => setPeriodRetry((value) => value + 1)} />}
              <View style={styles.ticketRule} />
              {useLegacy && <Text style={styles.ticketMuted}>Títulos, participantes e ticket médio abrangem todo o histórico, não o período.</Text>}
              <View style={styles.ticketMetrics}>
                <TicketMetric label="Títulos" value={summary ? count.format(summary.soldTickets) : "—"} />
                <TicketMetric label="Participantes" value={summary ? count.format(summary.participants) : "—"} />
                <TicketMetric label="Ticket médio" value={summary?.averageTicket === undefined ? "—" : money(summary.averageTicket)} />
                <TicketMetric label="Pedidos pagos" value={paidOrders === undefined ? "—" : count.format(paidOrders)} />
              </View>
            </View>
          </View>
          <Text style={[premiumTypography.body, { color: t.muted }]}>Valor bruto de pedidos pagos. Não representa saldo disponível ou repasse.</Text>
          {chart && displayRange && (
            <RevenueChartValues key={`${displayRange.start}:${displayRange.end}:${useLegacy}`}
              buckets={buckets} zone={useLegacy ? "UTC" : "Brasília"} />
          )}
        </>
      )}
      <View style={[styles.quickSection, { backgroundColor: t.surface, borderColor: t.line }]}>
        <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.text }]}>Ações rápidas</Text>
        <View style={styles.quickRow}>
          <QuickAction title="Criar" icon="plus" onPress={actions.onCreate} />
          <QuickAction title="Sortear" icon="trophy" hint="Consultar disponibilidade da apuração" onPress={actions.onDraw} />
          <QuickAction title="Divulgar" icon="link" onPress={actions.onShare} />
          <QuickAction title="Sacar" icon="wallet" hint="Consultar disponibilidade e abrir o financeiro" onPress={actions.onPayout} />
        </View>
      </View>
      <View style={[styles.copilot, { backgroundColor: t.deep }]}>
        <PremiumGradient from="#191238" to="#402087" />
        <View style={styles.ticketLabelRow}>
          <OrganizerIcon name="copilot" color="#DCCFFF" size={19} />
          <Text style={[premiumTypography.label, { color: "#DCCFFF" }]}>Copilot</Text>
        </View>
        <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.white }]}>Assistente da sua operação</Text>
        <Text style={[premiumTypography.body, { color: "#EBE4FF" }]}>Consulte o estado da IA SorteX e as análises disponíveis. Nenhuma ação é executada automaticamente.</Text>
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
  const geometry = organizerRevenueGeometry(values);
  const areaID = "sales-area-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  if (!geometry) return null;
  const { width, height, floor } = organizerChartBounds;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={values.length === 1
        ? `Vendas confirmadas em um dia: ${money(geometry.maximum)}.`
        : `Evolução das vendas em ${values.length} pontos. Maior valor: ${money(geometry.maximum)}.`}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" accessible={false} aria-hidden={true}>
        <Defs>
          <LinearGradient id={areaID} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.25} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        {[17, 38, floor].map((y) => <Line key={y} x1={0} x2={width} y1={y} y2={y}
          stroke="#FFFFFF" strokeOpacity={y === floor ? 0.38 : 0.15} strokeDasharray={y === floor ? "4 5" : undefined} />)}
        {geometry.vertex ? (
          <Circle cx={geometry.vertex[0]} cy={geometry.vertex[1]} r={4} fill="#FFFFFF" />
        ) : (
          <>
            <Path d={geometry.area} fill={`url(#${areaID})`} />
            <Polyline points={geometry.points} fill="none" stroke="#FFFFFF" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}
      </Svg>
    </View>
  );
}

function RevenueChartValues({ buckets, zone }: { buckets: RevenueBucket[]; zone: "UTC" | "Brasília" }) {
  const [expanded, setExpanded] = useState(false);
  const t = usePremiumTheme();
  const listID = useId();
  return (
    <View style={[styles.chartValues, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded}
        aria-controls={expanded ? listID : undefined}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.chartValuesToggle, { opacity: pressed ? 0.7 : 1 }]}>
        <Text style={[premiumTypography.label, { color: t.accent, flex: 1 }]}>
          {expanded ? "Ocultar valores do gráfico" : "Ver valores do gráfico"}
        </Text>
        <Text accessibilityElementsHidden importantForAccessibility="no" aria-hidden
          style={[premiumTypography.section, { color: t.accent }]}>{expanded ? "−" : "+"}</Text>
      </Pressable>
      {expanded && (
        <View nativeID={listID} style={styles.chartValuesList}>
          <Text style={[premiumTypography.body, { color: t.muted }]}>Fuso das datas: {zone}</Text>
          {buckets.map(({ first, last, revenue }) => {
            const label = first === last ? dateLabel(first) : `${dateLabel(first)} a ${dateLabel(last)}`;
            return (
              <Text key={first} style={[premiumTypography.body, styles.chartValueRow, { borderColor: t.line, color: t.text }]}>
                {label}: <Text style={{ fontWeight: "700" }}>{money(revenue)}</Text>
              </Text>
            );
          })}
        </View>
      )}
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

function HeaderAction({ title, hint, initial, onPress }: { title: string; hint?: string; initial?: string; onPress: () => void }) {
  const t = usePremiumTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint} onPress={onPress}
      style={({ pressed }) => [styles.headerButton, { backgroundColor: initial ? t.purple : t.surface,
        borderColor: initial ? t.purple : t.line, opacity: pressed ? 0.75 : 1 }]}>
      {initial ? <><PremiumGradient /><Text accessible={false} style={styles.initial}>{initial}</Text></>
        : <OrganizerIcon name="bell" color={t.accent} />}
    </Pressable>
  );
}

function QuickAction({ title, hint, icon, onPress }: { title: string; hint?: string; icon: OrganizerIconName; onPress: () => void }) {
  const t = usePremiumTheme();
  const { width, fontScale } = useWindowDimensions();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={hint} onPress={onPress}
      style={({ pressed }) => [styles.quickAction, { opacity: pressed ? 0.7 : 1,
        flexBasis: fontScale > 1.3 || width < 330 ? "45%" : "22%" }]}>
      <View style={[styles.quickIcon, premiumShadow, { borderColor: t.line, backgroundColor: t.surface }]}>
        <OrganizerIcon name={icon} color={t.accent} size={23} />
      </View>
      <Text style={[premiumTypography.label, { color: t.text, textAlign: "center" }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { gap: 9 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  logo: { flex: 1, fontSize: 26, fontWeight: "900", letterSpacing: -1.2 },
  headerButton: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, overflow: "hidden",
    alignItems: "center", justifyContent: "center" },
  initial: { fontSize: 17, fontWeight: "800", color: "#FFFFFF" },
  salesHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  salesHeadingText: { flex: 1, minWidth: 0, gap: 3 },
  headingIcon: { width: 41, height: 41, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  badge: { alignSelf: "flex-start", borderRadius: 30, paddingVertical: 5, paddingHorizontal: 11 },
  ticketShell: { borderRadius: 26 },
  ticket: { borderRadius: 26, padding: 20, gap: 9, overflow: "hidden" },
  notchLeft: { position: "absolute", top: "56%", left: -9, width: 18, height: 18, borderRadius: 9 },
  notchRight: { position: "absolute", top: "56%", right: -9, width: 18, height: 18, borderRadius: 9 },
  ticketLabelRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  ticketCaption: { flex: 1, color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  ticketValue: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", letterSpacing: -1.1 },
  ticketMuted: { color: "#F2EEFF", fontSize: 13, lineHeight: 18 },
  chartValues: { borderWidth: 1, borderRadius: 16 },
  chartValuesToggle: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 7 },
  chartValuesList: { paddingHorizontal: 14, paddingBottom: 9, gap: 3 },
  chartValueRow: { borderTopWidth: 1, paddingVertical: 6 },
  ticketRule: { borderBottomWidth: 1, borderStyle: "dashed", borderColor: "#FFFFFF80" },
  ticketMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metric: { gap: 2, flexBasis: "45%", flexGrow: 1, minWidth: 0, borderRadius: 10, padding: 7, backgroundColor: "#FFFFFF20" },
  metricValue: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  filters: { borderWidth: 1, borderRadius: 16, padding: 4, gap: 4, flexDirection: "row", flexWrap: "wrap" },
  filter: { minHeight: 44, paddingHorizontal: 7, borderRadius: 10, justifyContent: "center", flexGrow: 1 },
  surface: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 8 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  quickSection: { borderWidth: 1, borderRadius: 19, padding: 12, gap: 10 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 7 },
  quickAction: { alignItems: "center", gap: 7, minHeight: 76 },
  quickIcon: { width: 44, height: 44, borderRadius: 18, borderWidth: 1, justifyContent: "center", alignItems: "center" },
  copilot: { borderRadius: 22, padding: 15, gap: 9, overflow: "hidden" },
});
