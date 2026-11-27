import type { ReactNode } from "react";
import PremiumScope from "@/components/premium/PremiumScope";
import accessStyles from "../login/login-premium.module.css";
import styles from "./registration-forms.module.css";

/** Opt in only the two standard e-mail registration routes, not social completion. */
export default function RegistrationAccessScope({ children }: { children: ReactNode }) {
  return <PremiumScope className={`${accessStyles.scope} ${styles.registrationForm}`}>{children}</PremiumScope>;
}
