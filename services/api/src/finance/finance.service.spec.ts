import {
  FinancialAccountStatus,
  AdminTeamRole,
  PaymentStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import type { PrismaService } from '../prisma/prisma.service';
import type { BalanceAvailabilityService } from './balance-availability.service';
import type { StatementQueryDto } from './dto/finance.dto';
import { FinanceService } from './finance.service';

type FinancePrismaMock = {
  financialAccount: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  auditLog: { create: jest.Mock };
  payment: { aggregate: jest.Mock };
  ledgerEntry: { aggregate: jest.Mock };
  payoutRequest: { groupBy: jest.Mock };
  $transaction: jest.Mock;
};

describe('FinanceService — administração', () => {
  let prisma: FinancePrismaMock;
  let service: FinanceService;
  const admin: AuthenticatedUser = {
    id: 'admin-1',
    name: 'Admin Financeiro',
    email: 'financeiro@sortex.test',
    phone: null,
    cpf: null,
    cnpj: null,
    role: UserRole.ADMIN,
    city: null,
    state: null,
    isActive: true,
    status: UserStatus.ACTIVE,
    adminPermissions: [],
    adminTeamRole: AdminTeamRole.FINANCE,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    sessionId: 'session-1',
  };

  beforeEach(() => {
    prisma = {
      financialAccount: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      payment: { aggregate: jest.fn() },
      ledgerEntry: { aggregate: jest.fn() },
      payoutRequest: { groupBy: jest.fn() },
      $transaction: jest.fn((callback: (tx: FinancePrismaMock) => unknown) =>
        callback(prisma),
      ),
    };
    service = new FinanceService(
      prisma as unknown as PrismaService,
      { releaseDue: jest.fn() } as unknown as BalanceAvailabilityService,
    );
  });

  it('bloqueia uma conta e registra estados anterior e posterior', async () => {
    prisma.financialAccount.findUnique.mockResolvedValue({
      id: 'account-1',
      status: FinancialAccountStatus.ACTIVE,
    });
    prisma.financialAccount.update.mockResolvedValue({
      id: 'account-1',
      status: FinancialAccountStatus.BLOCKED,
    });

    await service.changeAccountStatus(
      'account-1',
      FinancialAccountStatus.BLOCKED,
      'Revisão financeira preventiva',
      admin,
    );

    expect(prisma.financialAccount.update).toHaveBeenCalledWith({
      where: { id: 'account-1' },
      data: { status: FinancialAccountStatus.BLOCKED },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'admin-1',
        actorRole: UserRole.ADMIN,
        entityType: 'FinancialAccount',
        entityId: 'account-1',
        action: 'FINANCIAL_ACCOUNT_BLOCKED',
        newData: {
          previousStatus: FinancialAccountStatus.ACTIVE,
          nextStatus: FinancialAccountStatus.BLOCKED,
          reason: 'Revisão financeira preventiva',
        },
      },
    });
  });

  it('concilia pagamentos aprovados com lançamentos brutos', async () => {
    prisma.payment.aggregate.mockResolvedValue({
      _sum: { amount: 150 },
      _count: 2,
    });
    prisma.ledgerEntry.aggregate.mockResolvedValue({
      _sum: { amount: 150 },
      _count: 2,
    });
    prisma.payoutRequest.groupBy.mockResolvedValue([]);

    const query: StatementQueryDto = { page: 1, limit: 25, sort: 'recent' };
    const result = await service.reconciliation(query);

    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: PaymentStatus.APPROVED },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        paymentTotal: 150,
        ledgerTotal: 150,
        difference: 0,
        balanced: true,
      }),
    );
  });
});
