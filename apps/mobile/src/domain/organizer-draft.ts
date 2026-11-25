type OrganizerApi = {
  request<T>(path: string, method?: string, body?: unknown): Promise<T>;
};

export type OrganizerDraftFields = {
  title: string;
  description: string;
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
  mainPrizeName?: string | null;
  numberPrice?: number | string | null;
  totalNumbers?: number | null;
};

export function draftFields(record: OrganizerDraftRecord): OrganizerDraftFields {
  return {
    title: record.title,
    description: record.description ?? "",
    mainPrizeName: record.mainPrizeName ?? "",
    numberPrice: record.numberPrice == null ? "" : String(record.numberPrice).replace(".", ","),
    totalNumbers: record.totalNumbers == null ? "" : String(record.totalNumbers),
  };
}

export function draftPayload(fields: OrganizerDraftFields) {
  const title = fields.title.trim();
  const quantity = fields.totalNumbers.trim();
  const price = fields.numberPrice.trim();
  if (title.length < 2) throw new Error("Digite o título da campanha.");
  if (quantity && (!/^\d+$/.test(quantity) || Number(quantity) < 1 || Number(quantity) > 10_000_000))
    throw new Error("Informe entre 1 e 10.000.000 de cotas.");
  if (price && (!/^\d+([.,]\d{1,2})?$/.test(price) || !Number.isFinite(Number(price.replace(",", "."))) || Number(price.replace(",", ".")) <= 0))
    throw new Error("Informe um preço válido, com até duas casas decimais.");
  return {
    title,
    description: fields.description.trim(),
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
