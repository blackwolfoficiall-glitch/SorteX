import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  purple: "#7138dc",
  ink: "#201337",
  muted: "#665e76",
  line: "#ded7eb",
  bg: "#f7f4fc",
};
export const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: 22,
    gap: 16,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingBottom: 42,
  },
  brand: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.purple,
    letterSpacing: -1,
  },
  title: { fontSize: 27, fontWeight: "800", color: colors.ink },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: "#ebe5f4",
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.purple,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  error: { color: "#a0253d", fontSize: 15, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  pill: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#fff",
  },
  selected: { borderColor: colors.purple, backgroundColor: "#eee4ff" },
});
export function Page({
  children,
  title,
  standalone = false,
}: {
  children: React.ReactNode;
  title?: string;
  standalone?: boolean;
}) {
  return (
    <SafeAreaView
      edges={
        standalone
          ? ["top", "left", "right", "bottom"]
          : ["left", "right", "bottom"]
      }
      style={s.page}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
        >
          {title && (
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
          )}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Button({
  title,
  onPress,
  testID,
  busy = false,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  testID?: string;
  busy?: boolean;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: busy || disabled, busy }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && { backgroundColor: "#e9defa" },
        (pressed || disabled || busy) && { opacity: 0.6 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.purple : "#fff"} />
      ) : (
        <Text style={[s.buttonText, secondary && { color: colors.purple }]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#82788f"
        style={s.input}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}
export function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <Text
      accessibilityRole={error ? "alert" : "text"}
      accessibilityLiveRegion="polite"
      style={error ? s.error : s.muted}
    >
      {message}
    </Text>
  );
}
export function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[s.pill, selected && s.selected]}
    >
      <Text style={s.text}>{label}</Text>
    </Pressable>
  );
}
export const money = (n: number | string | undefined) =>
  Number(n || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export const status = (value: string) =>
  ({
    PENDING: "Pendente",
    PAID: "Confirmado",
    CANCELED: "Cancelado",
    EXPIRED: "Expirado",
    PUBLISHED: "Publicada",
    DRAFT: "Rascunho",
    FINISHED: "Finalizada",
    DRAWN: "Apurada",
    VERIFIED: "Verificado",
    UNDER_REVIEW: "Em análise",
  })[value] || value;
