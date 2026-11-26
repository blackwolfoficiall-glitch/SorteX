type OrganizerApi = {
  request<T>(path: string, method?: string, body?: unknown): Promise<T>;
};

export type OrganizerDraftFields = {
  title: string;
  description: string;
  shortDescription?: string;
  mainPrizeName: string;
  numberPrice: string;
  totalNumbers: string;
};

export const emptyOrganizerDraft: OrganizerDraftFields = {
  title: "", description: "", mainPrizeName: "", numberPrice: "", totalNumbers: "",
};

export type OrganizerDraftRecord = {
  id: string;
  title: string;
  status: string;
  description?: string | null;
  shortDescription?: string | null;
  mainPrizeName?: string | null;
  numberPrice?: number | string | null;
  totalNumbers?: number | null;
};

export function draftFields(record: OrganizerDraftRecord): OrganizerDraftFields {
  return {
    title: record.title,
    description: record.description ?? "",
    ...(record.shortDescription == null ? {} : { shortDescription: record.shortDescription }),
    mainPrizeName: record.mainPrizeName ?? "",
    numberPrice: record.numberPrice == null ? "" : String(record.numberPrice).replace(".", ","),
    totalNumbers: record.totalNumbers == null ? "" : String(record.totalNumbers),
  };
}

export function isEditableOrganizerCampaign(status?: string) {
  return status === "DRAFT" || status === "PUBLISHED" || status === "PAUSED";
}

function campaignCopy(fields: OrganizerDraftFields) {
  const title = fields.title.trim();
  if (title.length < 2) throw new Error("Digite o título da campanha.");
  return { title, description: fields.description.trim() };
}

export function draftPayload(fields: OrganizerDraftFields) {
  const copy = campaignCopy(fields);
  const quantity = fields.totalNumbers.trim();
  const price = fields.numberPrice.trim();
  if (quantity && (!/^\d+$/.test(quantity) || Number(quantity) < 1 || Number(quantity) > 10_000_000))
    throw new Error("Informe entre 1 e 10.000.000 de cotas.");
  if (price && (!/^\d+([.,]\d{1,2})?$/.test(price) || !Number.isFinite(Number(price.replace(",", "."))) || Number(price.replace(",", ".")) <= 0))
    throw new Error("Informe um preço válido, com até duas casas decimais.");
  return {
    ...copy,
    ...(fields.shortDescription === undefined ? {} : { shortDescription: fields.shortDescription.trim() }),
    mainPrizeName: fields.mainPrizeName.trim(),
    ...(quantity ? { totalNumbers: Number(quantity) } : {}),
    ...(price ? { numberPrice: Number(price.replace(",", ".")) } : {}),
  };
}

export function saveOrganizerDraft(
  api: OrganizerApi,
  fields: OrganizerDraftFields,
  draft?: OrganizerDraftRecord,
) {
  if (draft && draft.status !== "DRAFT") throw new Error("Este editor salva somente rascunhos.");
  const payload = draftPayload(fields);
  return draft
    ? api.request<OrganizerDraftRecord>(`/campaigns/${encodeURIComponent(draft.id)}`, "PATCH", payload)
    : api.request<OrganizerDraftRecord>("/campaigns", "POST", payload);
}

export function saveOrganizerCampaign(
  api: OrganizerApi,
  fields: OrganizerDraftFields,
  campaign?: OrganizerDraftRecord,
) {
  if (!campaign || campaign.status === "DRAFT") return saveOrganizerDraft(api, fields, campaign);
  if (!isEditableOrganizerCampaign(campaign.status)) throw new Error("Esta campanha não pode mais ser editada.");
  const copy = campaignCopy(fields);
  const shortDescription = fields.shortDescription?.trim();
  // Do not resend stale values for fields the organizer did not edit.
  const changes = {
    ...(copy.title !== campaign.title.trim() ? { title: copy.title } : {}),
    ...(copy.description !== (campaign.description ?? "").trim()
      ? { description: copy.description }
      : {}),
    ...(shortDescription !== undefined && shortDescription !== (campaign.shortDescription ?? "").trim()
      ? { shortDescription }
      : {}),
  };
  if (Object.keys(changes).length === 0) return Promise.resolve(campaign);
  return api.request<OrganizerDraftRecord>(
    `/campaigns/${encodeURIComponent(campaign.id)}`, "PATCH", changes,
  );
}
