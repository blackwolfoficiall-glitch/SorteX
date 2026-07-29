import { authenticatedApiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const response = await authenticatedApiFetch(`/purchases/${id}`);
  return jsonFromUpstream(await readJson(response), response.status);
}
