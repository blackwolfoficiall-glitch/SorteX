import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PremiumButton, premiumTypography, usePremiumTheme } from "../theme/premium";
import { calendarDayAllowed, calendarMonth, dashboardCalendarCells, moveCalendarMonth, type CalendarLimits } from "./dashboard-calendar";

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" });
const civilDate = (day: string) => new Date(day + "T12:00:00Z");
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

export function NativeOrganizerDashboardCalendar({ label, selected, limits, onChoose, onClose }: {
  label: string; selected: string; limits: CalendarLimits;
  onChoose: (day: string) => void; onClose: () => void;
}) {
  const t = usePremiumTheme();
  const [month, setMonth] = useState(() => calendarMonth(calendarDayAllowed(selected, limits) ? selected : limits.max));
  const move = (delta: number) => moveCalendarMonth(month, delta, limits);
  const calendarControls = [
    [-12, "Ano anterior", "‹‹"], [-1, "Mês anterior", "‹"],
    [1, "Próximo mês", "›"], [12, "Próximo ano", "››"],
  ] as const;
  return <Modal visible animationType="fade" transparent onRequestClose={onClose}>
    <SafeAreaView style={styles.scrim}>
      <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
        <View accessibilityViewIsModal style={[styles.panel, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text accessibilityRole="header" style={[premiumTypography.section, { color: t.text }]}>{label}</Text>
          <Text style={[premiumTypography.body, { color: t.muted }]}>Escolha um dia no calendário.</Text>
          <View style={styles.monthRow}>
            {calendarControls.slice(0, 2).map(([delta, title, icon]) => {
              const next = move(delta);
              return <Pressable key={title} accessibilityRole="button" accessibilityLabel={title}
                accessibilityState={{ disabled: !next }} disabled={!next} onPress={() => { if (next) setMonth(next); }}
                style={styles.control}><Text style={{ color: next ? t.accent : t.muted, fontSize: 22 }}>{icon}</Text></Pressable>;
            })}
            <Text accessibilityRole="header" accessibilityLiveRegion="polite"
              style={[premiumTypography.label, styles.month, { color: t.text }]}>{monthFormat.format(civilDate(month))}</Text>
            {calendarControls.slice(2).map(([delta, title, icon]) => {
              const next = move(delta);
              return <Pressable key={title} accessibilityRole="button" accessibilityLabel={title}
                accessibilityState={{ disabled: !next }} disabled={!next} onPress={() => { if (next) setMonth(next); }}
                style={styles.control}><Text style={{ color: next ? t.accent : t.muted, fontSize: 22 }}>{icon}</Text></Pressable>;
            })}
          </View>
          <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={styles.week}>
            {weekdays.map((day) => <Text key={day} style={[styles.column, styles.weekday, { color: t.muted }]}>{day}</Text>)}
          </View>
          {dashboardCalendarCells(month).map((week, index) => <View key={index} style={styles.week}>
            {week.map((day, col) => {
              if (!day) return <View key={col} style={styles.column} />;
              const enabled = calendarDayAllowed(day, limits);
              const isSelected = day === selected;
              return <Pressable key={col} accessibilityRole="button" accessibilityLabel={dayFormat.format(civilDate(day))}
                accessibilityState={{ disabled: !enabled, selected: isSelected }}
                disabled={!enabled} onPress={() => { if (enabled) onChoose(day); }}
                style={[styles.column, styles.day, { backgroundColor: isSelected ? t.selected : "transparent" }]}>
                <Text style={[premiumTypography.label, { color: isSelected ? t.white : enabled ? t.text : t.muted,
                  textDecorationLine: enabled ? "none" : "line-through" }]}>{Number(day.slice(-2))}</Text>
              </Pressable>;
            })}
          </View>)}
          <PremiumButton title="Cancelar" onPress={onClose} />
        </View>
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "#140c35a6" },
  modalBody: { flexGrow: 1, justifyContent: "center", padding: 8 },
  panel: { borderWidth: 1, borderRadius: 20, padding: 8, gap: 5, width: "100%", maxWidth: 480, alignSelf: "center" },
  monthRow: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  month: { flex: 1, textAlign: "center", textTransform: "capitalize" },
  control: { minWidth: 37, minHeight: 44, alignItems: "center", justifyContent: "center" },
  week: { flexDirection: "row", minWidth: 0 },
  column: { flex: 1, minWidth: 0 },
  weekday: { textAlign: "center", fontWeight: "600", fontSize: 11 },
  day: { minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11 },
});
