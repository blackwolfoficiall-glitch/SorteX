"use client";

import { useEffect, useRef, type ReactNode } from "react";
import PremiumScope from "@/components/premium/PremiumScope";
import CrmNav from "./CrmNav";
import ui from "./crm-workspace-premium.module.css";

export function CrmWorkspace({
  title,
  subtitle,
  eyebrow = "CRM Intelligence",
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PremiumScope className={ui.workspace}>
      <header className={`sx-premium-ticket ${ui.hero}`}>
        <div>
          <p className={ui.eyebrow}>{eyebrow}</p>
          <h1 className="sx-premium-title">{title}</h1>
          {subtitle && <div className={ui.subtitle}>{subtitle}</div>}
        </div>
        {actions && <div className={ui.heroActions}>{actions}</div>}
      </header>
      <div className={ui.navigation}>
        <CrmNav />
      </div>
      {children}
    </PremiumScope>
  );
}

export function CrmNotice({
  children,
  kind = "info",
}: {
  children: ReactNode;
  kind?: "info" | "error" | "success";
}) {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      data-kind={kind}
      className={ui.notice}
    >
      {children}
    </div>
  );
}

export function CrmWorkspaceDialog({
  titleId,
  onDismiss,
  children,
}: {
  titleId: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const current = element.current;
    current?.showModal();
    return () => {
      if (current?.open) current.close();
    };
  }, []);
  return (
    <dialog
      ref={element}
      className={ui.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
