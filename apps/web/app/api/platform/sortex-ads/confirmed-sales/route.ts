import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

export async function GET(request: Request) {
  const query = new URL(request.url).search;
  const response = await authenticatedApiFetch(
    `/sortex-ads/confirmed-sales${query}`,
    {
      method: "GET",
      signal: request.signal,
    },
  );
  return jsonFromUpstream(await readJson(response), response.status, {
    "Cache-Control": "private, no-store",
  });
}
