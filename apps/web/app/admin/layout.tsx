'use client';

import { usePathname } from 'next/navigation';
import { RoleGate } from '@/components/auth/RoleGate';
import AdminShell from '@/components/admin/AdminShell';
import { requiredPermissionForAdminPath } from '@/lib/admin/authorization';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin/login' || pathname.startsWith('/admin/convite/')) return children;
  return <RoleGate allowed={['ADMIN']} requiredPermission={requiredPermissionForAdminPath(pathname)}><AdminShell>{children}</AdminShell></RoleGate>;
}
