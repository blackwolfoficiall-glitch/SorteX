import { draftFields, draftPayload, emptyOrganizerDraft,
  type OrganizerDraftFields, type OrganizerDraftRecord } from "./organizer-draft";

export const draftWizardStages = [
  { key: "info", title: "Informações principais", fields: ["title", "shortDescription", "description", "regulation"] },
  { key: "media", title: "Fotos e identidade", fields: [] },
  { key: "prizes", title: "Prêmios", fields: ["mainPrizeName", "mainPrizeDescription", "estimatedPrizeValue"] },
  { key: "numbers", title: "Quantidade e valor das cotas", fields: ["totalNumbers", "numberPrice", "minimumPurchase"] },
  { key: "instant", title: "Cotas premiadas", fields: [] },
  { key: "promotions", title: "Promoções", fields: [] },
  { key: "rule", title: "Regras de apuração", fields: ["drawRuleTemplateId"] },
  { key: "dates", title: "Datas e horários", fields: ["drawDate", "drawTime", "salesStartDate", "salesStartTime", "salesEndDate", "salesEndTime"] },
  { key: "payment", title: "Configurações de pagamento", fields: [] },
  { key: "review", title: "Revisão e publicação", fields: [] },
] as const satisfies readonly { key: string; title: string; fields: readonly (keyof OrganizerDraftFields)[] }[];

export type DraftWizardStage = (typeof draftWizardStages)[number]["key"];

export function changedDraftFields(fields: OrganizerDraftFields, record?: OrganizerDraftRecord) {
  const previous = record ? draftFields(record) : emptyOrganizerDraft;
  return Object.keys({ ...previous, ...fields }).some((k) => {
    const field = k as keyof OrganizerDraftFields;
    return (fields[field] ?? "").trim() !== (previous[field] ?? "").trim();
  });
}

export function checkedWizardFields(key: DraftWizardStage, fields: OrganizerDraftFields, record?: OrganizerDraftRecord) {
  const selected = draftWizardStages.find((stage) => stage.key === key);
  const slice = record ? draftFields(record) : { ...emptyOrganizerDraft };
  for (const field of selected?.fields ?? []) {
    const value = fields[field];
    if (value !== undefined) slice[field] = value;
  }
  // Only phase 1 requires a title to advance; every actual write requires
  // the real title and validates the full payload in the existing domain client.
  if (key !== "info" && !slice.title) slice.title = fields.title;
  return draftPayload(slice, record);
}

export function confirmedDraftWrite(
  item: OrganizerDraftRecord | null | undefined,
  organizerId: string,
  previous?: OrganizerDraftRecord,
) {
  return Boolean(
    item && typeof item.id === "string" && item.id &&
    item.organizerId === organizerId &&
    (previous ? item.id === previous.id && item.status === previous.status : item.status === "DRAFT"),
  );
}
