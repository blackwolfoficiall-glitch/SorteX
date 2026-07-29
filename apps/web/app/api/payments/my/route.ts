import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";
export async function GET(request: Request) {
  const response = await authenticatedApiFetch(
    `/payments/my${new URL(request.url).search}`,
  );
  return jsonFromUpstream(await readJson(response), response.status);
}
