import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const response = await authenticatedApiFetch(`/payments/${id}/refresh`, {
    method: "POST",
  });
  return jsonFromUpstream(await readJson(response), response.status);
}
