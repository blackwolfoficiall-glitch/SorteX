import {
  CampaignStatus,
  MiniCampaignStatus,
  UserRole,
  VerificationStatus,
  type Prisma,
} from '@prisma/client';

// Public display follows the existing PUBLISHED Mini and linked campaign
// page policy, plus the seller's main-campaign publication restrictions.
// Payment holds and sales clocks are separate from public read visibility.
export const publicMiniCampaignWhere = (
  slug: string,
): Prisma.MiniCampaignWhereInput => ({
  slug,
  status: MiniCampaignStatus.PUBLISHED,
  deletedAt: null,
  // The only result writer closes the Mini Campaign atomically. A result on a
  // still-published row is not a supported public archive state. Withhold the
  // page instead of presenting either an outcome or a reservation for it.
  result: { is: null },
  mainCampaign: {
    is: { status: CampaignStatus.PUBLISHED, publicationBlocked: false },
  },
  organizer: {
    is: {
      role: UserRole.ORGANIZER,
      isActive: true,
      organizerProfile: {
        is: {
          verificationStatus: VerificationStatus.VERIFIED,
          campaignsBlocked: false,
        },
      },
    },
  },
});

export const publicMiniCampaignSelect = {
  id: true,
  organizerId: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  prizeType: true,
  prizeDescription: true,
  maxTickets: true,
  soldTickets: true,
  ticketPrice: true,
  purchaseLimitPerBuyer: true,
  startsAt: true,
  endsAt: true,
  drawAt: true,
  rules: true,
  mainCampaign: {
    select: { id: true, title: true, slug: true, organizerId: true },
  },
  organizer: {
    select: {
      organizerBrandProfile: {
        select: {
          publicName: true,
          primaryLogoUrl: true,
          primaryColor: true,
        },
      },
    },
  },
} satisfies Prisma.MiniCampaignSelect;

type PublicMiniCampaignRow = Prisma.MiniCampaignGetPayload<{
  select: typeof publicMiniCampaignSelect;
}>;

export function projectPublicMiniCampaign(item: PublicMiniCampaignRow) {
  const brand = item.organizer.organizerBrandProfile;
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description,
    imageUrl: item.imageUrl,
    prizeType: item.prizeType,
    prizeDescription: item.prizeDescription,
    maxTickets: item.maxTickets,
    soldTickets: item.soldTickets,
    availableTickets: Math.max(0, item.maxTickets - item.soldTickets),
    ticketPrice: Number(item.ticketPrice),
    purchaseLimitPerBuyer: item.purchaseLimitPerBuyer,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    drawAt: item.drawAt,
    rules: item.rules,
    mainCampaign: {
      id: item.mainCampaign.id,
      title: item.mainCampaign.title,
      slug: item.mainCampaign.slug,
    },
    organizer: brand
      ? {
          publicName: brand.publicName,
          primaryLogoUrl: brand.primaryLogoUrl,
          primaryColor: brand.primaryColor,
        }
      : null,
    // Preserve the nullable field used by existing consumers. Finished
    // archive visibility and any outcome/winner disclosure require separate
    // approved product policy; neither is inferred from an internal result.
    result: null,
  };
}
