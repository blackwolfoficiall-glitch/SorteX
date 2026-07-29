import {
  apiFetch,
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";
async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const query = new URL(request.url).search;
  const contentType = request.headers.get("content-type") ?? "";
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : contentType.includes("multipart/form-data")
      ? await request.arrayBuffer()
      : await request.text();
  const endpoint =
    path[0] === "admin"
      ? `/admin/legal/${path.slice(1).map(encodeURIComponent).join("/")}`
      : `/legal/${path.map(encodeURIComponent).join("/")}`;
  const call = path[0] === "public" ? apiFetch : authenticatedApiFetch;
  const response = await call(`${endpoint}${query}`, {
    method: request.method,
    body: body || undefined,
    headers: body
      ? { "Content-Type": contentType || "application/json" }
      : undefined,
  });
  const responseType = response.headers.get("content-type") ?? "";
  if (
    responseType.includes("application/pdf") ||
    responseType.startsWith("image/")
  )
    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: {
        "Content-Type": responseType,
        "Content-Disposition":
          response.headers.get("content-disposition") ?? "inline",
      },
    });
  return jsonFromUpstream(await readJson(response), response.status);
}
export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
