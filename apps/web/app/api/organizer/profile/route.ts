import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

export async function GET() {
  const response = await authenticatedApiFetch("/organizers/me/profile");
  return jsonFromUpstream(await readJson(response), response.status);
}

export async function PATCH(request: Request) {
  const response = await authenticatedApiFetch("/organizers/me/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await request.json()),
  });
  return jsonFromUpstream(await readJson(response), response.status);
}
