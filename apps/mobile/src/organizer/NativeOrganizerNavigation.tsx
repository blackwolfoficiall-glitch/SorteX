import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PremiumButton, PremiumGradient, PremiumPage, premiumShadow, premiumTypography, usePremiumTheme,
} from "../theme/premium";
import { organizerGroups } from "./premium-navigation";

const tabItems = {
  Home: ["⌂", "Início"],
  Campaigns: ["🎟️", "Campanhas"],
  Copilot: ["✦", "Copilot"],
  More: ["▦", "Mais"],
} as const;

export function OrganizerTabBar({ state, navigation }: BottomTabBarProps) {
  const t = usePremiumTheme();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const compact = width < 350 || fontScale > 1.35;
  return (
    <View style={{ backgroundColor: t.bg, paddingBottom: Math.max(6, insets.bottom),
      paddingHorizontal: Math.max(8, insets.left, insets.right) }}>
      <View style={[styles.bar, premiumShadow, { backgroundColor: t.surface, borderColor: t.line }]}>
        {state.routes.map((route, index) => {
          const meta = tabItems[route.name as keyof typeof tabItems];
          if (!meta) return null;
          const [icon, label] = meta;
          const selected = state.index === index;
          return <React.Fragment key={route.key}>
            {index === 2 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Criar campanha"
                testID="sortex-organizer-create"
                onPress={() => navigation.navigate("OrganizerDraft")}
                style={({ pressed }) => [styles.create, { backgroundColor: t.purple,
                  opacity: pressed ? 0.8 : 1 }]}>
                <PremiumGradient />
                <Text allowFontScaling={false} accessible={false} style={styles.createLabel}>+</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }}
              testID={`sortex-organizer-tab-${route.name.toLowerCase()}`}
              onPress={() => {
                const result = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!selected && !result.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={({ pressed }) => [styles.tab, selected && { backgroundColor: t.tint }, pressed && { opacity: 0.75 }]}
            >
              <Text accessible={false} allowFontScaling={false} style={[styles.tabIcon, { color: selected ? t.accent : t.muted }]}>{icon}</Text>
              {!compact && <Text numberOfLines={1} maxFontSizeMultiplier={1.15}
                style={[styles.tabLabel, { color: selected ? t.accent : t.muted }]}>{label}</Text>}
            </Pressable>
          </React.Fragment>;
        })}
      </View>
    </View>
  );
}

export function OrganizerMore({ navigation }: { navigation: any }) {
  const t = usePremiumTheme();
  const { width, fontScale } = useWindowDimensions();
  const columns = width >= 375 && fontScale <= 1.3 ? 2 : 1;
  return (
    <PremiumPage title="Mais">
      <Text style={[premiumTypography.body, { color: t.muted }]}>Todos os recursos da sua operação SorteX.</Text>
      {organizerGroups.map((group) => (
        <View key={group.title} style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.text }]}>{group.title}</Text>
          <View style={styles.grid}>
            {group.entries.map((entry) => {
              const hint = "hint" in entry ? entry.hint :
                "unavailable" in entry ? entry.unavailable : undefined;
              return (
                <Pressable accessibilityRole="button" accessibilityLabel={entry.title} accessibilityHint={hint}
                  key={entry.title}
                  onPress={() => {
                    if ("unavailable" in entry) navigation.navigate("OrganizerModuleStatus", { title: entry.title, message: entry.unavailable });
                    else navigation.navigate(entry.route);
                  }}
                  style={({ pressed }) => [styles.menuCard, { borderColor: t.line, backgroundColor: t.surface,
                    width: columns === 1 ? "100%" : "48.5%", opacity: pressed ? 0.72 : 1 }]}>
                  <Text accessible={false} allowFontScaling={false} style={{ fontSize: 19, color: t.accent }}>{entry.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[premiumTypography.label, { color: t.text }]}>{entry.title}</Text>
                    <Text style={{ color: t.muted, fontSize: 12, marginTop: 3 }}>
                      {"unavailable" in entry || entry.title === "IA SorteX" ? "Ainda indisponível" : "Abrir"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </PremiumPage>
  );
}

export function OrganizerCopilot() {
  const t = usePremiumTheme();
  return (
    <PremiumPage title="Copilot">
      <View style={[styles.info, { borderColor: t.line, backgroundColor: t.surface }]}>
        <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.text }]}>IA SorteX ainda não conectada</Text>
        <Text style={[premiumTypography.body, { color: t.muted }]}>
          As recomendações aparecem aqui depois que um provedor de IA for conectado e validado. Nenhuma previsão está sendo exibida e nenhuma ação é executada automaticamente.
        </Text>
      </View>
    </PremiumPage>
  );
}

export function OrganizerModuleStatus({ route, navigation }: { route: any; navigation: any }) {
  const t = usePremiumTheme();
  return (
    <PremiumPage title={route.params.title} bottom>
      <View style={[styles.info, { borderColor: t.line, backgroundColor: t.surface }]}>
        <Text style={[premiumTypography.body, { color: t.muted }]}>{route.params.message}</Text>
        {route.params.finance === true && <PremiumButton title="Consultar financeiro" onPress={() => navigation.replace("OrganizerFinance")} />}
        <PremiumButton title="Voltar" onPress={() => navigation.goBack()} />
      </View>
    </PremiumPage>
  );
}

const styles = StyleSheet.create({
  bar: { borderWidth: 1, borderRadius: 24, paddingHorizontal: 4, paddingVertical: 4,
    flexDirection: "row", gap: 2, alignItems: "center", width: "100%", maxWidth: 700, alignSelf: "center", minHeight: 62 },
  tab: { flex: 1, minWidth: 0, minHeight: 48, justifyContent: "center", alignItems: "center", borderRadius: 15, paddingHorizontal: 1 },
  tabIcon: { fontSize: 21, lineHeight: 24, fontWeight: "700" },
  tabLabel: { marginTop: 2, fontSize: 10, fontWeight: "700" },
  create: { width: 48, height: 49, marginHorizontal: 3, borderRadius: 18, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  createLabel: { fontSize: 28, color: "#FFF", fontWeight: "600", lineHeight: 31 },
  grid: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", rowGap: 8 },
  menuCard: { minHeight: 68, borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  info: { gap: 12, borderWidth: 1, borderRadius: 20, padding: 16 },
});
