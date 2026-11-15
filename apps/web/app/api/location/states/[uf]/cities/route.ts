import { apiFetch } from "@/lib/auth/server";
export async function GET(_request: Request, { params }: { params: Promise<{ uf: string }> }) {
  const { uf } = await params;
  if (!/^[a-z]{2}$/i.test(uf)) return Response.json({ message: "UF inválida." }, { status: 400 });
  return apiFetch(`/locations/states/${uf.toUpperCase()}/cities`);
}
