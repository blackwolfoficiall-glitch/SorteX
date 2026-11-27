import LegalUserCenter from "@/components/legal/LegalUserCenter";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./legal-center-premium.module.css";

export default function Page() {
  return (
    <PremiumScope className={styles.scope}>
      <section aria-label="Central Jurídica" className={styles.content}>
        <LegalUserCenter />
      </section>
    </PremiumScope>
  );
}
