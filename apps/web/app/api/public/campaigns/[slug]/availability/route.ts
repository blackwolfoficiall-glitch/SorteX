import { apiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const response = await apiFetch(`/public/campaigns/${encodeURIComponent(slug)}/availability`);
  return jsonFromUpstream(await readJson(response), response.status);
}
