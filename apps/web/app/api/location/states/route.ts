import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome", { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error();
    const states = (await response.json()) as Array<{ id: number; sigla: string; nome: string }>;
    return NextResponse.json(states.map(({ id, sigla, nome }) => ({ id, code: sigla, name: nome })), { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch {
    return NextResponse.json({ message: "Não foi possível carregar os estados agora." }, { status: 503 });
  }
}
