import { apiFetch, readJson } from "@/lib/auth/server";
export async function GET() {
  const response = await apiFetch("/auth/social/providers");
  return Response.json(await readJson(response), {
    status: response.status,
    headers: { "Cache-Control": "no-store" },
  });
}
