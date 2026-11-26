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
import { NativeOrganizerDraftCover } from "./NativeOrganizerDraftCover";
import { activeCoverSession } from "../domain/organizer-draft-cover";
import { Button, Field, Notice, Page, colors } from "./ui";

export function NativeOrganizerDraft({
  organizerId,
  revision,
  campaignId,
  onSaved,
}: {
  organizerId: string;
  revision: number;
  campaignId?: string;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState(emptyOrganizerDraft);
  const [draft, setDraft] = useState<OrganizerDraftRecord>();
  const [loading, setLoading] = useState(Boolean(campaignId));
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const sendingCover = useRef(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const saving = useRef(false);
  const sameAccount = () => activeCoverSession(client, organizerId, revision);
  const errorMessage = (e: unknown) => e instanceof Error ? e.message : "Não foi possível salvar a campanha.";

  useEffect(() => {
    active.current = true;
    let alive = true;
    if (campaignId) {
      setLoading(true);
      client.request<OrganizerDraftRecord>(`/campaigns/${encodeURIComponent(campaignId)}`)
        .then((item) => {
          if (!alive || !sameAccount()) return;
          if (item.id !== campaignId || item.organizerId !== organizerId) throw new Error("Não foi possível confirmar a campanha.");
          if (!isEditableOrganizerCampaign(item.status)) throw new Error("Esta campanha não pode mais ser editada.");
          setDraft(item);
          setFields(draftFields(item));
        })
        .catch((e: unknown) => { if (alive && sameAccount()) setError(errorMessage(e)); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; active.current = false; };
  }, [campaignId, organizerId, revision]);

  const update = (field: keyof OrganizerDraftFields) => (value: string) =>
    setFields((prev) => ({ ...prev, [field]: value }));
  if (loading) return (
    <Page title="Carregando campanha">
      <ActivityIndicator accessibilityLabel="Carregando" color={colors.purple} />
    </Page>
  );

  const editable = !campaignId || isEditableOrganizerCampaign(draft?.status);
  const copyOnly = draft && draft.status !== "DRAFT";
  const title = !campaignId ? "Nova campanha" : copyOnly ? "Editar campanha" : "Editar rascunho";
  return (
    <Page title={title}>
      {editable && <Notice message={copyOnly
        ? "Aqui você pode editar o título, o resumo público e a descrição. As demais opções permanecem no painel web."
        : campaignId ? "Outros requisitos podem ser preenchidos no painel web."
          : "Salve o rascunho para adicionar a capa. As opções completas ficam no painel web."} />}
      {!!error && <Notice error message={error} />}
      {!editable && draft && <Notice message="Esta campanha não pode mais ser editada." />}
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
        {draft && !copyOnly && (
          <NativeOrganizerDraftCover client={client} accountId={organizerId} revision={revision}
            campaign={draft} disabled={busy} canStart={() => !saving.current}
            onBusy={(value) => { sendingCover.current = value; setCoverBusy(value); }} onChange={setDraft} />
        )}
        <Button title={copyOnly ? "Salvar campanha" : "Salvar rascunho"} busy={busy} disabled={coverBusy} onPress={() => {
          if (saving.current || sendingCover.current || !sameAccount()) return;
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
