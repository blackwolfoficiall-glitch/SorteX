import { authenticatedApiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";

export async function POST(request: Request) {
  const response = await authenticatedApiFetch("/auth/checkout/complete", { method: "POST", body: JSON.stringify(await request.json()), headers: { "Content-Type": "application/json" } });
  return jsonFromUpstream(await readJson(response), response.status);
}
