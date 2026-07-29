import { authenticatedApiFetch } from "@/lib/auth/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> },
) {
  const { id, path } = await params;
  const response = await authenticatedApiFetch(
    `/campaigns/${encodeURIComponent(id)}/media/${path.map(encodeURIComponent).join("/")}`,
  );
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "private, no-store",
    },
  });
}
