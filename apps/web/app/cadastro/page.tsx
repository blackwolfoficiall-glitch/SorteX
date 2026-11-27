import Link from "next/link";
import { ArrowUpRight, Building2, Ticket } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import SocialAccess from "@/components/auth/SocialAccess";
import PremiumScope from "@/components/premium/PremiumScope";
import accessStyles from "../login/login-premium.module.css";
import styles from "./registration-choice.module.css";

export default function CadastroPage() {
  return (
    <PremiumScope className={`${accessStyles.scope} ${styles.registration}`}>
      <AuthShell
        title="Seu próximo passo começa aqui."
        description="Entre com uma identidade social ou escolha seu perfil para cadastrar-se com e-mail."
        backHref="/"
      >
        <SocialAccess />
        <section aria-labelledby="profile-choice-title">
          <h2 id="profile-choice-title" className={styles.choiceTitle}>Escolha seu perfil</h2>
          <div className={`sx-choice-grid ${styles.choiceGrid}`}>
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
              <Link key={href} href={href} className={`sx-choice-card ${styles.choiceCard}`}>
                <span className={styles.choiceIcon}><Icon size={22} aria-hidden="true" /></span>
                <div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </div>
                <ArrowUpRight size={17} aria-hidden="true" className={styles.arrow} />
              </Link>
            ))}
          </div>
        </section>
        <p className={styles.signIn}>
          Já possui uma conta? <Link href="/login">Entrar</Link>
        </p>
      </AuthShell>
    </PremiumScope>
  );
}
