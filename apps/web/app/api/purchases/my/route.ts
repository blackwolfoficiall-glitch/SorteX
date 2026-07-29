import { authenticatedApiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";
export async function GET(request: Request) {
  const query = new URL(request.url).search;
  const response = await authenticatedApiFetch(`/purchases/my${query}`);
  return jsonFromUpstream(await readJson(response), response.status);
}
