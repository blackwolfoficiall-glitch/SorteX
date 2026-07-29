-- CreateEnum
CREATE TYPE "AdminTeamRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'REGISTRATION_ANALYST', 'FINANCE', 'SUPPORT', 'AUDIT');

-- CreateEnum
CREATE TYPE "OrganizerDocumentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrganizerRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "OrganizerInternalNoteCategory" AS ENUM ('REGISTRATION', 'FINANCE', 'SUPPORT', 'RISK', 'COMMERCIAL', 'LEGAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "AdminGatewayStatus" AS ENUM ('INACTIVE', 'SANDBOX', 'ACTIVE', 'ERROR', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "PlatformFeeRuleType" AS ENUM ('GLOBAL', 'PLAN', 'ORGANIZER', 'CAMPAIGN', 'ZERO_FEE', 'FIRST_CAMPAIGN_FREE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VerificationStatus" ADD VALUE 'INCOMPLETE';
ALTER TYPE "VerificationStatus" ADD VALUE 'CORRECTION_REQUESTED';
ALTER TYPE "VerificationStatus" ADD VALUE 'DOCUMENT_REQUESTED';
ALTER TYPE "VerificationStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "OrganizerDocument" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "OrganizerDocumentStatus" NOT NULL DEFAULT 'SUBMITTED';

-- AlterTable
ALTER TABLE "OrganizerProfile" ADD COLUMN     "assignedAdminId" TEXT,
ADD COLUMN     "correctionDeadline" TIMESTAMP(3),
ADD COLUMN     "publicReviewMessage" TEXT,
ADD COLUMN     "riskLevel" "OrganizerRiskLevel" NOT NULL DEFAULT 'MANUAL_REVIEW',
ADD COLUMN     "riskScore" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "annualPrice" DECIMAL(14,2),
ADD COLUMN     "campaignLimit" INTEGER,
ADD COLUMN     "teamMemberLimit" INTEGER,
ADD COLUMN     "ticketLimit" INTEGER,
ADD COLUMN     "trialDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminTeamRole" "AdminTeamRole";

-- CreateTable
CREATE TABLE "OrganizerReviewDecision" (
    "id" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "previousStatus" "VerificationStatus" NOT NULL,
    "nextStatus" "VerificationStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedFields" JSONB,
    "requestedDocuments" JSONB,
    "deadline" TIMESTAMP(3),
    "canResubmit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerInternalNote" (
    "id" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "category" "OrganizerInternalNoteCategory" NOT NULL DEFAULT 'GENERAL',
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerInternalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerFeeHistory" (
    "id" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "ruleType" "PlatformFeeRuleType" NOT NULL,
    "previousRate" DECIMAL(6,3),
    "newRate" DECIMAL(6,3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "campaignId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerFeeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminGatewayConfig" (
    "id" TEXT NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "AdminGatewayStatus" NOT NULL DEFAULT 'INACTIVE',
    "sandboxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "productionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "splitAvailable" BOOLEAN NOT NULL DEFAULT false,
    "planBillingAvailable" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "estimatedFeeRate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "collectionModel" TEXT NOT NULL DEFAULT 'CONSOLIDATED',
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminGatewayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizerReviewDecision_organizerProfileId_createdAt_idx" ON "OrganizerReviewDecision"("organizerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizerReviewDecision_adminId_createdAt_idx" ON "OrganizerReviewDecision"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizerInternalNote_organizerProfileId_createdAt_idx" ON "OrganizerInternalNote"("organizerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizerFeeHistory_organizerProfileId_createdAt_idx" ON "OrganizerFeeHistory"("organizerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizerFeeHistory_campaignId_idx" ON "OrganizerFeeHistory"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminGatewayConfig_provider_key" ON "AdminGatewayConfig"("provider");

-- CreateIndex
CREATE INDEX "AdminGatewayConfig_status_priority_idx" ON "AdminGatewayConfig"("status", "priority");

-- AddForeignKey
ALTER TABLE "OrganizerReviewDecision" ADD CONSTRAINT "OrganizerReviewDecision_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerReviewDecision" ADD CONSTRAINT "OrganizerReviewDecision_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerInternalNote" ADD CONSTRAINT "OrganizerInternalNote_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerInternalNote" ADD CONSTRAINT "OrganizerInternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerFeeHistory" ADD CONSTRAINT "OrganizerFeeHistory_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerFeeHistory" ADD CONSTRAINT "OrganizerFeeHistory_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
