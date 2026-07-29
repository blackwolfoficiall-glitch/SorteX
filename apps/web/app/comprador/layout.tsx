"use client";

import Link from "next/link";
import { Home, Search, Ticket, CirclePlus, User } from "lucide-react";
import { RoleGate } from "@/components/auth/RoleGate";
import LegalAcceptanceGate from "@/components/legal/LegalAcceptanceGate";

const buyerRoles = ["BUYER", "ADMIN"] as const;

export default function CompradorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGate allowed={[...buyerRoles]}>
      <main className="min-h-screen bg-zinc-100 pb-24">

      {children}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur">

        <div className="mx-auto flex max-w-md justify-around py-3">

          <Link href="/comprador" className="flex flex-col items-center text-violet-700">
            <Home size={22} />
            <span className="text-xs">Início</span>
          </Link>

          <Link href="/comprador/sorteios" className="flex flex-col items-center text-zinc-500">
            <Search size={22} />
            <span className="text-xs">Sorteios</span>
          </Link>

          <Link href="/comprador/participar" className="-mt-8 flex h-16 w-16 flex-col items-center justify-center rounded-full bg-violet-700 text-white shadow-xl ring-4 ring-zinc-100">
            <CirclePlus size={26} />
            <span className="text-[10px]">Participar</span>
          </Link>

          <Link href="/comprador/meus-numeros" className="flex flex-col items-center text-zinc-500">
            <Ticket size={22} />
            <span className="text-xs">Meus títulos</span>
          </Link>

          <Link href="/comprador/perfil" className="flex flex-col items-center text-zinc-500">
            <User size={22} />
            <span className="text-xs">Perfil</span>
          </Link>

        </div>

      </nav>

      </main>
      <LegalAcceptanceGate />
    </RoleGate>
  );
}
