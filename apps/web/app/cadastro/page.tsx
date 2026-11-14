import Link from "next/link";
import { ArrowUpRight, Building2, Ticket } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import SocialAccess from "@/components/auth/SocialAccess";
export default function CadastroPage() {
  return (
    <AuthShell
      title="Seu próximo passo começa aqui."
      description="Entre com uma identidade social ou escolha seu perfil para cadastrar-se com e-mail."
      backHref="/"
    >
      <SocialAccess />
      <div className="sx-choice-grid">
        {[
          {
            href: "/cadastro/comprador",
            title: "Sou comprador",
            copy: "Quero participar de campanhas e acompanhar meus títulos.",
            Icon: Ticket,
          },
          {
            href: "/cadastro/organizador",
            title: "Sou organizador",
            copy: "Quero criar e administrar campanhas. Cadastro PF ou PJ.",
            Icon: Building2,
          },
        ].map(({ href, title, copy, Icon }) => (
          <Link key={href} href={href} className="sx-choice-card">
            <Icon size={25} />
            <div>
              <h2>{title}</h2>
              <p>{copy}</p>
            </div>
            <ArrowUpRight size={18} />
          </Link>
        ))}
      </div>
      <p className="mt-7 text-center text-xs text-zinc-500">
        Já possui uma conta?{" "}
        <Link href="/login" className="font-semibold text-violet-700">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
