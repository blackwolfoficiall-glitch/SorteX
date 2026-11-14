import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowUpRight, Layers3, Ticket } from "lucide-react";
import { SorteXMark } from "@/components/marketing/ProductHome";
export function AuthShell({
  title,
  description,
  children,
  backHref = "/cadastro",
  backLabel = "Voltar",
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="sx-auth">
      <aside className="sx-auth-story">
        <SorteXMark light />
        <div>
          <p className="sx-eyebrow">UMA PLATAFORMA. NOVAS POSSIBILIDADES.</p>
          <h2>
            Sua campanha,
            <br />
            em outro <em>nível.</em>
          </h2>
          <p>
            Organize o que importa.
            <br />
            Acompanhe cada etapa.
          </p>
          <div className="sx-auth-mini-screen">
            <Image
              src="/product/access-preview.png"
              width={1440}
              height={470}
              alt="Interface real do painel SorteX em ambiente de teste"
            />
          </div>
          <p className="sx-demo-note">Interface real · dados de demonstração</p>
          <div className="sx-auth-story-bottom">
            <span>
              <Layers3 size={17} />
              Para organizar
            </span>
            <span>
              <Ticket size={17} />
              Para participar
            </span>
          </div>
        </div>
        <Link href="/#por-dentro">
          Conheça a plataforma <ArrowUpRight size={17} />
        </Link>
      </aside>
      <div className="sx-auth-main">
        <header className="sx-auth-mobile-brand">
          <SorteXMark />
        </header>
        <div className="sx-auth-form-wrap">
          <Link href={backHref} className="sx-auth-back">
            <ArrowLeft size={15} />
            {backLabel}
          </Link>
          <header className="sx-auth-heading">
            <span className="sx-eyebrow">SEU ESPAÇO NA SORTEX</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </header>
          <section className="sx-auth-form">{children}</section>
          <footer className="sx-auth-footer">
            <Link href="/termos">Termos de uso</Link>
            <span>·</span>
            <Link href="/privacidade">Privacidade</Link>
          </footer>
        </div>
      </div>
    </main>
  );
}
export const authInputClass =
  "sx-auth-input h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-600 focus:ring-4 focus:ring-violet-100 disabled:bg-zinc-50 disabled:text-zinc-500";
