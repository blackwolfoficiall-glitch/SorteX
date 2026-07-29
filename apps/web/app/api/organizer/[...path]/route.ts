import {
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
  const hasBody = !["GET", "HEAD"].includes(request.method);
  const contentType = request.headers.get("content-type") || "";
  const isMultipart = contentType.includes("multipart/form-data");
  const body = !hasBody
    ? undefined
    : isMultipart
      ? await request.formData()
      : await request.text();
  const response = await authenticatedApiFetch(
    `/organizer/${path.map(encodeURIComponent).join("/")}${query}`,
    {
      method: request.method,
      body: body || undefined,
      headers: typeof body === "string" && body
        ? {
            "Content-Type": contentType || "application/json",
          }
        : undefined,
    },
  );
  return jsonFromUpstream(await readJson(response), response.status);
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
