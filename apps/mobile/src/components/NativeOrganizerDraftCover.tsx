import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { ApiError, type SortexClient } from "../api/client";
import {
  activeCoverSession,
  draftCoverMimeTypes,
  draftCoverRevision,
  nativeDraftCoverForm,
  uploadOrganizerDraftCover,
  validateNativeDraftCover,
} from "../domain/organizer-draft-cover";
import type { OrganizerDraftRecord } from "../domain/organizer-draft";
import { PremiumButton, PremiumMessage, PremiumPanel } from "../theme/premium";

export function NativeOrganizerDraftCover({
  client,
  accountId,
  revision,
  campaign,
  disabled,
  canStart,
  onBusy,
  onChange,
}: {
  client: SortexClient;
  accountId: string;
  revision: number;
  campaign: OrganizerDraftRecord;
  disabled: boolean;
  canStart: () => boolean;
  onBusy: (busy: boolean) => void;
  onChange: (campaign: OrganizerDraftRecord) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const mounted = useRef(false);
  const locked = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = draftCoverRevision(campaign, accountId);
  if (Platform.OS === "web" || !current) return null;
  const active = () => mounted.current && activeCoverSession(client, accountId, revision);

  async function act(refresh = false) {
    if (locked.current || disabled || !canStart() || !active()) return;
    locked.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setSuccess("");
    try {
      if (refresh) {
        const fresh = await client.request<OrganizerDraftRecord>(
          `/campaigns/${encodeURIComponent(campaign.id)}`,
        );
        if (!active()) return;
        if (fresh?.id !== campaign.id || fresh?.organizerId !== accountId)
          throw new Error("Não foi possível confirmar a campanha. Abra os detalhes novamente.");
        onChange(fresh);
        setNeedsRefresh(false);
        return;
      }
      const picked = await DocumentPicker.getDocumentAsync({
        type: [...draftCoverMimeTypes],
        multiple: false,
        copyToCacheDirectory: true,
      });
      if (!active() || picked.canceled) return;
      if (picked.assets.length !== 1 || !picked.assets[0])
        throw new Error("Selecione apenas uma imagem para a capa.");
      const file = validateNativeDraftCover(picked.assets[0]);
      const updated = await uploadOrganizerDraftCover(
        client,
        accountId,
        revision,
        campaign,
        (expected) => nativeDraftCoverForm(expected, file),
        active,
      );
      if (!active()) return;
      onChange(updated);
      setSuccess(
        current === "none" ? "Capa adicionada e conferida." : "Nova capa salva e conferida.",
      );
    } catch (cause) {
      if (!active()) return;
      const ambiguous =
        cause instanceof ApiError &&
        (cause.status === 0 || cause.status >= 500 || (cause.status >= 200 && cause.status < 300));
      const stale = cause instanceof ApiError && [401, 403, 404, 409].includes(cause.status);
      setNeedsRefresh(ambiguous || stale || refresh);
      setError(
        ambiguous
          ? "O envio não pôde ser confirmado. Atualize a capa antes de tentar novamente."
          : cause instanceof Error
            ? cause.message
            : "Não foi possível enviar a capa.",
      );
    } finally {
      locked.current = false;
      if (active()) {
        setBusy(false);
        onBusy(false);
      }
    }
  }

  return (
    <PremiumPanel title="Capa da campanha">
      <PremiumMessage
        message={
          current === "none"
            ? "Sem capa cadastrada. Adicione um JPG, PNG ou WEBP de até 20 MB."
            : "Capa cadastrada. Você pode substituí-la por um JPG, PNG ou WEBP de até 20 MB."
        }
      />
      <PremiumMessage message="A capa é um dos requisitos de publicação. Ela permanece privada no rascunho." />
      {success ? <PremiumMessage success message={success} /> : null}
      {error ? <PremiumMessage error message={error} /> : null}
      <PremiumButton
        title={
          needsRefresh
            ? "Atualizar situação da capa"
            : current === "none"
              ? "Adicionar capa"
              : "Substituir capa"
        }
        busy={busy}
        disabled={disabled}
        onPress={() => void act(needsRefresh)}
      />
    </PremiumPanel>
  );
}
