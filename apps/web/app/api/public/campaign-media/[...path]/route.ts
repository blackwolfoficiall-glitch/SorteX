import { apiFetch } from "@/lib/auth/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const response = await apiFetch(
    `/public/campaigns/media/${path.map(encodeURIComponent).join("/")}`,
  );
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": response.headers.get("cache-control") || "no-store",
    },
  });
}
