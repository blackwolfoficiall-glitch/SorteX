import { RoleGate } from "@/components/auth/RoleGate";
import { OrganizerShell } from "@/components/dashboard/Sidebar";
import { OrganizerOnboardingGate } from "@/components/organizer-platform/OrganizerOnboardingGate";
import OrganizerApprovalGate from "@/components/organizador/OrganizerApprovalGate";
import LegalAcceptanceGate from "@/components/legal/LegalAcceptanceGate";

const organizerRoles = ["ORGANIZER"] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGate allowed={[...organizerRoles]}>
      <OrganizerOnboardingGate>
        <OrganizerApprovalGate>
          <OrganizerShell>{children}</OrganizerShell>
          <LegalAcceptanceGate />
        </OrganizerApprovalGate>
      </OrganizerOnboardingGate>
    </RoleGate>
  );
}
