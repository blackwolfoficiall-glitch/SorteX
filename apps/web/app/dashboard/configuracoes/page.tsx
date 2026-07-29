import Link from "next/link";
import { Crown, Globe2, Palette, Scale, Share2 } from "lucide-react";
const sections = [
  [Crown,"Meu plano","Plano atual, limites, consumo, upgrade e cancelamento.","/dashboard/configuracoes/plano"],
  [Scale,"Central Jurídica","Documentos legais, aceites e solicitações relacionadas aos seus dados.","/dashboard/configuracoes/juridico"],
  [Palette,"Personalização","Identidade, aparência, layout, elementos e templates.","/dashboard/personalizacao"],
  [Globe2,"Domínio próprio","DNS, verificação, HTTPS e status do domínio.","/dashboard/personalizacao/dominio"],
  [Share2,"Redes sociais e comunidades","Links públicos, grupos, canais e ordem de exibição.","/dashboard/personalizacao/redes-sociais"],
] as const;
export default function ConfiguracoesPage(){return <div className="mx-auto max-w-6xl"><p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">Conta e plataforma</p><h1 className="mt-2 text-3xl font-black">Configurações</h1><p className="mt-2 text-zinc-500">Gerencie seu plano e a presença da sua marca na SorteX.</p><div className="mt-7 grid gap-5 md:grid-cols-2">{sections.map(([Icon,title,description,href])=><Link key={href} href={href} className="group rounded-3xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-violet-300 hover:shadow-lg"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Icon/></span><h2 className="mt-5 text-xl font-black">{title}</h2><p className="mt-2 text-sm text-zinc-500">{description}</p><span className="mt-5 inline-block text-sm font-bold text-violet-700">Abrir configuração →</span></Link>)}</div></div>}
