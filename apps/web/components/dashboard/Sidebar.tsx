"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, Boxes, ClipboardList, Gift, LayoutDashboard, Megaphone, Menu, MessageCircle, Palette, Plug, Settings, Share2, Ticket, Trophy, UserRound, Users, Wallet, X } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/client";
import type { AuthUser } from "@/lib/auth/types";
import { getPersonalization } from "@/lib/organizer-platform/client";
import { authRequest } from "@/lib/auth/client";

const menu = [
  [LayoutDashboard, "Dashboard", "/dashboard"],
  [Ticket, "Campanhas", "/dashboard/campanhas"],
  [Trophy, "Ganhadores", "/dashboard/campanhas/ganhadores"],
  [ClipboardList, "Pedidos", "/dashboard/pedidos"],
  [Boxes, "Mini Campanhas", "/dashboard/mini-campanhas"],
  [Wallet, "Financeiro", "/dashboard/financeiro"],
  [Users, "CRM Intelligence", "/dashboard/crm"],
  [Bot, "IA SorteX", "/dashboard/ia"],
  [Megaphone, "SorteX Ads", "/dashboard/ads"],
  [Share2, "Afiliados", "/dashboard/afiliados"],
  [Gift, "Promoções", "/dashboard/promocoes"],
  [Trophy, "Cotas premiadas", "/dashboard/ganhadores"],
  [MessageCircle, "Comunicação", "/dashboard/comunicacao"],
  [Palette, "Personalização", "/dashboard/personalizacao"],
  [Plug, "Integrações", "/dashboard/integracoes"],
  [Settings, "Configurações", "/dashboard/configuracoes"],
  [UserRound, "Perfil", "/perfil"],
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const onboarding = pathname === "/dashboard/personalizacao" && searchParams.get("onboarding") === "1";
  const [open, setOpen] = useState(false);
  const [user,setUser]=useState<AuthUser|null>(null);
  const [profileImage,setProfileImage]=useState(false);const[publicName,setPublicName]=useState("");
  useEffect(()=>{getCurrentUser().then(setUser).catch(()=>undefined);getPersonalization().then(data=>{setProfileImage(Boolean(data.brand.profileImageUrl));setPublicName(data.brand.publicName)}).catch(()=>undefined)},[]);
  return <>
    <button aria-label="Abrir menu do organizador" onClick={()=>setOpen(true)} className="fixed left-4 top-4 z-40 rounded-xl bg-zinc-950 p-3 text-white shadow-lg lg:hidden"><Menu/></button>
    {open&&<button aria-label="Fechar menu" onClick={()=>setOpen(false)} className="fixed inset-0 z-40 bg-black/50 lg:hidden"/>}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-zinc-800 bg-zinc-950 text-white transition-transform lg:translate-x-0 ${open?"translate-x-0":"-translate-x-full"}`}>
      <div className="flex items-center justify-between px-6 py-6"><Link href="/dashboard" onClick={()=>setOpen(false)} className="text-3xl font-black">Sorte<span className="text-violet-500">X</span></Link><button aria-label="Fechar menu" onClick={()=>setOpen(false)} className="rounded-lg p-2 text-zinc-400 lg:hidden"><X/></button></div>
      <Link href="/perfil" onClick={()=>setOpen(false)} className="mx-4 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-violet-500 hover:bg-zinc-800">{profileImage&&user?<Image src={`/api/brand-assets/${user.id}/profile`} width={48} height={48} unoptimized alt="Foto do organizador" className="h-12 w-12 shrink-0 rounded-full border border-zinc-700 bg-white object-cover"/>:<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-600 text-lg font-black">{(publicName||user?.name||"O").trim().charAt(0).toUpperCase()}</span>}<span className="min-w-0"><span className="block text-xs text-zinc-400">Bem-vindo,</span><span className="mt-0.5 block truncate font-bold">{publicName||user?.name||"Organizador"}</span>{user?.verified&&<span className="mt-1 block text-[10px] font-bold text-green-400">Organizador Verificado</span>}</span></Link>
      {onboarding ? <div className="mx-4 mt-5 flex-1 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4"><p className="font-bold">Configuração inicial</p><p className="mt-2 text-sm text-zinc-400">Salve as configurações ou pule por agora para liberar a navegação do painel.</p><button onClick={async()=>{await authRequest('/api/auth/logout',{method:'POST'}).catch(()=>undefined);router.replace('/login')}} className="mt-5 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold">Sair da conta</button></div> : <nav className="mt-5 flex-1 overflow-y-auto px-3 pb-5">{menu.map(([Icon,label,href])=>{const active=isActiveRoute(pathname,href);return <Link key={label} href={href} onClick={()=>setOpen(false)} aria-current={active?"page":undefined} className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${active?"bg-violet-600 text-white":"text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}><Icon size={19}/>{label}</Link>})}</nav>}
      <div className="border-t border-zinc-800 p-4 text-xs text-zinc-500">Menu fixo no desktop · recolhível no mobile</div>
    </aside>
  </>;
}

function isActiveRoute(pathname:string,href:string){if(href==="/dashboard/campanhas"&&pathname.startsWith("/dashboard/campanhas/ganhadores"))return false;return href==="/dashboard"?pathname===href:pathname===href||pathname.startsWith(`${href}/`)}
