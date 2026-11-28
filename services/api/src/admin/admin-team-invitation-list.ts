import type { Prisma } from '@prisma/client';

// Directory reads have no need for invitation validation or lifecycle data.
export const adminTeamInvitationListSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  expiresAt: true,
  invitedBy: { select: { name: true } },
} satisfies Prisma.AdminTeamInvitationSelect;

type InvitationListRow = Prisma.AdminTeamInvitationGetPayload<{
  select: typeof adminTeamInvitationListSelect;
}>;

export function adminTeamInvitationListRow(row: InvitationListRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expiresAt,
    invitedBy: { name: row.invitedBy.name },
  };
}
