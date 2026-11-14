import type { Metadata } from "next";
import ProductHome from "@/components/marketing/ProductHome";
import "./sortex-organizer-home.css";
export const metadata: Metadata = {
  title: "SorteX — Sua campanha, em outro nível",
  description:
    "Gestão para organizadores: campanhas, vendas, clientes, CRM, IA SorteX e acompanhamento da apuração em uma plataforma conectada.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "SorteX — Sua campanha, em outro nível",
    description:
      "Campanhas, vendas e relacionamento com clientes. Conheça a gestão para organizadores da SorteX.",
    images: ["/sortex-og.png"],
  },
};
export default function Home() {
  return <ProductHome />;
}
