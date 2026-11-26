import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { client } from "../auth/runtime";
import {
  draftFields,
  emptyOrganizerDraft,
  isEditableOrganizerCampaign,
  listOrganizerDrawTemplates,
  mayChooseOrganizerDrawTemplate,
  saveOrganizerCampaign,
  type OrganizerDraftFields,
  type OrganizerDraftRecord,
  type OrganizerDrawTemplate,
} from "../domain/organizer-draft";
import { NativeOrganizerDraftCover } from "./NativeOrganizerDraftCover";
import { activeCoverSession } from "../domain/organizer-draft-cover";
import { Button, Choice, Field, Notice, Page, colors, s } from "./ui";

function dateMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}
function timeMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return [digits.slice(0, 2), digits.slice(2)].filter(Boolean).join(":");
}

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
  // A cover refresh may return newer content. Keep the form's comparison
  // baseline so a subsequent save does not resend fields the user never edited.
  const loadedDraft = useRef<OrganizerDraftRecord | undefined>(undefined);
  const [loading, setLoading] = useState(Boolean(campaignId));
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const sendingCover = useRef(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rules, setRules] = useState<OrganizerDrawTemplate[]>();
  const [rulesBusy, setRulesBusy] = useState(false);
  const [rulesError, setRulesError] = useState("");
  const fetchingRules = useRef(false);
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
          loadedDraft.current = item;
          setDraft(item);
          setFields(draftFields(item));
        })
        .catch((e: unknown) => { if (alive && sameAccount()) setError(errorMessage(e)); })
        .finally(() => { if (alive) setLoading(false); });
    }
    return () => { alive = false; active.current = false; };
  }, [campaignId, organizerId, revision]);

  const update = (field: keyof OrganizerDraftFields) => (value: string) => {
    if (saving.current) return;
    setSaved(false);
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  async function fetchRules() {
    if (fetchingRules.current || !sameAccount()) return;
    fetchingRules.current = true;
    setRulesBusy(true);
    setRulesError("");
    try {
      const models = await listOrganizerDrawTemplates(client);
      if (active.current && sameAccount()) setRules(models);
    } catch (e) {
      if (active.current && sameAccount()) setRulesError(
        e instanceof Error ? e.message : "Não foi possível carregar os modelos de regra.",
      );
    } finally {
      fetchingRules.current = false;
      if (active.current && sameAccount()) setRulesBusy(false);
    }
  }
  if (loading) return (
    <Page title="Carregando campanha">
      <ActivityIndicator accessibilityLabel="Carregando" color={colors.purple} />
    </Page>
  );

  const editable = !campaignId || isEditableOrganizerCampaign(draft?.status);
  const copyOnly = draft && draft.status !== "DRAFT";
  const title = !campaignId && !draft ? "Nova campanha" : copyOnly ? "Editar campanha" : "Editar rascunho";
  const selectedRule = rules?.find((rule) => rule.id === fields.drawRuleTemplateId);
  return (
    <Page title={title}>
      {editable && <Notice message={copyOnly
        ? "Aqui você pode editar o título, o resumo público e a descrição. As demais opções permanecem no painel web."
        : draft ? "Complete os dados, salve e confira a publicação na seção Situação da campanha."
          : "Preencha os dados aos poucos. Salve o rascunho para poder enviar a capa."} />}
      {saved && <Notice message="Rascunho salvo. Você já pode adicionar a capa abaixo." />}
      {!!error && <Notice error message={error} />}
      {!editable && draft && <Notice message="Esta campanha não pode mais ser editada." />}
      {editable && <>
        <Field label="Título" value={fields.title} onChangeText={update("title")} editable={!busy} maxLength={120} />
        <Field label="Resumo público" value={fields.shortDescription ?? ""} onChangeText={update("shortDescription")} editable={!busy} multiline />
        <Field label="Descrição completa" value={fields.description} onChangeText={update("description")} editable={!busy} multiline />
        {!copyOnly && (
          <>
            <Field label="Regulamento" value={fields.regulation} onChangeText={update("regulation")} editable={!busy} multiline />
            <Field label="Prêmio principal" value={fields.mainPrizeName} onChangeText={update("mainPrizeName")} editable={!busy} />
            <Field label="Descrição do prêmio" value={fields.mainPrizeDescription}
              onChangeText={update("mainPrizeDescription")} editable={!busy} multiline />
            <Field label="Valor estimado do prêmio (R$)" value={fields.estimatedPrizeValue}
              onChangeText={update("estimatedPrizeValue")} editable={!busy} keyboardType="decimal-pad" />
            <Field label="Quantidade de cotas" value={fields.totalNumbers} onChangeText={update("totalNumbers")} editable={!busy} keyboardType="number-pad" />
            <Field label="Valor da cota (R$)" value={fields.numberPrice} onChangeText={update("numberPrice")} editable={!busy} keyboardType="decimal-pad" />
            <Field label="Compra mínima (cotas)" value={fields.minimumPurchase}
              onChangeText={update("minimumPurchase")} editable={!busy} keyboardType="number-pad" placeholder="1" />
            <Field label="Data do sorteio (DD/MM/AAAA)" value={fields.drawDate}
              onChangeText={(value) => update("drawDate")(dateMask(value))} editable={!busy} keyboardType="number-pad" maxLength={10} placeholder="DD/MM/AAAA" />
            <Field label="Horário do sorteio (HH:MM, Brasília para novas datas)" value={fields.drawTime}
              onChangeText={(value) => update("drawTime")(timeMask(value))} editable={!busy} keyboardType="number-pad" maxLength={5} placeholder="HH:MM" />
            <Field label="Data de início das vendas (DD/MM/AAAA)" value={fields.salesStartDate}
              onChangeText={(value) => update("salesStartDate")(dateMask(value))} editable={!busy} keyboardType="number-pad" maxLength={10} placeholder="DD/MM/AAAA" />
            <Field label="Horário de início das vendas (HH:MM)" value={fields.salesStartTime}
              onChangeText={(value) => update("salesStartTime")(timeMask(value))} editable={!busy} keyboardType="number-pad" maxLength={5} placeholder="HH:MM" />
            <Notice message="O início das vendas usa o fuso horário deste aparelho." />
            <View style={s.card}>
              <Text accessibilityRole="header" style={s.label}>Regra do sorteio</Text>
              {mayChooseOrganizerDrawTemplate(draft) ? (
                <>
                  <Notice message={selectedRule
                    ? `Loteria Federal: ${selectedRule.name}`
                    : fields.drawRuleTemplateId ? "O modelo já selecionado será mantido." : "Nenhum modelo selecionado. Você pode salvar o rascunho sem uma regra."} />
                  <Button secondary title={rulesOpen ? "Fechar modelos" : "Escolher modelo da Loteria Federal"}
                    disabled={busy}
                    onPress={() => {
                      setRulesOpen(!rulesOpen);
                      if (!rulesOpen && rules === undefined) void fetchRules();
                    }} />
                  {rulesOpen && rulesBusy && <ActivityIndicator accessibilityLabel="Carregando modelos" color={colors.purple} />}
                  {rulesOpen && !!rulesError && <>
                    <Notice error message={rulesError} />
                    <Button secondary title="Tentar carregar modelos novamente" disabled={busy || rulesBusy} onPress={() => void fetchRules()} />
                  </>}
                  {rulesOpen && !rulesBusy && rules?.length === 0 && <Notice message="Nenhum modelo disponível. Seu rascunho ainda pode ser salvo." />}
                  {rulesOpen && !rulesBusy && !busy && rules?.map((rule) => (
                    <View key={rule.id} style={{ gap: 5 }}>
                      <Choice label={rule.name} selected={rule.id === fields.drawRuleTemplateId} onPress={() => {
                        update("drawRuleTemplateId")(rule.id);
                        setRulesOpen(false);
                      }} />
                      {rule.description && <Notice message={rule.description} />}
                    </View>
                  ))}
                </>
              ) : (
                <Notice message="A regra existente será mantida. Use o painel web para editar uma regra personalizada ou mudar a base do sorteio." />
              )}
            </View>
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
          const save = async () => {
            const baseline = loadedDraft.current;
            if (baseline && fields.drawRuleTemplateId !== (baseline.drawRuleTemplateId ?? "") &&
                !mayChooseOrganizerDrawTemplate(draft))
              throw new Error("A regra mudou. Abra o rascunho novamente para conferir.");
            return saveOrganizerCampaign(client, fields, baseline);
          };
          void save()
            .then((result) => {
              if (!active.current || !sameAccount()) return;
              if (!result.id || result.organizerId !== organizerId ||
                  (draft && (result.id !== draft.id || result.status !== draft.status)) ||
                  (!draft && result.status !== "DRAFT"))
                throw new Error("Não foi possível confirmar o salvamento. Confira a campanha antes de tentar novamente.");
              if (!draft) {
                loadedDraft.current = result;
                setDraft(result);
                setFields(draftFields(result));
                setSaved(true);
              } else onSaved();
            })
            .catch((e: unknown) => { if (active.current && sameAccount()) setError(errorMessage(e)); })
            .finally(() => {
              saving.current = false;
              if (active.current && sameAccount()) setBusy(false);
            });
        }} />
        {saved && <Button secondary title="Voltar à lista de campanhas" disabled={busy || coverBusy} onPress={onSaved} />}
      </>}
    </Page>
  );
}
