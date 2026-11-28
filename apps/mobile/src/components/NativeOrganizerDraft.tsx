import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Platform, View } from "react-native";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { ApiError } from "../api/client";
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
import {
  changedDraftFields,
  checkedWizardFields,
  confirmedDraftWrite,
  draftWizardStages,
} from "../domain/organizer-draft-wizard";
import { NativeOrganizerDraftCover } from "./NativeOrganizerDraftCover";
import { activeCoverSession } from "../domain/organizer-draft-cover";
import {
  PremiumButton,
  PremiumChoice,
  PremiumField,
  PremiumMessage,
  PremiumPage,
  PremiumPanel,
  usePremiumTheme,
} from "../theme/premium";

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
  onPrizes,
  onPromotions,
}: {
  organizerId: string;
  revision: number;
  campaignId?: string;
  onSaved: () => void;
  onPrizes: (campaignId: string) => void;
  onPromotions: (campaignId: string) => void;
}) {
  const theme = usePremiumTheme();
  const navigation = useNavigation();
  const [step, setStep] = useState(0);
  const [reload, setReload] = useState(0);
  const [creationUncertain, setCreationUncertain] = useState(false);
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
  const errorMessage = (e: unknown) =>
    e instanceof Error ? e.message : "Não foi possível salvar a campanha.";

  const dirty = changedDraftFields(fields, loadedDraft.current);
  usePreventRemove(dirty || busy || coverBusy, ({ data }) => {
    if (saving.current || sendingCover.current) return;
    Alert.alert("Alterações não salvas", "Volte ao editor para salvar ou saia sem manter estas alterações.", [
      { text: "Continuar editando", style: "cancel" },
      { text: "Sair sem salvar", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  useEffect(() => {
    active.current = true;
    let alive = true;
    if (campaignId) {
      setLoading(true);
      setError("");
      client
        .request<OrganizerDraftRecord>(`/campaigns/${encodeURIComponent(campaignId)}`)
        .then((item) => {
          if (!alive || !sameAccount()) return;
          if (item.id !== campaignId || item.organizerId !== organizerId)
            throw new Error("Não foi possível confirmar a campanha.");
          if (!isEditableOrganizerCampaign(item.status))
            throw new Error("Esta campanha não pode mais ser editada.");
          loadedDraft.current = item;
          setDraft(item);
          setFields(draftFields(item));
        })
        .catch((e: unknown) => {
          if (alive && sameAccount()) setError(errorMessage(e));
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }
    return () => {
      alive = false;
      active.current = false;
    };
  }, [campaignId, organizerId, revision, reload]);

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
      if (active.current && sameAccount())
        setRulesError(
          e instanceof Error ? e.message : "Não foi possível carregar os modelos de regra.",
        );
    } finally {
      fetchingRules.current = false;
      if (active.current && sameAccount()) setRulesBusy(false);
    }
  }
  if (loading)
    return (
      <PremiumPage title="Carregando campanha" top={false} bottom>
        <ActivityIndicator accessibilityLabel="Carregando" color={theme.accent} />
      </PremiumPage>
    );

  const editable = !campaignId || isEditableOrganizerCampaign(draft?.status);
  const copyOnly = draft && draft.status !== "DRAFT";
  const title =
    !campaignId && !draft ? "Nova campanha" : copyOnly ? "Editar campanha" : "Editar rascunho";
  const selectedRule = rules?.find((rule) => rule.id === fields.drawRuleTemplateId);
  const phase = draftWizardStages[step] ?? draftWizardStages[0];
  const wizard = !copyOnly && editable;
  const operationBusy = busy || coverBusy;
  function goStep(next: number) {
    if (saving.current || sendingCover.current) return;
    Keyboard.dismiss();
    if (next > step) {
      try {
        checkedWizardFields(phase.key, fields, loadedDraft.current);
      } catch (cause) {
        setError(errorMessage(cause));
        return;
      }
    }
    setError("");
    setStep(next);
  }

  function save() {
    if (saving.current || sendingCover.current || creationUncertain || !sameAccount()) return;
    saving.current = true;
    setBusy(true);
    setError("");
    const baseline = loadedDraft.current;
    let responded = false;
    void (async () => {
      if (baseline && fields.drawRuleTemplateId !== (baseline.drawRuleTemplateId ?? "") &&
          !mayChooseOrganizerDrawTemplate(draft))
        throw new Error("A regra mudou. Abra o rascunho novamente para conferir.");
      const result = await saveOrganizerCampaign(client, fields, baseline);
      responded = true;
      if (!active.current || !sameAccount()) return;
      if (!confirmedDraftWrite(result, organizerId, baseline))
        throw new Error("Não foi possível confirmar o salvamento. Confira a campanha na lista.");
      // Refresh the differential-save baseline only after the owning API confirms.
      // The no-op path returns the original baseline; do not roll the cover back.
      if (result !== baseline) {
        loadedDraft.current = result;
        setDraft(result);
        setFields(draftFields(result));
      }
      setSaved(true);
    })().catch((cause: unknown) => {
      if (!active.current || !sameAccount()) return;
      if (!baseline && (responded || (cause instanceof ApiError &&
          (cause.status === 0 || cause.status >= 500 || (cause.status >= 200 && cause.status < 300))))) {
        setCreationUncertain(true);
        setError("Não foi possível confirmar se o rascunho foi criado. Confira na lista de campanhas antes de iniciar outro. Os dados ainda estão neste formulário.");
      } else {
        setError(errorMessage(cause));
      }
    }).finally(() => {
      saving.current = false;
      if (active.current && sameAccount()) setBusy(false);
    });
  }

  return (
    <PremiumPage key={wizard ? phase.key : title} title={title} top={false} bottom avoidKeyboard>
      {editable && (
        <PremiumMessage
          message={
            copyOnly
              ? "Aqui você pode editar o título, o resumo público e a descrição. As demais opções permanecem no painel web."
              : "O rascunho é privado. Salve quando quiser e retome pela lista de campanhas."
          }
        />
      )}
      {saved && (
        <PremiumMessage success message={copyOnly ? "Alterações de texto salvas." : "Rascunho salvo. Nenhuma campanha foi publicada."} />
      )}
      {!!error && <PremiumMessage error message={error} />}
      {!editable && !draft && campaignId && (
        <PremiumButton title="Tentar carregar novamente" onPress={() => setReload((n) => n + 1)} />
      )}
      {editable && (
        <>
          {wizard && <PremiumMessage message={`Etapa ${step + 1} de ${draftWizardStages.length}: ${phase.title}`} />}
          {(copyOnly || phase.key === "info") && <PremiumPanel title="Informações da campanha">
            <PremiumField
              testID="sortex-organizer-draft-title"
              label="Título"
              value={fields.title}
              onChangeText={update("title")}
              editable={!busy}
              maxLength={120}
            />
            <PremiumField
              label="Resumo público"
              value={fields.shortDescription ?? ""}
              onChangeText={update("shortDescription")}
              editable={!busy}
              multiline
            />
            <PremiumField
              label="Descrição completa"
              value={fields.description}
              onChangeText={update("description")}
              editable={!busy}
              multiline
            />
          </PremiumPanel>}
          {wizard && (
            <>
              {phase.key === "info" && <PremiumPanel title="Regras de participação">
                <PremiumField
                  label="Regulamento"
                  value={fields.regulation}
                  onChangeText={update("regulation")}
                  editable={!busy}
                  multiline
                />
              </PremiumPanel>}
              {phase.key === "prizes" && <PremiumPanel title="Prêmio principal">
                <PremiumField
                  label="Prêmio principal"
                  value={fields.mainPrizeName}
                  onChangeText={update("mainPrizeName")}
                  editable={!busy}
                />
                <PremiumField
                  label="Descrição do prêmio"
                  value={fields.mainPrizeDescription}
                  onChangeText={update("mainPrizeDescription")}
                  editable={!busy}
                  multiline
                />
                <PremiumField
                  label="Valor estimado do prêmio (R$)"
                  value={fields.estimatedPrizeValue}
                  onChangeText={update("estimatedPrizeValue")}
                  editable={!busy}
                  keyboardType="decimal-pad"
                />
              </PremiumPanel>}
              {phase.key === "numbers" && <PremiumPanel title="Cotas">
                <PremiumField
                  label="Quantidade de cotas"
                  value={fields.totalNumbers}
                  onChangeText={update("totalNumbers")}
                  editable={!busy}
                  keyboardType="number-pad"
                />
                <PremiumField
                  label="Valor da cota (R$)"
                  value={fields.numberPrice}
                  onChangeText={update("numberPrice")}
                  editable={!busy}
                  keyboardType="decimal-pad"
                />
                <PremiumField
                  label="Compra mínima (cotas)"
                  value={fields.minimumPurchase}
                  onChangeText={update("minimumPurchase")}
                  editable={!busy}
                  keyboardType="number-pad"
                  placeholder="1"
                />
              </PremiumPanel>}
              {phase.key === "dates" && <PremiumPanel title="Calendário">
                <PremiumField
                  label="Data do sorteio (DD/MM/AAAA)"
                  value={fields.drawDate}
                  onChangeText={(value) => update("drawDate")(dateMask(value))}
                  editable={!busy}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="DD/MM/AAAA"
                />
                <PremiumField
                  label="Horário do sorteio (HH:MM, Brasília para novas datas)"
                  value={fields.drawTime}
                  onChangeText={(value) => update("drawTime")(timeMask(value))}
                  editable={!busy}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholder="HH:MM"
                />
                <PremiumField
                  label="Data de início das vendas (DD/MM/AAAA)"
                  value={fields.salesStartDate}
                  onChangeText={(value) => update("salesStartDate")(dateMask(value))}
                  editable={!busy}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="DD/MM/AAAA"
                />
                <PremiumField
                  label="Horário de início das vendas (HH:MM)"
                  value={fields.salesStartTime}
                  onChangeText={(value) => update("salesStartTime")(timeMask(value))}
                  editable={!busy}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholder="HH:MM"
                />
                <PremiumField
                  label="Data de encerramento das vendas (DD/MM/AAAA)"
                  value={fields.salesEndDate}
                  onChangeText={(value) => update("salesEndDate")(dateMask(value))}
                  editable={!busy}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="DD/MM/AAAA"
                />
                <PremiumField
                  label="Horário de encerramento das vendas (HH:MM)"
                  value={fields.salesEndTime}
                  onChangeText={(value) => update("salesEndTime")(timeMask(value))}
                  editable={!busy}
                  keyboardType="number-pad"
                  maxLength={5}
                  placeholder="HH:MM"
                />
                <PremiumMessage message="O período de vendas usa o fuso horário deste aparelho. Horários já salvos são mantidos se não forem editados." />
              </PremiumPanel>}
              {phase.key === "rule" && <PremiumPanel title="Regra do sorteio">
                {mayChooseOrganizerDrawTemplate(draft) ? (
                  <>
                    <PremiumMessage
                      message={
                        selectedRule
                          ? `Loteria Federal: ${selectedRule.name}`
                          : fields.drawRuleTemplateId
                            ? "O modelo já selecionado será mantido."
                            : "Nenhum modelo selecionado. Você pode salvar o rascunho sem uma regra."
                      }
                    />
                    <PremiumButton
                      title={rulesOpen ? "Fechar modelos" : "Escolher modelo da Loteria Federal"}
                      disabled={busy}
                      onPress={() => {
                        setRulesOpen(!rulesOpen);
                        if (!rulesOpen && rules === undefined) void fetchRules();
                      }}
                    />
                    {rulesOpen && rulesBusy && (
                      <ActivityIndicator
                        accessibilityLabel="Carregando modelos"
                        color={theme.accent}
                      />
                    )}
                    {rulesOpen && !!rulesError && (
                      <>
                        <PremiumMessage error message={rulesError} />
                        <PremiumButton
                          title="Tentar carregar modelos novamente"
                          disabled={busy || rulesBusy}
                          onPress={() => void fetchRules()}
                        />
                      </>
                    )}
                    {rulesOpen && !rulesBusy && rules?.length === 0 && (
                      <PremiumMessage message="Nenhum modelo disponível. Seu rascunho ainda pode ser salvo." />
                    )}
                    {rulesOpen &&
                      !rulesBusy &&
                      !busy &&
                      rules?.map((rule) => (
                        <View key={rule.id} style={{ gap: 5 }}>
                          <PremiumChoice
                            label={rule.name}
                            selected={rule.id === fields.drawRuleTemplateId}
                            onPress={() => {
                              update("drawRuleTemplateId")(rule.id);
                              setRulesOpen(false);
                            }}
                          />
                          {rule.description && <PremiumMessage message={rule.description} />}
                        </View>
                      ))}
                  </>
                ) : (
                  <PremiumMessage message="A regra existente será mantida. Use o painel web para editar uma regra personalizada ou mudar a base do sorteio." />
                )}
              </PremiumPanel>}
            </>
          )}
          {wizard && phase.key === "media" && (
            <>
              {!draft && <PremiumMessage message="Salve o rascunho antes de enviar a foto da capa." />}
              <PremiumMessage message={Platform.OS === "web"
                ? "Use o aplicativo instalado para enviar a capa. A galeria e a identidade avançada estão no painel web."
                : "Este editor permite enviar a capa. Galeria e identidade visual avançada permanecem no painel web."} />
              {!!draft && Platform.OS !== "web" && (
                <NativeOrganizerDraftCover
                  client={client}
                  accountId={organizerId}
                  revision={revision}
                  campaign={draft}
                  disabled={busy}
                  canStart={() => !saving.current}
                  onBusy={(value) => {
                    sendingCover.current = value;
                    setCoverBusy(value);
                  }}
                  onChange={setDraft}
                />
              )}
            </>
          )}
          {wizard && phase.key === "instant" && (
            <PremiumPanel title="Cotas premiadas do rascunho">
              <PremiumMessage message={!draft || dirty
                ? "Salve os dados do rascunho antes de configurar os números premiados."
                : "Configure as cotas privadas neste rascunho. Isso não apura, entrega nem paga prêmios."} />
              {!!draft && <PremiumButton title="Abrir cotas premiadas" disabled={dirty || operationBusy}
                onPress={() => onPrizes(draft.id)} />}
            </PremiumPanel>
          )}
          {wizard && phase.key === "promotions" && (
            <PremiumPanel title="Promoções do rascunho">
              <PremiumMessage message={!draft || dirty
                ? "Salve o rascunho antes de incluir cupons ou pacotes."
                : "Abra a gestão desta campanha para salvar ofertas como rascunho. Nenhuma promoção é ativada aqui."} />
              {!!draft && <PremiumButton title="Abrir promoções do rascunho" disabled={dirty || operationBusy}
                onPress={() => onPromotions(draft.id)} />}
            </PremiumPanel>
          )}
          {wizard && phase.key === "payment" && (
            <PremiumPanel title="Configurações de pagamento">
              <PremiumMessage message="Nenhum gateway será configurado por este rascunho. A configuração de pagamentos e os testes com o provedor não fazem parte deste editor." />
            </PremiumPanel>
          )}
          {wizard && phase.key === "review" && (
            <PremiumPanel title="Revisão do rascunho">
              <PremiumMessage message={`Campanha: ${fields.title.trim() || "Não informada"}`} />
              <PremiumMessage message={`Prêmio principal: ${fields.mainPrizeName.trim() || "Não informado"}`} />
              <PremiumMessage message={`Cotas: ${fields.totalNumbers.trim() || "Não informadas"} · Valor: ${fields.numberPrice.trim() ? `R$ ${fields.numberPrice.trim()}` : "Não informado"}`} />
              <PremiumMessage message={`Sorteio: ${fields.drawDate.trim() || "Não informado"} ${fields.drawTime.trim()}`} />
              <PremiumMessage message="Salvar aqui mantém a campanha privada. As exigências de publicação são conferidas separadamente em Situação da campanha." />
            </PremiumPanel>
          )}
          {wizard && step > 0 && (
            <PremiumButton title="Etapa anterior" onPress={() => goStep(step - 1)} disabled={operationBusy} />
          )}
          {wizard && step < draftWizardStages.length - 1 && (
            <PremiumButton title="Próxima etapa" filled onPress={() => goStep(step + 1)} disabled={operationBusy} />
          )}
          <PremiumButton
            filled={!wizard || phase.key === "review"}
            testID="sortex-organizer-draft-save"
            title={copyOnly ? "Salvar campanha" : "Salvar rascunho"}
            busy={busy}
            disabled={coverBusy || creationUncertain}
            onPress={save}
          />
          {saved && (
            <PremiumButton
              title="Fechar editor"
              disabled={dirty || operationBusy}
              onPress={onSaved}
            />
          )}
        </>
      )}
    </PremiumPage>
  );
}
