import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export function AuthShell({
  title,
  description,
  children,
  backHref = "/escolha",
  backLabel = "Voltar",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-violet-50 via-white to-white px-5 py-8">
      <div className="mx-auto w-full max-w-md">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700"
        >
          <ArrowLeft size={18} />
          {backLabel}
        </Link>

        <div className="mt-6 text-center">
          <Link href="/" className="text-5xl font-black tracking-tight">
            Sorte<span className="text-violet-600">X</span>
          </Link>
          <h1 className="mt-7 text-3xl font-black text-zinc-950">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-500">{description}</p>
        </div>

        <section className="mt-8 rounded-[32px] border border-violet-100 bg-white p-6 shadow-xl shadow-violet-100/50">
          {children}
        </section>

        <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-zinc-500">
          <ShieldCheck size={16} className="text-green-600" />
          Seus dados e sua sessão são protegidos pela SorteX.
        </p>
      </div>
    </main>
  );
}

export const authInputClass =
  "h-14 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none transition focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100";
