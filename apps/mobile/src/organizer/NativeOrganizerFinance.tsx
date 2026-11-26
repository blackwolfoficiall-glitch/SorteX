import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Button, Notice, Page, colors, s } from "../components/ui";
import {
  formatFinanceMoney,
  ledgerStatuses,
  ledgerTypes,
  loadOrganizerFinance,
  type FinanceClient,
  type FinanceRead,
  type FinanceSession,
} from "./finance";

const when = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
type ScreenState =
  Exclude<FinanceRead, { kind: "stale" }> | { kind: "loading" | "error" };

export function NativeOrganizerFinance({
  client,
  session,
}: {
  client: FinanceClient;
  session: FinanceSession;
}) {
  const { organizerId, revision } = session;
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${page}:${attempt}`;
  const [result, setResult] = useState<{ key: string; state: ScreenState }>();
  const state: ScreenState =
    result?.key === requestKey ? result.state : { kind: "loading" };
  useEffect(() => {
    let active = true;
    loadOrganizerFinance(client, { organizerId, revision }, page)
      .then((state) => {
        if (active && state.kind !== "stale")
          setResult({ key: requestKey, state });
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, state: { kind: "error" } });
      });
    return () => {
      active = false;
    };
  }, [client, organizerId, page, requestKey, revision]);
  const reload = () => setAttempt((current) => current + 1);
  return (
    <Page title="Financeiro">
      <Notice message="Consulta do saldo interno da SorteX. Não comprova liquidação pelo gateway, split ou dinheiro recebido em conta bancária." />
      {state.kind === "loading" && (
        <ActivityIndicator
          accessibilityLabel="Carregando financeiro"
          color={colors.purple}
        />
      )}
      {state.kind === "unavailable" && (
        <Notice
          error
          message="O financeiro não está disponível nesta versão da API. Tente novamente após a atualização do ambiente de teste."
        />
      )}
      {state.kind === "error" && (
        <Notice
          error
          message="Não foi possível carregar os dados financeiros. Nenhum valor foi exibido. Confira sua conexão e tente novamente."
        />
      )}
      {state.kind === "ok" && (
        <>
          {state.balance.accountExists ? (
            <>
              <View style={s.card}>
                <Text accessibilityRole="header" style={s.label}>
                  Saldo interno
                </Text>
                <Text style={s.text}>
                  Disponível: {formatFinanceMoney(state.balance.available)}
                </Text>
                <Text style={s.text}>
                  Pendente: {formatFinanceMoney(state.balance.pending)}
                </Text>
                <Text style={s.text}>
                  Bloqueado: {formatFinanceMoney(state.balance.blocked)}
                </Text>
              </View>
              <View style={s.card}>
                <Text accessibilityRole="header" style={s.label}>
                  Receitas e taxas acumuladas
                </Text>
                <Text style={s.text}>
                  Receita bruta registrada:{" "}
                  {formatFinanceMoney(state.balance.gross)}
                </Text>
                <Text style={s.text}>
                  Receita líquida registrada:{" "}
                  {formatFinanceMoney(state.balance.net)}
                </Text>
                <Text style={s.text}>
                  Taxas SorteX: {formatFinanceMoney(state.balance.platformFees)}
                </Text>
                <Text style={s.text}>
                  Taxas de gateway registradas:{" "}
                  {formatFinanceMoney(state.balance.gatewayFees)}
                </Text>
                <Text style={s.muted}>
                  Taxas de gateway no saldo interno podem incluir estimativas,
                  não valores efetivamente liquidados.
                </Text>
              </View>
            </>
          ) : (
            <Notice message="Ainda não há uma conta financeira interna para este organizador." />
          )}
          <Text accessibilityRole="header" style={s.label}>
            Extrato interno
          </Text>
          {!state.statement.data.length && (
            <Notice
              message={
                page === 1
                  ? "Nenhum lançamento no extrato."
                  : "Esta página do extrato não tem lançamentos."
              }
            />
          )}
          {state.statement.data.map((entry) => (
            <View key={entry.id} style={s.card}>
              <Text style={s.label}>{ledgerTypes[entry.type]}</Text>
              <Text style={s.text}>
                {formatFinanceMoney(entry.amount, entry.direction)}
              </Text>
              <Text style={s.muted}>
                {ledgerStatuses[entry.status]} ·{" "}
                {when.format(new Date(entry.createdAt))}
              </Text>
              {!!entry.campaignTitle && (
                <Text style={s.text}>Campanha: {entry.campaignTitle}</Text>
              )}
            </View>
          ))}
          {(page > 1 || state.statement.pagination.pages > 1) && (
            <View style={s.card}>
              <Text accessibilityLiveRegion="polite" style={s.label}>
                Página {page} de {Math.max(1, state.statement.pagination.pages)}
              </Text>
              <Button
                secondary
                title="Página anterior do extrato"
                disabled={page === 1}
                onPress={() => setPage((current) => Math.max(1, current - 1))}
              />
              <Button
                secondary
                title="Próxima página do extrato"
                disabled={page >= state.statement.pagination.pages}
                onPress={() =>
                  setPage((current) =>
                    Math.min(state.statement.pagination.pages, current + 1),
                  )
                }
              />
            </View>
          )}
        </>
      )}
      {state.kind !== "loading" && (
        <Button
          secondary
          title={
            state.kind === "ok" ? "Atualizar financeiro" : "Tentar novamente"
          }
          onPress={reload}
        />
      )}
    </Page>
  );
}
