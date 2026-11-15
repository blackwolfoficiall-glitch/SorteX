import Link from "next/link";
import { ArrowUpRight, MessageSquare, UserRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
export default function ContactPage() {
  return (
    <AuthShell
      title="Vamos conversar."
      description="Encontre o caminho para acompanhar sua conta e suas campanhas."
      backHref="/"
    >
      <div className="sx-choice-grid">
        <Link href="/login" className="sx-choice-card">
          <UserRound size={24} />
          <div>
            <h2>Já faço parte da SorteX</h2>
            <p>
              Entre na sua conta para acessar o painel e os canais internos de
              suporte.
            </p>
          </div>
          <ArrowUpRight size={18} />
        </Link>
        <div className="sx-choice-card">
          <MessageSquare size={24} />
          <div>
            <h2>Canal público em preparação</h2>
            <p>
              O contato público será informado aqui após confirmação. Ainda não
              há telefone ou e-mail oficial publicado nesta página.
            </p>
          </div>
        </div>
      </div>
      <p className="mt-6 text-xs leading-6 text-zinc-500">
        Dúvidas iniciais?{" "}
        <Link href="/#duvidas" className="font-semibold text-violet-700">
          Consulte as perguntas frequentes.
        </Link>
      </p>
    </AuthShell>
  );
}
