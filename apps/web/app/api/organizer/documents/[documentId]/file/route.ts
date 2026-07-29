import { authenticatedApiFetch } from "@/lib/auth/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const response = await authenticatedApiFetch(
    `/organizers/documents/${documentId}/file`,
  );
  return new Response(response.body, {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("content-type") || "application/octet-stream",
      "Content-Disposition":
        response.headers.get("content-disposition") || "inline",
    },
  });
}
