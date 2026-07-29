-- CreateEnum
CREATE TYPE "OrganizerOnboardingStatus" AS ENUM ('PLAN_SELECTION', 'IDENTITY_SETUP', 'COMPLETE');

-- CreateEnum
CREATE TYPE "PlanBillingCycle" AS ENUM ('MONTHLY', 'ANNUAL', 'ONE_TIME', 'TRIAL');

-- CreateEnum
CREATE TYPE "OrganizerThemeMode" AS ENUM ('LIGHT', 'DARK', 'AUTOMATIC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CampaignLayoutStyle" AS ENUM ('CLASSIC', 'MODERN', 'IMAGE_FOCUS', 'WIDE', 'COMPACT', 'PREMIUM');

-- CreateEnum
CREATE TYPE "OrganizerSocialNetwork" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'X_TWITTER', 'WEBSITE', 'WHATSAPP', 'TELEGRAM', 'DISCORD');

-- CreateEnum
CREATE TYPE "OrganizerCommunityType" AS ENUM ('WHATSAPP_GROUP', 'WHATSAPP_COMMUNITY', 'INSTAGRAM_CHANNEL', 'TELEGRAM_CHANNEL', 'TELEGRAM_GROUP', 'DISCORD');

-- CreateEnum
CREATE TYPE "OrganizerDomainType" AS ENUM ('ROOT', 'SUBDOMAIN', 'CAMPAIGN');

-- CreateEnum
CREATE TYPE "OrganizerDomainStatus" AS ENUM ('NOT_CONFIGURED', 'AWAITING_DNS', 'VERIFYING', 'ACTIVE', 'ERROR', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MiniCampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MiniCampaignPrizeType" AS ENUM ('MAIN_CAMPAIGN_TICKETS', 'PIX', 'PRODUCT', 'BONUS', 'OTHER');

-- CreateEnum
CREATE TYPE "MiniCampaignOrderStatus" AS ENUM ('RESERVED', 'AWAITING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'FAILED');

-- AlterTable
ALTER TABLE "OrganizerBrandProfile" ADD COLUMN     "appearanceConfig" JSONB,
ADD COLUMN     "backgroundColor" TEXT NOT NULL DEFAULT '#FFFFFF',
ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "buttonColor" TEXT NOT NULL DEFAULT '#2563EB',
ADD COLUMN     "cardColor" TEXT NOT NULL DEFAULT '#FFFFFF',
ADD COLUMN     "fantasyName" TEXT,
ADD COLUMN     "layoutStyle" "CampaignLayoutStyle" NOT NULL DEFAULT 'MODERN',
ADD COLUMN     "profileImageUrl" TEXT,
ADD COLUMN     "progressColor" TEXT NOT NULL DEFAULT '#22C55E',
ADD COLUMN     "publicEmail" TEXT,
ADD COLUMN     "publicPhone" TEXT,
ADD COLUMN     "themeMode" "OrganizerThemeMode" NOT NULL DEFAULT 'LIGHT';

-- AlterTable
ALTER TABLE "OrganizerProfile" ADD COLUMN     "identitySetupCompletedAt" TIMESTAMP(3),
ADD COLUMN     "onboardingStatus" "OrganizerOnboardingStatus" NOT NULL DEFAULT 'PLAN_SELECTION',
ADD COLUMN     "planSelectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "billingCycle" "PlanBillingCycle" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "nextRenewalAt" TIMESTAMP(3),
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "sandboxMode" BOOLEAN NOT NULL DEFAULT true;

-- Preserve access for organizers that existed before the onboarding flow.
UPDATE "OrganizerProfile"
SET "onboardingStatus" = 'COMPLETE',
    "planSelectedAt" = COALESCE("planSelectedAt", "createdAt"),
    "identitySetupCompletedAt" = COALESCE("identitySetupCompletedAt", "createdAt");

-- The four launch plans are configuration records. IDs are stable so the
-- migration is deterministic in development and staging.
INSERT INTO "Plan" ("id", "code", "name", "description", "monthlyPrice", "platformFeeRate", "isActive", "sortOrder", "createdAt", "updatedAt") VALUES
('plan_inicial', 'INITIAL', 'Inicial', 'Recursos essenciais para começar.', 0.00, 2.900, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('plan_profissional', 'PROFESSIONAL', 'Profissional', 'CRM, afiliados, comunicação e personalização ampliada.', 79.90, 2.400, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('plan_avancado', 'ADVANCED', 'Avançado', 'IA SorteX, Ads, automações e domínio próprio.', 149.90, 1.900, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('plan_empresarial', 'ENTERPRISE', 'Empresarial', 'Limites e condições comerciais personalizadas.', 299.90, 1.900, true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "monthlyPrice" = EXCLUDED."monthlyPrice",
  "platformFeeRate" = EXCLUDED."platformFeeRate",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PlanFeature" ("id", "planId", "key", "name", "value") VALUES
('pf_initial_campaigns', 'plan_inicial', 'campaignLimit', 'Limite de campanhas', '2'::jsonb),
('pf_initial_tickets', 'plan_inicial', 'ticketLimit', 'Títulos por campanha', '10000'::jsonb),
('pf_initial_team', 'plan_inicial', 'teamLimit', 'Usuários da equipe', '1'::jsonb),
('pf_initial_personalization', 'plan_inicial', 'personalizationLevel', 'Personalização', '"BASIC"'::jsonb),
('pf_prof_campaigns', 'plan_profissional', 'campaignLimit', 'Limite de campanhas', '10'::jsonb),
('pf_prof_tickets', 'plan_profissional', 'ticketLimit', 'Títulos por campanha', '100000'::jsonb),
('pf_prof_team', 'plan_profissional', 'teamLimit', 'Usuários da equipe', '3'::jsonb),
('pf_prof_crm', 'plan_profissional', 'crm', 'CRM Intelligence', 'true'::jsonb),
('pf_prof_affiliates', 'plan_profissional', 'affiliates', 'Afiliados', 'true'::jsonb),
('pf_prof_communication', 'plan_profissional', 'communication', 'Comunicação', 'true'::jsonb),
('pf_prof_personalization', 'plan_profissional', 'personalizationLevel', 'Personalização', '"PROFESSIONAL"'::jsonb),
('pf_advanced_campaigns', 'plan_avancado', 'campaignLimit', 'Limite de campanhas', '50'::jsonb),
('pf_advanced_tickets', 'plan_avancado', 'ticketLimit', 'Títulos por campanha', '1000000'::jsonb),
('pf_advanced_team', 'plan_avancado', 'teamLimit', 'Usuários da equipe', '10'::jsonb),
('pf_advanced_crm', 'plan_avancado', 'crm', 'CRM Intelligence', 'true'::jsonb),
('pf_advanced_ai', 'plan_avancado', 'ai', 'IA SorteX', 'true'::jsonb),
('pf_advanced_ads', 'plan_avancado', 'ads', 'SorteX Ads', 'true'::jsonb),
('pf_advanced_affiliates', 'plan_avancado', 'affiliates', 'Afiliados', 'true'::jsonb),
('pf_advanced_communication', 'plan_avancado', 'communication', 'Comunicação', 'true'::jsonb),
('pf_advanced_automations', 'plan_avancado', 'automations', 'Automações', 'true'::jsonb),
('pf_advanced_domain', 'plan_avancado', 'customDomain', 'Domínio próprio', 'true'::jsonb),
('pf_advanced_mini', 'plan_avancado', 'miniCampaigns', 'Mini Campanhas', 'true'::jsonb),
('pf_advanced_personalization', 'plan_avancado', 'personalizationLevel', 'Personalização', '"ADVANCED"'::jsonb),
('pf_enterprise_campaigns', 'plan_empresarial', 'campaignLimit', 'Limite de campanhas', '-1'::jsonb),
('pf_enterprise_tickets', 'plan_empresarial', 'ticketLimit', 'Títulos por campanha', '-1'::jsonb),
('pf_enterprise_team', 'plan_empresarial', 'teamLimit', 'Usuários da equipe', '-1'::jsonb),
('pf_enterprise_crm', 'plan_empresarial', 'crm', 'CRM Intelligence', 'true'::jsonb),
('pf_enterprise_ai', 'plan_empresarial', 'ai', 'IA SorteX', 'true'::jsonb),
('pf_enterprise_ads', 'plan_empresarial', 'ads', 'SorteX Ads', 'true'::jsonb),
('pf_enterprise_affiliates', 'plan_empresarial', 'affiliates', 'Afiliados', 'true'::jsonb),
('pf_enterprise_communication', 'plan_empresarial', 'communication', 'Comunicação', 'true'::jsonb),
('pf_enterprise_automations', 'plan_empresarial', 'automations', 'Automações', 'true'::jsonb),
('pf_enterprise_domain', 'plan_empresarial', 'customDomain', 'Domínio próprio', 'true'::jsonb),
('pf_enterprise_mini', 'plan_empresarial', 'miniCampaigns', 'Mini Campanhas', 'true'::jsonb),
('pf_enterprise_personalization', 'plan_empresarial', 'personalizationLevel', 'Personalização', '"ENTERPRISE"'::jsonb)
ON CONFLICT ("planId", "key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "value" = EXCLUDED."value";

UPDATE "Subscription"
SET "planId" = CASE "plan"
  WHEN 'BASIC' THEN 'plan_inicial'
  WHEN 'PROFESSIONAL' THEN 'plan_profissional'
  WHEN 'PREMIUM' THEN 'plan_avancado'
  WHEN 'ENTERPRISE' THEN 'plan_empresarial'
END;

-- CreateTable
CREATE TABLE "OrganizerSocialLink" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "type" "OrganizerSocialNetwork" NOT NULL,
    "label" TEXT,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerSocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerCommunityLink" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "type" "OrganizerCommunityType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerCommunityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerDomain" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "type" "OrganizerDomainType" NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "OrganizerDomainStatus" NOT NULL DEFAULT 'AWAITING_DNS',
    "verificationToken" TEXT NOT NULL,
    "dnsInstructions" JSONB NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sslActive" BOOLEAN NOT NULL DEFAULT false,
    "httpsActive" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignCustomization" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "useOrganizerDefaults" BOOLEAN NOT NULL DEFAULT true,
    "configuration" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignCustomization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignTemplate" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "sourceCampaignId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "configuration" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniCampaign" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "mainCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "prizeType" "MiniCampaignPrizeType" NOT NULL,
    "prizeDescription" TEXT NOT NULL,
    "maxTickets" INTEGER NOT NULL,
    "ticketPrice" DECIMAL(14,2) NOT NULL,
    "purchaseLimitPerBuyer" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "drawAt" TIMESTAMP(3),
    "rules" TEXT NOT NULL,
    "status" "MiniCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "soldTickets" INTEGER NOT NULL DEFAULT 0,
    "grossRevenue" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniCampaignOrder" (
    "id" TEXT NOT NULL,
    "miniCampaignId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "MiniCampaignOrderStatus" NOT NULL DEFAULT 'RESERVED',
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniCampaignOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniCampaignTicket" (
    "id" TEXT NOT NULL,
    "miniCampaignId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniCampaignTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniCampaignResult" (
    "id" TEXT NOT NULL,
    "miniCampaignId" TEXT NOT NULL,
    "winningNumber" INTEGER NOT NULL,
    "winnerId" TEXT,
    "notes" TEXT,
    "auditedData" JSONB,
    "drawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniCampaignResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizerSocialLink_organizerId_isActive_sortOrder_idx" ON "OrganizerSocialLink"("organizerId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerSocialLink_organizerId_type_key" ON "OrganizerSocialLink"("organizerId", "type");

-- CreateIndex
CREATE INDEX "OrganizerCommunityLink_organizerId_isActive_sortOrder_idx" ON "OrganizerCommunityLink"("organizerId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerCommunityLink_organizerId_type_url_key" ON "OrganizerCommunityLink"("organizerId", "type", "url");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerDomain_domain_key" ON "OrganizerDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerDomain_verificationToken_key" ON "OrganizerDomain"("verificationToken");

-- CreateIndex
CREATE INDEX "OrganizerDomain_organizerId_status_idx" ON "OrganizerDomain"("organizerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignCustomization_campaignId_key" ON "CampaignCustomization"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignCustomization_organizerId_updatedAt_idx" ON "CampaignCustomization"("organizerId", "updatedAt");

-- CreateIndex
CREATE INDEX "CampaignTemplate_organizerId_isActive_updatedAt_idx" ON "CampaignTemplate"("organizerId", "isActive", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignTemplate_organizerId_name_key" ON "CampaignTemplate"("organizerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MiniCampaign_slug_key" ON "MiniCampaign"("slug");

-- CreateIndex
CREATE INDEX "MiniCampaign_organizerId_status_updatedAt_idx" ON "MiniCampaign"("organizerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "MiniCampaign_mainCampaignId_status_idx" ON "MiniCampaign"("mainCampaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MiniCampaignOrder_code_key" ON "MiniCampaignOrder"("code");

-- CreateIndex
CREATE INDEX "MiniCampaignOrder_miniCampaignId_status_createdAt_idx" ON "MiniCampaignOrder"("miniCampaignId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MiniCampaignOrder_buyerId_status_createdAt_idx" ON "MiniCampaignOrder"("buyerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MiniCampaignTicket_orderId_idx" ON "MiniCampaignTicket"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "MiniCampaignTicket_miniCampaignId_number_key" ON "MiniCampaignTicket"("miniCampaignId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "MiniCampaignResult_miniCampaignId_key" ON "MiniCampaignResult"("miniCampaignId");

-- CreateIndex
CREATE INDEX "MiniCampaignResult_winnerId_drawnAt_idx" ON "MiniCampaignResult"("winnerId", "drawnAt");

-- CreateIndex
CREATE INDEX "Subscription_planId_status_idx" ON "Subscription"("planId", "status");

-- AddForeignKey
ALTER TABLE "OrganizerSocialLink" ADD CONSTRAINT "OrganizerSocialLink_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerCommunityLink" ADD CONSTRAINT "OrganizerCommunityLink_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerDomain" ADD CONSTRAINT "OrganizerDomain_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCustomization" ADD CONSTRAINT "CampaignCustomization_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTemplate" ADD CONSTRAINT "CampaignTemplate_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignTemplate" ADD CONSTRAINT "CampaignTemplate_sourceCampaignId_fkey" FOREIGN KEY ("sourceCampaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCampaign" ADD CONSTRAINT "MiniCampaign_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCampaign" ADD CONSTRAINT "MiniCampaign_mainCampaignId_fkey" FOREIGN KEY ("mainCampaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCampaignOrder" ADD CONSTRAINT "MiniCampaignOrder_miniCampaignId_fkey" FOREIGN KEY ("miniCampaignId") REFERENCES "MiniCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCampaignOrder" ADD CONSTRAINT "MiniCampaignOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCampaignTicket" ADD CONSTRAINT "MiniCampaignTicket_miniCampaignId_fkey" FOREIGN KEY ("miniCampaignId") REFERENCES "MiniCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCampaignTicket" ADD CONSTRAINT "MiniCampaignTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MiniCampaignOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCampaignResult" ADD CONSTRAINT "MiniCampaignResult_miniCampaignId_fkey" FOREIGN KEY ("miniCampaignId") REFERENCES "MiniCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniCampaignResult" ADD CONSTRAINT "MiniCampaignResult_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
