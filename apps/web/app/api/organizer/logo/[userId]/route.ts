import { apiFetch } from "@/lib/auth/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const response = await apiFetch(`/organizers/${userId}/logo`);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": response.headers.get("cache-control") || "no-store",
    },
  });
}
