import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { SortexClient } from "../api/client";
import { Button, Notice, colors, s } from "../components/ui";
import { loadBuyerPrizeList, type BuyerPrizeKind, type BuyerPrizeList } from "./prizes";

function PrizeList({
  client, accountId, kind,
}: { client: SortexClient; accountId: string; kind: BuyerPrizeKind }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ attempt: number; result: BuyerPrizeList }>();

  useEffect(() => {
    let active = true;
    void loadBuyerPrizeList(client, accountId, kind).then((result) => {
      if (active && client.snapshot().user?.id === accountId) setState({ attempt, result });
    });
    return () => { active = false; };
  }, [accountId, attempt, client, kind]);

  const result = state?.attempt === attempt ? state.result : undefined;
  const label = kind === "draw" ? "Prêmios de sorteio" : "Cotas premiadas";
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.label}>{label}</Text>
      {!result ? (
        <ActivityIndicator accessibilityLabel={`Carregando: ${label}`} color={colors.purple} />
      ) : !result.ok ? (
        <>
          <Notice error message="Não foi possível consultar estes prêmios agora." />
          <Button secondary title="Tentar novamente" onPress={() => setAttempt((value) => value + 1)} />
        </>
      ) : result.items.length === 0 ? (
        <Notice message="Nenhum prêmio desta categoria na sua conta." />
      ) : (
        result.items.map((item) => (
          <View key={item.id} style={s.pill}>
            <Text style={s.label}>{item.prizeName}</Text>
            <Text style={s.text}>{item.campaignTitle}</Text>
            <Text style={s.text}>Título: {item.ticketNumber}</Text>
            <Text style={s.muted}>{item.status}</Text>
          </View>
        ))
      )}
    </View>
  );
}

export function NativeBuyerPrizes({ client, accountId }: { client: SortexClient; accountId: string }) {
  return (
    <>
      <Notice message="Veja os prêmios registrados na sua conta. Esta consulta não confirma apuração, entrega ou pagamento." />
      <PrizeList client={client} accountId={accountId} kind="draw" />
      <PrizeList client={client} accountId={accountId} kind="instant" />
    </>
  );
}
