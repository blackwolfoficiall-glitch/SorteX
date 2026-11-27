import React, { useId, type ReactNode } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, useColorScheme, View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const common = { purple: "#7734F5", blue: "#285BEA", white: "#FFFFFF", deep: "#191238" };
const palettes = {
  light: {
    ...common, dark: false, bg: "#F3F0FF", surface: "#FFFFFF", text: "#191238", muted: "#5B5373",
    line: "#DDD5F1", accent: "#5E26C5", tint: "#E9DEFF", selected: "#191238",
  },
  dark: {
    ...common, dark: true, bg: "#14102A", surface: "#231B40", text: "#FCFAFF", muted: "#C9BEDF",
    line: "#403358", accent: "#C9AAFF", tint: "#332450", selected: "#4A3472",
  },
};

export function usePremiumTheme() {
  return palettes[useColorScheme() === "dark" ? "dark" : "light"];
}

export const premiumTypography = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.9 },
  section: { fontSize: 19, fontWeight: "800", letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: "700" },
});

export const premiumShadow = {
  shadowColor: "#4C2E91", shadowOpacity: 0.13, shadowRadius: 16,
  shadowOffset: { width: 0, height: 7 }, elevation: 4,
} as const;

export function PremiumGradient({ from = "#7130F2", to = "#234ED2" }: { from?: string; to?: string }) {
  const id = "gradient-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0%" x2="100%" y1="10%" y2="100%">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function PremiumPage({ children, title, bottom = false }: { children: ReactNode; title?: string; bottom?: boolean }) {
  const t = usePremiumTheme();
  const focused = useIsFocused();
  return (
    <SafeAreaView edges={bottom ? ["top", "left", "right", "bottom"] : ["top", "left", "right"]} style={{ flex: 1, backgroundColor: t.bg }}>
      {focused && <StatusBar style={t.dark ? "light" : "dark"} />}
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: t.tint }]} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {title && <Text accessibilityRole="header" style={[premiumTypography.title, { color: t.text }]}>{title}</Text>}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function PremiumButton({ title, onPress, filled = false }: {
  title: string; onPress: () => void; filled?: boolean;
}) {
  const t = usePremiumTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [
      styles.button, { backgroundColor: filled ? t.purple : t.surface, borderColor: filled ? t.purple : t.line },
      pressed && { opacity: 0.8 },
    ]}>
      {filled && <PremiumGradient />}
      <Text style={[premiumTypography.label, { textAlign: "center", color: filled ? t.white : t.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, padding: 16, paddingBottom: 24, maxWidth: 720, width: "100%", alignSelf: "center" },
  glow: { position: "absolute", left: -36, top: -50, width: 275, height: 240, borderRadius: 140, opacity: 0.42 },
  button: { minHeight: 48, justifyContent: "center", alignItems: "center", padding: 10, overflow: "hidden", borderRadius: 16, borderWidth: 1 },
});
