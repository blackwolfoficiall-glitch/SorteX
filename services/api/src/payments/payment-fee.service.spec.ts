/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call */
import { OrganizerPlan, Prisma } from '@prisma/client';
import { PaymentFeeService } from './payment-fee.service';

describe('PaymentFeeService', () => {
  const service = new PaymentFeeService();
  const transaction: any = { campaign: { count: jest.fn() } };
  const profile = {
    currentPlan: OrganizerPlan.BASIC,
    platformFee: new Prisma.Decimal(2.9),
    customPlatformFee: null,
    firstCampaignFree: false,
    platformFeeWaived: false,
    founder: false,
    vip: false,
  };
  const input = {
    amount: new Prisma.Decimal(100),
    campaignId: 'campaign-1',
    campaignCreatedAt: new Date(),
    campaignFeeWaived: false,
    organizerId: 'organizer-1',
    profile,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MERCADO_PAGO_ESTIMATED_FEE_PERCENT = '1';
  });

  it('calcula separadamente taxa SorteX e taxa estimada do gateway', async () => {
    const result = await service.calculate(transaction, input);
    expect(Number(result.platformFee)).toBe(2.9);
    expect(Number(result.gatewayFee)).toBe(1);
    expect(Number(result.netAmount)).toBe(96.1);
  });

  it('zera a taxa SorteX na primeira campanha sem cobrir o gateway', async () => {
    transaction.campaign.count.mockResolvedValue(0);
    const result = await service.calculate(transaction, {
      ...input,
      profile: { ...profile, firstCampaignFree: true },
    });
    expect(Number(result.platformFee)).toBe(0);
    expect(Number(result.gatewayFee)).toBe(1);
    expect(result.firstCampaignFreeApplied).toBe(true);
  });

  it('respeita taxa personalizada do organizador', async () => {
    const result = await service.calculate(transaction, {
      ...input,
      profile: { ...profile, customPlatformFee: new Prisma.Decimal(1.5) },
    });
    expect(Number(result.platformFeeRate)).toBe(1.5);
    expect(Number(result.platformFee)).toBe(1.5);
  });

  it('respeita isenção específica da campanha', async () => {
    const result = await service.calculate(transaction, {
      ...input,
      campaignFeeWaived: true,
    });
    expect(Number(result.platformFee)).toBe(0);
  });
});
