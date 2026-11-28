import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { client } from "../auth/runtime";
import { PremiumButton, PremiumPage, premiumTypography, usePremiumTheme } from "../theme/premium";
import { advisorPrompts, askOrganizerAdvisor, organizerAdvisorAvailable } from "./organizer-advisor";

export function NativeOrganizerAdvisor() {
  const auth = useSyncExternalStore(client.subscribe, client.snapshot);
  const organizerId = auth.status === "signedIn" && auth.user?.role === "ORGANIZER" ? auth.user.id : null;
  const focused = useIsFocused();
  const theme = usePremiumTheme();
  const [available, setAvailable] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<Awaited<ReturnType<typeof askOrganizerAdvisor>> | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    const current = ++generation.current;
    pending.current = false;
    setAvailable(false);
    setConsent(false);
    setBusy(false);
    setError("");
    setAnswer(null);
    if (focused && organizerId) {
      void organizerAdvisorAvailable(client).then((enabled) => {
        if (generation.current === current) setAvailable(enabled);
      }).catch(() => {});
    }
    return () => { generation.current++; };
  }, [focused, organizerId]);

  const submit = async (question: typeof advisorPrompts[number][1]) => {
    if (!focused || !organizerId || pending.current) return;
    const current = generation.current;
    pending.current = true;
    setBusy(true);
    setError("");
    setAnswer(null);
    try {
      const result = await askOrganizerAdvisor(client, question, available && consent);
      if (generation.current === current) setAnswer(result);
    } catch (cause) {
      if (generation.current === current) {
        setError(cause instanceof Error ? cause.message : "Consulta indisponível.");
      }
    } finally {
      if (generation.current === current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <PremiumPage title="SorteX Copilot">
      <Text style={[premiumTypography.body, { color: theme.muted }]}>
        Consulte indicadores do Dashboard, CRM, Financeiro e SorteX Ads. Nenhuma ação é executada automaticamente.
      </Text>
      {available ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={[premiumTypography.body, { flex: 1, color: theme.text }]}>
            Usar IA externa com indicadores fictícios agregados.
          </Text>
          <Switch accessibilityLabel="Usar IA externa" value={consent} onValueChange={setConsent} />
        </View>
      ) : (
        <Text style={[premiumTypography.body, { color: theme.muted }]}>
          IA externa indisponível. As respostas usam apenas regras locais.
        </Text>
      )}
      {!busy && advisorPrompts.map(([module, question]) => (
        <PremiumButton key={module} title={module + ": " + question} onPress={() => void submit(question)} />
      ))}
      {busy && <ActivityIndicator accessibilityLabel="Consultando indicadores" color={theme.accent} />}
      {!!error && <Text accessibilityRole="alert" style={{ color: theme.text }}>{error}</Text>}
      {answer && (
        <View style={{ gap: 8, borderWidth: 1, borderColor: theme.line, borderRadius: 20, padding: 16, backgroundColor: theme.surface }}>
          <Text accessibilityRole="header" style={[premiumTypography.label, { color: theme.accent }]}>{answer.source}</Text>
          <Text style={[premiumTypography.body, { color: theme.text }]}>{answer.answer}</Text>
          {answer.providerLimited && (
            <Text accessibilityLiveRegion="polite" style={[premiumTypography.body, { color: theme.muted }]}>
              O provedor externo atingiu um limite de uso. Esta resposta usou apenas regras locais.
            </Text>
          )}
        </View>
      )}
    </PremiumPage>
  );
}
