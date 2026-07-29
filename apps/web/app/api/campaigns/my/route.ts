import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.toString();
  const response = await authenticatedApiFetch(
    `/campaigns/my${query ? `?${query}` : ""}`,
  );
  const retryAfter = response.headers.get("Retry-After");
  const requestId = response.headers.get("X-Request-Id");
  return jsonFromUpstream(await readJson(response), response.status, {
    ...(retryAfter ? { "Retry-After": retryAfter } : {}),
    ...(requestId ? { "X-Request-Id": requestId } : {}),
  });
}
