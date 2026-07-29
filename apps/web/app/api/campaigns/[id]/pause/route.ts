import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const response = await authenticatedApiFetch(`/campaigns/${id}/pause`, {
    method: "POST",
  });
  return jsonFromUpstream(await readJson(response), response.status);
}
