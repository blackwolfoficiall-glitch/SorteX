import type { ReactNode } from "react";
import PremiumScope from "@/components/premium/PremiumScope";
import accessStyles from "../login/login-premium.module.css";
import styles from "./password-recovery.module.css";

export default function PasswordRecoveryAccessScope({ children }: { children: ReactNode }) {
  return <PremiumScope className={`${accessStyles.scope} ${styles.recovery}`}>{children}</PremiumScope>;
}
