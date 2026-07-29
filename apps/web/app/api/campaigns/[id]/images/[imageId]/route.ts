import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  const { id, imageId } = await params;
  const response = await authenticatedApiFetch(
    `/campaigns/${id}/images/${imageId}`,
    { method: "DELETE" },
  );
  return jsonFromUpstream(await readJson(response), response.status);
}
