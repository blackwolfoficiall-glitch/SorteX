import React from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PremiumButton, PremiumGradient, PremiumPage, premiumShadow, premiumTypography, usePremiumTheme,
} from "../theme/premium";
import { OrganizerIcon } from "./OrganizerIcons";
import { organizerGroups } from "./premium-navigation";
import { NativeOrganizerAdvisor } from "./NativeOrganizerAdvisor";

const tabItems = {
  Home: ["home", "Início"],
  Campaigns: ["ticket", "Campanhas"],
  Copilot: ["copilot", "Copilot"],
  More: ["more", "Mais"],
} as const;

export function OrganizerTabBar({ state, navigation }: BottomTabBarProps) {
  const t = usePremiumTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = width - insets.left - insets.right < 350;
  const labelStyle = [styles.tabLabel, compact && styles.tabLabelCompact];
  return (
    <View style={{ backgroundColor: t.bg, paddingBottom: Math.max(6, insets.bottom),
      paddingHorizontal: Math.max(8, insets.left, insets.right) }}>
      <View style={[styles.bar, premiumShadow, { backgroundColor: t.surface, borderColor: t.line }]} testID="sortex-organizer-dock">
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
                style={({ pressed }) => [styles.create, pressed && { opacity: 0.8 }]}>
                <View style={[styles.createTile, compact && styles.createTileCompact, { backgroundColor: t.purple }]}>
                  <PremiumGradient />
                  <View style={styles.createSymbol}><OrganizerIcon name="plus" color={t.white} size={25} /></View>
                </View>
                <Text numberOfLines={2} maxFontSizeMultiplier={1.3} style={[...labelStyle, { color: t.muted }]}>Criar</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} aria-selected={selected}
              testID={`sortex-organizer-tab-${route.name.toLowerCase()}`}
              onPress={() => {
                const result = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!selected && !result.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={({ pressed }) => [
                styles.tab,
                compact && route.name === "Campaigns" && styles.campaignTabCompact,
                selected && { backgroundColor: t.tint },
                pressed && { opacity: 0.75 },
              ]}
            >
              <OrganizerIcon name={icon} color={selected ? t.accent : t.muted} size={compact ? 19 : 22} />
              <Text numberOfLines={2} maxFontSizeMultiplier={1.3} style={[...labelStyle, { color: selected ? t.accent : t.muted }]}>{label}</Text>
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
                      {"unavailable" in entry ? "Ainda indisponível" : "Abrir"}
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
  return <NativeOrganizerAdvisor />;
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
    flexDirection: "row", gap: 2, alignItems: "stretch", width: "100%", maxWidth: 700,
    alignSelf: "center", minHeight: 60, marginTop: 7 },
  tab: { flex: 1, minWidth: 44, minHeight: 48, justifyContent: "center", alignItems: "center",
    borderRadius: 16, paddingHorizontal: 1, paddingVertical: 4, gap: 3 },
  campaignTabCompact: { minWidth: 61 },
  tabLabel: { fontSize: 11, fontWeight: "700", textAlign: "center", width: "100%" },
  tabLabelCompact: { fontSize: 10 },
  create: { flex: 1, minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "flex-start",
    paddingHorizontal: 1, paddingBottom: 3, gap: 2 },
  createTile: { width: 45, height: 45, marginTop: -11, borderRadius: 16, overflow: "hidden",
    alignItems: "center", justifyContent: "center" },
  createTileCompact: { width: 44, height: 44 },
  createSymbol: { position: "relative", zIndex: 1 },
  grid: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", rowGap: 8 },
  menuCard: { minHeight: 68, borderRadius: 18, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  info: { gap: 12, borderWidth: 1, borderRadius: 20, padding: 16 },
});
