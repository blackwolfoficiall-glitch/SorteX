import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

export async function POST(request: Request) {
  const response = await authenticatedApiFetch("/organizers/me/logo", {
    method: "POST",
    body: await request.formData(),
  });
  return jsonFromUpstream(await readJson(response), response.status);
}
