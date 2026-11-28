import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

export const automationPath = "/dashboard/crm/automacoes";

export default function AutomationShortcutLink({
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  if (href === automationPath || href.startsWith(`${automationPath}?`)) {
    // These URLs seed different form/list states. Use browser history directly
    // so a stale Next client transition cannot replace the query after Back.
    return <a href={href} {...props} />;
  }
  return <Link href={href} {...props} />;
}
