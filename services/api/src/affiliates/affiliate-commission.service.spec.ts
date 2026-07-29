import { AffiliateCommissionType, Prisma } from '@prisma/client';
import { AffiliateCommissionService } from './affiliate-commission.service';
describe('AffiliateCommissionService', () => {
  const service = new AffiliateCommissionService();
  const base = {
    commissionPercentage: null,
    commissionFixedAmount: null,
    commissionMixedPercentage: null,
    commissionMixedFixedAmount: null,
  };
  it('calcula percentual', () =>
    expect(
      service
        .calculate(
          {
            ...base,
            commissionType: AffiliateCommissionType.PERCENTAGE,
            commissionPercentage: new Prisma.Decimal(10),
          },
          new Prisma.Decimal(100),
          1,
        )
        .toString(),
    ).toBe('10'));
  it('calcula fixa por título', () =>
    expect(
      service
        .calculate(
          {
            ...base,
            commissionType: AffiliateCommissionType.FIXED,
            commissionFixedAmount: new Prisma.Decimal('.1'),
          },
          new Prisma.Decimal(100),
          900,
        )
        .toString(),
    ).toBe('90'));
  it('calcula mista', () =>
    expect(
      service
        .calculate(
          {
            ...base,
            commissionType: AffiliateCommissionType.MIXED,
            commissionMixedPercentage: new Prisma.Decimal(5),
            commissionMixedFixedAmount: new Prisma.Decimal('.1'),
          },
          new Prisma.Decimal(100),
          100,
        )
        .toString(),
    ).toBe('15'));
  it('rejeita comissão maior que a venda', () =>
    expect(() =>
      service.calculate(
        {
          ...base,
          commissionType: AffiliateCommissionType.FIXED,
          commissionFixedAmount: new Prisma.Decimal(2),
        },
        new Prisma.Decimal(10),
        10,
      ),
    ).toThrow());
});
