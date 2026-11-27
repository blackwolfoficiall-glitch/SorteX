import Link from "next/link";
import {
  ArrowUpRight,
  Crown,
  Globe2,
  Palette,
  Scale,
  Settings2,
  Share2,
  UserRound,
} from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./settings-overview.module.css";

const sections = [
  [
    UserRound,
    "Perfil",
    "Dados da conta e slogan opcional da sua marca.",
    "/perfil",
  ],
  [
    Crown,
    "Meu plano",
    "Plano atual, limites, consumo, upgrade e cancelamento.",
    "/dashboard/configuracoes/plano",
  ],
  [
    Scale,
    "Central Jurídica",
    "Documentos legais, aceites e solicitações relacionadas aos seus dados.",
    "/dashboard/configuracoes/juridico",
  ],
  [
    Palette,
    "Personalização",
    "Identidade, aparência, layout, elementos e templates.",
    "/dashboard/personalizacao",
  ],
  [
    Globe2,
    "Domínio próprio",
    "DNS, verificação, HTTPS e status do domínio.",
    "/dashboard/personalizacao/dominio",
  ],
  [
    Share2,
    "Redes sociais e comunidades",
    "Links públicos, grupos, canais e ordem de exibição.",
    "/dashboard/personalizacao/redes-sociais",
  ],
] as const;

export default function ConfiguracoesPage() {
  return (
    <PremiumScope className={styles.scope}>
      <section
        className={styles.content}
        aria-labelledby="organizer-settings-title"
      >
        <header className={styles.banner}>
          <span className={styles.heroIcon}>
            <Settings2 aria-hidden="true" size={24} />
          </span>
          <div>
            <p className={styles.eyebrow}>Conta e plataforma</p>
            <h1 className="sx-premium-title" id="organizer-settings-title">
              Configurações
            </h1>
            <p className={styles.description}>
              Gerencie seu plano e a presença da sua marca na SorteX.
            </p>
          </div>
        </header>
        <nav className={styles.grid} aria-label="Seções de configurações">
          {sections.map(([Icon, title, description, href], index) => {
            const titleId = `organizer-settings-card-${index}`;
            const descriptionId = `${titleId}-description`;
            return (
              <Link
                key={href}
                href={href}
                className={styles.card}
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
              >
                <span className={styles.cardIcon}>
                  <Icon aria-hidden="true" size={21} />
                </span>
                <div className={styles.text}>
                  <h2 className={styles.cardTitle} id={titleId}>
                    {title}
                  </h2>
                  <p className={styles.description} id={descriptionId}>
                    {description}
                  </p>
                </div>
                <span className={styles.arrow} aria-hidden="true">
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            );
          })}
        </nav>
      </section>
    </PremiumScope>
  );
}
