import type { Metadata } from "next";
import ProductHome from "@/components/marketing/ProductHome";
export const metadata: Metadata = {
  title: "SorteX — Sua campanha, em outro nível",
  description:
    "Conheça a SorteX: criação e gestão de campanhas, acompanhamento de participantes, vendas e resultados em uma plataforma para organizadores e compradores.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "SorteX — Sua campanha, em outro nível",
    description:
      "Do primeiro cadastro ao acompanhamento da campanha. Conheça a plataforma SorteX.",
    images: ["/sortex-og.png"],
  },
};
export default function Home() {
  return <ProductHome />;
}
