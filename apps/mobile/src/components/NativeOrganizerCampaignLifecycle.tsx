import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { ApiError, type SortexClient } from "../api/client";
import {
  organizerLifecycleOptions,
  runOrganizerLifecycle,
  type OrganizerCampaignState,
  type OrganizerLifecycleAction,
} from "../domain/organizer-campaign-lifecycle";
import { Button, Notice, s } from "./ui";

const labels: Record<
  OrganizerLifecycleAction,
  { label: string; warning: string }
> = {
  publish: {
    label: "Publicar campanha",
    warning:
      "A campanha ficará disponível para consulta pública se atender aos requisitos. Se faltarem regulamento, imagem ou dados do sorteio, complete em Editar rascunho. Consulte o site para ajustar regras personalizadas.",
  },
  pause: {
    label: "Pausar campanha",
    warning:
      "A campanha deixa de aceitar novas reservas enquanto estiver pausada. Isso não cancela pedidos existentes.",
  },
  reactivate: {
    label: "Reativar campanha",
    warning:
      "A campanha voltará à consulta pública se o servidor confirmar que continua apta para publicação.",
  },
  finish: {
    label: "Encerrar campanha",
    warning:
      "Esta ação encerra a campanha e não oferece reativação no app. Não confirma apuração, entrega, cancelamento de pedidos nem pagamento.",
  },
};

export function NativeOrganizerCampaignLifecycle({
  client,
  accountId,
  campaign,
  onRefresh,
}: {
  client: SortexClient;
  accountId: string;
  campaign: OrganizerCampaignState;
  onRefresh: () => void;
}) {
  const [selected, setSelected] = useState<OrganizerLifecycleAction | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const mounted = useRef(false);
  const locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const { actions, notice } = organizerLifecycleOptions(campaign);
  if (campaign.organizerId !== accountId) return null;

  async function confirm(action: OrganizerLifecycleAction) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      await runOrganizerLifecycle(client, accountId, campaign, action);
      if (mounted.current) {
        setSelected(null);
        onRefresh();
      }
    } catch (cause) {
      if (mounted.current) {
        const ambiguous =
          cause instanceof ApiError &&
          (cause.status === 0 || cause.status >= 500);
        const stale =
          cause instanceof ApiError && [401, 403, 409].includes(cause.status);
        setNeedsRefresh(ambiguous || stale);
        setSelected(null);
        setError(
          ambiguous
            ? "O estado não pôde ser confirmado. Atualize antes de fazer outra alteração."
            : cause instanceof Error
              ? cause.message
              : "Não foi possível alterar a situação.",
        );
      }
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.label}>
        Situação da campanha
      </Text>
      {notice ? <Notice message={notice} /> : null}
      {error ? <Notice error message={error} /> : null}
      {needsRefresh ? (
        <Button secondary title="Atualizar situação" onPress={onRefresh} />
      ) : selected ? (
        <>
          <Notice message={labels[selected].warning} />
          <Button
            title={`Confirmar: ${labels[selected].label.toLocaleLowerCase("pt-BR")}`}
            busy={busy}
            onPress={() => void confirm(selected)}
          />
          <Button
            secondary
            title="Voltar sem alterar"
            disabled={busy}
            onPress={() => setSelected(null)}
          />
        </>
      ) : (
        actions.map((action) => (
          <Button
            key={action}
            secondary
            title={labels[action].label}
            onPress={() => {
              setError("");
              setSelected(action);
            }}
          />
        ))
      )}
    </View>
  );
}
