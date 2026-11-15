import { apiFetch, jsonFromUpstream, readJson } from "@/lib/auth/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uf: string }> },
) {
  const { uf } = await params;
  if (!/^[a-z]{2}$/i.test(uf))
    return Response.json({ message: "UF inválida." }, { status: 400 });
  const response = await apiFetch(
    `/locations/states/${uf.toUpperCase()}/cities`,
  );
  return jsonFromUpstream(await readJson(response), response.status);
}
