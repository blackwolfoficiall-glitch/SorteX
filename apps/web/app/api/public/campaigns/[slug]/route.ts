import { apiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const response = await apiFetch(`/public/campaigns/${slug}`);
  return jsonFromUpstream(await readJson(response), response.status);
}
