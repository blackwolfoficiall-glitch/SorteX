import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contentType = request.headers.get("content-type");
  const response = await authenticatedApiFetch(`/campaigns/${id}/images`, {
    method: "POST",
    headers: contentType ? { "Content-Type": contentType } : undefined,
    body: request.body,
    // O corpo multipart deve ser transmitido sem ser reconstruído em memória.
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return jsonFromUpstream(await readJson(response), response.status);
}
