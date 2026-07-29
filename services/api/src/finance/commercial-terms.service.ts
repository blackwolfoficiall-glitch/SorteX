import { Injectable } from '@nestjs/common';
import { OrganizerPlan, Prisma } from '@prisma/client';

const PLAN_RATES: Record<OrganizerPlan, number> = {
  BASIC: 2.9,
  PROFESSIONAL: 2.4,
  PREMIUM: 1.9,
  ENTERPRISE: 1.9,
};
type Transaction = Prisma.TransactionClient;

@Injectable()
export class CommercialTermsService {
  async calculate(
    transaction: Transaction,
    input: {
      amount: Prisma.Decimal;
      campaignId: string;
      campaignCreatedAt: Date;
      campaignFeeWaived: boolean;
      campaignCustomRate?: Prisma.Decimal | null;
      organizerId: string;
      profile: {
        currentPlan: OrganizerPlan;
        platformFee: Prisma.Decimal;
        customPlatformFee: Prisma.Decimal | null;
        firstCampaignFree: boolean;
        platformFeeWaived: boolean;
        founder: boolean;
        vip: boolean;
      } | null;
    },
  ) {
    const profile = input.profile;
    const hasCampaignRate = input.campaignCustomRate != null;
    const firstCampaign =
      !hasCampaignRate &&
      Boolean(profile?.firstCampaignFree) &&
      (await transaction.campaign.count({
        where: {
          organizerId: input.organizerId,
          createdAt: { lt: input.campaignCreatedAt },
        },
      })) === 0;
    const waived =
      input.campaignFeeWaived ||
      (!hasCampaignRate && Boolean(profile?.platformFeeWaived)) ||
      firstCampaign;
    const configured =
      input.campaignCustomRate ??
      profile?.customPlatformFee ??
      profile?.platformFee;
    const plan = profile?.currentPlan ?? OrganizerPlan.BASIC;
    const rate = new Prisma.Decimal(
      waived ? 0 : configured == null ? PLAN_RATES[plan] : configured,
    );
    const gatewayRate = new Prisma.Decimal(
      Math.max(0, Number(process.env.MERCADO_PAGO_ESTIMATED_FEE_PERCENT || 0)),
    );
    const platformFee = input.amount.mul(rate).div(100).toDecimalPlaces(2);
    const gatewayFee = input.amount
      .mul(gatewayRate)
      .div(100)
      .toDecimalPlaces(2);
    const reason = firstCampaign
      ? 'FIRST_CAMPAIGN_FREE'
      : input.campaignFeeWaived
        ? 'CAMPAIGN_WAIVER'
        : input.campaignCustomRate != null
          ? 'CAMPAIGN_RATE'
          : profile?.platformFeeWaived
            ? 'ORGANIZER_WAIVER'
            : profile?.customPlatformFee != null
              ? 'CUSTOM_RATE'
              : 'PLAN_RATE';
    return {
      plan,
      platformFeeRate: rate,
      platformFee,
      gatewayFeeRate: gatewayRate,
      gatewayFee,
      netAmount: input.amount
        .sub(platformFee)
        .sub(gatewayFee)
        .toDecimalPlaces(2),
      firstCampaignFreeApplied: firstCampaign,
      campaignFeeWaived: waived,
      founder: profile?.founder ?? false,
      vip: profile?.vip ?? false,
      reason,
      source:
        input.campaignCustomRate != null
          ? 'CAMPAIGN'
          : profile?.customPlatformFee != null
            ? 'ORGANIZER_PROFILE'
            : waived
              ? 'COMMERCIAL_CONDITION'
              : 'PLAN',
    };
  }
}
