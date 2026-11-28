import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { PremiumButton, PremiumChoice, PremiumField, PremiumMessage, PremiumPage, PremiumPanel,
  premiumTypography, usePremiumTheme } from "../theme/premium";
import { filterOrganizerWinners, loadOrganizerWinners, winnerStatuses,
  type OrganizerWinner, type WinnerPeriod, type WinnersClient, type WinnersSession } from "./winners";

const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia",
});
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const periods: WinnerPeriod[] = [0, 7, 30, 90];
type Load = { kind: "ready"; rows: OrganizerWinner[] } | { kind: "error" };
const status = (winner: OrganizerWinner) => Object.hasOwn(winnerStatuses, winner.status)
  ? winnerStatuses[winner.status] : "Status em acompanhamento";

export function NativeOrganizerWinners({ client, session }: { client: WinnersClient; session: WinnersSession }) {
  const theme = usePremiumTheme();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ attempt: number; result: Load }>();
  const [campaign, setCampaign] = useState("");
  const [number, setNumber] = useState("");
  const [period, setPeriod] = useState<WinnerPeriod>(0);
  const [detailId, setDetailId] = useState<string>();
  const { organizerId, revision } = session;
  useEffect(() => {
    let active = true;
    void loadOrganizerWinners(client, { organizerId, revision }).then((rows) => {
      if (active && rows) setLoaded({ attempt, result: { kind: "ready", rows } });
    }).catch(() => {
      if (active) setLoaded({ attempt, result: { kind: "error" } });
    });
    return () => { active = false; };
  }, [attempt, client, organizerId, revision]);

  const result = loaded?.attempt === attempt ? loaded.result : undefined;
  const rows = result?.kind === "ready" ? result.rows : undefined;
  const campaigns = useMemo(() => Array.from(new Map((rows ?? [])
    .map((item) => [item.campaign.id, item.campaign.title])).entries()), [rows]);
  const shown = rows && filterOrganizerWinners(rows, campaign, number, period);
  const detail = shown?.find((winner) => winner.id === detailId);

  return <PremiumPage title="Ganhadores" top={false} bottom>
    <PremiumMessage message="Ganhadores registrados nos sorteios das suas campanhas. Esta tela não executa sorteios nem altera entregas." />
    {!result && <ActivityIndicator accessibilityLabel="Carregando ganhadores" color={theme.accent} />}
    {result?.kind === "error" && <PremiumPanel>
      <PremiumMessage error message="Não foi possível consultar os ganhadores. Confira a conexão e tente novamente." />
      <PremiumButton title="Tentar novamente" onPress={() => setAttempt((n) => n + 1)} />
    </PremiumPanel>}
    {detail ? <PremiumPanel title="Detalhes do ganhador">
      <Text accessibilityRole="header" style={[premiumTypography.section, { color: theme.text }]}>{detail.winnerName}</Text>
      <PremiumMessage message={detail.city || "Cidade não informada"} />
      <PremiumMessage message={"Campanha: " + detail.campaign.title} />
      <PremiumMessage message={"Cota: " + detail.winningNumber} />
      <PremiumMessage message={"Prêmio: " + detail.prizeName} />
      {detail.prizeValue !== null && <PremiumMessage message={"Valor registrado: " + brl.format(Number(detail.prizeValue))} />}
      <PremiumMessage message={"Registro: " + date.format(new Date(detail.createdAt))} />
      <PremiumMessage message={"Entrega: " + status(detail)} />
      {detail.deliveredAt && <PremiumMessage message={"Data da entrega: " + date.format(new Date(detail.deliveredAt))} />}
      <PremiumMessage message={detail.publicDisclosureAuthorized ? "Divulgação autorizada no registro." : "Divulgação não autorizada."} />
      <PremiumButton title="Voltar à lista" onPress={() => setDetailId(undefined)} />
    </PremiumPanel> : shown && <>
      <PremiumPanel title="Filtros">
        <PremiumField label="Buscar número da cota" value={number} onChangeText={setNumber}
          keyboardType="number-pad" maxLength={24} />
        <Text style={[premiumTypography.label, { color: theme.text }]}>Campanha</Text>
        <PremiumChoice label="Todas as campanhas" selected={!campaign} onPress={() => setCampaign("")} />
        {campaigns.map(([id, title]) => <PremiumChoice key={id} label={title} selected={id === campaign}
          onPress={() => setCampaign(id)} />)}
        <Text style={[premiumTypography.label, { color: theme.text }]}>Período</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {periods.map((days) => <PremiumChoice key={days} label={days ? "Últimos " + days + " dias" : "Todo o período"}
            selected={days === period} onPress={() => setPeriod(days)} />)}
        </View>
        <PremiumButton title="Atualizar ganhadores" onPress={() => { setDetailId(undefined); setCampaign(""); setAttempt((n) => n + 1); }} />
      </PremiumPanel>
      {!shown.length && <PremiumMessage message={rows?.length ? "Nenhum ganhador encontrado com estes filtros." : "Nenhum ganhador registrado."} />}
      {shown.map((winner) => <PremiumPanel key={winner.id} title={winner.winnerName}>
        <PremiumMessage message={winner.campaign.title + " · Cota " + winner.winningNumber} />
        <PremiumMessage message={winner.prizeName + " · " + status(winner)} />
        <PremiumButton title="Ver detalhes" onPress={() => setDetailId(winner.id)} />
      </PremiumPanel>)}
    </>}
  </PremiumPage>;
}
