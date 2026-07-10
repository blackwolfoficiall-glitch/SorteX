"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Ticket,
  Wallet,
  Users,
  Bot,
  Megaphone,
  Share2,
  Gift,
  MessageCircle,
  BarChart3,
  Brain,
  Trophy,
  Plug,
  Settings,
} from "lucide-react";

const menu = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Ticket, label: "Campanhas", href: "/dashboard/campanhas" },
  { icon: Wallet, label: "Financeiro", href: "/dashboard/financeiro" },
  { icon: Users, label: "CRM Inteligente", href: "/dashboard/crm" },
  { icon: Bot, label: "IA SorteX", href: "/dashboard/ia" },
  { icon: Megaphone, label: "SorteX Ads", href: "/dashboard/ads" },
  { icon: Share2, label: "Afiliados", href: "/dashboard/afiliados" },
  { icon: Gift, label: "Promoções", href: "/dashboard/promocoes" },
  { icon: MessageCircle, label: "Comunicação", href: "/dashboard/comunicacao" },
  { icon: BarChart3, label: "Relatórios", href: "/dashboard/relatorios" },
  { icon: Brain, label: "Inteligência", href: "/dashboard/inteligencia" },
  { icon: Trophy, label: "Ranking", href: "/dashboard/ranking" },
  { icon: Plug, label: "Integrações", href: "/dashboard/integracoes" },
  { icon: Settings, label: "Configurações", href: "/dashboard/configuracoes" },
];

export default function Sidebar() {
  return (
    <aside className="w-72 bg-white border-r min-h-screen flex flex-col">

      <div className="p-8">

        <h1 className="text-4xl font-black">
          Sorte
          <span className="text-violet-600">X</span>
        </h1>

      </div>

      <nav className="flex-1 px-4 space-y-2">

        {menu.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-4 rounded-2xl px-4 py-4 transition hover:bg-violet-50 hover:text-violet-700"
          >
            <item.icon size={22} />
            <span className="font-medium">
              {item.label}
            </span>
          </Link>
        ))}

      </nav>

      <div className="border-t p-6">

        <div className="rounded-2xl bg-gradient-to-r from-violet-700 to-purple-600 p-5 text-white">

          <p className="text-sm opacity-80">
            Plano
          </p>

          <h2 className="mt-1 text-xl font-bold">
            Profissional
          </h2>

          <button className="mt-4 w-full rounded-xl bg-white py-3 text-violet-700 font-bold">
            Gerenciar Plano
          </button>

        </div>

      </div>

    </aside>
  );
}