import { apiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";

export async function POST(request: Request) {
  const response = await apiFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(await request.json()),
  });
  return jsonFromUpstream(await readJson(response), response.status);
}
