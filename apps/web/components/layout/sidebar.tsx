"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  Users,
  Megaphone,
  Zap,
  BarChart3,
  DollarSign,
  Gift,
  Settings,
  CircleHelp,
  LogOut,
  Crown,
} from "lucide-react";

const menu = [
  {
    title: "Principal",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        href: "/dashboard",
      },
      {
        icon: Ticket,
        label: "Minhas Rifas",
        href: "/rifas",
      },
      {
        icon: PlusCircle,
        label: "Criar Rifa",
        href: "/criar",
      },
      {
        icon: Users,
        label: "Participações",
        href: "/participacoes",
      },
    ],
  },
  {
    title: "Marketing",
    items: [
      {
        icon: Users,
        label: "CRM Clientes",
        href: "/crm",
      },
      {
        icon: Megaphone,
        label: "Comunicações",
        href: "/comunicacoes",
      },
      {
        icon: Zap,
        label: "Modo Turbo",
        href: "/turbo",
      },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      {
        icon: BarChart3,
        label: "Relatórios",
        href: "/relatorios",
      },
      {
        icon: DollarSign,
        label: "Financeiro",
        href: "/financeiro",
      },
      {
        icon: Gift,
        label: "Afiliados",
        href: "/afiliados",
      },
      {
        icon: Settings,
        label: "Configurações",
        href: "/configuracoes",
      },
      {
        icon: CircleHelp,
        label: "Central de Ajuda",
        href: "/ajuda",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-72 bg-[#070707] border-r border-zinc-800 text-white flex flex-col">
      <div className="p-8">
        <h1 className="text-5xl font-black">
          Sorte
          <span className="text-violet-500">X</span>
        </h1>
      </div>

      <div className="px-5">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://i.pravatar.cc/120"
            alt="Avatar do organizador Carlos Silva"
            className="w-20 h-20 rounded-full border-2 border-violet-500"
          />

          <h2 className="mt-4 text-xl font-bold">
            Carlos Silva
          </h2>

          <p className="text-zinc-400">
            Organizador
          </p>

          <span className="inline-flex mt-3 px-3 py-1 rounded-full bg-violet-600 text-xs">
            PRO
          </span>

          <div className="mt-6 border-t border-zinc-700 pt-4">
            <p className="text-zinc-400 text-sm">
              Saldo disponível
            </p>

            <h3 className="text-2xl font-bold text-violet-400">
              R$ 2.458,90
            </h3>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto mt-8 px-4">
        {menu.map((group) => (
          <div key={group.title} className="mb-8">
            <p className="text-xs uppercase tracking-wider text-zinc-500 px-4 mb-3">
              {group.title}
            </p>

            {group.items.map((item) => {
              const Icon = item.icon;

              const active =
                pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl mb-2 transition ${
                    active
                      ? "bg-violet-600"
                      : "hover:bg-zinc-800"
                  }`}
                >
                  <Icon size={20} />

                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-5">
        <div className="rounded-2xl bg-gradient-to-br from-violet-700 to-violet-900 p-5">
          <Crown className="mb-3" />

          <h3 className="font-bold text-lg">
            Plano Professional
          </h3>

          <p className="text-sm text-violet-100 mt-2">
            Tenha mais recursos e aumente suas vendas.
          </p>

          <button className="mt-5 w-full bg-white text-violet-700 rounded-xl py-3 font-semibold">
            Ver meu plano
          </button>
        </div>

        <button className="mt-6 flex items-center gap-3 text-red-400">
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  );
}
