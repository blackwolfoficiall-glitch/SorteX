import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { client } from "../auth/runtime";
import {
  draftFields,
  emptyOrganizerDraft,
  saveOrganizerDraft,
  type OrganizerDraftFields,
  type OrganizerDraftRecord,
} from "../domain/organizer-draft";
import { Button, Field, Notice, Page, colors } from "./ui";

export function NativeOrganizerDraft({
  organizerId,
  campaignId,
  onSaved,
}: {
  organizerId: string;
  campaignId?: string;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState(emptyOrganizerDraft);
  const [draft, setDraft] = useState<OrganizerDraftRecord>();
  const [loading, setLoading] = useState(Boolean(campaignId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const saving = useRef(false);
  const sameAccount = () => client.snapshot().user?.id === organizerId;
  const errorMessage = (e: unknown) => e instanceof Error ? e.message : "Não foi possível salvar a campanha.";

  useEffect(() => {
    active.current = true;
    let alive = true;
    if (campaignId) {
      setLoading(true);
      client.request<OrganizerDraftRecord>(`/campaigns/${encodeURIComponent(campaignId)}`)
        .then((item) => {
          if (!alive || client.snapshot().user?.id !== organizerId) return;
          if (item.status !== "DRAFT") throw new Error("Este editor salva somente rascunhos.");
          setDraft(item);
          setFields(draftFields(item));
        })
        .catch((e: unknown) => { if (alive && client.snapshot().user?.id === organizerId) setError(errorMessage(e)); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; active.current = false; };
  }, [campaignId, organizerId]);

  const update = (field: keyof OrganizerDraftFields) => (value: string) =>
    setFields((prev) => ({ ...prev, [field]: value }));
  if (loading) return (
    <Page title="Carregando rascunho">
      <ActivityIndicator accessibilityLabel="Carregando" color={colors.purple} />
    </Page>
  );

  const editable = !campaignId || Boolean(draft);
  return (
    <Page title={campaignId ? "Editar rascunho" : "Nova campanha"}>
      <Notice message="Somente rascunho. As opções completas e a publicação permanecem no painel web." />
      {!!error && <Notice error message={error} />}
      {editable && <>
        <Field label="Título" value={fields.title} onChangeText={update("title")} maxLength={120} />
        <Field label="Descrição" value={fields.description} onChangeText={update("description")} multiline />
        <Field label="Prêmio principal" value={fields.mainPrizeName} onChangeText={update("mainPrizeName")} />
        <Field label="Quantidade de cotas" value={fields.totalNumbers} onChangeText={update("totalNumbers")} keyboardType="number-pad" />
        <Field label="Valor da cota" value={fields.numberPrice} onChangeText={update("numberPrice")} keyboardType="decimal-pad" />
        <Button title="Salvar rascunho" busy={busy} onPress={() => {
          if (saving.current || !sameAccount()) return;
          saving.current = true;
          setBusy(true);
          setError("");
          const save = async () => saveOrganizerDraft(client, fields, draft);
          void save()
            .then(() => { if (active.current && sameAccount()) onSaved(); })
            .catch((e: unknown) => { if (active.current && sameAccount()) setError(errorMessage(e)); })
            .finally(() => {
              saving.current = false;
              if (active.current && sameAccount()) setBusy(false);
            });
        }} />
      </>}
    </Page>
  );
}
