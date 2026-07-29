"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getCurrentUser } from "@/lib/auth/client";
import type { UserRole } from "@/lib/auth/types";

export function accountPathForRole(role: UserRole) {
  if (role === "BUYER") return "/comprador";
  if (role === "ADMIN") return "/admin";
  return "/dashboard";
}

export default function Header() {
  const router = useRouter();

  useEffect(() => {
    getCurrentUser()
      .then((user) => router.replace(accountPathForRole(user.role)))
      .catch(() => undefined);
  }, [router]);

  return (
    <header className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-5">
      <Link href="/" aria-label="Página inicial da SorteX" className="min-w-0">
        <p className="text-2xl font-black sm:text-3xl md:text-4xl">Sorte<span className="text-violet-600">X</span></p>
        <p className="mt-1 hidden text-sm text-zinc-500 sm:block">Encontre sua próxima sorte.</p>
      </Link>
      <nav className="flex shrink-0 items-center gap-1.5 sm:gap-3" aria-label="Acesso à conta">
        <Link href="/login" className="rounded-xl px-3 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-50 sm:rounded-2xl sm:px-5 sm:py-3">Entrar</Link>
        <Link href="/cadastro" className="rounded-xl bg-violet-700 px-3 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-violet-800 sm:rounded-2xl sm:px-5 sm:py-3">Criar conta</Link>
      </nav>
    </header>
  );
}
