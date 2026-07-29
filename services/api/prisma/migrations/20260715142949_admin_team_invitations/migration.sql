-- CreateEnum
CREATE TYPE "AdminInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AdminTeamInvitation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "AdminTeamRole" NOT NULL,
    "permissions" "AdminPermission"[],
    "message" TEXT,
    "status" "AdminInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminTeamInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminTeamInvitation_tokenHash_key" ON "AdminTeamInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminTeamInvitation_email_status_idx" ON "AdminTeamInvitation"("email", "status");

-- CreateIndex
CREATE INDEX "AdminTeamInvitation_invitedById_createdAt_idx" ON "AdminTeamInvitation"("invitedById", "createdAt");

-- CreateIndex
CREATE INDEX "AdminTeamInvitation_expiresAt_status_idx" ON "AdminTeamInvitation"("expiresAt", "status");

-- AddForeignKey
ALTER TABLE "AdminTeamInvitation" ADD CONSTRAINT "AdminTeamInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminTeamInvitation" ADD CONSTRAINT "AdminTeamInvitation_acceptedUserId_fkey" FOREIGN KEY ("acceptedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
