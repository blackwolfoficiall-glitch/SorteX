import { apiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const query = new URL(request.url).search;
  const response = await apiFetch(`/public/campaigns/${encodeURIComponent(slug)}/numbers${query}`);
  return jsonFromUpstream(await readJson(response), response.status);
}
