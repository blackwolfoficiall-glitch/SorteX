import {
  authenticatedApiFetch,
  jsonFromUpstream,
  readJson,
} from "@/lib/auth/server";
export async function GET(
  _request: Request,
  context: { params: Promise<{ purchaseId: string }> },
) {
  const { purchaseId } = await context.params;
  const response = await authenticatedApiFetch(
    `/payments/purchase/${purchaseId}`,
  );
  return jsonFromUpstream(await readJson(response), response.status);
}
