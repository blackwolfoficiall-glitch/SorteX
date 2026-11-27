import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { SortexClient } from "../api/client";
import { Button, Notice, colors, s } from "../components/ui";
import { loadBuyerDrawResults, type BuyerDrawResult } from "./draw-results";

type Result = { accountId: string; attempt: number } & (
  { ok: true; items: BuyerDrawResult[] } | { ok: false }
);

export function NativeBuyerDrawResults({
  client,
  accountId,
}: {
  client: SortexClient;
  accountId: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Result>();
  useEffect(() => {
    let active = true;
    const isCurrent = () => {
      const auth = client.snapshot();
      return (
        active &&
        auth.status === "signedIn" &&
        auth.user?.role === "BUYER" &&
        auth.user.id === accountId
      );
    };
    void loadBuyerDrawResults(client, accountId)
      .then((items) => {
        if (isCurrent()) setState({ accountId, attempt, ok: true, items });
      })
      .catch(() => {
        if (isCurrent()) setState({ accountId, attempt, ok: false });
      });
    return () => {
      active = false;
    };
  }, [accountId, attempt, client]);

  const result =
    state?.accountId === accountId && state.attempt === attempt
      ? state
      : undefined;
  if (!result)
    return (
      <ActivityIndicator
        accessibilityLabel="Carregando resultados"
        color={colors.purple}
      />
    );
  if (!result.ok)
    return (
      <View style={s.card}>
        <Notice
          error
          message="Não foi possível consultar os resultados dos seus pedidos."
        />
        <Button
          secondary
          title="Tentar novamente"
          onPress={() => setAttempt((value) => value + 1)}
        />
      </View>
    );
  if (!result.items.length)
    return (
      <Notice message="Nenhum resultado confirmado nas campanhas dos seus pedidos. Apenas divulgações autorizadas são exibidas." />
    );
  return (
    <>
      {result.items.map((campaign) => (
        <View key={campaign.id} style={s.card}>
          <Text style={s.title}>{campaign.title}</Text>
          {campaign.synthetic && (
            <Notice message="Resultado fictício de avaliação. Não houve sorteio nem premiação real." />
          )}
          {campaign.draws.map((draw, index) => (
            <Text key={index} style={s.text}>
              {campaign.synthetic ? "Número simulado" : "Número apurado"}: {draw.winningNumber}
            </Text>
          ))}
          {campaign.winners.map((winner) => (
            <Text key={winner.id} style={s.text}>
              {winner.publicDisplayName || "Ganhador com divulgação restrita"} ·{" "}
              {winner.prizeName}
            </Text>
          ))}
        </View>
      ))}
    </>
  );
}
