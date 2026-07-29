import { authenticatedApiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";
export async function GET() {
  const response = await authenticatedApiFetch("/purchases/current");
  return jsonFromUpstream(await readJson(response), response.status);
}
