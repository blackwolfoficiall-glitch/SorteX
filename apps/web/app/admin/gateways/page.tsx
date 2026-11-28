import AdminManagement from '@/components/admin/AdminManagement';
import '../planos/admin-plans-premium.css';

export default function Page() {
  return <AdminManagement mode="gateways" premiumGateways />;
}
