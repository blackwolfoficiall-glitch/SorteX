import React, { useId, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import {
  premiumGradientStops,
  premiumPalettes,
  premiumShadowTokens,
  premiumShapeTokens,
  premiumTextTokens,
} from "../../../../packages/design-tokens/src/premium";

export function usePremiumTheme() {
  return premiumPalettes[useColorScheme() === "dark" ? "dark" : "light"];
}

export const premiumTypography = StyleSheet.create(premiumTextTokens);
export const premiumShadow = premiumShadowTokens;

export function PremiumGradient({
  from = premiumGradientStops.from,
  to = premiumGradientStops.to,
}: {
  from?: string;
  to?: string;
}) {
  const id = "gradient-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
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

export function PremiumPage({
  children,
  title,
  bottom = false,
  top = true,
  avoidKeyboard = false,
}: {
  children: ReactNode;
  title?: string;
  bottom?: boolean;
  top?: boolean;
  avoidKeyboard?: boolean;
}) {
  const t = usePremiumTheme();
  const focused = useIsFocused();
  const body = (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {title && (
        <Text accessibilityRole="header" style={[premiumTypography.title, { color: t.text }]}>
          {title}
        </Text>
      )}
      {children}
    </ScrollView>
  );
  return (
    <SafeAreaView
      edges={[
        "left",
        "right",
        ...(top ? ["top" as const] : []),
        ...(bottom ? ["bottom" as const] : []),
      ]}
      style={{ flex: 1, backgroundColor: t.bg }}
    >
      {focused && <StatusBar style={t.dark ? "light" : "dark"} />}
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: t.tint }]} />
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function PremiumButton({
  title,
  onPress,
  filled = false,
  disabled = false,
  busy = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  filled?: boolean;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
}) {
  const t = usePremiumTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: filled ? t.purple : t.surface, borderColor: filled ? t.purple : t.line },
        (pressed || disabled || busy) && { opacity: 0.65 },
      ]}
    >
      {filled && <PremiumGradient />}
      {busy ? (
        <ActivityIndicator color={filled ? t.white : t.accent} />
      ) : (
        <Text
          style={[
            premiumTypography.label,
            { textAlign: "center", color: filled ? t.white : t.text },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function PremiumPanel({ children, title }: { children: ReactNode; title?: string }) {
  const t = usePremiumTheme();
  return (
    <View style={[styles.panel, { backgroundColor: t.surface, borderColor: t.line }]}>
      {title && (
        <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.text }]}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

export function PremiumMessage({
  message,
  error = false,
  success = false,
}: {
  message: string;
  error?: boolean;
  success?: boolean;
}) {
  const t = usePremiumTheme();
  return (
    <Text
      accessibilityRole={error ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={[premiumTypography.body, { color: error ? t.error : success ? t.success : t.muted }]}
    >
      {message}
    </Text>
  );
}

export function PremiumField({ label, ...props }: TextInputProps & { label: string }) {
  const t = usePremiumTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[premiumTypography.label, { color: t.text }]}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...props}
        style={[
          styles.field,
          { color: t.text, backgroundColor: t.bg, borderColor: t.line },
          props.multiline && styles.multiline,
          props.editable === false && { opacity: 0.65 },
          props.style,
        ]}
      />
    </View>
  );
}

export function PremiumChoice({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  const t = usePremiumTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? t.tint : t.surface,
          borderColor: selected ? t.accent : t.line,
        },
      ]}
    >
      <Text style={[premiumTypography.label, { color: selected ? t.accent : t.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 24,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  glow: {
    position: "absolute",
    left: -36,
    top: -50,
    width: 275,
    height: 240,
    borderRadius: 140,
    opacity: 0.42,
  },
  button: {
    minHeight: premiumShapeTokens.actionHeight,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    overflow: "hidden",
    borderRadius: premiumShapeTokens.buttonRadius,
    borderWidth: 1,
  },
  panel: { borderRadius: premiumShapeTokens.panelRadius, borderWidth: 1, gap: 14, padding: 16 },
  field: { borderRadius: 14, borderWidth: 1, minHeight: 48, padding: 12, fontSize: 16 },
  multiline: { minHeight: 78, textAlignVertical: "top" },
  choice: {
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 13,
    borderWidth: 1,
    padding: 12,
  },
});
