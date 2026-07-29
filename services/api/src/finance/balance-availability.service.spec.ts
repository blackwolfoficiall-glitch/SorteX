import { LedgerStatus, Prisma } from '@prisma/client';
import { BalanceAvailabilityService } from './balance-availability.service';

describe('BalanceAvailabilityService', () => {
  it('libera saldo pendente uma única vez', async () => {
    const entry = {
      id: 'e1',
      accountId: 'a1',
      campaignId: 'c1',
      amount: new Prisma.Decimal(50),
      status: LedgerStatus.PENDING,
    };
    const tx: any = {
      ledgerEntry: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      financialAccount: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ pendingBalance: new Prisma.Decimal(50) }),
        update: jest.fn(),
      },
      campaignFinancialSummary: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma: any = {
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([entry]) },
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    const result = await new BalanceAvailabilityService(prisma).releaseDue(
      'a1',
    );
    expect(result.released).toBe(1);
    expect(tx.financialAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          pendingBalance: { decrement: entry.amount },
          availableBalance: { increment: entry.amount },
        },
      }),
    );
  });
  it('ignora lançamento já processado por concorrência', async () => {
    const tx: any = {
      ledgerEntry: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma: any = {
      ledgerEntry: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'e1', accountId: 'a1', amount: new Prisma.Decimal(10) },
          ]),
      },
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    expect(await new BalanceAvailabilityService(prisma).releaseDue()).toEqual({
      released: 0,
    });
  });
  it('recusa inconsistência que deixaria pendente negativo', async () => {
    const entry = { id: 'e1', accountId: 'a1', amount: new Prisma.Decimal(50) };
    const tx: any = {
      ledgerEntry: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      financialAccount: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ pendingBalance: new Prisma.Decimal(5) }),
      },
    };
    const prisma: any = {
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([entry]) },
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    await expect(
      new BalanceAvailabilityService(prisma).releaseDue(),
    ).rejects.toThrow('Saldo pendente inconsistente');
  });
});
