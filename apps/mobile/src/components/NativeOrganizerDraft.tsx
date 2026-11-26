import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";
import { client } from "../auth/runtime";
import {
  draftFields,
  emptyOrganizerDraft,
  isEditableOrganizerCampaign,
  saveOrganizerCampaign,
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
          if (!isEditableOrganizerCampaign(item.status)) throw new Error("Esta campanha não pode mais ser editada.");
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
    <Page title="Carregando campanha">
      <ActivityIndicator accessibilityLabel="Carregando" color={colors.purple} />
    </Page>
  );

  const editable = !campaignId || Boolean(draft);
  const copyOnly = draft && draft.status !== "DRAFT";
  const title = !campaignId ? "Nova campanha" : copyOnly ? "Editar campanha" : "Editar rascunho";
  return (
    <Page title={title}>
      {editable && <Notice message={copyOnly
        ? "Aqui você pode editar o título, o resumo público e a descrição. As demais opções permanecem no painel web."
        : "As opções completas e a publicação permanecem no painel web."} />}
      {!!error && <Notice error message={error} />}
      {editable && <>
        <Field label="Título" value={fields.title} onChangeText={update("title")} maxLength={120} />
        <Field label="Resumo público" value={fields.shortDescription ?? ""} onChangeText={update("shortDescription")} multiline />
        <Field label="Descrição completa" value={fields.description} onChangeText={update("description")} multiline />
        {!copyOnly && (
          <>
            <Field label="Prêmio principal" value={fields.mainPrizeName} onChangeText={update("mainPrizeName")} />
            <Field label="Quantidade de cotas" value={fields.totalNumbers} onChangeText={update("totalNumbers")} keyboardType="number-pad" />
            <Field label="Valor da cota" value={fields.numberPrice} onChangeText={update("numberPrice")} keyboardType="decimal-pad" />
          </>
        )}
        <Button title={copyOnly ? "Salvar campanha" : "Salvar rascunho"} busy={busy} onPress={() => {
          if (saving.current || !sameAccount()) return;
          saving.current = true;
          setBusy(true);
          setError("");
          const save = async () => saveOrganizerCampaign(client, fields, draft);
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
