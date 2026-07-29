"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyPublicLink, useCampaignPublicUrl } from "./CampaignShare";

export default function CampaignPublicLink({slug,compact=false,editHref="./"}:{slug:string;compact?:boolean;editHref?:string}) {
  const url=useCampaignPublicUrl(slug);const input=useRef<HTMLInputElement>(null);const [message,setMessage]=useState("");const [busy,setBusy]=useState(false);
  async function copy(){if(busy)return;setBusy(true);try{await copyPublicLink(url);setMessage("Link copiado com sucesso")}catch(cause){setMessage(cause instanceof Error?cause.message:"Não foi possível copiar o link.");input.current?.focus();input.current?.select()}finally{setBusy(false);window.setTimeout(()=>setMessage(""),3000)}}
  if(!url)return <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><p className="font-bold">Não foi possível gerar o link desta campanha.</p><a href={editHref} className="mt-1 inline-block underline">Editar campanha</a></div>;
  return <div className="min-w-0"><div className={`flex min-w-0 gap-2 ${compact?"flex-col sm:flex-row":"flex-col sm:flex-row"}`}><input ref={input} aria-label="Link público da campanha" readOnly value={url} onFocus={event=>event.currentTarget.select()} className="h-11 min-w-0 flex-1 rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 outline-none focus:border-violet-500"/><button disabled={busy} onClick={()=>void copy()} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold hover:bg-zinc-50 disabled:opacity-50">{message==="Link copiado com sucesso"?<Check className="text-green-600" size={17}/>:<Copy size={17}/>} Copiar link</button></div>{message&&<p role="status" className={`mt-2 text-xs font-bold ${message.startsWith("Link copiado")?"text-green-700":"text-red-700"}`}>{message}</p>}</div>;
}
