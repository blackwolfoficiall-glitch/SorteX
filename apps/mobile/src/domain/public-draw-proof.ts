import { ApiError, type SortexClient } from "../api/client";

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;
const digits = (value: unknown): string | null =>
  typeof value === "string" && /^[0-9]+$/.test(value) && !/[^0-9]/.test(value)
    ? value
    : null;
const prizeList = (value: unknown): readonly string[] | null =>
  Array.isArray(value) &&
  value.length === 5 &&
  value.every((item) => digits(item) !== null)
    ? (value as string[])
    : null;

export type PublicDrawProof = {
  code: string;
  campaignTitle: string;
  campaignSlug: string;
  winnerStatus: string;
  winningTicket: string;
  confirmedAt: string;
  auditHash: string;
  rule: JsonRecord;
  rawResult: string | null;
  normalizedResult: string | null;
  extractionNumber: string | null;
  extractionDate: string | null;
  sourcePrizes: readonly string[] | null;
  canonicalPrizes: readonly string[] | null;
};

export async function readPublicDrawProof(
  client: Pick<SortexClient, "publicRequest">,
  input: string,
): Promise<PublicDrawProof> {
  const code = input.trim();
  if (!/^[A-Za-z0-9_-]{1,96}$/.test(code))
    throw new ApiError("Informe o código público como foi publicado.", 400);
  const response = record(
    await client.publicRequest<unknown>(
      `/public/winners/verify/${encodeURIComponent(code)}`,
    ),
  );
  const campaign = record(response?.campaign);
  const draw = record(response?.draw);
  const result = record(draw?.result);
  const lottery = record(result?.lottery);
  const rule = record(draw?.rule);
  const winningTicket = digits(response?.winningNumber);
  const campaignTitle = text(campaign?.title);
  const campaignSlug = text(campaign?.slug);
  const winnerStatus = text(response?.status);
  const confirmedAt = text(draw?.date);
  const auditHash = text(draw?.auditHash);
  if (
    response?.verificationCode !== code ||
    !winningTicket ||
    !campaignTitle ||
    !campaignSlug ||
    !winnerStatus ||
    !confirmedAt ||
    !Number.isFinite(Date.parse(confirmedAt)) ||
    !auditHash ||
    auditHash.length !== 64 ||
    !/^[a-f0-9]{64}$/i.test(auditHash) ||
    !rule
  )
    throw new ApiError(
      "A API não retornou uma prova pública de apuração válida.",
    );

  // Extraction and rule are the immutable execution snapshot. The public API
  // also exposes a live lottery object; do not use it to present the proof.
  return {
    code,
    campaignTitle,
    campaignSlug,
    winnerStatus,
    winningTicket,
    confirmedAt,
    auditHash,
    rule,
    rawResult: digits(result?.rawResult),
    normalizedResult: digits(result?.normalizedResult),
    extractionNumber: text(lottery?.extractionNumber),
    extractionDate: text(lottery?.drawDate),
    sourcePrizes: prizeList(lottery?.sourcePrizes),
    canonicalPrizes: prizeList(lottery?.prizes),
  };
}
