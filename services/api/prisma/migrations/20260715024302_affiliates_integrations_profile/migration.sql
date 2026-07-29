-- CreateEnum
CREATE TYPE "OrganizerIntegrationType" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'GOOGLE', 'TIKTOK', 'YOUTUBE', 'TELEGRAM', 'META_ADS', 'GOOGLE_ADS', 'WEBHOOK', 'ZAPIER', 'MAKE', 'GATEWAY');

-- CreateEnum
CREATE TYPE "OrganizerIntegrationStatus" AS ENUM ('NOT_CONNECTED', 'CONFIGURING', 'SANDBOX_CONNECTED', 'CONNECTED', 'ERROR', 'DISCONNECTED');

-- AlterTable
ALTER TABLE "Affiliate" ADD COLUMN     "invitationLastSentAt" TIMESTAMP(3),
ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteMessage" TEXT;

-- AlterTable
ALTER TABLE "AffiliateProgram" ADD COLUMN     "affiliateLimit" INTEGER,
ADD COLUMN     "commissionBasis" TEXT NOT NULL DEFAULT 'SALE',
ADD COLUMN     "rules" TEXT;

-- CreateTable
CREATE TABLE "OrganizerIntegration" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "type" "OrganizerIntegrationType" NOT NULL,
    "status" "OrganizerIntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "displayName" TEXT,
    "accountId" TEXT,
    "provider" TEXT,
    "publicConfig" JSONB,
    "secretHash" TEXT,
    "webhookUrl" TEXT,
    "sandbox" BOOLEAN NOT NULL DEFAULT true,
    "permissions" TEXT[],
    "lastTestedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerIntegrationLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerIntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizerIntegration_organizerId_status_idx" ON "OrganizerIntegration"("organizerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerIntegration_organizerId_type_key" ON "OrganizerIntegration"("organizerId", "type");

-- CreateIndex
CREATE INDEX "OrganizerIntegrationLog_integrationId_createdAt_idx" ON "OrganizerIntegrationLog"("integrationId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrganizerIntegration" ADD CONSTRAINT "OrganizerIntegration_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerIntegrationLog" ADD CONSTRAINT "OrganizerIntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "OrganizerIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
