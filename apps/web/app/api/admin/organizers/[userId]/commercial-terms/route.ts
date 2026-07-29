import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const response = await authenticatedApiFetch(
    `/admin/organizers/${userId}/commercial-terms`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(await request.json()),
    },
  );
  return jsonFromUpstream(await readJson(response), response.status);
}
