import {
  FinancialOwnerType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { FinancialLedgerService } from './financial-ledger.service';

describe('FinancialLedgerService', () => {
  const service = new FinancialLedgerService();
  let tx: any;
  const payment = {
    id: 'pay1',
    purchaseId: 'buy1',
    campaignId: 'camp1',
    organizerId: 'org1',
    currency: 'BRL',
    method: PaymentMethod.PIX,
    status: PaymentStatus.APPROVED,
    amount: new Prisma.Decimal(100),
    platformFee: new Prisma.Decimal(2.4),
    platformFeeRate: new Prisma.Decimal(2.4),
    gatewayFee: new Prisma.Decimal(0.99),
    netAmount: new Prisma.Decimal(96.61),
    approvedAt: new Date('2026-07-10'),
    provider: 'MERCADO_PAGO',
    campaign: {},
  };
  beforeEach(() => {
    tx = {
      ledgerEntry: { findUnique: jest.fn(), create: jest.fn() },
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      financialAccount: {
        upsert: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve({
            id:
              where.ownerType_ownerId_currency.ownerType ===
              FinancialOwnerType.PLATFORM
                ? 'platform'
                : 'organizer',
            pendingBalance: new Prisma.Decimal(0),
          }),
        ),
        update: jest.fn(),
      },
      campaignFinancialSummary: { upsert: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    process.env.FINANCE_PIX_AVAILABLE_DAYS = '1';
  });
  it('cria cinco lançamentos e atualiza as duas contas', async () => {
    const result = await service.recordApprovedPayment(tx, 'pay1');
    expect(result.duplicate).toBe(false);
    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(5);
    expect(tx.financialAccount.update).toHaveBeenCalledTimes(2);
    expect(tx.campaignFinancialSummary.upsert).toHaveBeenCalledTimes(1);
  });
  it('é idempotente pela referência líquida', async () => {
    tx.ledgerEntry.findUnique.mockResolvedValue({ id: 'existing' });
    expect(await service.recordApprovedPayment(tx, 'pay1')).toEqual({
      duplicate: true,
    });
    expect(tx.payment.findUnique).not.toHaveBeenCalled();
  });
  it('recusa pagamento não aprovado', async () => {
    tx.payment.findUnique.mockResolvedValue({
      ...payment,
      status: PaymentStatus.PENDING,
    });
    await expect(service.recordApprovedPayment(tx, 'pay1')).rejects.toThrow(
      'Ledger exige pagamento aprovado',
    );
  });
  it('separa bruto, taxas e líquido', async () => {
    await service.recordApprovedPayment(tx, 'pay1');
    const payloads = tx.ledgerEntry.create.mock.calls.map(
      (c: any) => c[0].data,
    );
    expect(payloads.map((p: any) => Number(p.amount))).toEqual([
      100, 2.4, 0.99, 96.61, 2.4,
    ]);
  });
  it('define disponibilidade configurável por método', () => {
    expect(
      service
        .availabilityDate(PaymentMethod.PIX, new Date('2026-07-10T00:00:00Z'))
        .toISOString(),
    ).toBe('2026-07-11T00:00:00.000Z');
    process.env.FINANCE_CARD_AVAILABLE_DAYS = '30';
    expect(
      service
        .availabilityDate(
          PaymentMethod.CREDIT_CARD,
          new Date('2026-07-10T00:00:00Z'),
        )
        .toISOString(),
    ).toBe('2026-08-09T00:00:00.000Z');
  });
});
