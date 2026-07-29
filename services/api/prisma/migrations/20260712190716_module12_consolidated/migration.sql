-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "AdminPermission" AS ENUM ('USERS_READ', 'USERS_WRITE', 'ORGANIZERS_REVIEW', 'CAMPAIGNS_REVIEW', 'FINANCE_READ', 'FINANCE_WRITE', 'PAYOUTS_REVIEW', 'LOTTERY_RESULTS_WRITE', 'DRAWS_REVIEW', 'SETTINGS_WRITE', 'AUDIT_READ', 'SUPPORT_WRITE', 'CONTENT_WRITE');

-- CreateEnum
CREATE TYPE "ReportEntityType" AS ENUM ('USER', 'ORGANIZER', 'CAMPAIGN', 'PAYMENT', 'DRAW', 'WINNER', 'CONTENT');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('ACCOUNT', 'CAMPAIGN', 'PAYMENT', 'PRIZE', 'FINANCE', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ContentPageType" AS ENUM ('INSTITUTIONAL', 'FAQ', 'TERMS', 'PRIVACY', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrganizerDocumentType" AS ENUM ('IDENTITY', 'ADDRESS_PROOF', 'CNPJ_DOCUMENT');

-- CreateEnum
CREATE TYPE "OrganizerPlan" AS ENUM ('BASIC', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'PAUSED', 'SOLD_OUT', 'DRAWN', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CampaignCategory" AS ENUM ('AUTOMOBILE', 'MOTORCYCLE', 'ELECTRONICS', 'CASH', 'TRAVEL', 'OTHER');

-- CreateEnum
CREATE TYPE "NumberSelectionMode" AS ENUM ('RANDOM', 'MANUAL');

-- CreateEnum
CREATE TYPE "DrawBasis" AS ENUM ('LOTERIA_FEDERAL', 'CUSTOM', 'MANUAL_RESULT');

-- CreateEnum
CREATE TYPE "CampaignPrizeType" AS ENUM ('PIX', 'PRODUCT', 'GIFT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "InstantPrizeStatus" AS ENUM ('AVAILABLE', 'FOUND', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'RESERVED', 'AWAITING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "GatewayProvider" AS ENUM ('MERCADO_PAGO', 'PAGARME', 'PAGBANK', 'STONE', 'ASAAS');

-- CreateEnum
CREATE TYPE "LotteryDrawStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'LOCKED');

-- CreateEnum
CREATE TYPE "LotterySourceType" AS ENUM ('MANUAL', 'IMPORTED', 'OFFICIAL_API', 'OFFICIAL_DOCUMENT');

-- CreateEnum
CREATE TYPE "CampaignDrawStatus" AS ENUM ('DRAFT', 'SIMULATED', 'PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "WinnerStatus" AS ENUM ('IDENTIFIED', 'PENDING_CONTACT', 'CONTACTED', 'CLAIMED', 'PAYMENT_PENDING', 'DELIVERED', 'CONFIRMED_BY_WINNER', 'NOT_CLAIMED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PrizeType" AS ENUM ('MAIN_PRIZE', 'INSTANT_PRIZE', 'SALES_BONUS', 'OTHER');

-- CreateEnum
CREATE TYPE "InstantPrizeResultStatus" AS ENUM ('IDENTIFIED', 'DELIVERED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "UnsoldNumberPolicy" AS ENUM ('NEXT_SOLD_NUMBER', 'PREVIOUS_SOLD_NUMBER', 'CLOSEST_SOLD_NUMBER', 'REDRAW_WITH_NEXT_RULE_STEP', 'NO_WINNER', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "FinancialOwnerType" AS ENUM ('ORGANIZER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "FinancialAccountStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'UNDER_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('GROSS_SALE', 'PLATFORM_FEE', 'GATEWAY_FEE', 'ORGANIZER_NET_REVENUE', 'REFUND', 'CHARGEBACK', 'PAYOUT_REQUEST', 'PAYOUT_COMPLETED', 'PAYOUT_CANCELLED', 'MANUAL_ADJUSTMENT', 'BONUS', 'MONTHLY_PLAN_FEE', 'CAMPAIGN_FEE_WAIVER', 'PLATFORM_REVENUE');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "LedgerStatus" AS ENUM ('PENDING', 'AVAILABLE', 'BLOCKED', 'COMPLETED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutDestinationType" AS ENUM ('PIX', 'BANK_ACCOUNT');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'OVERDUE', 'CANCELLED', 'WAIVED');

-- CreateEnum
CREATE TYPE "AffiliateProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AffiliateCommissionType" AS ENUM ('PERCENTAGE', 'FIXED', 'MIXED');

-- CreateEnum
CREATE TYPE "AffiliateAttributionModel" AS ENUM ('FIRST_CLICK', 'LAST_CLICK', 'COUPON', 'MANUAL');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('INVITED', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AffiliateConversionStatus" AS ENUM ('PENDING', 'APPROVED', 'AVAILABLE', 'BLOCKED', 'CANCELLED', 'REVERSED', 'PAID');

-- CreateEnum
CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AffiliateDiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "ReferralTargetType" AS ENUM ('BUYER', 'ORGANIZER');

-- CreateEnum
CREATE TYPE "ReferralRewardType" AS ENUM ('DISCOUNT', 'CREDIT', 'REDUCED_FEE', 'FREE_CAMPAIGN', 'BADGE', 'PROMOTIONAL_BENEFIT');

-- CreateEnum
CREATE TYPE "ReferralProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'QUALIFIED', 'REWARDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmContactSource" AS ENUM ('CAMPAIGN', 'PURCHASE', 'AFFILIATE', 'REFERRAL', 'MANUAL', 'IMPORT', 'SUPPORT');

-- CreateEnum
CREATE TYPE "CrmContactStatus" AS ENUM ('LEAD', 'CUSTOMER', 'VIP', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CrmInteractionType" AS ENUM ('PURCHASE', 'PAYMENT', 'CAMPAIGN_VIEW', 'FAVORITE', 'SUPPORT', 'PRIZE', 'AFFILIATE', 'MANUAL_NOTE', 'AUTOMATION', 'NOTIFICATION');

-- CreateEnum
CREATE TYPE "CrmChannel" AS ENUM ('PLATFORM', 'EMAIL', 'WHATSAPP', 'SMS', 'PHONE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SegmentType" AS ENUM ('DYNAMIC', 'STATIC');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('PURCHASE', 'PAYMENT', 'CAMPAIGN', 'DRAW', 'PRIZE', 'FINANCE', 'AFFILIATE', 'SUPPORT', 'MARKETING', 'SECURITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AutomationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('PURCHASE_APPROVED', 'PURCHASE_PENDING', 'RESERVATION_EXPIRED', 'CAMPAIGN_VIEWED', 'CAMPAIGN_FAVORITED', 'NO_PURCHASE_DAYS', 'CAMPAIGN_PERCENT_SOLD', 'DRAW_APPROACHING', 'PRIZE_WON', 'AFFILIATE_JOINED', 'SUPPORT_OPENED', 'MANUAL');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('CREATE_NOTIFICATION', 'ADD_TAG', 'REMOVE_TAG', 'CHANGE_CRM_STATUS', 'CREATE_TASK', 'QUEUE_EXTERNAL_MESSAGE');

-- CreateEnum
CREATE TYPE "AutomationAudienceType" AS ENUM ('ALL_CONTACTS', 'SEGMENT', 'CONTACT');

-- CreateEnum
CREATE TYPE "OutboundMessageStatus" AS ENUM ('DRAFT', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MarketingCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'PAUSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CrmTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MediaTemplateType" AS ENUM ('STATIC_IMAGE', 'VIDEO_FRAME', 'STORY', 'REEL', 'FEED_POST', 'WHATSAPP_STATUS', 'BANNER', 'WINNER_CARD', 'CAMPAIGN_CARD', 'INSTANT_PRIZE_CARD', 'AFFILIATE_CARD');

-- CreateEnum
CREATE TYPE "MediaFormat" AS ENUM ('SQUARE_1_1', 'PORTRAIT_4_5', 'STORY_9_16', 'LANDSCAPE_16_9', 'WHATSAPP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "MediaTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GeneratedMediaStatus" AS ENUM ('DRAFT', 'PREVIEW_READY', 'QUEUED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('ORGANIZER_LOGO', 'SORTEX_LOGO', 'CAMPAIGN_COVER', 'CAMPAIGN_GALLERY', 'WINNER_VIDEO', 'WINNER_IMAGE', 'PRIZE_IMAGE', 'BACKGROUND', 'MUSIC', 'ICON', 'DECORATION', 'QR_CODE');

-- CreateEnum
CREATE TYPE "ShareChannel" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'TELEGRAM', 'COPY_LINK', 'NATIVE_SHARE', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaRenderJobType" AS ENUM ('STATIC_IMAGE', 'VIDEO', 'THUMBNAIL', 'QR_CODE');

-- CreateEnum
CREATE TYPE "MediaRenderJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS', 'PRIVACY', 'MARKETING', 'DATA_PROCESSING');

-- CreateEnum
CREATE TYPE "DataSubjectRequestType" AS ENUM ('ACCESS', 'EXPORT', 'CORRECTION', 'DELETION', 'ANONYMIZATION', 'RESTRICTION');

-- CreateEnum
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminPermissions" "AdminPermission"[],
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAccessAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT,
    "description" TEXT,
    "regulation" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "category" "CampaignCategory" NOT NULL DEFAULT 'OTHER',
    "mainPrizeName" TEXT,
    "mainPrizeDescription" TEXT,
    "mainPrizeImage" TEXT,
    "mainPrizeQuantity" INTEGER NOT NULL DEFAULT 1,
    "cashAlternative" DECIMAL(14,2),
    "estimatedPrizeValue" DECIMAL(14,2),
    "coverImage" TEXT,
    "promotionalVideo" TEXT,
    "totalNumbers" INTEGER NOT NULL DEFAULT 10000,
    "numberPrice" DECIMAL(14,2) NOT NULL DEFAULT 0.1,
    "minimumPurchase" INTEGER NOT NULL DEFAULT 1,
    "maximumPurchasePerBuyer" INTEGER,
    "numberSelectionMode" "NumberSelectionMode" NOT NULL DEFAULT 'RANDOM',
    "drawDate" TIMESTAMP(3),
    "drawTime" TEXT,
    "drawBasis" "DrawBasis" NOT NULL DEFAULT 'LOTERIA_FEDERAL',
    "drawRuleTemplateId" TEXT,
    "customDrawRule" JSONB,
    "salesStartAt" TIMESTAMP(3),
    "salesEndAt" TIMESTAMP(3),
    "soldNumbers" INTEGER NOT NULL DEFAULT 0,
    "reservedNumbers" INTEGER NOT NULL DEFAULT 0,
    "grossRevenue" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platformFeeWaived" BOOLEAN NOT NULL DEFAULT false,
    "publishedRuleSnapshot" JSONB,
    "unsoldNumberPolicy" "UnsoldNumberPolicy" NOT NULL DEFAULT 'MANUAL_REVIEW',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "purchasesBlocked" BOOLEAN NOT NULL DEFAULT false,
    "publicationBlocked" BOOLEAN NOT NULL DEFAULT false,
    "adminReviewStatus" TEXT,
    "adminNotes" TEXT,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerFavorite" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSubjectRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicalJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerBrandProfile" (
    "organizerId" TEXT NOT NULL,
    "primaryLogoUrl" TEXT,
    "secondaryLogoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#6D28D9',
    "secondaryColor" TEXT NOT NULL DEFAULT '#111827',
    "accentColor" TEXT NOT NULL DEFAULT '#22C55E',
    "textColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "publicName" TEXT NOT NULL,
    "instagramHandle" TEXT,
    "whatsappMasked" TEXT,
    "slogan" TEXT,
    "useSortexBranding" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerBrandProfile_pkey" PRIMARY KEY ("organizerId")
);

-- CreateTable
CREATE TABLE "MediaTemplate" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "MediaTemplateType" NOT NULL,
    "format" "MediaFormat" NOT NULL,
    "category" TEXT NOT NULL,
    "status" "MediaTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "templateDefinition" JSONB NOT NULL,
    "previewImageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedMedia" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "winnerId" TEXT,
    "instantPrizeResultId" TEXT,
    "affiliateId" TEXT,
    "templateId" TEXT NOT NULL,
    "type" "MediaTemplateType" NOT NULL,
    "format" "MediaFormat" NOT NULL,
    "status" "GeneratedMediaStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "inputData" JSONB NOT NULL,
    "editorConfig" JSONB,
    "outputUrl" TEXT,
    "previewUrl" TEXT,
    "thumbnailUrl" TEXT,
    "verificationCode" TEXT,
    "qrCodeValue" TEXT,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" "MediaAssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "fileSize" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "generatedMediaId" TEXT,
    "campaignId" TEXT,
    "code" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "channel" "ShareChannel" NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueClicks" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLinkClick" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "visitorHash" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaRenderJob" (
    "id" TEXT NOT NULL,
    "generatedMediaId" TEXT NOT NULL,
    "jobType" "MediaRenderJobType" NOT NULL,
    "status" "MediaRenderJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaRenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "userId" TEXT,
    "buyerId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "source" "CrmContactSource" NOT NULL,
    "status" "CrmContactStatus" NOT NULL DEFAULT 'LEAD',
    "totalPurchases" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalTickets" INTEGER NOT NULL DEFAULT 0,
    "lastPurchaseAt" TIMESTAMP(3),
    "lastInteractionAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "externalOptOut" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTag" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContactTag" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmContactTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmNote" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmInteraction" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" "CrmInteractionType" NOT NULL,
    "channel" "CrmChannel" NOT NULL DEFAULT 'PLATFORM',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "campaignId" TEXT,
    "purchaseId" TEXT,
    "paymentId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "SegmentType" NOT NULL DEFAULT 'DYNAMIC',
    "rules" JSONB NOT NULL,
    "isDynamic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contactCount" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AutomationStatus" NOT NULL DEFAULT 'DRAFT',
    "triggerType" "AutomationTriggerType" NOT NULL,
    "triggerConfig" JSONB NOT NULL,
    "audienceType" "AutomationAudienceType" NOT NULL DEFAULT 'ALL_CONTACTS',
    "audienceConfig" JSONB NOT NULL,
    "actionType" "AutomationActionType" NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "totalRuns" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "automationId" TEXT,
    "channel" "CrmChannel" NOT NULL,
    "destinationMasked" TEXT NOT NULL,
    "templateId" TEXT,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "status" "OutboundMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageTemplate" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT,
    "name" TEXT NOT NULL,
    "channel" "CrmChannel" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "CrmChannel" NOT NULL,
    "segmentId" TEXT,
    "status" "MarketingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "totalQueued" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalFailed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmTask" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "contactId" TEXT,
    "assignedUserId" TEXT,
    "automationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CrmTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CrmTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateProgram" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "AffiliateProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "commissionType" "AffiliateCommissionType" NOT NULL,
    "commissionPercentage" DECIMAL(6,3),
    "commissionFixedAmount" DECIMAL(14,2),
    "commissionMixedPercentage" DECIMAL(6,3),
    "commissionMixedFixedAmount" DECIMAL(14,2),
    "minimumPayoutAmount" DECIMAL(14,2) NOT NULL DEFAULT 50,
    "releaseDelayDays" INTEGER NOT NULL DEFAULT 7,
    "allowSelfSignup" BOOLEAN NOT NULL DEFAULT false,
    "allowSelfReferral" BOOLEAN NOT NULL DEFAULT false,
    "cookieDurationDays" INTEGER NOT NULL DEFAULT 30,
    "attributionModel" "AffiliateAttributionModel" NOT NULL DEFAULT 'LAST_CLICK',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizerId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "document" TEXT,
    "status" "AffiliateStatus" NOT NULL DEFAULT 'INVITED',
    "referralCode" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateLink" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "campaignId" TEXT,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "uniqueClicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "affiliateLinkId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "referrer" TEXT,
    "landingPage" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "convertedAt" TIMESTAMP(3),

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateConversion" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "paymentId" TEXT,
    "buyerId" TEXT NOT NULL,
    "grossAmount" DECIMAL(14,2) NOT NULL,
    "eligibleAmount" DECIMAL(14,2) NOT NULL,
    "commissionAmount" DECIMAL(14,2) NOT NULL,
    "status" "AffiliateConversionStatus" NOT NULL DEFAULT 'PENDING',
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateConversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "AffiliateConversionStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliatePayoutRequest" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "destinationSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCoupon" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "campaignId" TEXT,
    "code" TEXT NOT NULL,
    "discountType" "AffiliateDiscountType" NOT NULL,
    "discountValue" DECIMAL(14,2) NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateMaterial" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "textContent" TEXT,
    "instructions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" "ReferralTargetType" NOT NULL,
    "rewardType" "ReferralRewardType" NOT NULL,
    "rewardValue" DECIMAL(14,2) NOT NULL,
    "status" "ReferralProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "qualifiedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignImage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignInstantPrize" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "exactNumber" TEXT,
    "generationRule" JSONB,
    "value" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "imageStorageKey" TEXT,
    "type" "CampaignPrizeType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "InstantPrizeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "foundCount" INTEGER NOT NULL DEFAULT 0,
    "winnerUserId" TEXT,
    "winnerCity" TEXT,
    "foundAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignInstantPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignPromotion" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "numberQuantity" INTEGER NOT NULL,
    "packagePrice" DECIMAL(14,2) NOT NULL,
    "discountRate" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "promotionId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "selectionMode" "NumberSelectionMode" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "affiliateCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "provider" "GatewayProvider" NOT NULL,
    "providerPaymentId" TEXT,
    "externalReference" TEXT NOT NULL,
    "activePurchaseKey" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amount" DECIMAL(14,2) NOT NULL,
    "platformFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "platformFeeRate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "gatewayFee" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gatewayFeeRate" DECIMAL(6,3) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "pixQrCode" TEXT,
    "pixQrCodeBase64" TEXT,
    "pixCopyPaste" TEXT,
    "boletoUrl" TEXT,
    "cardLastFour" TEXT,
    "cardBrand" TEXT,
    "installments" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "provider" "GatewayProvider" NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawRuleTemplate" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "ruleVersion" INTEGER NOT NULL DEFAULT 1,
    "ruleDefinition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrawRuleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryDraw" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'LOTERIA_FEDERAL',
    "lotteryName" TEXT NOT NULL DEFAULT 'Loteria Federal',
    "extractionNumber" TEXT,
    "drawDate" TIMESTAMP(3) NOT NULL,
    "drawTime" TEXT,
    "firstPrize" TEXT NOT NULL,
    "secondPrize" TEXT NOT NULL,
    "thirdPrize" TEXT NOT NULL,
    "fourthPrize" TEXT NOT NULL,
    "fifthPrize" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceDocumentHash" TEXT,
    "sourceType" "LotterySourceType" NOT NULL DEFAULT 'MANUAL',
    "status" "LotteryDrawStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "enteredByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LotteryDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignDraw" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "lotteryDrawId" TEXT,
    "ruleTemplateId" TEXT,
    "ruleSnapshot" JSONB NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "winningNumber" TEXT NOT NULL,
    "normalizedWinningNumber" TEXT NOT NULL,
    "status" "CampaignDrawStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "executedByUserId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "auditHash" TEXT NOT NULL,
    "previousAuditHash" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winner" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignDrawId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "prizeType" "PrizeType" NOT NULL,
    "prizeName" TEXT NOT NULL,
    "prizeDescription" TEXT,
    "prizeValue" DECIMAL(14,2),
    "winningNumber" TEXT NOT NULL,
    "status" "WinnerStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "notifiedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "confirmationToken" TEXT,
    "confirmationTokenExpiresAt" TIMESTAMP(3),
    "publicVerificationCode" TEXT NOT NULL,
    "publicDisplayName" TEXT,
    "publicCity" TEXT,
    "testimonialText" TEXT,
    "testimonialVideoUrl" TEXT,
    "testimonialImageUrl" TEXT,
    "publicDisclosureAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "winnerConfirmedReceipt" BOOLEAN NOT NULL DEFAULT false,
    "winnerConfirmedReceiptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Winner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstantPrizeResult" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "instantPrizeId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "winningNumber" TEXT NOT NULL,
    "status" "InstantPrizeResultStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstantPrizeResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "previousData" JSONB,
    "newData" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL,
    "ownerType" "FinancialOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "FinancialAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "availableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pendingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "blockedBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeGrossRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimePlatformFees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeGatewayFees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lifetimeNetRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "purchaseId" TEXT,
    "paymentId" TEXT,
    "payoutRequestId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "status" "LedgerStatus" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceBefore" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "availableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRequest" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "financialAccountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "fee" DECIMAL(18,2),
    "netAmount" DECIMAL(18,2) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "rejectionReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "destinationType" "PayoutDestinationType" NOT NULL,
    "destinationSnapshot" JSONB NOT NULL,
    "externalReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAdjustment" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignFinancialSummary" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "grossRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "approvedPayments" INTEGER NOT NULL DEFAULT 0,
    "pendingPayments" INTEGER NOT NULL DEFAULT 0,
    "rejectedPayments" INTEGER NOT NULL DEFAULT 0,
    "refundedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "chargebackAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "platformFees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "gatewayFees" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pendingBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignFinancialSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "plan" "OrganizerPlan" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "monthlyPrice" DECIMAL(14,2) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionInvoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "organizationName" TEXT,
    "cnpj" TEXT,
    "instagram" TEXT,
    "postalCode" TEXT,
    "address" TEXT,
    "addressNumber" TEXT,
    "addressComplement" TEXT,
    "city" TEXT,
    "state" TEXT,
    "logoStorageKey" TEXT,
    "logoOriginalName" TEXT,
    "logoMimeType" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "currentPlan" "OrganizerPlan" NOT NULL DEFAULT 'BASIC',
    "platformFee" DECIMAL(5,2) NOT NULL DEFAULT 2.9,
    "monthlyFee" DECIMAL(12,2) NOT NULL DEFAULT 29.9,
    "firstCampaignFree" BOOLEAN NOT NULL DEFAULT true,
    "platformFeeWaived" BOOLEAN NOT NULL DEFAULT false,
    "monthlyFeeWaived" BOOLEAN NOT NULL DEFAULT false,
    "customPlatformFee" DECIMAL(5,2),
    "founder" BOOLEAN NOT NULL DEFAULT false,
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "campaignsBlocked" BOOLEAN NOT NULL DEFAULT false,
    "paymentsBlocked" BOOLEAN NOT NULL DEFAULT false,
    "payoutsBlocked" BOOLEAN NOT NULL DEFAULT false,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerDocument" (
    "id" TEXT NOT NULL,
    "organizerProfileId" TEXT NOT NULL,
    "type" "OrganizerDocumentType" NOT NULL,
    "originalName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DECIMAL(14,2) NOT NULL,
    "platformFeeRate" DECIMAL(6,3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanFeature" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizerCommercialOverride" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "promotionalStartAt" TIMESTAMP(3),
    "promotionalEndAt" TIMESTAMP(3),
    "notes" TEXT,
    "campaignLimit" INTEGER,
    "ticketLimit" INTEGER,
    "enabledFeatures" JSONB,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizerCommercialOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "entityType" "ReportEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformBanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "linkUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedCampaign" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturedCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformNotice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ContentPageType" NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "assignedAdminId" TEXT,
    "category" "SupportCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "category" "NotificationCategory" NOT NULL DEFAULT 'SYSTEM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE INDEX "Campaign_organizerId_idx" ON "Campaign"("organizerId");

-- CreateIndex
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");

-- CreateIndex
CREATE INDEX "Campaign_category_idx" ON "Campaign"("category");

-- CreateIndex
CREATE INDEX "Campaign_publishedAt_idx" ON "Campaign"("publishedAt");

-- CreateIndex
CREATE INDEX "BuyerFavorite_buyerId_createdAt_idx" ON "BuyerFavorite"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "BuyerFavorite_campaignId_idx" ON "BuyerFavorite"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerFavorite_buyerId_campaignId_key" ON "BuyerFavorite"("buyerId", "campaignId");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_type_grantedAt_idx" ON "ConsentRecord"("userId", "type", "grantedAt");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_userId_status_requestedAt_idx" ON "DataSubjectRequest"("userId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "DataSubjectRequest_status_requestedAt_idx" ON "DataSubjectRequest"("status", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TechnicalJob_idempotencyKey_key" ON "TechnicalJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TechnicalJob_status_scheduledAt_idx" ON "TechnicalJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "TechnicalJob_type_status_idx" ON "TechnicalJob"("type", "status");

-- CreateIndex
CREATE INDEX "MediaTemplate_organizerId_status_category_idx" ON "MediaTemplate"("organizerId", "status", "category");

-- CreateIndex
CREATE INDEX "MediaTemplate_isSystemTemplate_status_sortOrder_idx" ON "MediaTemplate"("isSystemTemplate", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MediaTemplate_organizerId_name_format_key" ON "MediaTemplate"("organizerId", "name", "format");

-- CreateIndex
CREATE INDEX "GeneratedMedia_organizerId_status_createdAt_idx" ON "GeneratedMedia"("organizerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "GeneratedMedia_campaignId_type_idx" ON "GeneratedMedia"("campaignId", "type");

-- CreateIndex
CREATE INDEX "MediaAsset_organizerId_type_isActive_idx" ON "MediaAsset"("organizerId", "type", "isActive");

-- CreateIndex
CREATE INDEX "MediaAsset_campaignId_idx" ON "MediaAsset"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_code_key" ON "ShareLink"("code");

-- CreateIndex
CREATE INDEX "ShareLink_organizerId_channel_createdAt_idx" ON "ShareLink"("organizerId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "ShareLinkClick_shareLinkId_clickedAt_idx" ON "ShareLinkClick"("shareLinkId", "clickedAt");

-- CreateIndex
CREATE INDEX "MediaRenderJob_status_scheduledAt_idx" ON "MediaRenderJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "CrmContact_organizerId_status_updatedAt_idx" ON "CrmContact"("organizerId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "CrmContact_organizerId_email_idx" ON "CrmContact"("organizerId", "email");

-- CreateIndex
CREATE INDEX "CrmContact_organizerId_phone_idx" ON "CrmContact"("organizerId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_organizerId_userId_key" ON "CrmContact"("organizerId", "userId");

-- CreateIndex
CREATE INDEX "CrmTag_organizerId_idx" ON "CrmTag"("organizerId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmTag_organizerId_name_key" ON "CrmTag"("organizerId", "name");

-- CreateIndex
CREATE INDEX "CrmContactTag_tagId_idx" ON "CrmContactTag"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmContactTag_contactId_tagId_key" ON "CrmContactTag"("contactId", "tagId");

-- CreateIndex
CREATE INDEX "CrmNote_organizerId_contactId_createdAt_idx" ON "CrmNote"("organizerId", "contactId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmInteraction_organizerId_contactId_occurredAt_idx" ON "CrmInteraction"("organizerId", "contactId", "occurredAt");

-- CreateIndex
CREATE INDEX "CrmInteraction_campaignId_occurredAt_idx" ON "CrmInteraction"("campaignId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmInteraction_organizerId_type_purchaseId_paymentId_key" ON "CrmInteraction"("organizerId", "type", "purchaseId", "paymentId");

-- CreateIndex
CREATE INDEX "Segment_organizerId_isActive_idx" ON "Segment"("organizerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_organizerId_name_key" ON "Segment"("organizerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_category_key" ON "NotificationPreference"("userId", "category");

-- CreateIndex
CREATE INDEX "Automation_organizerId_status_triggerType_idx" ON "Automation"("organizerId", "status", "triggerType");

-- CreateIndex
CREATE INDEX "OutboundMessage_organizerId_status_scheduledAt_idx" ON "OutboundMessage"("organizerId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MessageTemplate_organizerId_isActive_idx" ON "MessageTemplate"("organizerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MessageTemplate_organizerId_name_key" ON "MessageTemplate"("organizerId", "name");

-- CreateIndex
CREATE INDEX "MarketingCampaign_organizerId_status_createdAt_idx" ON "MarketingCampaign"("organizerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CrmTask_organizerId_status_dueAt_idx" ON "CrmTask"("organizerId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "AffiliateProgram_organizerId_status_idx" ON "AffiliateProgram"("organizerId", "status");

-- CreateIndex
CREATE INDEX "AffiliateProgram_campaignId_status_idx" ON "AffiliateProgram"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_referralCode_key" ON "Affiliate"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_slug_key" ON "Affiliate"("slug");

-- CreateIndex
CREATE INDEX "Affiliate_organizerId_status_idx" ON "Affiliate"("organizerId", "status");

-- CreateIndex
CREATE INDEX "Affiliate_userId_idx" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_programId_email_key" ON "Affiliate"("programId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLink_code_key" ON "AffiliateLink"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateLink_slug_key" ON "AffiliateLink"("slug");

-- CreateIndex
CREATE INDEX "AffiliateLink_affiliateId_createdAt_idx" ON "AffiliateLink"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "AffiliateLink_campaignId_idx" ON "AffiliateLink"("campaignId");

-- CreateIndex
CREATE INDEX "AffiliateClick_visitorId_clickedAt_idx" ON "AffiliateClick"("visitorId", "clickedAt");

-- CreateIndex
CREATE INDEX "AffiliateClick_affiliateLinkId_clickedAt_idx" ON "AffiliateClick"("affiliateLinkId", "clickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateConversion_purchaseId_key" ON "AffiliateConversion"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateConversion_paymentId_key" ON "AffiliateConversion"("paymentId");

-- CreateIndex
CREATE INDEX "AffiliateConversion_affiliateId_status_idx" ON "AffiliateConversion"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "AffiliateConversion_programId_status_idx" ON "AffiliateConversion"("programId", "status");

-- CreateIndex
CREATE INDEX "AffiliateConversion_campaignId_status_idx" ON "AffiliateConversion"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCommission_conversionId_key" ON "AffiliateCommission"("conversionId");

-- CreateIndex
CREATE INDEX "AffiliateCommission_affiliateId_status_availableAt_idx" ON "AffiliateCommission"("affiliateId", "status", "availableAt");

-- CreateIndex
CREATE INDEX "AffiliatePayoutRequest_affiliateId_status_idx" ON "AffiliatePayoutRequest"("affiliateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliateCoupon_code_key" ON "AffiliateCoupon"("code");

-- CreateIndex
CREATE INDEX "AffiliateCoupon_programId_isActive_idx" ON "AffiliateCoupon"("programId", "isActive");

-- CreateIndex
CREATE INDEX "AffiliateMaterial_programId_isActive_idx" ON "AffiliateMaterial"("programId", "isActive");

-- CreateIndex
CREATE INDEX "AffiliateMaterial_campaignId_idx" ON "AffiliateMaterial"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");

-- CreateIndex
CREATE INDEX "Referral_referrerUserId_status_idx" ON "Referral"("referrerUserId", "status");

-- CreateIndex
CREATE INDEX "Referral_code_idx" ON "Referral"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_programId_referrerUserId_referredUserId_key" ON "Referral"("programId", "referrerUserId", "referredUserId");

-- CreateIndex
CREATE INDEX "CampaignImage_campaignId_sortOrder_idx" ON "CampaignImage"("campaignId", "sortOrder");

-- CreateIndex
CREATE INDEX "CampaignInstantPrize_campaignId_idx" ON "CampaignInstantPrize"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignInstantPrize_status_idx" ON "CampaignInstantPrize"("status");

-- CreateIndex
CREATE INDEX "CampaignPromotion_campaignId_sortOrder_idx" ON "CampaignPromotion"("campaignId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_idempotencyKey_key" ON "Purchase"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Purchase_buyerId_status_idx" ON "Purchase"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Purchase_campaignId_status_idx" ON "Purchase"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Purchase_expiresAt_idx" ON "Purchase"("expiresAt");

-- CreateIndex
CREATE INDEX "Ticket_purchaseId_idx" ON "Ticket"("purchaseId");

-- CreateIndex
CREATE INDEX "Ticket_buyerId_status_idx" ON "Ticket"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Ticket_campaignId_status_reservedUntil_idx" ON "Ticket"("campaignId", "status", "reservedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_campaignId_number_key" ON "Ticket"("campaignId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_externalReference_key" ON "Payment"("externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_activePurchaseKey_key" ON "Payment"("activePurchaseKey");

-- CreateIndex
CREATE INDEX "Payment_purchaseId_status_idx" ON "Payment"("purchaseId", "status");

-- CreateIndex
CREATE INDEX "Payment_buyerId_status_idx" ON "Payment"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Payment_organizerId_status_idx" ON "Payment"("organizerId", "status");

-- CreateIndex
CREATE INDEX "Payment_campaignId_status_idx" ON "Payment"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "Payment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_idx" ON "PaymentEvent"("paymentId");

-- CreateIndex
CREATE INDEX "PaymentEvent_processed_createdAt_idx" ON "PaymentEvent"("processed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "DrawRuleTemplate_organizerId_idx" ON "DrawRuleTemplate"("organizerId");

-- CreateIndex
CREATE INDEX "DrawRuleTemplate_isSystemTemplate_idx" ON "DrawRuleTemplate"("isSystemTemplate");

-- CreateIndex
CREATE UNIQUE INDEX "DrawRuleTemplate_organizerId_name_key" ON "DrawRuleTemplate"("organizerId", "name");

-- CreateIndex
CREATE INDEX "LotteryDraw_drawDate_status_idx" ON "LotteryDraw"("drawDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryDraw_lotteryName_extractionNumber_key" ON "LotteryDraw"("lotteryName", "extractionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDraw_campaignId_key" ON "CampaignDraw"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignDraw_auditHash_key" ON "CampaignDraw"("auditHash");

-- CreateIndex
CREATE INDEX "CampaignDraw_status_executedAt_idx" ON "CampaignDraw"("status", "executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Winner_ticketId_key" ON "Winner"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Winner_confirmationToken_key" ON "Winner"("confirmationToken");

-- CreateIndex
CREATE UNIQUE INDEX "Winner_publicVerificationCode_key" ON "Winner"("publicVerificationCode");

-- CreateIndex
CREATE INDEX "Winner_campaignId_status_idx" ON "Winner"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Winner_buyerId_status_idx" ON "Winner"("buyerId", "status");

-- CreateIndex
CREATE INDEX "InstantPrizeResult_campaignId_status_idx" ON "InstantPrizeResult"("campaignId", "status");

-- CreateIndex
CREATE INDEX "InstantPrizeResult_buyerId_status_idx" ON "InstantPrizeResult"("buyerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InstantPrizeResult_instantPrizeId_ticketId_key" ON "InstantPrizeResult"("instantPrizeId", "ticketId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialAccount_ownerType_status_idx" ON "FinancialAccount"("ownerType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialAccount_ownerType_ownerId_currency_key" ON "FinancialAccount"("ownerType", "ownerId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_reference_key" ON "LedgerEntry"("reference");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_createdAt_idx" ON "LedgerEntry"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_campaignId_createdAt_idx" ON "LedgerEntry"("campaignId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_paymentId_idx" ON "LedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_status_availableAt_idx" ON "LedgerEntry"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_externalReference_key" ON "PayoutRequest"("externalReference");

-- CreateIndex
CREATE INDEX "PayoutRequest_organizerId_status_idx" ON "PayoutRequest"("organizerId", "status");

-- CreateIndex
CREATE INDEX "PayoutRequest_status_requestedAt_idx" ON "PayoutRequest"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "FinancialAdjustment_accountId_createdAt_idx" ON "FinancialAdjustment"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialAdjustment_organizerId_createdAt_idx" ON "FinancialAdjustment"("organizerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignFinancialSummary_campaignId_key" ON "CampaignFinancialSummary"("campaignId");

-- CreateIndex
CREATE INDEX "CampaignFinancialSummary_organizerId_updatedAt_idx" ON "CampaignFinancialSummary"("organizerId", "updatedAt");

-- CreateIndex
CREATE INDEX "Subscription_organizerId_status_idx" ON "Subscription"("organizerId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_organizerId_status_idx" ON "SubscriptionInvoice"("organizerId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionInvoice_dueDate_status_idx" ON "SubscriptionInvoice"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerProfile_userId_key" ON "OrganizerProfile"("userId");

-- CreateIndex
CREATE INDEX "OrganizerProfile_verificationStatus_idx" ON "OrganizerProfile"("verificationStatus");

-- CreateIndex
CREATE INDEX "OrganizerProfile_currentPlan_idx" ON "OrganizerProfile"("currentPlan");

-- CreateIndex
CREATE INDEX "OrganizerDocument_organizerProfileId_idx" ON "OrganizerDocument"("organizerProfileId");

-- CreateIndex
CREATE INDEX "OrganizerDocument_type_idx" ON "OrganizerDocument"("type");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerDocument_organizerProfileId_type_key" ON "OrganizerDocument"("organizerProfileId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PlanFeature_planId_key_key" ON "PlanFeature"("planId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerCommercialOverride_organizerId_key" ON "OrganizerCommercialOverride"("organizerId");

-- CreateIndex
CREATE INDEX "Report_status_createdAt_idx" ON "Report"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_entityType_entityId_idx" ON "Report"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedCampaign_campaignId_key" ON "FeaturedCampaign"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");

-- CreateIndex
CREATE INDEX "PlatformSetting_category_idx" ON "PlatformSetting"("category");

-- CreateIndex
CREATE INDEX "SupportTicket_status_priority_createdAt_idx" ON "SupportTicket"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "SupportTicket_requesterUserId_idx" ON "SupportTicket"("requesterUserId");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_drawRuleTemplateId_fkey" FOREIGN KEY ("drawRuleTemplateId") REFERENCES "DrawRuleTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerFavorite" ADD CONSTRAINT "BuyerFavorite_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerFavorite" ADD CONSTRAINT "BuyerFavorite_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSubjectRequest" ADD CONSTRAINT "DataSubjectRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerBrandProfile" ADD CONSTRAINT "OrganizerBrandProfile_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMedia" ADD CONSTRAINT "GeneratedMedia_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMedia" ADD CONSTRAINT "GeneratedMedia_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Winner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMedia" ADD CONSTRAINT "GeneratedMedia_instantPrizeResultId_fkey" FOREIGN KEY ("instantPrizeResultId") REFERENCES "InstantPrizeResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMedia" ADD CONSTRAINT "GeneratedMedia_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedMedia" ADD CONSTRAINT "GeneratedMedia_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MediaTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_generatedMediaId_fkey" FOREIGN KEY ("generatedMediaId") REFERENCES "GeneratedMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLinkClick" ADD CONSTRAINT "ShareLinkClick_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaRenderJob" ADD CONSTRAINT "MediaRenderJob_generatedMediaId_fkey" FOREIGN KEY ("generatedMediaId") REFERENCES "GeneratedMedia"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContactTag" ADD CONSTRAINT "CrmContactTag_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContactTag" ADD CONSTRAINT "CrmContactTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CrmTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmNote" ADD CONSTRAINT "CrmNote_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmInteraction" ADD CONSTRAINT "CrmInteraction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmInteraction" ADD CONSTRAINT "CrmInteraction_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmTask" ADD CONSTRAINT "CrmTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProgram" ADD CONSTRAINT "AffiliateProgram_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateProgram" ADD CONSTRAINT "AffiliateProgram_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AffiliateProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AffiliateProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateLink" ADD CONSTRAINT "AffiliateLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_affiliateLinkId_fkey" FOREIGN KEY ("affiliateLinkId") REFERENCES "AffiliateLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AffiliateProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateConversion" ADD CONSTRAINT "AffiliateConversion_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "AffiliateConversion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliatePayoutRequest" ADD CONSTRAINT "AffiliatePayoutRequest_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCoupon" ADD CONSTRAINT "AffiliateCoupon_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCoupon" ADD CONSTRAINT "AffiliateCoupon_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AffiliateProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCoupon" ADD CONSTRAINT "AffiliateCoupon_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateMaterial" ADD CONSTRAINT "AffiliateMaterial_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AffiliateProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateMaterial" ADD CONSTRAINT "AffiliateMaterial_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignImage" ADD CONSTRAINT "CampaignImage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInstantPrize" ADD CONSTRAINT "CampaignInstantPrize_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignPromotion" ADD CONSTRAINT "CampaignPromotion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "CampaignPromotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrawRuleTemplate" ADD CONSTRAINT "DrawRuleTemplate_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryDraw" ADD CONSTRAINT "LotteryDraw_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryDraw" ADD CONSTRAINT "LotteryDraw_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDraw" ADD CONSTRAINT "CampaignDraw_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDraw" ADD CONSTRAINT "CampaignDraw_lotteryDrawId_fkey" FOREIGN KEY ("lotteryDrawId") REFERENCES "LotteryDraw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDraw" ADD CONSTRAINT "CampaignDraw_ruleTemplateId_fkey" FOREIGN KEY ("ruleTemplateId") REFERENCES "DrawRuleTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDraw" ADD CONSTRAINT "CampaignDraw_executedByUserId_fkey" FOREIGN KEY ("executedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignDraw" ADD CONSTRAINT "CampaignDraw_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_campaignDrawId_fkey" FOREIGN KEY ("campaignDrawId") REFERENCES "CampaignDraw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winner" ADD CONSTRAINT "Winner_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantPrizeResult" ADD CONSTRAINT "InstantPrizeResult_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantPrizeResult" ADD CONSTRAINT "InstantPrizeResult_instantPrizeId_fkey" FOREIGN KEY ("instantPrizeId") REFERENCES "CampaignInstantPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantPrizeResult" ADD CONSTRAINT "InstantPrizeResult_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantPrizeResult" ADD CONSTRAINT "InstantPrizeResult_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantPrizeResult" ADD CONSTRAINT "InstantPrizeResult_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "PayoutRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRequest" ADD CONSTRAINT "PayoutRequest_financialAccountId_fkey" FOREIGN KEY ("financialAccountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialAdjustment" ADD CONSTRAINT "FinancialAdjustment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignFinancialSummary" ADD CONSTRAINT "CampaignFinancialSummary_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionInvoice" ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerProfile" ADD CONSTRAINT "OrganizerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerDocument" ADD CONSTRAINT "OrganizerDocument_organizerProfileId_fkey" FOREIGN KEY ("organizerProfileId") REFERENCES "OrganizerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
