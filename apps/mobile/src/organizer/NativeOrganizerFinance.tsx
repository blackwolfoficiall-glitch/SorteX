import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  PremiumButton,
  PremiumGradient,
  PremiumMessage,
  PremiumPage,
  PremiumPanel,
  premiumTypography,
  usePremiumTheme,
} from "../theme/premium";
import {
  formatFinanceMoney,
  ledgerStatuses,
  ledgerTypes,
  loadOrganizerFinance,
  statementPageNavigation,
  type FinanceBalance,
  type FinanceClient,
  type FinanceRead,
  type FinanceSession,
  type LedgerItem,
  type Statement,
} from "./finance";

const when = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});
type ScreenState = Exclude<FinanceRead, { kind: "stale" }> | { kind: "loading" | "error" };
type PageResult = {
  sessionKey: string;
  page: number;
  attempt: number;
  state: ScreenState;
};

export function NativeOrganizerFinance({
  client,
  session,
}: {
  client: FinanceClient;
  session: FinanceSession;
}) {
  const theme = usePremiumTheme();
  const { organizerId, revision } = session;
  const sessionKey = `${organizerId}:${revision}`;
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<PageResult>();
  const sameRead = result?.sessionKey === sessionKey && result.attempt === attempt;
  const state: ScreenState = sameRead && result.page === page ? result.state : { kind: "loading" };
  // While moving within the same statement, keep only the last verified
  // balance. Never keep previous entries or show cached amounts after an
  // error, refresh, new session, or incompatible API.
  const verifiedPrior =
    state.kind === "loading" && sameRead && result.page !== page && result.state.kind === "ok"
      ? result.state
      : null;
  const balance = state.kind === "ok" ? state.balance : verifiedPrior?.balance;
  useEffect(() => {
    let active = true;
    void loadOrganizerFinance(client, { organizerId, revision }, page)
      .then((next) => {
        if (active && next.kind !== "stale") setResult({ sessionKey, page, attempt, state: next });
      })
      .catch(() => {
        if (active) setResult({ sessionKey, page, attempt, state: { kind: "error" } });
      });
    return () => {
      active = false;
    };
  }, [attempt, client, organizerId, page, revision, sessionKey]);

  const reload = () => setAttempt((current) => current + 1);
  return (
    <PremiumPage title="Financeiro" top={false} bottom>
      <PremiumMessage message="Este painel mostra os registros internos da SorteX. Confira recebimentos e prazos de liquidação diretamente no seu gateway." />
      {verifiedPrior && (
        <PremiumMessage message="Posição contábil e taxas da última consulta enquanto a nova página do extrato é carregada." />
      )}
      {balance && <BalanceCards balance={balance} />}

      {state.kind === "loading" && (
        <PremiumPanel title={verifiedPrior ? "Extrato interno" : undefined}>
          <ActivityIndicator
            accessibilityLabel={
              verifiedPrior ? "Carregando página do extrato" : "Carregando financeiro"
            }
            color={theme.accent}
          />
          <Text
            accessibilityLiveRegion="polite"
            style={[premiumTypography.body, { color: theme.muted }]}
          >
            {verifiedPrior
              ? `Carregando a página ${page} do extrato…`
              : "Consultando saldos, taxas e extrato…"}
          </Text>
        </PremiumPanel>
      )}

      {(state.kind === "unavailable" || state.kind === "error") && (
        <PremiumPanel
          title={state.kind === "unavailable" ? "Financeiro indisponível" : "Falha na consulta"}
        >
          <PremiumMessage
            error
            message={
              state.kind === "unavailable"
                ? "O financeiro não está disponível nesta versão da API. Nenhum valor foi exibido."
                : "Não foi possível carregar os dados financeiros. Nenhum valor foi exibido. Confira sua conexão e tente novamente."
            }
          />
          <PremiumButton title="Tentar novamente" onPress={reload} />
          {page > 1 && (
            <PremiumButton title="Voltar à primeira página do extrato" onPress={() => setPage(1)} />
          )}
        </PremiumPanel>
      )}

      {state.kind === "ok" && (
        <>
          <StatementPage statement={state.statement} onPage={setPage} />
          <PremiumButton title="Atualizar financeiro" onPress={reload} />
        </>
      )}
    </PremiumPage>
  );
}

function BalanceCards({ balance }: { balance: FinanceBalance }) {
  const theme = usePremiumTheme();
  if (!balance.accountExists) {
    return (
      <PremiumPanel title="Saldo interno">
        <PremiumMessage message="Ainda não há uma conta financeira interna para este organizador." />
      </PremiumPanel>
    );
  }
  return (
    <>
      <View style={[styles.balance, { backgroundColor: theme.purple }]}>
        <PremiumGradient />
        <Text
          accessibilityRole="header"
          style={[premiumTypography.section, { color: theme.white }]}
        >
          Saldo interno
        </Text>
        <Text style={[premiumTypography.label, { color: theme.white }]}>Disponibilidade no controle interno</Text>
        <Text style={[styles.balanceAmount, { color: theme.white }]}>
          {formatFinanceMoney(balance.available)}
        </Text>
        <View style={styles.balanceOthers}>
          <View style={styles.pocket}>
            <Text style={[premiumTypography.body, { color: theme.white }]}>Pendente no controle</Text>
            <Text style={[premiumTypography.label, { color: theme.white }]}>
              {formatFinanceMoney(balance.pending)}
            </Text>
          </View>
          <View style={styles.pocket}>
            <Text style={[premiumTypography.body, { color: theme.white }]}>Bloqueado no controle</Text>
            <Text style={[premiumTypography.label, { color: theme.white }]}>
              {formatFinanceMoney(balance.blocked)}
            </Text>
          </View>
        </View>
      </View>
      <PremiumPanel title="Receitas e taxas registradas">
        <MoneyRow label="Receita bruta registrada" value={balance.gross} />
        <MoneyRow label="Receita líquida registrada" value={balance.net} />
        <MoneyRow label="Taxas SorteX" value={balance.platformFees} />
        <MoneyRow label="Taxas de gateway registradas" value={balance.gatewayFees} />
        <PremiumMessage message="Os valores do gateway podem incluir estimativas e não comprovam taxas efetivamente cobradas. A receita registrada não é lucro." />
      </PremiumPanel>
    </>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  const theme = usePremiumTheme();
  return (
    <View style={styles.moneyRow}>
      <Text style={[premiumTypography.body, styles.moneyLabel, { color: theme.muted }]}>
        {label}
      </Text>
      <Text style={[premiumTypography.label, { color: theme.text }]}>
        {formatFinanceMoney(value)}
      </Text>
    </View>
  );
}

function StatementPage({
  statement,
  onPage,
}: {
  statement: Statement;
  onPage: (page: number) => void;
}) {
  const theme = usePremiumTheme();
  const { page, last, total, next, previous, pastEnd } = statementPageNavigation(
    statement.pagination,
  );
  const count = total.toLocaleString("pt-BR");
  return (
    <>
      <PremiumPanel title="Extrato interno">
        <PremiumMessage
          message={total === 1 ? "1 lançamento registrado." : `${count} lançamentos registrados.`}
        />
        {pastEnd ? (
          <>
            <PremiumMessage message="Esta página não existe mais. Consulte a última página disponível." />
            <PremiumButton title="Abrir última página do extrato" onPress={() => onPage(last)} />
          </>
        ) : (
          <>
            {total > 0 && (
              <PremiumMessage message="As datas e horas seguem o horário deste aparelho." />
            )}
            {last > 1 && (
              <>
                <Text
                  accessibilityLiveRegion="polite"
                  style={[premiumTypography.label, { color: theme.text }]}
                >
                  Página {page} de {last}
                </Text>
                <View style={styles.pageButtons}>
                  <View style={styles.pageButton}>
                    <PremiumButton
                      title="Página anterior do extrato"
                      disabled={previous === null}
                      onPress={() => {
                        if (previous !== null) onPage(previous);
                      }}
                    />
                  </View>
                  <View style={styles.pageButton}>
                    <PremiumButton
                      title="Próxima página do extrato"
                      disabled={next === null}
                      onPress={() => {
                        if (next !== null) onPage(next);
                      }}
                    />
                  </View>
                </View>
              </>
            )}
            {!statement.data.length && (
              <PremiumMessage
                message={
                  page === 1
                    ? "Nenhum lançamento no extrato."
                    : "Esta página do extrato não tem lançamentos."
                }
              />
            )}
          </>
        )}
      </PremiumPanel>
      {!pastEnd && statement.data.map((entry) => <StatementItem key={entry.id} entry={entry} />)}
    </>
  );
}

function StatementItem({ entry }: { entry: LedgerItem }) {
  const theme = usePremiumTheme();
  const debit = entry.direction === "DEBIT";
  const name = debit ? "Débito interno" : "Crédito interno";
  const formatted = formatFinanceMoney(entry.amount, entry.direction);
  return (
    <PremiumPanel title={ledgerTypes[entry.type]}>
      <View style={styles.moneyRow}>
        <Text style={[premiumTypography.body, styles.moneyLabel, { color: theme.muted }]}>
          {name}
        </Text>
        <Text style={[premiumTypography.label, { color: debit ? theme.error : theme.success }]}>
          {formatted}
        </Text>
      </View>
      <PremiumMessage
        message={`${ledgerStatuses[entry.status]} · ${when.format(new Date(entry.createdAt))}`}
      />
      {!!entry.campaignTitle && <PremiumMessage message={`Campanha: ${entry.campaignTitle}`} />}
    </PremiumPanel>
  );
}

const styles = StyleSheet.create({
  balance: { gap: 10, borderRadius: 24, overflow: "hidden", padding: 18 },
  balanceAmount: { fontSize: 32, fontWeight: "800", letterSpacing: -0.6 },
  balanceOthers: { paddingTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pocket: { flexBasis: 124, flexGrow: 1, minWidth: 0, gap: 3 },
  moneyRow: {
    gap: 6,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  moneyLabel: { flexBasis: 139, flexShrink: 1, flexGrow: 1 },
  pageButtons: { gap: 8, flexDirection: "row", flexWrap: "wrap" },
  pageButton: { flexGrow: 1, flexBasis: 125, minWidth: 0 },
});
