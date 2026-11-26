type OrganizerApi = {
  request<T>(path: string, method?: string, body?: unknown): Promise<T>;
};

export type OrganizerDraftFields = {
  title: string;
  description: string;
  shortDescription?: string;
  regulation: string;
  mainPrizeName: string;
  mainPrizeDescription: string;
  estimatedPrizeValue: string;
  numberPrice: string;
  totalNumbers: string;
  minimumPurchase: string;
  drawDate: string;
  drawTime: string;
  salesStartDate: string;
  salesStartTime: string;
  drawRuleTemplateId: string;
};

export const emptyOrganizerDraft: OrganizerDraftFields = {
  title: "", description: "", regulation: "", mainPrizeName: "", mainPrizeDescription: "",
  estimatedPrizeValue: "", numberPrice: "", totalNumbers: "", minimumPurchase: "",
  drawDate: "", drawTime: "", salesStartDate: "", salesStartTime: "", drawRuleTemplateId: "",
};

export type OrganizerDraftRecord = {
  id: string;
  title: string;
  status: string;
  organizerId?: string;
  publishedAt?: string | null;
  coverImageRevision?: string | null;
  description?: string | null;
  shortDescription?: string | null;
  regulation?: string | null;
  mainPrizeName?: string | null;
  mainPrizeDescription?: string | null;
  estimatedPrizeValue?: number | string | null;
  numberPrice?: number | string | null;
  totalNumbers?: number | null;
  minimumPurchase?: number | null;
  drawDate?: string | null;
  drawTime?: string | null;
  drawBasis?: string;
  drawRuleTemplateId?: string | null;
  customDrawRule?: unknown;
  salesStartAt?: string | null;
};

const amountInput = (value?: number | string | null) =>
  value == null ? "" : String(value).replace(".", ",");

const pad = (part: number) => String(part).padStart(2, "0");
const brazilianDate = (isoDate: string) => /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
  ? isoDate.split("-").reverse().join("/")
  : "";

function localSalesTime(value?: string | null) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return { salesStartDate: "", salesStartTime: "" };
  return {
    salesStartDate: [pad(date.getDate()), pad(date.getMonth() + 1), date.getFullYear()].join("/"),
    salesStartTime: [pad(date.getHours()), pad(date.getMinutes())].join(":"),
  };
}

export function draftFields(record: OrganizerDraftRecord): OrganizerDraftFields {
  return {
    title: record.title,
    description: record.description ?? "",
    ...(record.shortDescription == null ? {} : { shortDescription: record.shortDescription }),
    regulation: record.regulation ?? "",
    mainPrizeName: record.mainPrizeName ?? "",
    mainPrizeDescription: record.mainPrizeDescription ?? "",
    estimatedPrizeValue: amountInput(record.estimatedPrizeValue),
    numberPrice: amountInput(record.numberPrice),
    totalNumbers: record.totalNumbers == null ? "" : String(record.totalNumbers),
    minimumPurchase: record.minimumPurchase == null ? "" : String(record.minimumPurchase),
    drawDate: brazilianDate(record.drawDate?.slice(0, 10) ?? ""),
    drawTime: record.drawTime ?? "",
    drawRuleTemplateId: record.drawRuleTemplateId ?? "",
    ...localSalesTime(record.salesStartAt),
  };
}

export function isEditableOrganizerCampaign(status?: string) {
  return status === "DRAFT" || status === "PUBLISHED" || status === "PAUSED";
}

// The app can select real Federal templates, but must not replace a custom
// rule or change another draw basis created on the Web.
export function mayChooseOrganizerDrawTemplate(draft?: OrganizerDraftRecord) {
  return !draft || (draft.status === "DRAFT" &&
    (draft.drawBasis === undefined || draft.drawBasis === "LOTERIA_FEDERAL") && draft.customDrawRule == null);
}

export type OrganizerDrawTemplate = { id: string; name: string; description?: string };
export async function listOrganizerDrawTemplates(api: OrganizerApi): Promise<OrganizerDrawTemplate[]> {
  const data = await api.request<unknown>("/draw-rule-templates");
  if (!Array.isArray(data)) throw new Error("Não foi possível confirmar os modelos de regra.");
  return data.flatMap((item): OrganizerDrawTemplate[] =>
    item && typeof item.id === "string" && item.id &&
    typeof item.name === "string" && item.name.trim()
      ? [{ id: item.id, name: item.name, ...(typeof item.description === "string" ? { description: item.description } : {}) }]
      : []);
}

function campaignCopy(fields: OrganizerDraftFields) {
  const title = fields.title.trim();
  if (title.length < 2) throw new Error("Digite o título da campanha.");
  return { title, description: fields.description.trim() };
}

function calendarDate(value: string, label: string) {
  const parts = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = parts ? `${parts[3]}-${parts[2]}-${parts[1]}` : "";
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (!parts || Number(parts[3]) < 1000 || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso)
    throw new Error(`Informe ${label} válida no formato DD/MM/AAAA.`);
  return iso;
}

function clockTime(value: string, label: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw new Error(`Informe ${label} válido no formato HH:MM.`);
  return value;
}

function parseSalesStart(dateInput: string, timeInput: string) {
  const datePart = calendarDate(dateInput, "uma data de início das vendas");
  const time = clockTime(timeInput, "um horário de início das vendas");
  // As on Web, a local wall time is converted to the corresponding ISO instant.
  const date = new Date(`${datePart}T${time}`);
  const readback = localSalesTime(Number.isFinite(date.getTime()) ? date.toISOString() : null);
  if (readback.salesStartDate !== dateInput || readback.salesStartTime !== timeInput)
    throw new Error("O horário de início das vendas não existe no fuso deste aparelho.");
  return date.toISOString();
}

function optionalAmount(value: string, invalidMessage: string, minimum: number) {
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  if (!/^\d+([.,]\d{1,2})?$/.test(value) || !Number.isFinite(parsed) ||
      parsed < minimum || parsed > 999_999_999_999.99)
    throw new Error(invalidMessage);
  return parsed;
}

export function draftPayload(fields: OrganizerDraftFields, current?: OrganizerDraftRecord) {
  const copy = campaignCopy(fields);
  const previous = current ? draftFields(current) : undefined;
  const changed = (key: keyof OrganizerDraftFields) => fields[key]?.trim() !== previous?.[key]?.trim();
  const quantity = fields.totalNumbers.trim();
  const price = fields.numberPrice.trim();
  const minimum = fields.minimumPurchase.trim();
  if (changed("totalNumbers") && quantity && (!/^\d+$/.test(quantity) || Number(quantity) < 1 || Number(quantity) > 10_000_000))
    throw new Error("Informe entre 1 e 10.000.000 de cotas.");
  if (changed("minimumPurchase") && minimum && (!/^\d+$/.test(minimum) || Number(minimum) < 1 || Number(minimum) > 10_000_000))
    throw new Error("Informe uma quantidade válida para a compra mínima.");
  if ((changed("minimumPurchase") || changed("totalNumbers")) && minimum && Number(minimum) > Number(quantity || current?.totalNumbers || 10_000))
    throw new Error("A compra mínima não pode ser maior que a quantidade de cotas.");

  const salesChanged = changed("salesStartDate") || changed("salesStartTime");
  const dateInput = fields.salesStartDate.trim(), timeInput = fields.salesStartTime.trim();
  const drawDate = fields.drawDate.trim(), drawTime = fields.drawTime.trim();
  const prizeValue = fields.estimatedPrizeValue.trim();
  // The API currently only updates these typed fields when a value is present.
  // Blanking an existing value must not appear to clear a persisted draft field.
  for (const [key, label] of [
    ["totalNumbers", "a quantidade de cotas"], ["minimumPurchase", "a compra mínima"],
    ["numberPrice", "o valor da cota"], ["estimatedPrizeValue", "o valor estimado do prêmio"],
    ["drawDate", "a data do sorteio"], ["drawTime", "o horário do sorteio"],
    ["salesStartDate", "a data de início das vendas"], ["salesStartTime", "o horário de início das vendas"],
    ["drawRuleTemplateId", "o modelo de regra"],
  ] as const) {
    if (previous?.[key]?.trim() && !fields[key]?.trim())
      throw new Error(`Informe outro valor para substituir ${label}.`);
  }

  const rule = fields.drawRuleTemplateId.trim();
  if (changed("drawRuleTemplateId") && rule && !mayChooseOrganizerDrawTemplate(current))
    throw new Error("A regra existente é protegida neste editor. Consulte o painel web.");

  return {
    ...(changed("title") ? { title: copy.title } : {}),
    ...(changed("description") ? { description: copy.description } : {}),
    ...(fields.shortDescription !== undefined && changed("shortDescription") ? { shortDescription: fields.shortDescription.trim() } : {}),
    ...(changed("mainPrizeName") ? { mainPrizeName: fields.mainPrizeName.trim() } : {}),
    ...(changed("regulation") && (previous?.regulation || fields.regulation.trim()) ? { regulation: fields.regulation.trim() } : {}),
    ...(changed("mainPrizeDescription") && (previous?.mainPrizeDescription || fields.mainPrizeDescription.trim()) ? { mainPrizeDescription: fields.mainPrizeDescription.trim() } : {}),
    ...(changed("totalNumbers") && quantity ? { totalNumbers: Number(quantity) } : {}),
    ...(changed("minimumPurchase") && minimum ? { minimumPurchase: Number(minimum) } : {}),
    ...(changed("numberPrice") && price ? { numberPrice: optionalAmount(price, "Informe um preço válido, com até duas casas decimais.", 0.01) } : {}),
    ...(changed("estimatedPrizeValue") && prizeValue ? { estimatedPrizeValue: optionalAmount(prizeValue, "Informe um valor estimado válido, com até duas casas decimais.", 0) } : {}),
    ...(changed("drawDate") && drawDate ? { drawDate: calendarDate(drawDate, "uma data de sorteio") } : {}),
    ...(changed("drawTime") && drawTime ? { drawTime: clockTime(drawTime, "um horário de sorteio") } : {}),
    ...(salesChanged && (dateInput || timeInput) ? { salesStartAt: parseSalesStart(dateInput, timeInput) } : {}),
    ...(changed("drawRuleTemplateId") && rule ? { drawBasis: "LOTERIA_FEDERAL", drawRuleTemplateId: rule } : {}),
  };
}

export function saveOrganizerDraft(
  api: OrganizerApi,
  fields: OrganizerDraftFields,
  draft?: OrganizerDraftRecord,
) {
  if (draft && draft.status !== "DRAFT") throw new Error("Este editor salva somente rascunhos.");
  const payload = draftPayload(fields, draft);
  if (draft && Object.keys(payload).length === 0) return Promise.resolve(draft);
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
