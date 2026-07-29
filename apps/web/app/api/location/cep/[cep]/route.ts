import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ cep: string }> }) {
  const cep = (await params).cep.replace(/\D/g, "");
  if (cep.length !== 8) return NextResponse.json({ message: "CEP incompleto." }, { status: 400 });
  try {
    const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (response.status === 404) return NextResponse.json({ message: "CEP não encontrado." }, { status: 404 });
    if (!response.ok) throw new Error();
    const data = (await response.json()) as { street?: string; neighborhood?: string; city?: string; state?: string; city_ibge_code?: string };
    let municipalityCode = data.city_ibge_code || "";
    if (!municipalityCode && data.state && data.city) {
      const citiesResponse = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${data.state}/municipios`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) });
      if (citiesResponse.ok) {
        const cities = (await citiesResponse.json()) as Array<{ id: number; nome: string }>;
        const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
        municipalityCode = String(cities.find((city) => normalize(city.nome) === normalize(data.city || ""))?.id || "");
      }
    }
    return NextResponse.json({ address: data.street || "", neighborhood: data.neighborhood || "", city: data.city || "", state: data.state || "", municipalityCode });
  } catch {
    return NextResponse.json({ message: "Não foi possível consultar o CEP agora. Você pode preencher o endereço manualmente." }, { status: 503 });
  }
}
