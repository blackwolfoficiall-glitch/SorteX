import { RoleGate } from "@/components/auth/RoleGate";

export default function OrganizerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RoleGate allowed={["ORGANIZER", "ADMIN"]}>{children}</RoleGate>;
}
