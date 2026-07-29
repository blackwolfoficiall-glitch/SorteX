import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ uf: string }> }) {
  const uf = (await params).uf.toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) return NextResponse.json({ message: "Estado inválido." }, { status: 400 });
  try {
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error();
    const cities = (await response.json()) as Array<{ id: number; nome: string }>;
    return NextResponse.json(cities.map(({ id, nome }) => ({ id: String(id), name: nome })), { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch {
    return NextResponse.json({ message: "Não foi possível carregar as cidades agora." }, { status: 503 });
  }
}
