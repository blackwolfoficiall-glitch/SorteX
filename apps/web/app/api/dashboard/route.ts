import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

export async function GET() {
  const response = await authenticatedApiFetch("/dashboard");
  return jsonFromUpstream(await readJson(response), response.status);
}
