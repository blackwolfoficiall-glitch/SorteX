import { apiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";

export async function GET() {
  const response = await apiFetch("/health/ready");
  return jsonFromUpstream(await readJson(response), response.status);
}
