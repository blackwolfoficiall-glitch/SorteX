import { apiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizerId: string }> },
) {
  const { organizerId } = await params;
  const response = await apiFetch(
    `/public/campaigns/organizers/${encodeURIComponent(organizerId)}/profile`,
  );
  return jsonFromUpstream(await readJson(response), response.status);
}
