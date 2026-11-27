import {
  apiFetch,
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

const publicInstantStatuses = new Set([
  "IDENTIFIED",
  "DELIVERED",
  "CANCELLED",
  "DISPUTED",
]);
const publicInstantPrizeTypes = new Set([
  "PIX",
  "PRODUCT",
  "GIFT_CARD",
  "OTHER",
]);
const maskedTicket = /^(?:\*{1,2}|[0-9]\*{2,}[0-9])$/;
const utcInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function publicInstantPrizeRows(upstream: unknown) {
  if (!Array.isArray(upstream)) return [];
  return upstream.flatMap((value: unknown) => {
    const row = record(value);
    const prize = record(row?.instantPrize);
    if (
      !row ||
      !prize ||
      typeof row.winningNumber !== "string" ||
      !maskedTicket.test(row.winningNumber) ||
      typeof row.status !== "string" ||
      !publicInstantStatuses.has(row.status) ||
      typeof row.identifiedAt !== "string" ||
      !utcInstant.test(row.identifiedAt) ||
      !Number.isFinite(Date.parse(row.identifiedAt)) ||
      new Date(row.identifiedAt).toISOString() !== row.identifiedAt ||
      typeof prize.description !== "string" ||
      typeof prize.value !== "number" ||
      !Number.isFinite(prize.value) ||
      typeof prize.type !== "string" ||
      !publicInstantPrizeTypes.has(prize.type)
    ) {
      return [];
    }

    // The older API also publishes buyer display fields. Never relay buyer
    // fields, unknown attributes or an unmasked ticket from this public read.
    return [
      {
        winningNumber: row.winningNumber,
        status: row.status,
        identifiedAt: row.identifiedAt,
        buyer: { name: "Identidade preservada", city: null, state: null },
        instantPrize: {
          description: prize.description,
          value: prize.value,
          type: prize.type,
        },
      },
    ];
  });
}

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const query = new URL(request.url).search;
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.text();
  const target = `/${path.join("/")}${query}`;
  const publicRead = request.method === "GET" && path[0] === "public";
  const fetcher = publicRead ? apiFetch : authenticatedApiFetch;
  const response = await fetcher(target, {
    method: request.method,
    body: body || undefined,
    headers: body
      ? {
          "Content-Type":
            request.headers.get("content-type") ?? "application/json",
        }
      : undefined,
  });
  const instantPrizeResult =
    publicRead &&
    path.length === 4 &&
    path[1] === "campaigns" &&
    path[3] === "instant-prizes";
  const payload: unknown = await readJson(response);
  return jsonFromUpstream(
    instantPrizeResult && response.ok
      ? publicInstantPrizeRows(payload)
      : payload,
    response.status,
    instantPrizeResult ? { "Cache-Control": "no-store" } : undefined,
  );
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
