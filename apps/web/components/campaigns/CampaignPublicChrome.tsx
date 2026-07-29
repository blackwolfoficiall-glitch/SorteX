"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, CircleDollarSign, Gift, Handshake, LockKeyhole, Menu, MessageCircle, RotateCw, Search, Share2, ShieldCheck, Target, Ticket, Trophy, X } from "lucide-react";
import type { Campaign } from "@/lib/campaigns/types";
import type { Purchase, PurchaseStatus } from "@/lib/purchases/types";

type SocialLink={id:string;type:string;label:string|null;url:string};
type InstantPrize={id:string;campaignId?:string;purchaseId:string;winningNumber:string;identifiedAt?:string;instantPrize:{description:string;value:number}};
type RouletteStatus={config?:{enabled?:boolean;name?:string};totalRounds?:number;availableRounds?:number};
const statusLabel:Record<PurchaseStatus,string>={PENDING:"Pendente",RESERVED:"Reservada",AWAITING_PAYMENT:"Aguardando pagamento",PAID:"Pago",EXPIRED:"Expirada",CANCELLED:"Cancelada",REFUNDED:"Reembolsada"};
const money=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function CampaignPublicHeader({campaign,onOpenTitles}:{campaign:Campaign;onOpenTitles:()=>void}){
  const [open,setOpen]=useState(false);
  const social=supportedSocial(campaign.organizer.socialLinks||[]);
  const logoPosition=organizerLogoPosition(campaign);
  const logoSize=organizerLogoSize(campaign);
  const hub=(view:string)=>`/o/${campaign.organizer.id}?view=${view}&returnTo=${encodeURIComponent(`/campanha/${campaign.slug}`)}`;
  const preserveCampaign=()=>storeCampaignPosition(campaign.slug);
  useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("keydown",close);const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.removeEventListener("keydown",close);document.body.style.overflow=previous}},[open]);
  const titleAction=()=>{setOpen(false);onOpenTitles()};
  return <>
    <header className="sticky top-0 z-[80] border-b bg-white/95 shadow-sm backdrop-blur" data-testid="public-campaign-header">
      <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-3 px-3 sm:px-6">
        <button type="button" onClick={()=>setOpen(true)} aria-label="Abrir menu" aria-expanded={open} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-zinc-700 transition hover:bg-zinc-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"><Menu/></button>
        <span className="text-lg font-black tracking-tight" aria-label="SorteX"><span className="text-zinc-950">Sorte</span><span className="text-violet-700">X</span></span>
        <button type="button" onClick={onOpenTitles} className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-violet-700 px-3 text-xs font-black text-white shadow transition hover:bg-violet-800 active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 sm:px-5 sm:text-sm"><Ticket size={18}/><span className="hidden min-[360px]:inline">Meus Títulos</span></button>
      </div>
      <div className="border-t bg-zinc-50/90 px-3 py-2.5 sm:px-6 sm:py-3" data-testid="organizer-card" data-logo-position={logoPosition} data-logo-size={logoSize}>
        <OrganizerIdentity key={`${campaign.organizer.logoUrl??"fallback"}-${logoPosition}`} organizer={campaign.organizer} position={logoPosition} size={logoSize}/>
      </div>
    </header>
    {open&&<div className="fixed inset-0 z-[100]" role="presentation"><button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/45" onClick={()=>setOpen(false)}/><aside role="dialog" aria-modal="true" aria-label="Menu da campanha" className="absolute inset-y-0 left-0 flex w-[min(88vw,390px)] flex-col overflow-y-auto bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b p-5"><div><p className="text-xl font-black">Menu</p><p className="mt-1 truncate text-xs text-zinc-500">{campaign.title}</p></div><button autoFocus type="button" onClick={()=>setOpen(false)} aria-label="Fechar menu" className="rounded-xl p-3 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"><X/></button></div>
      <nav className="flex-1 space-y-1 p-4" aria-label="Navegação pública">
        <MenuButton icon={<Ticket/>} label="Meus títulos" onClick={titleAction}/>
        <MenuLink icon={<Trophy/>} label="Ver ganhadores" href={hub("winners")} onClick={()=>{preserveCampaign();setOpen(false)}}/>
        <MenuLink icon={<Search/>} label="Auditoria" href={hub("audit")} onClick={()=>{preserveCampaign();setOpen(false)}}/>
        <MenuLink icon={<Target/>} label="Campanhas" href={hub("campaigns")} onClick={()=>{preserveCampaign();setOpen(false)}}/>
        <MenuLink icon={<Handshake/>} label="Afiliados" href={`/afiliado?organizerId=${campaign.organizer.id}&returnTo=${encodeURIComponent(`/campanha/${campaign.slug}`)}`} onClick={()=>setOpen(false)}/>
        <MenuLink icon={<MessageCircle/>} label="Contato" href={hub("contact")} onClick={()=>{preserveCampaign();setOpen(false)}}/>
      </nav>
      {social.length>0&&<div className="border-t p-5"><p className="text-xs font-black uppercase tracking-wide text-zinc-500">Redes sociais</p><div className="mt-3 flex flex-wrap gap-2">{social.map(link=><a key={link.id} href={link.url} target="_blank" rel="noreferrer" aria-label={socialName(link.type)} className="inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold hover:bg-zinc-50">{socialIcon(link.type)} {socialName(link.type)}</a>)}</div></div>}
    </aside></div>}
  </>;
}

export function CampaignBuyerTitlesPanel({campaign,open,onClose,onParticipate}:{campaign:Campaign;open:boolean;onClose:()=>void;onParticipate:()=>void}){
  const [loading,setLoading]=useState(false),[retrying,setRetrying]=useState(false),[authRequired,setAuthRequired]=useState(false),[error,setError]=useState(""),[purchases,setPurchases]=useState<Purchase[]>([]),[roulette,setRoulette]=useState<RouletteStatus|null>(null),[prizes,setPrizes]=useState<InstantPrize[]>([]),[shareMessage,setShareMessage]=useState("");
  const load=useCallback(async(background=false)=>{if(!background)setLoading(true);else setRetrying(true);setError("");try{const purchaseResponse=await fetch("/api/purchases/my",{credentials:"include",cache:"no-store"});if(purchaseResponse.status===401||purchaseResponse.status===403){setAuthRequired(true);setPurchases([]);return}if(!purchaseResponse.ok)throw new Error();const all=await purchaseResponse.json() as Purchase[];const current=all.filter(item=>item.campaignId===campaign.id);setPurchases(current);setAuthRequired(false);const [rouletteResponse,prizesResponse]=await Promise.all([fetch(`/api/draws/roulette/campaigns/${campaign.id}/status`,{credentials:"include",cache:"no-store"}),fetch("/api/draws/winners/my-instant-prizes",{credentials:"include",cache:"no-store"})]);setRoulette(rouletteResponse.ok?await rouletteResponse.json():null);if(prizesResponse.ok){const rows=await prizesResponse.json() as InstantPrize[];const purchaseIds=new Set(current.map(item=>item.id));setPrizes(rows.filter(item=>item.campaignId===campaign.id||purchaseIds.has(item.purchaseId)))}else setPrizes([])}catch{setError("Não foi possível carregar seus títulos. Tente novamente.")}finally{setLoading(false);setRetrying(false)}},[campaign.id]);
  useEffect(()=>{if(!open)return;const initial=window.setTimeout(()=>void load(),0);const timer=window.setInterval(()=>{if(!document.hidden)void load(true)},10000);const refresh=()=>void load(true);window.addEventListener("focus",refresh);window.addEventListener("sortex:purchase-updated",refresh);return()=>{window.clearTimeout(initial);window.clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("sortex:purchase-updated",refresh)}},[open,load]);
  useEffect(()=>{if(!open)return;const close=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()};document.addEventListener("keydown",close);const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.removeEventListener("keydown",close);document.body.style.overflow=previous}},[open,onClose]);
  const tickets=useMemo(()=>purchases.flatMap(item=>item.tickets),[purchases]);
  async function share(){const url=window.location.href;try{if(navigator.share)await navigator.share({title:campaign.title,url});else{await navigator.clipboard.writeText(url);setShareMessage("Link copiado.");window.setTimeout(()=>setShareMessage(""),2500)}}catch{/* cancelamento nativo não é erro */}}
  if(!open)return null;
  return <div className="fixed inset-0 z-[110]" role="presentation"><button type="button" aria-label="Fechar Meus Títulos" onClick={onClose} className="absolute inset-0 bg-black/50"/><section role="dialog" aria-modal="true" aria-labelledby="buyer-titles-title" className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[28px] bg-white shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-[min(94vw,860px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px]">
    <div className="flex items-center justify-between border-b p-5 sm:p-6"><div><p className="text-xs font-black uppercase tracking-wide text-violet-700">Área do comprador</p><h2 id="buyer-titles-title" className="mt-1 text-2xl font-black">Meus Títulos</h2></div><button autoFocus type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-3 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"><X/></button></div>
    <div className="overflow-y-auto p-5 sm:p-6" aria-live="polite">
      {loading?<TitlesSkeleton/>:authRequired?<EmptyPanel title="Entre para consultar seus títulos nesta campanha." action="Entrar" onAction={()=>{window.location.href=`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}}/>:error?<EmptyPanel title={error} action={retrying?"Carregando…":"Tentar novamente"} onAction={()=>void load()} disabled={retrying}/>:purchases.length===0?<EmptyPanel title="Você ainda não possui títulos nesta campanha." action="Participar agora" onAction={()=>{onClose();onParticipate()}}/>:<div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Summary icon={<Ticket/>} label="Quantidade de títulos" value={tickets.length.toLocaleString("pt-BR")}/><Summary icon={<RotateCw/>} label="Giros disponíveis" value={String(roulette?.availableRounds??0)}/><Summary icon={<Gift/>} label="Raspadinhas disponíveis" value="—" detail="Não disponível nesta campanha"/><Summary icon={<Gift/>} label="Prêmios instantâneos" value={String(prizes.length)}/></div>
        <div className="space-y-3">{purchases.map(purchase=><article key={purchase.id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black">Compra de {purchase.quantity.toLocaleString("pt-BR")} título{purchase.quantity===1?"":"s"}</p><p className="mt-1 text-xs text-zinc-500">{new Date(purchase.createdAt).toLocaleString("pt-BR")}</p></div><span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black">{statusLabel[purchase.status]}</span></div><div className="mt-3 flex items-center justify-between text-sm"><span className="text-zinc-500">Valor pago</span><strong>{money(purchase.total)}</strong></div><details className="mt-3"><summary className="cursor-pointer text-sm font-black text-violet-700">Ver números ({purchase.tickets.length})</summary><div className="mt-3 flex flex-wrap gap-2">{purchase.tickets.map(ticket=><span key={ticket.id||ticket.number} className="rounded-lg bg-violet-50 px-2 py-1 font-mono text-xs font-black text-violet-800">{ticket.number}</span>)}</div></details></article>)}</div>
        {prizes.length>0&&<div><h3 className="font-black">Histórico de prêmios instantâneos</h3><div className="mt-3 space-y-2">{prizes.map(prize=><div key={prize.id} className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 p-3 text-sm"><span><strong>{prize.instantPrize.description}</strong><span className="block font-mono text-xs text-zinc-600">Cota {prize.winningNumber}</span></span><strong>{money(Number(prize.instantPrize.value))}</strong></div>)}</div></div>}
        <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={()=>{onClose();onParticipate()}} className="min-h-12 rounded-xl bg-violet-700 px-4 font-black text-white hover:bg-violet-800 active:scale-[.99]">Comprar mais títulos</button><button type="button" onClick={()=>void share()} className="min-h-12 rounded-xl border px-4 font-black hover:bg-zinc-50 active:scale-[.99]"><Share2 className="mr-2 inline" size={18}/>Compartilhar campanha</button></div>{shareMessage&&<p className="text-center text-sm font-bold text-emerald-700">{shareMessage}</p>}
      </div>}
    </div>
  </section></div>;
}

export function CampaignPublicFooter({campaign,onOpenTitles}:{campaign:Campaign;onOpenTitles:()=>void}){const [openSection,setOpenSection]=useState<string|null>(null);const social=supportedSocial(campaign.organizer.socialLinks||[]),whatsapp=whatsappUrl(campaign),preserve=()=>storeCampaignPosition(campaign.slug),dark=campaign.organizer.brand?.themeMode==="DARK",hub=(view:string)=>`/o/${campaign.organizer.id}?view=${view}&returnTo=${encodeURIComponent(`/campanha/${campaign.slug}`)}`;const toggle=(value:string)=>setOpenSection(current=>current===value?null:value);return <footer className={`mt-6 border-t px-4 pb-28 pt-6 transition-colors md:pb-8 ${dark?"bg-zinc-950 text-zinc-300":"bg-zinc-50 text-zinc-700"}`}><div className={`mx-auto max-w-[900px] divide-y overflow-hidden rounded-2xl border ${dark?"divide-white/10 border-white/10 bg-white/[.03]":"divide-zinc-200 border-zinc-200 bg-white shadow-sm"}`}>
  <FooterAccordion dark={dark} title="Informações" open={openSection==="info"} onToggle={()=>toggle("info")}><button onClick={onOpenTitles}>Consultar pedidos</button><Link href={institutionalHref("/termos",campaign.slug)} onClick={preserve}>Termos de Uso</Link><Link href={institutionalHref("/privacidade",campaign.slug)} onClick={preserve}>Política de Privacidade</Link><Link href={`${institutionalHref("/privacidade",campaign.slug)}#exclusao-de-dados`} onClick={preserve}>Excluir dados</Link><Link href={hub("audit")} onClick={preserve}>Auditoria da campanha</Link></FooterAccordion>
  <FooterAccordion dark={dark} title="Formas de pagamento" open={openSection==="payment"} onToggle={()=>toggle("payment")}><span className="inline-flex items-center gap-2"><CircleDollarSign size={18}/> PIX</span></FooterAccordion>
  <FooterAccordion dark={dark} title="Redes sociais" open={openSection==="social"} onToggle={()=>toggle("social")}><div className="flex flex-wrap gap-2">{social.length?social.map(link=><a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2">{socialIcon(link.type)}{socialName(link.type)}</a>):<span>Nenhuma rede social configurada.</span>}</div></FooterAccordion>
  <FooterAccordion dark={dark} title="Contato" open={openSection==="contact"} onToggle={()=>toggle("contact")}><Link href={hub("contact")} onClick={preserve}>Ver contatos</Link>{whatsapp&&<a href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>}</FooterAccordion>
  </div>
  <div className="mx-auto mt-5 grid max-w-[900px] grid-cols-3 gap-2 rounded-2xl border border-current/10 p-3 text-[10px] font-medium sm:text-xs">
    <FooterTrust icon={<LockKeyhole/>} text="Compra protegida"/>
    <FooterTrust icon={<ShieldCheck/>} text="Auditoria realizada"/>
    <FooterTrust icon={<CheckCircle2/>} text={campaign.drawBasis==="LOTERIA_FEDERAL"?"Resultado pela Loteria Federal":"Regra registrada"}/>
  </div>
  <div className="mx-auto mt-5 flex max-w-[900px] flex-wrap items-center justify-between gap-3 text-xs"><button type="button" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} className="flex items-center gap-2 font-semibold hover:opacity-70"><ChevronRight className="-rotate-90" size={17}/>Voltar ao topo</button><span className="font-medium opacity-70">© SorteX 2026 — Todos os direitos reservados.</span></div></footer>}

function supportedSocial(links:SocialLink[]){return links.filter(link=>["INSTAGRAM","FACEBOOK","TIKTOK","YOUTUBE"].includes(link.type)&&Boolean(link.url))}
function whatsappUrl(campaign:Campaign){return campaign.organizer.socialLinks?.find(link=>link.type==="WHATSAPP")?.url||campaign.organizer.communities?.find(link=>link.type==="WHATSAPP")?.url||null}
function socialName(type:string){return({INSTAGRAM:"Instagram",FACEBOOK:"Facebook",TIKTOK:"TikTok",YOUTUBE:"YouTube"} as Record<string,string>)[type]||type}
function socialIcon(type:string){return <span aria-hidden className="inline-flex h-[18px] min-w-[18px] items-center justify-center text-xs font-black">{({INSTAGRAM:"◎",FACEBOOK:"f",TIKTOK:"♪",YOUTUBE:"▶"} as Record<string,string>)[type]||"•"}</span>}
function organizerInitial(name:string){return name.trim().charAt(0).toLocaleUpperCase("pt-BR")||"S"}
function organizerLogoSrc(url:string){if(/^https?:\/\//i.test(url))return url;const match=url.match(/^\/organizers\/([^/]+)\/brand-assets\/logo(.*)$/);if(match)return`/api/brand-assets/${match[1]}/logo${match[2]}`;const legacy=url.match(/^\/organizers\/([^/]+)\/logo(.*)$/);if(legacy)return`/api/organizer/logo/${legacy[1]}${legacy[2]}`;return url}
function OrganizerIdentity({organizer,position,size}:{organizer:Campaign["organizer"];position:"LEFT"|"CENTER"|"RIGHT";size:number}){
  const [logoStatus,setLogoStatus]=useState<"loading"|"loaded"|"error">(organizer.logoUrl?"loading":"error");
  const alignment=position==="CENTER"?"items-center text-center":position==="RIGHT"?"items-end text-right":"items-start text-left";
  const imageAlignment=position==="CENTER"?"self-center":position==="RIGHT"?"self-end":"self-start";
  const logoAvailable=Boolean(organizer.logoUrl)&&logoStatus!=="error";
  const scale=size/100;
  const logoDimensions={
    "--logo-mobile-width":`${Math.round(140*scale)}px`,
    "--logo-mobile-height":`${Math.round(64*scale)}px`,
    "--logo-desktop-width":`${Math.round(200*scale)}px`,
    "--logo-desktop-height":`${Math.round(80*scale)}px`,
  } as React.CSSProperties;
  return <div className={`mx-auto flex max-w-[1500px] flex-col ${alignment}`}>
    {logoAvailable?<div className="flex w-full max-w-full flex-col">
      <div style={logoDimensions} className={`relative flex h-[var(--logo-mobile-height)] w-[min(70vw,var(--logo-mobile-width))] max-w-full items-center sm:h-[var(--logo-desktop-height)] sm:w-[min(100%,var(--logo-desktop-width))] ${imageAlignment}`}>
        {logoStatus==="loading"&&<span className="absolute inset-0 animate-pulse rounded-xl bg-zinc-200" aria-label="Carregando logo do organizador"/>}
        <Image data-testid="organizer-logo" src={organizerLogoSrc(organizer.logoUrl!)} fill sizes="(max-width: 640px) 70vw, 360px" loading="eager" unoptimized alt={`Logo de ${organizer.name}`} onLoad={event=>setLogoStatus(event.currentTarget.naturalWidth>0?"loaded":"error")} onError={()=>{setLogoStatus("error");if(process.env.NODE_ENV==="development")console.warn("Logo cadastrada, mas não pôde ser carregada.",{url:organizer.logoUrl})}} className={`object-contain transition-opacity ${logoStatus==="loaded"?"opacity-100":"opacity-0"}`}/>
      </div>
    </div>:<div className="flex items-center gap-3" data-testid="organizer-fallback">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-white text-xl font-black text-violet-700 shadow-sm"><span aria-label={`Avatar de ${organizer.name}`}>{organizerInitial(organizer.name)}</span></div>
      <div className="min-w-0"><p data-testid="organizer-name" className="truncate text-sm font-black sm:text-base">{organizer.name}</p></div>
    </div>}
  </div>;
}
function organizerLogoPosition(campaign:Campaign){const value=campaign.organizer.brand?.appearanceConfig?.logoPosition;return value==="CENTER"||value==="RIGHT"?value:"LEFT"}
function organizerLogoSize(campaign:Campaign){const value=Number(campaign.organizer.brand?.appearanceConfig?.logoSize);return Number.isFinite(value)?Math.min(180,Math.max(60,Math.round(value/5)*5)):100}
function institutionalHref(path:string,slug:string){return `${path}?returnTo=${encodeURIComponent(`/campanha/${slug}`)}`}
function storeCampaignPosition(slug:string){sessionStorage.setItem(`sortex:campaign-scroll:${slug}`,String(window.scrollY))}
function MenuButton({icon,label,onClick}:{icon:React.ReactNode;label:string;onClick:()=>void}){return <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-bold hover:bg-violet-50 active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"><span className="text-violet-700 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>{label}<ChevronRight className="ml-auto" size={17}/></button>}
function MenuLink({icon,label,href,external,onClick}:{icon:React.ReactNode;label:string;href:string;external?:boolean;onClick:()=>void}){return <Link href={href} target={external?"_blank":undefined} rel={external?"noreferrer":undefined} onClick={onClick} className="flex min-h-12 items-center gap-3 rounded-xl px-3 font-bold hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"><span className="text-violet-700 [&_svg]:h-5 [&_svg]:w-5">{icon}</span>{label}<ChevronRight className="ml-auto" size={17}/></Link>}
function TitlesSkeleton(){return <div className="space-y-4" aria-label="Carregando seus títulos"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1,2,3,4].map(item=><div key={item} className="h-24 animate-pulse rounded-2xl bg-zinc-100"/>)}</div><div className="h-36 animate-pulse rounded-2xl bg-zinc-100"/></div>}
function EmptyPanel({title,action,onAction,disabled=false}:{title:string;action:string;onAction:()=>void;disabled?:boolean}){return <div className="py-10 text-center"><Ticket className="mx-auto text-violet-300" size={48}/><p className="mx-auto mt-4 max-w-md font-bold text-zinc-700">{title}</p><button type="button" disabled={disabled} onClick={onAction} className="mt-5 min-h-12 rounded-xl bg-violet-700 px-6 font-black text-white disabled:opacity-60">{action}</button></div>}
function Summary({icon,label,value,detail}:{icon:React.ReactNode;label:string;value:string;detail?:string}){return <div className="rounded-2xl bg-zinc-50 p-4"><span className="text-violet-700 [&_svg]:h-5 [&_svg]:w-5">{icon}</span><strong className="mt-3 block text-2xl">{value}</strong><span className="mt-1 block text-xs font-bold text-zinc-600">{label}</span>{detail&&<span className="mt-1 block text-[10px] text-zinc-500">{detail}</span>}</div>}
function FooterAccordion({title,open,onToggle,children,dark}:{title:string;open:boolean;onToggle:()=>void;children:React.ReactNode;dark:boolean}){return <section><button type="button" onClick={onToggle} aria-expanded={open} className={`flex min-h-14 w-full items-center justify-between px-4 text-left font-semibold tracking-[-0.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400 ${dark?"text-white":"text-zinc-900"}`}>{title}<ChevronRight className={`transition-transform duration-200 ${open?"rotate-90":""}`} size={18}/></button><div className={`grid transition-[grid-template-rows,opacity] duration-200 ${open?"grid-rows-[1fr] opacity-100":"grid-rows-[0fr] opacity-0"}`}><div className="overflow-hidden"><div className="flex flex-col items-start gap-3 px-4 pb-5 text-sm [&_a:hover]:opacity-70 [&_button:hover]:opacity-70">{children}</div></div></div></section>}
function FooterTrust({icon,text}:{icon:React.ReactNode;text:string}){return <div className="flex min-w-0 items-center justify-center gap-1.5 text-center"><span className="shrink-0 text-violet-600 [&_svg]:h-4 [&_svg]:w-4">{icon}</span><span>{text}</span></div>}
