"use client";

import Link from "next/link";
import { Bell, UserCircle } from "lucide-react";

export default function Header() {
  return (
    <header className="mb-6 flex items-center justify-between">

      <div>
        <p className="text-sm text-zinc-500">
          👋 Bom dia,
        </p>

        <h1 className="text-3xl font-black">
          Felipe
        </h1>

        <p className="text-sm text-violet-600">
          Bem-vindo à SorteX
        </p>
      </div>

      <div className="flex items-center gap-3">

        <button className="rounded-2xl bg-white p-3 shadow">
          <Bell size={22} />
        </button>

        <Link
          href="/comprador/perfil"
          className="rounded-2xl bg-white p-3 shadow"
        >
          <UserCircle size={24} />
        </Link>

      </div>

    </header>
  );
}