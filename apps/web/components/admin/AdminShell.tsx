"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Building2,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  FileClock,
  Image,
  Gauge,
  Landmark,
  Megaphone,
  Menu,
  Scale,
  Settings,
  ShieldCheck,
  HeartPulse,
  TicketCheck,
  Users,
  UserRoundSearch,
  WalletCards,
  X,
} from "lucide-react";
import { useState } from "react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import {
  hasAdminPermission,
  requiredPermissionForAdminPath,
} from "@/lib/admin/authorization";

const links = [
  ["Dashboard", "/admin/dashboard", Gauge],
  ["Aprovações", "/admin/aprovacoes", ClipboardCheck],
  ["Organizadores", "/admin/organizadores", Building2],
  ["Campanhas", "/admin/campanhas", TicketCheck],
  ["Planos", "/admin/planos", WalletCards],
  ["Taxas", "/admin/taxas", BadgeDollarSign],
  ["Financeiro", "/admin/financeiro", CircleDollarSign],
  ["Gateways", "/admin/gateways", Landmark],
  ["Equipe", "/admin/equipe", Users],
  ["Auditoria", "/admin/auditoria", FileClock],
  ["Saúde", "/admin/saude", HeartPulse],
  ["Conteúdo", "/admin/conteudo", FileText],
  ["Configurações", "/admin/configuracoes", Settings],
  ["Central Jurídica", "/admin/juridico", Scale],
  ["Afiliados", "/admin/afiliados", UserRoundSearch],
  ["CRM", "/admin/crm", Megaphone],
  ["Mídia", "/admin/midia", Image],
] as const;

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const user = useAuthorizedUser();
  const [open, setOpen] = useState(false);
  const visibleLinks = links.filter(([, href]) =>
    user
      ? hasAdminPermission(user, requiredPermissionForAdminPath(href))
      : false,
  );
  return (
    <div className="min-h-screen bg-slate-50">
      <button
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-xl bg-slate-950 p-3 text-white lg:hidden"
      >
        <Menu />
      </button>
      {open && (
        <button
          aria-label="Fechar menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto bg-[#090b12] p-5 text-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <Link href="/admin/dashboard" className="text-3xl font-black">
            Sorte<span className="text-violet-500">X</span>
          </Link>
          <button
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="lg:hidden"
          >
            <X />
          </button>
        </div>
        <div className="mt-6 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-600">
              <ShieldCheck size={21} />
            </span>
            <div>
              <p className="font-black">Painel Administrativo</p>
              <p className="text-xs text-violet-200">Equipe SorteX</p>
            </div>
          </div>
        </div>
        <nav className="mt-6 space-y-1">
          {visibleLinks.map(([label, href, Icon]) => {
            const active =
              pathname === href ||
              (href !== "/admin/dashboard" && pathname.startsWith(`${href}/`));
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${active ? "bg-violet-600 font-bold" : "text-slate-300 hover:bg-white/10"}`}
              >
                <Icon size={19} />
                <span>{label}</span>
                {active && <ChevronRight className="ml-auto" size={16} />}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-72">{children}</div>
    </div>
  );
}
