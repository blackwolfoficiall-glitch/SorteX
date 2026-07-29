import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";
export async function GET() {
  const response = await authenticatedApiFetch("/draw-rule-templates");
  return jsonFromUpstream(await readJson(response), response.status);
}
export async function POST(request: Request) {
  const response = await authenticatedApiFetch("/draw-rule-templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(await request.json()),
  });
  return jsonFromUpstream(await readJson(response), response.status);
}
