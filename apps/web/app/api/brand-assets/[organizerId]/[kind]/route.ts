import { apiFetch } from "@/lib/auth/server";
export async function GET(_request: Request, { params }: { params: Promise<{ organizerId: string; kind: string }> }) {
  const { organizerId, kind } = await params;
  const response = await apiFetch(`/organizers/${organizerId}/brand-assets/${kind}`);
  return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/octet-stream", "Cache-Control": response.headers.get("Cache-Control") || "public, max-age=3600" } });
}
