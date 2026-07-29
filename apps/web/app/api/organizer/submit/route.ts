import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";

export async function POST() {
  const response = await authenticatedApiFetch("/organizers/me/submit", {
    method: "POST",
  });
  return jsonFromUpstream(await readJson(response), response.status);
}
