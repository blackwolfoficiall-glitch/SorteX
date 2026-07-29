-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('PACKAGE', 'COUPON', 'INSTANT_PRIZE', 'FLASH', 'BONUS', 'QUANTITY_DISCOUNT', 'CASHBACK');

-- CreateEnum
CREATE TYPE "PromotionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PromotionUsageStatus" AS ENUM ('RESERVED', 'APPROVED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "SortexAdStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SANDBOX_ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SortexAdObjective" AS ENUM ('VISITS', 'PARTICIPANTS', 'SALES', 'ABANDONED_RESERVATIONS', 'PROMOTION', 'NEW_CAMPAIGN', 'DRAW_APPROACHING');

-- CreateEnum
CREATE TYPE "SortexAdBudgetType" AS ENUM ('DAILY', 'TOTAL');

-- CreateEnum
CREATE TYPE "SortexAdChannel" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'GOOGLE', 'YOUTUBE', 'TIKTOK');

-- CreateEnum
CREATE TYPE "AiRecommendationPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AiRecommendationStatus" AS ENUM ('NEW', 'VIEWED', 'ACCEPTED', 'EXECUTED', 'IGNORED', 'NOT_USEFUL');

-- AlterTable
ALTER TABLE "CampaignPromotion" ADD COLUMN     "attributedRevenue" DECIMAL(16,2) NOT NULL DEFAULT 0,
ADD COLUMN     "config" JSONB,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "grantedDiscount" DECIMAL(16,2) NOT NULL DEFAULT 0,
ADD COLUMN     "perBuyerLimit" INTEGER,
ADD COLUMN     "stackRules" JSONB,
ADD COLUMN     "status" "PromotionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "totalLimit" INTEGER,
ADD COLUMN     "type" "PromotionType" NOT NULL DEFAULT 'PACKAGE',
ADD COLUMN     "usageCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PromotionCoupon" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(14,2) NOT NULL,
    "minimumAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalLimit" INTEGER,
    "perBuyerLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionUsage" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "couponId" TEXT,
    "buyerId" TEXT NOT NULL,
    "purchaseId" TEXT,
    "status" "PromotionUsageStatus" NOT NULL DEFAULT 'RESERVED',
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "finalAmount" DECIMAL(14,2) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionalCredit" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "usedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionalCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SortexAdCampaign" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "promotionId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "SortexAdStatus" NOT NULL DEFAULT 'DRAFT',
    "objective" "SortexAdObjective" NOT NULL,
    "channels" "SortexAdChannel"[],
    "audience" JSONB NOT NULL,
    "location" JSONB NOT NULL,
    "budgetType" "SortexAdBudgetType" NOT NULL,
    "budget" DECIMAL(14,2) NOT NULL,
    "creative" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "registrations" INTEGER NOT NULL DEFAULT 0,
    "reservations" INTEGER NOT NULL DEFAULT 0,
    "approvedSales" INTEGER NOT NULL DEFAULT 0,
    "attributedRevenue" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SortexAdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SortexAdEvent" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "visitorHash" TEXT,
    "buyerId" TEXT,
    "purchaseId" TEXT,
    "type" TEXT NOT NULL,
    "value" DECIMAL(14,2),
    "channel" "SortexAdChannel",
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SortexAdEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRecommendation" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "ruleKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "impact" TEXT,
    "priority" "AiRecommendationPriority" NOT NULL,
    "status" "AiRecommendationStatus" NOT NULL DEFAULT 'NEW',
    "actionType" TEXT NOT NULL,
    "actionUrl" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewedAt" TIMESTAMP(3),
    "actedAt" TIMESTAMP(3),
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromotionCoupon_promotionId_isActive_idx" ON "PromotionCoupon"("promotionId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionCoupon_organizerId_code_key" ON "PromotionCoupon"("organizerId", "code");

-- CreateIndex
CREATE INDEX "PromotionUsage_buyerId_createdAt_idx" ON "PromotionUsage"("buyerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionUsage_promotionId_purchaseId_key" ON "PromotionUsage"("promotionId", "purchaseId");

-- CreateIndex
CREATE INDEX "PromotionalCredit_buyerId_expiresAt_idx" ON "PromotionalCredit"("buyerId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SortexAdCampaign_code_key" ON "SortexAdCampaign"("code");

-- CreateIndex
CREATE INDEX "SortexAdCampaign_organizerId_status_updatedAt_idx" ON "SortexAdCampaign"("organizerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "SortexAdCampaign_campaignId_status_idx" ON "SortexAdCampaign"("campaignId", "status");

-- CreateIndex
CREATE INDEX "SortexAdEvent_adId_type_occurredAt_idx" ON "SortexAdEvent"("adId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "SortexAdEvent_buyerId_occurredAt_idx" ON "SortexAdEvent"("buyerId", "occurredAt");

-- CreateIndex
CREATE INDEX "AiRecommendation_organizerId_status_priority_generatedAt_idx" ON "AiRecommendation"("organizerId", "status", "priority", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiRecommendation_organizerId_ruleKey_campaignId_key" ON "AiRecommendation"("organizerId", "ruleKey", "campaignId");

-- AddForeignKey
ALTER TABLE "PromotionCoupon" ADD CONSTRAINT "PromotionCoupon_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "CampaignPromotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionUsage" ADD CONSTRAINT "PromotionUsage_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "CampaignPromotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionUsage" ADD CONSTRAINT "PromotionUsage_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "PromotionCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionalCredit" ADD CONSTRAINT "PromotionalCredit_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "CampaignPromotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionalCredit" ADD CONSTRAINT "PromotionalCredit_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortexAdCampaign" ADD CONSTRAINT "SortexAdCampaign_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortexAdCampaign" ADD CONSTRAINT "SortexAdCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortexAdCampaign" ADD CONSTRAINT "SortexAdCampaign_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "CampaignPromotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SortexAdEvent" ADD CONSTRAINT "SortexAdEvent_adId_fkey" FOREIGN KEY ("adId") REFERENCES "SortexAdCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecommendation" ADD CONSTRAINT "AiRecommendation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
