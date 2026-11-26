import { useState } from "react";
import { Text, View } from "react-native";
import { ApiError, type SortexClient } from "../api/client";
import {
  readPublicDrawProof,
  type PublicDrawProof,
} from "../domain/public-draw-proof";
import { Button, Field, Notice, s } from "./ui";

const prizeStatuses: Record<string, string> = {
  IDENTIFIED: "Ganhador identificado",
  PENDING_CONTACT: "Contato com o ganhador pendente",
  CONTACTED: "Ganhador contatado",
  CLAIMED: "Prêmio solicitado",
  PAYMENT_PENDING: "Pagamento do prêmio pendente",
  DELIVERED: "Prêmio entregue",
  CONFIRMED_BY_WINNER: "Recebimento confirmado pelo ganhador",
  NOT_CLAIMED: "Prêmio não solicitado",
  CANCELLED: "Premiação cancelada",
  DISPUTED: "Premiação em disputa",
};

export function NativePublicDrawProof({ client }: { client: SortexClient }) {
  const [code, setCode] = useState("");
  const [proof, setProof] = useState<PublicDrawProof | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (working) return;
    setProof(null);
    setError("");
    setWorking(true);
    try {
      setProof(await readPublicDrawProof(client, code));
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 404
          ? "Não há prova de ganhador válida para este código."
          : cause instanceof Error
            ? cause.message
            : "Não foi possível verificar o resultado.",
      );
    } finally {
      setWorking(false);
    }
  }

  const prizeStatus =
    proof && Object.hasOwn(prizeStatuses, proof.winnerStatus)
      ? prizeStatuses[proof.winnerStatus]
      : null;
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.label}>
        Prova pública de apuração
      </Text>
      <Notice message="Confira a prova de um sorteio confirmado pelo código publicado. Esta consulta não inclui cotas premiadas instantâneas." />
      <Field
        label="Código público de verificação"
        value={code}
        editable={!working}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={96}
        onChangeText={(value) => {
          setCode(value);
          setProof(null);
          setError("");
        }}
      />
      <Button
        secondary
        title="Verificar código público"
        busy={working}
        disabled={!code.trim()}
        onPress={() => void verify()}
      />
      {error ? <Notice error message={error} /> : null}
      {proof ? (
        <View style={s.card} accessibilityLiveRegion="polite">
          <Text style={s.label}>{proof.campaignTitle}</Text>
          <Text style={s.text}>Título vencedor: {proof.winningTicket}</Text>
          <Notice
            message={`Apuração confirmada em ${new Date(proof.confirmedAt).toLocaleString("pt-BR")}`}
          />
          {prizeStatus && <Notice message={`Premiação: ${prizeStatus}`} />}
          {proof.extractionNumber && (
            <Text style={s.text}>
              Extração Federal: {proof.extractionNumber}
            </Text>
          )}
          {typeof proof.rule.version === "number" && (
            <Text style={s.text}>Versão da regra: {proof.rule.version}</Text>
          )}
          {proof.sourcePrizes && (
            <Notice
              message={`Prêmios originais da fonte: ${proof.sourcePrizes.join(" · ")}`}
            />
          )}
          {proof.canonicalPrizes && (
            <Notice
              message={`Prêmios usados na apuração: ${proof.canonicalPrizes.join(" · ")}`}
            />
          )}
          <RuleSteps rule={proof.rule} />
          {proof.rawResult && (
            <Text style={s.text}>Resultado calculado: {proof.rawResult}</Text>
          )}
          {proof.normalizedResult &&
            proof.normalizedResult !== proof.rawResult && (
              <Text style={s.text}>
                Resultado normalizado: {proof.normalizedResult}
              </Text>
            )}
          <Text style={s.label}>Hash da apuração</Text>
          <Text selectable style={s.muted}>
            {proof.auditHash}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const positions: Record<string, string> = {
  TEN_THOUSAND: "dezena de milhar",
  THOUSAND: "milhar",
  HUNDRED: "centena",
  TEN: "dezena",
  UNIT: "unidade",
};

function RuleSteps({ rule }: { rule: PublicDrawProof["rule"] }) {
  if (!Array.isArray(rule.steps)) return null;
  const labels = rule.steps.flatMap((step: unknown) => {
    if (
      !step ||
      typeof step !== "object" ||
      !("sourcePrize" in step) ||
      typeof step.sourcePrize !== "number" ||
      !("digitPosition" in step) ||
      typeof step.digitPosition !== "string" ||
      !Object.hasOwn(positions, step.digitPosition)
    )
      return [];
    const position = positions[step.digitPosition];
    const reversed = "direction" in step && step.direction === "REVERSE";
    return [
      `${step.sourcePrize}º prêmio, ${position}${reversed ? " (inverso)" : ""}`,
    ];
  });
  return labels.length ? (
    <Notice message={`Etapas registradas da regra: ${labels.join(" · ")}`} />
  ) : null;
}
