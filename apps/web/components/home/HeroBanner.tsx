import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function HeroBanner() {
  return (
    <section className="px-5 pb-16 pt-8 md:pb-24 md:pt-14">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[40px] bg-gradient-to-br from-violet-700 via-purple-800 to-zinc-950 px-6 py-16 text-white md:px-14 md:py-24">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-4xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold"><ShieldCheck size={18} /> Plataforma SorteX</p>
          <h1 className="mt-7 text-4xl font-black leading-tight sm:text-5xl md:text-7xl">Sorteios online com segurança, transparência e credibilidade.</h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-violet-100 md:text-xl">Participe de campanhas de organizadores verificados, acompanhe seus títulos e confira resultados com regras transparentes baseadas na Loteria Federal quando essa modalidade estiver definida na campanha.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Link href="/cadastro" className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-4 font-black text-violet-700">Criar minha conta <ArrowRight size={18} /></Link><Link href="/login" className="rounded-2xl border border-white/30 px-6 py-4 font-black hover:bg-white/10">Entrar</Link></div>
        </div>
      </div>
    </section>
  );
}
