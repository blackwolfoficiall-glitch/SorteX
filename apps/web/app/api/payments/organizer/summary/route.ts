import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";
export async function GET() {
  const response = await authenticatedApiFetch("/payments/organizer/summary");
  return jsonFromUpstream(await readJson(response), response.status);
}
