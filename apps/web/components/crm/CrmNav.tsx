"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  CheckSquare,
  LayoutDashboard,
  Tags,
  TicketX,
  Users,
} from "lucide-react";

const items = [
  {
    label: "Visão geral",
    href: "/dashboard/crm?tab=overview",
    path: "/dashboard/crm",
    icon: LayoutDashboard,
  },
  {
    label: "Contatos",
    href: "/dashboard/crm/contatos",
    path: "/dashboard/crm/contatos",
    icon: Users,
  },
  {
    label: "Segmentos",
    href: "/dashboard/crm/segmentos",
    path: "/dashboard/crm/segmentos",
    icon: Tags,
  },
  {
    label: "Automações",
    href: "/dashboard/crm/automacoes",
    path: "/dashboard/crm/automacoes",
    icon: Bot,
  },
  {
    label: "Reservas abandonadas",
    href: "/dashboard/crm/reservas-abandonadas",
    path: "/dashboard/crm/reservas-abandonadas",
    icon: TicketX,
  },
  {
    label: "Tarefas",
    href: "/dashboard/crm/tarefas",
    path: "/dashboard/crm/tarefas",
    icon: CheckSquare,
  },
] as const;

export default function CrmNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal do CRM"
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl border bg-white p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => {
        const active =
          item.path === "/dashboard/crm"
            ? pathname === item.path
            : pathname.startsWith(item.path);
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 snap-center items-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm font-black outline-none transition focus-visible:ring-4 focus-visible:ring-violet-200 ${active ? "border-violet-700 bg-violet-700 text-white shadow-sm" : "border-transparent bg-zinc-50 text-violet-700 hover:bg-violet-50"}`}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
