import { Injectable } from '@nestjs/common';
import { OrganizerPlan, Prisma } from '@prisma/client';
import { CommercialTermsService } from '../finance/commercial-terms.service';

type Transaction = Prisma.TransactionClient;

@Injectable()
export class PaymentFeeService {
  private readonly commercialTerms = new CommercialTermsService();
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
    return this.commercialTerms.calculate(transaction, input);
  }
}
