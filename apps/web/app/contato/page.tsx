import Link from "next/link";
import { ArrowUpRight, MessageSquare, UserRound } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./public-contact-premium.module.css";

export default function ContactPage() {
  return (
    <AuthShell
      title="Vamos conversar."
      description="Encontre o caminho para acompanhar sua conta e suas campanhas."
      backHref="/"
    >
      <PremiumScope className={styles.contact}>
        <div className={styles.options}>
          <Link href="/login" className={styles.account} aria-labelledby="contact-account" aria-describedby="contact-account-help">
            <span className={styles.icon}><UserRound size={22} aria-hidden="true" /></span>
            <div>
              <h2 id="contact-account">Já faço parte da SorteX</h2>
              <p id="contact-account-help">Entre na sua conta para acessar o painel e os canais internos de suporte.</p>
            </div>
            <ArrowUpRight className={styles.arrow} size={17} aria-hidden="true" />
          </Link>
          <section className={styles.pending} aria-labelledby="contact-public">
            <span className={styles.icon}><MessageSquare size={22} aria-hidden="true" /></span>
            <div>
              <h2 id="contact-public">Canal público em preparação</h2>
              <p>O contato público será informado aqui após confirmação. Ainda não há telefone ou e-mail oficial publicado nesta página.</p>
            </div>
          </section>
        </div>
        <p className={styles.faq}>
          Dúvidas iniciais?{" "}
          <Link href="/#duvidas">Consulte as perguntas frequentes.</Link>
        </p>
      </PremiumScope>
    </AuthShell>
  );
}
