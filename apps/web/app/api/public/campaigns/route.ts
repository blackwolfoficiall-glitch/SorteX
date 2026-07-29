import { apiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.toString();
  const response = await apiFetch(
    `/public/campaigns${query ? `?${query}` : ""}`,
  );
  return jsonFromUpstream(await readJson(response), response.status);
}
