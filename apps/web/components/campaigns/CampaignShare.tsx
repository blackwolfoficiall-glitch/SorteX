"use client";

import { useEffect, useState } from "react";
import { Camera, Check, Copy, Globe2, MessageCircle, Send, Share2 } from "lucide-react";

export function isValidCampaignSlug(slug?: string | null) {
  return Boolean(slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug));
}

export function useCampaignPublicUrl(slug?: string | null) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!isValidCampaignSlug(slug)) {
      if (process.env.NODE_ENV === "development") console.error("Campanha publicada sem slug público válido.", { slug });
      setUrl("");
      return;
    }
    setUrl(`${window.location.origin}/campanha/${slug}`);
  }, [slug]);
  return url;
}

export async function copyPublicLink(url: string) {
  if (!url) throw new Error("Não foi possível gerar o link desta campanha.");
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(url);
    return;
  }
  const input = document.createElement("textarea");
  input.value = url;
  input.readOnly = true;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Selecione o endereço e copie manualmente.");
}

export default function CampaignShare({ title, slug, compact = false, label = "Compartilhar campanha" }: { title: string; slug: string; compact?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const url = useCampaignPublicUrl(slug);
  const text = `Confira a campanha ${cleanTitle(title)} na SorteX`;

  function feedback(value: string) {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 3000);
  }
  async function copy(instagram = false) {
    if (busy) return;
    setBusy(true);
    try {
      await copyPublicLink(url);
      feedback(instagram ? "Link copiado. Cole no Instagram ou envie pelo Direct." : "Link copiado com sucesso");
    } catch (cause) {
      feedback(cause instanceof Error ? cause.message : "Não foi possível copiar o link.");
    } finally {
      setBusy(false);
    }
  }
  async function nativeShare() {
    if (busy || !url) return;
    setBusy(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: cleanTitle(title), text, url });
      } else {
        await copyPublicLink(url);
        feedback("Link copiado com sucesso");
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      feedback("Não foi possível compartilhar a campanha.");
    } finally {
      setBusy(false);
    }
  }
  const channels = [
    ["WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`, <MessageCircle key="whatsapp" size={18}/>],
    ["Telegram", `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, <Send key="telegram" size={18}/>],
    ["Facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, <Globe2 key="facebook" size={18}/>],
  ] as const;
  return <div className="relative min-w-0">
    <button disabled={!url||busy} onClick={()=>setOpen(value=>!value)} className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${compact?"w-full border px-3 py-2 text-sm hover:bg-violet-50 sm:w-auto":"w-full bg-violet-700 px-5 py-3 text-white hover:bg-violet-800 sm:w-auto"}`}><Share2 size={17}/> {label}</button>
    {open&&<div className="absolute left-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border bg-white p-3 text-zinc-900 shadow-2xl sm:left-auto sm:right-0">
      <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Divulgar campanha</p>
      {channels.map(([channel,href,icon])=><a key={channel} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold hover:bg-violet-50">{icon} {channel}</a>)}
      <button disabled={busy} onClick={()=>void copy(true)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold hover:bg-violet-50"><Camera size={18}/> Instagram</button>
      <button disabled={busy} onClick={()=>void nativeShare()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold hover:bg-violet-50"><Share2 size={18}/> Compartilhamento nativo</button>
      <button disabled={busy} onClick={()=>void copy()} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold hover:bg-violet-50">{message.startsWith("Link copiado")?<Check className="text-green-600" size={18}/>:<Copy size={18}/>} Copiar link</button>
      {message&&<p role="status" className={`mt-2 rounded-xl p-3 text-sm font-bold ${message.startsWith("Não")?"bg-red-50 text-red-700":"bg-green-50 text-green-700"}`}>{message}</p>}
    </div>}
  </div>;
}

export function cleanTitle(title: string) { return title.replace(/\s*[—-]\s*Cópia\s*$/i, "").trim(); }
