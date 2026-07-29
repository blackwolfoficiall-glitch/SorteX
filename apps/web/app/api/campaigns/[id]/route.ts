import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const response = await authenticatedApiFetch(`/campaigns/${id}`);
  return jsonFromUpstream(await readJson(response), response.status);
}
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  const response = await authenticatedApiFetch(`/campaigns/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await request.json()),
  });
  return jsonFromUpstream(await readJson(response), response.status);
}
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const response = await authenticatedApiFetch(`/campaigns/${id}`, {
    method: "DELETE",
  });
  return jsonFromUpstream(await readJson(response), response.status);
}
