import { OrganizerPlan, Prisma } from '@prisma/client';
import { CommercialTermsService } from './commercial-terms.service';

describe('CommercialTermsService', () => {
  const service = new CommercialTermsService();
  const tx: any = { campaign: { count: jest.fn().mockResolvedValue(2) } };
  const base = {
    amount: new Prisma.Decimal(100),
    campaignId: 'c1',
    campaignCreatedAt: new Date(),
    campaignFeeWaived: false,
    organizerId: 'o1',
    profile: {
      currentPlan: OrganizerPlan.BASIC,
      platformFee: new Prisma.Decimal(2.9),
      customPlatformFee: null,
      firstCampaignFree: false,
      platformFeeWaived: false,
      founder: false,
      vip: false,
    },
  };
  beforeEach(() => {
    tx.campaign.count.mockResolvedValue(2);
    process.env.MERCADO_PAGO_ESTIMATED_FEE_PERCENT = '1';
  });
  it.each([
    [OrganizerPlan.BASIC, 2.9],
    [OrganizerPlan.PROFESSIONAL, 2.4],
    [OrganizerPlan.PREMIUM, 1.9],
  ])('aplica taxa do plano %s', async (plan, rate) => {
    const result = await service.calculate(tx, {
      ...base,
      profile: {
        ...base.profile,
        currentPlan: plan,
        platformFee: new Prisma.Decimal(rate),
      },
    });
    expect(Number(result.platformFee)).toBe(rate);
    expect(result.reason).toBe('PLAN_RATE');
  });
  it('aplica taxa personalizada', async () => {
    const result = await service.calculate(tx, {
      ...base,
      profile: { ...base.profile, customPlatformFee: new Prisma.Decimal(1.25) },
    });
    expect(Number(result.platformFee)).toBe(1.25);
    expect(result.source).toBe('ORGANIZER_PROFILE');
  });
  it('zera a primeira campanha sem zerar gateway', async () => {
    tx.campaign.count.mockResolvedValue(0);
    const result = await service.calculate(tx, {
      ...base,
      profile: { ...base.profile, firstCampaignFree: true },
    });
    expect(Number(result.platformFee)).toBe(0);
    expect(Number(result.gatewayFee)).toBe(1);
    expect(result.reason).toBe('FIRST_CAMPAIGN_FREE');
  });
  it('zera por isenção da campanha', async () => {
    const result = await service.calculate(tx, {
      ...base,
      campaignFeeWaived: true,
    });
    expect(Number(result.platformFee)).toBe(0);
    expect(result.reason).toBe('CAMPAIGN_WAIVER');
  });
});
