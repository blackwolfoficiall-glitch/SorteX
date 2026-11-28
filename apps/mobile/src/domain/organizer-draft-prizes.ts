import { ApiError, type SortexClient } from "../api/client";
import { activeCoverSession } from "./organizer-draft-cover";
import type { OrganizerDraftRecord } from "./organizer-draft";

export const prizeTypes = ["PIX", "PRODUCT", "GIFT_CARD", "OTHER"] as const;
export type PrizeType = (typeof prizeTypes)[number];
export type PrizeFields = {
  exactNumber: string;
  description: string;
  value: string;
  type: PrizeType;
};
export type DraftPrize = {
  id: string;
  exactNumber: string;
  description: string;
  value: number;
  type: PrizeType;
  status: string;
  updatedAt: string;
  editable: boolean;
};
export type PrizeApi = Pick<
  SortexClient,
  "snapshot" | "activeSessionRevision" | "request"
>;
type PrizeContext = { accountId: string; revision: number; campaignId: string };
type PrizeList = { items: unknown[]; pages: number };
type PrizeCommand =
  | { kind: "create"; fields: PrizeFields }
  | { kind: "edit"; prize: DraftPrize; fields: PrizeFields }
  | { kind: "remove"; prize: DraftPrize };

const validId = (id: string) => /^[\w-]+$/.test(id);
function campaignPath(id: string) {
  if (!validId(id)) throw new Error("Campanha inválida.");
  return `/campaigns/${id}`;
}
export function prizeFields(
  input: PrizeFields,
  total: number,
  editing: boolean,
) {
  const description = input.description.trim();
  const exactNumber = input.exactNumber.trim();
  const raw = input.value.trim();
  const price = Number(raw.replace(",", "."));
  if (!description || description.length > 120)
    throw new Error("Informe um nome de até 120 caracteres.");
  if (!/^\d{1,12}([,.]\d{1,2})?$/.test(raw) || !Number.isFinite(price))
    throw new Error("Informe um valor válido, com até duas casas decimais.");
  if (!prizeTypes.includes(input.type))
    throw new Error("Selecione o tipo do prêmio.");
  const width = String(total - 1).length;
  if (
    !editing &&
    (!/^\d+$/.test(exactNumber) ||
      exactNumber.length !== width ||
      Number(exactNumber) >= total)
  )
    throw new Error(
      `Informe um número válido com ${width} dígitos. Preserve os zeros à esquerda.`,
    );
  return {
    ...(!editing ? { exactNumber } : {}),
    description,
    value: price,
    type: input.type,
  };
}

export function toDraftPrize(value: unknown, campaignId: string): DraftPrize {
  const p = value as {
    id: string;
    campaignId: string;
    exactNumber: string | null;
    description: string;
    value: number;
    type: PrizeType;
    status: string;
    updatedAt: string;
    foundCount: number;
    winnerUserId: string | null;
    reservation: unknown;
    results: unknown[];
  } | null;
  if (
    !p ||
    p.campaignId !== campaignId ||
    typeof p.id !== "string" ||
    !validId(p.id) ||
    typeof p.description !== "string" ||
    typeof p.value !== "number" ||
    !Number.isFinite(p.value) ||
    !prizeTypes.includes(p.type) ||
    typeof p.status !== "string" ||
    typeof p.updatedAt !== "string" ||
    !(p.exactNumber === null || typeof p.exactNumber === "string")
  )
    throw new Error("Não foi possível confirmar as cotas desta campanha.");
  return {
    id: p.id,
    exactNumber: p.exactNumber ?? "",
    description: p.description,
    value: p.value,
    type: p.type,
    status: p.status,
    updatedAt: p.updatedAt,
    editable:
      p.foundCount === 0 &&
      p.winnerUserId === null &&
      p.reservation === null &&
      Array.isArray(p.results) &&
      p.results.length === 0 &&
      ["AVAILABLE", "CANCELLED"].includes(p.status) &&
      /^\d+$/.test(p.exactNumber ?? "") &&
      Number.isFinite(Date.parse(p.updatedAt)),
  };
}

function assertSession(
  api: PrizeApi,
  ctx: PrizeContext,
  isActive: () => boolean,
) {
  if (!isActive() || !activeCoverSession(api, ctx.accountId, ctx.revision))
    throw new ApiError("A sessão mudou. Entre novamente.", 401);
}

async function loadDraft(
  api: PrizeApi,
  ctx: PrizeContext,
  isActive: () => boolean,
) {
  assertSession(api, ctx, isActive);
  const campaign = await api.request<OrganizerDraftRecord>(
    campaignPath(ctx.campaignId),
  );
  assertSession(api, ctx, isActive);
  if (
    campaign?.id !== ctx.campaignId ||
    campaign.organizerId !== ctx.accountId ||
    campaign.status !== "DRAFT" ||
    campaign.publishedAt !== null ||
    typeof campaign.totalNumbers !== "number" ||
    !Number.isSafeInteger(campaign.totalNumbers) ||
    campaign.totalNumbers < 1
  )
    throw new ApiError(
      "Somente o organizador pode alterar cotas de um rascunho nunca publicado.",
      409,
    );
  return campaign;
}

export async function loadDraftPrizes(
  api: PrizeApi,
  ctx: PrizeContext,
  page: number,
  isActive = () => true,
) {
  const campaign = await loadDraft(api, ctx, isActive);
  const payload = await api.request<PrizeList>(
    `/organizer/prize-tickets?campaignId=${encodeURIComponent(ctx.campaignId)}&page=${page}&limit=15&sort=number`,
  );
  assertSession(api, ctx, isActive);
  if (
    !Array.isArray(payload?.items) ||
    !Number.isInteger(payload.pages) ||
    payload.pages < 1
  )
    throw new Error("Não foi possível carregar as cotas.");
  return {
    campaign,
    prizes: payload.items.map((p) => toDraftPrize(p, ctx.campaignId)),
    pages: payload.pages,
  };
}

export async function changeDraftPrize(
  api: PrizeApi,
  ctx: PrizeContext,
  command: PrizeCommand,
  isActive = () => true,
) {
  const campaign = await loadDraft(api, ctx, isActive);
  const base = `${campaignPath(ctx.campaignId)}/draft-prize-tickets`;
  let result: { id: string };
  if (command.kind === "create") {
    result = await api.request(
      base,
      "POST",
      prizeFields(command.fields, campaign.totalNumbers!, false),
    );
  } else {
    const { prize } = command;
    if (!prize.editable || !validId(prize.id))
      throw new Error("Esta cota não pode ser alterada.");
    const path = `${base}/${prize.id}`;
    result =
      command.kind === "edit"
        ? await api.request(path, "PATCH", {
            ...prizeFields(command.fields, campaign.totalNumbers!, true),
            revision: prize.updatedAt,
          })
        : await api.request(
            `${path}?revision=${encodeURIComponent(prize.updatedAt)}`,
            "DELETE",
          );
    if (result?.id !== prize.id)
      throw new ApiError(
        "Não foi possível confirmar a cota. Atualize a lista.",
        409,
      );
  }
  assertSession(api, ctx, isActive);
  if (!result?.id || !validId(result.id))
    throw new ApiError(
      "Não foi possível confirmar a cota. Atualize a lista.",
      409,
    );
  return result.id;
}
