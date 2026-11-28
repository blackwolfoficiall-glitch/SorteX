import Link from "next/link";
import { ArrowLeft, ArrowUpRight, LifeBuoy, LockKeyhole } from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./public-support-premium.module.css";

export default function SuportePage() {
  return (
    <PremiumScope className={styles.page}>
      <main className={styles.wrap}>
        <Link href="/" className={styles.back}>
          <ArrowLeft size={17} aria-hidden="true" /> Voltar
        </Link>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>SorteX</p>
            <h1>Suporte</h1>
            <p>Entre na sua conta para abrir e acompanhar um chamado com segurança.</p>
          </div>
          <LifeBuoy size={34} aria-hidden="true" />
        </header>
        <section className={styles.panel} aria-labelledby="support-access">
          <span className={styles.icon}><LockKeyhole size={20} aria-hidden="true" /></span>
          <div>
            <h2 id="support-access">Acesso à conta</h2>
            <p>Os chamados ficam disponíveis após o login.</p>
          </div>
          <Link href="/login" className={styles.primary}>
            Entrar <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </main>
    </PremiumScope>
  );
}
