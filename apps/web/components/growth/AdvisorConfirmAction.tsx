"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import type { AdvisorAction } from "@/lib/growth/client";

export function AdvisorConfirmAction({ action }: { action: AdvisorAction }) {
  function confirm(event: MouseEvent<HTMLAnchorElement>) {
    if (!window.confirm(action.confirmation)) event.preventDefault();
  }
  return (
    <Link href={action.url} onClick={confirm} className="sx-premium-button">
      {action.label}
    </Link>
  );
}
