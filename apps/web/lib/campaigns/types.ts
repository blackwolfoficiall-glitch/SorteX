export type CampaignStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "PAUSED"
  | "SOLD_OUT"
  | "DRAWN"
  | "FINISHED"
  | "CANCELLED";
export type CampaignCategory =
  "AUTOMOBILE" | "MOTORCYCLE" | "ELECTRONICS" | "CASH" | "TRAVEL" | "OTHER";
export type NumberSelectionMode = "RANDOM" | "MANUAL";
export type DrawBasis = "LOTERIA_FEDERAL" | "CUSTOM" | "MANUAL_RESULT";
export type CampaignPrizeType = "PIX" | "PRODUCT" | "GIFT_CARD" | "OTHER";

export type CampaignPromotionInput = {
  name: string;
  numberQuantity: number;
  packagePrice: number;
  isPopular?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  startsAt?: string;
  endsAt?: string;
};

export type CampaignInstantPrizeInput = {
  exactNumber?: string;
  generationRule?: Record<string, unknown>;
  value: number;
  description: string;
  type: CampaignPrizeType;
  quantity: number;
};

export type CampaignMilestoneInput = {
  name: string;
  description?: string;
  imageUrl?: string;
  imageCrop?: CampaignImageCrop;
  videoUrl?: string;
  estimatedValue?: number;
  percentage: number;
  scheduledAt?: string;
  notes?: string;
};

export type CampaignImageViewport = { x: number; y: number; zoom: number };
export type CampaignImageCrop = {
  desktop: CampaignImageViewport;
  mobile: CampaignImageViewport;
};

export type CampaignTitleSegment = {
  text: string;
  color: string;
  order: number;
};
export type RewardSection =
  | "INSTANT_WIN"
  | "MILESTONES"
  | "ROULETTE";

export type CampaignMilestone = CampaignMilestoneInput & {
  id: string;
  status: "WAITING" | "RELEASED" | "DRAWN" | "COMPLETED";
  reachedAt: string | null;
  drawnAt: string | null;
  eligibleTicketCount: number | null;
  winner: {
    name: string;
    city: string | null;
    number: string;
  } | null;
};

export type RouletteRuleInput = { id: string; minQuantity: number; rounds: number };
export type RouletteItemInput = { id: string; name: string; type: string; imageUrl?: string; quantity: number; probability: number; isActive: boolean };
export type RouletteConfigInput = {
  enabled: boolean;
  name: string;
  description?: string;
  imageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  rules: RouletteRuleInput[];
  items: RouletteItemInput[];
};

export type CampaignDraft = {
  showParticipants?: boolean;
  titleDisplayMode?: "SIMPLE" | "HIGHLIGHT";
  titleColorMode?: "WHITE" | "BLACK" | "BLUE" | "AUTO" | "CUSTOM";
  customTitleColor?: string;
  titleCompositionMode?: "SINGLE" | "SEGMENTS";
  titleSegments?: CampaignTitleSegment[];
  rewardSectionsOrder?: RewardSection[];
  accentColorMode?: "BLUE" | "GREEN" | "RED" | "PURPLE" | "PINK" | "ORANGE" | "YELLOW" | "BLACK" | "CUSTOM";
  customAccentColor?: string;
  popularQuickQuantity?: 50 | 100 | 250 | 500 | 1000 | 2000;
  title?: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  regulation?: string;
  category?: CampaignCategory;
  mainPrizeName?: string;
  mainPrizeDescription?: string;
  mainPrizeQuantity?: number;
  cashAlternative?: number;
  estimatedPrizeValue?: number;
  totalNumbers?: number;
  numberPrice?: number;
  minimumPurchase?: number;
  maximumPurchasePerBuyer?: number;
  numberSelectionMode?: NumberSelectionMode;
  drawDate?: string;
  drawTime?: string;
  drawBasis?: DrawBasis;
  drawRuleTemplateId?: string;
  customDrawRule?: Record<string, unknown>;
  customization?: Record<string, unknown>;
  salesStartAt?: string;
  salesEndAt?: string;
  instantPrizes?: CampaignInstantPrizeInput[];
  promotions?: CampaignPromotionInput[];
  milestones?: CampaignMilestoneInput[];
  milestoneWinnersRemainEligible?: boolean;
};

type RequiredCampaignField =
  | "title"
  | "category"
  | "totalNumbers"
  | "numberPrice"
  | "minimumPurchase"
  | "numberSelectionMode"
  | "drawBasis";

export type Campaign = Required<Pick<CampaignDraft, RequiredCampaignField>> &
  Omit<
    CampaignDraft,
    RequiredCampaignField | "promotions" | "instantPrizes"
  > & {
    id: string;
    organizerId: string;
    slug: string;
    status: CampaignStatus;
    isFeatured?: boolean;
    coverImageUrl: string | null;
    promotionalVideoUrl: string | null;
    mainPrizeImageUrl: string | null;
    soldNumbers: number;
    reservedNumbers: number;
    grossRevenue: number;
    participantsCount?: number;
    showParticipants?: boolean;
    titleDisplayMode?: "SIMPLE" | "HIGHLIGHT";
    titleColorMode?: "WHITE" | "BLACK" | "BLUE" | "AUTO" | "CUSTOM";
    customTitleColor?: string;
    titleCompositionMode?: "SINGLE" | "SEGMENTS";
    titleSegments?: CampaignTitleSegment[];
    rewardSectionsOrder?: RewardSection[];
    accentColorMode?: "BLUE" | "GREEN" | "RED" | "PURPLE" | "PINK" | "ORANGE" | "YELLOW" | "BLACK" | "CUSTOM";
    customAccentColor?: string;
    popularQuickQuantity?: 50 | 100 | 250 | 500 | 1000 | 2000;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    customization?: { useOrganizerDefaults:boolean; configuration:Record<string,unknown> } | null;
    galleryImages: Array<{
      id: string;
      originalName: string;
      url: string;
      sortOrder: number;
    }>;
    instantPrizes: Array<
      CampaignInstantPrizeInput & {
        id: string;
        status: string;
        foundCount: number;
        winnerCity: string | null;
        foundAt: string | null;
        imageUrl: string | null;
      }
    >;
    promotions: Array<
      CampaignPromotionInput & { id: string; discountRate: number }
    >;
    milestonePrizes: CampaignMilestone[];
    drawRuleTemplate: DrawRuleTemplate | null;
    affiliateProgramActive?: boolean;
    organizer: {
      id: string;
      name: string;
      verified: boolean;
      logoUrl: string | null;
      slogan: string | null;
      brand?: { publicName: string; primaryColor: string; secondaryColor: string; accentColor: string; textColor?: string; buttonColor: string; progressColor: string; backgroundColor: string; cardColor: string; themeMode: string; layoutStyle: string; appearanceConfig?: Record<string, unknown> | null } | null;
      socialLinks?: Array<{ id: string; type: string; label: string | null; url: string; sortOrder: number }>;
      communities?: Array<{ id: string; type: string; name: string; url: string; sortOrder: number }>;
      platformFee: number;
    };
  };

export type DrawRuleDigit = { prize: number; position: number; order: number };
export type DrawRuleTemplate = {
  id: string;
  name: string;
  description: string;
  isSystemTemplate: boolean;
  organizerId: string | null;
  ruleDefinition: { digits: DrawRuleDigit[] };
};
export type DrawRuleSimulation = {
  prizes: Array<{ prize: number; number: string }>;
  selected: Array<DrawRuleDigit & { value: string }>;
  finalNumber: string;
};
