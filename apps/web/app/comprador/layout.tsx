"use client";

import Link from "next/link";
import { Home, Search, Ticket, Heart, User } from "lucide-react";

export default function CompradorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-zinc-100 pb-24">

      {children}

      <nav className="fixed bottom-0 left-0 right-0 border-t bg-white shadow-lg">

        <div className="mx-auto flex max-w-md justify-around py-3">

          <Link href="/comprador" className="flex flex-col items-center text-violet-700">
            <Home size={22} />
            <span className="text-xs">Início</span>
          </Link>

          <Link href="/" className="flex flex-col items-center text-zinc-500">
            <Search size={22} />
            <span className="text-xs">Explorar</span>
          </Link>

          <Link href="/comprador/meus-numeros" className="flex flex-col items-center text-zinc-500">
            <Ticket size={22} />
            <span className="text-xs">Números</span>
          </Link>

          <Link href="/comprador/favoritos" className="flex flex-col items-center text-zinc-500">
            <Heart size={22} />
            <span className="text-xs">Favoritos</span>
          </Link>

          <Link href="/comprador/perfil" className="flex flex-col items-center text-zinc-500">
            <User size={22} />
            <span className="text-xs">Perfil</span>
          </Link>

        </div>

      </nav>

    </main>
  );
}