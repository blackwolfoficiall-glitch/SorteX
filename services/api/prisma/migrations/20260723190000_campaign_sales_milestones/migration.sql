CREATE TYPE "CampaignMilestoneStatus" AS ENUM ('WAITING', 'RELEASED', 'DRAWN', 'COMPLETED');

ALTER TABLE "Campaign"
ADD COLUMN "milestoneWinnersRemainEligible" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "CampaignMilestonePrize" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "videoUrl" TEXT,
  "estimatedValue" DECIMAL(14,2),
  "percentage" INTEGER NOT NULL,
  "scheduledAt" TIMESTAMP(3),
  "notes" TEXT,
  "status" "CampaignMilestoneStatus" NOT NULL DEFAULT 'WAITING',
  "reachedAt" TIMESTAMP(3),
  "snapshotAt" TIMESTAMP(3),
  "eligibleTicketCount" INTEGER NOT NULL DEFAULT 0,
  "lotteryDrawId" TEXT,
  "winnerTicketId" TEXT,
  "winningNumber" TEXT,
  "ruleSnapshot" JSONB,
  "resultSnapshot" JSONB,
  "auditHash" TEXT,
  "executedByUserId" TEXT,
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignMilestonePrize_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampaignMilestoneEligibleTicket" (
  "id" TEXT NOT NULL,
  "milestoneId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "buyerId" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "excludedAt" TIMESTAMP(3),
  "exclusionReason" TEXT,
  CONSTRAINT "CampaignMilestoneEligibleTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignMilestonePrize_campaignId_percentage_key"
ON "CampaignMilestonePrize"("campaignId", "percentage");
CREATE INDEX "CampaignMilestonePrize_campaignId_status_percentage_idx"
ON "CampaignMilestonePrize"("campaignId", "status", "percentage");
CREATE INDEX "CampaignMilestonePrize_lotteryDrawId_idx"
ON "CampaignMilestonePrize"("lotteryDrawId");
CREATE UNIQUE INDEX "CampaignMilestoneEligibleTicket_milestoneId_ticketId_key"
ON "CampaignMilestoneEligibleTicket"("milestoneId", "ticketId");
CREATE INDEX "CampaignMilestoneEligibleTicket_milestoneId_number_idx"
ON "CampaignMilestoneEligibleTicket"("milestoneId", "number");
CREATE INDEX "CampaignMilestoneEligibleTicket_buyerId_capturedAt_idx"
ON "CampaignMilestoneEligibleTicket"("buyerId", "capturedAt");

ALTER TABLE "CampaignMilestonePrize"
ADD CONSTRAINT "CampaignMilestonePrize_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignMilestonePrize"
ADD CONSTRAINT "CampaignMilestonePrize_lotteryDrawId_fkey"
FOREIGN KEY ("lotteryDrawId") REFERENCES "LotteryDraw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignMilestonePrize"
ADD CONSTRAINT "CampaignMilestonePrize_winnerTicketId_fkey"
FOREIGN KEY ("winnerTicketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampaignMilestonePrize"
ADD CONSTRAINT "CampaignMilestonePrize_executedByUserId_fkey"
FOREIGN KEY ("executedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CampaignMilestoneEligibleTicket"
ADD CONSTRAINT "CampaignMilestoneEligibleTicket_milestoneId_fkey"
FOREIGN KEY ("milestoneId") REFERENCES "CampaignMilestonePrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignMilestoneEligibleTicket"
ADD CONSTRAINT "CampaignMilestoneEligibleTicket_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
