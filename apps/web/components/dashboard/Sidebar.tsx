"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bot, Boxes, ClipboardList, Gift, LayoutDashboard, Megaphone, Menu, MessageCircle, Palette, Plug, Settings, Share2, Ticket, Trophy, UserRound, Users, Wallet, X } from "lucide-react";
import { authRequest, getCurrentUser } from "@/lib/auth/client";
import type { AuthUser } from "@/lib/auth/types";
import { getPersonalization } from "@/lib/organizer-platform/client";

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profileImage, setProfileImage] = useState(false);
  const [publicName, setPublicName] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const closeControl = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => undefined);
    getPersonalization().then(({ brand }) => {
      setProfileImage(Boolean(brand.profileImageUrl));
      setPublicName(brand.publicName);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (open) closeControl.current?.focus();
  }, [open]);

  function closeMenu(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }

  const organizerName = publicName || user?.name || "Organizador";

  return (
    <>
      <button
        ref={trigger}
        aria-label="Abrir menu do organizador"
        aria-controls="organizer-sidebar"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-xl bg-zinc-950 p-3 text-white shadow-lg lg:hidden"
      >
        <Menu aria-hidden="true" />
      </button>
      {open && (
        <div
          aria-hidden="true"
          onClick={() => closeMenu(true)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}
      <aside
        id="organizer-sidebar"
        aria-label="Painel do organizador"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            closeMenu(true);
          }
        }}
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100%_-_2rem)] flex-col overflow-y-auto overscroll-contain border-r border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom)] text-white motion-safe:transition-transform lg:visible lg:translate-x-0 ${open ? "visible translate-x-0" : "invisible -translate-x-full"}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <Link href="/dashboard" onClick={() => closeMenu()} className="text-3xl font-black">
            Sorte<span className="text-violet-500">X</span>
          </Link>
          <button
            ref={closeControl}
            aria-label="Fechar menu"
            onClick={() => closeMenu(true)}
            className="shrink-0 rounded-lg p-2.5 text-zinc-400 lg:hidden"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <Link
          href="/perfil"
          onClick={() => closeMenu()}
          className="mx-3 flex shrink-0 items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-3 transition hover:border-violet-500 hover:bg-zinc-800 sm:mx-4 sm:p-4"
        >
          {profileImage && user ? (
            <Image src={`/api/brand-assets/${user.id}/profile`} width={48} height={48} unoptimized alt="Foto do organizador" className="h-12 w-12 shrink-0 rounded-full border border-zinc-700 bg-white object-cover" />
          ) : (
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-600 text-lg font-black">
              {organizerName.trim().charAt(0).toUpperCase() || "O"}
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-xs text-zinc-400">Bem-vindo,</span>
            <span className="mt-0.5 block font-bold [overflow-wrap:anywhere]">{organizerName}</span>
            {user?.verified && <span className="mt-1 block text-[10px] font-bold text-green-400">Organizador Verificado</span>}
          </span>
        </Link>
        {onboarding ? (
          <div className="mx-4 mt-4 rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4">
            <p className="font-bold">Configuração inicial</p>
            <p className="mt-2 text-sm text-zinc-400">Salve as configurações ou pule por agora para liberar a navegação do painel.</p>
            <button onClick={async () => {
              await authRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              router.replace("/login");
            }} className="mt-5 w-full rounded-xl border border-zinc-700 px-4 py-3 text-sm font-bold">Sair da conta</button>
          </div>
        ) : (
          <nav aria-label="Menu do organizador" className="space-y-1 px-3 py-4">
            {menu.map(([Icon, label, href]) => {
              const active = isActiveRoute(pathname, href);
              return (
                <Link
                  key={label}
                  href={href}
                  onClick={() => closeMenu()}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition sm:px-4 ${active ? "bg-violet-600 text-white" : "text-zinc-300 hover:bg-zinc-800 hover:text-white"}`}
                >
                  <Icon size={19} aria-hidden="true" className="shrink-0" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </aside>
    </>
  );
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard/campanhas" && pathname.startsWith("/dashboard/campanhas/ganhadores")) return false;
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
