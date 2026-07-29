import { RoleGate } from "@/components/auth/RoleGate";
import Sidebar from "@/components/dashboard/Sidebar";
import { OrganizerOnboardingGate } from "@/components/organizer-platform/OrganizerOnboardingGate";
import OrganizerApprovalGate from "@/components/organizador/OrganizerApprovalGate";
import LegalAcceptanceGate from "@/components/legal/LegalAcceptanceGate";

const organizerRoles = ["ORGANIZER"] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate allowed={[...organizerRoles]}><OrganizerOnboardingGate><OrganizerApprovalGate><div className="min-h-screen bg-zinc-100"><Sidebar/><main className="px-4 pb-10 pt-20 sm:px-6 lg:ml-72 lg:px-8 lg:pt-8">{children}</main><LegalAcceptanceGate/></div></OrganizerApprovalGate></OrganizerOnboardingGate></RoleGate>;
}
