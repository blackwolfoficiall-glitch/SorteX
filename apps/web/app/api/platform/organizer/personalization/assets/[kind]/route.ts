import { authenticatedApiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";
export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const response = await authenticatedApiFetch(`/organizer/personalization/assets/${kind}`, { method: "POST", body: await request.formData() });
  return jsonFromUpstream(await readJson(response), response.status);
}
