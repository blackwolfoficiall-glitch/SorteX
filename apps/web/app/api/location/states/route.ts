import { apiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";

export async function GET() {
  const response = await apiFetch("/locations/states");
  // Fetch already decodes compressed upstream bodies. Re-serialize JSON instead
  // of forwarding stale Content-Encoding/Content-Length transport headers.
  return jsonFromUpstream(await readJson(response), response.status);
}
