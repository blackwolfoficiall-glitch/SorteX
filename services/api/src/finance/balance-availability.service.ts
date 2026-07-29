import { Injectable } from '@nestjs/common';
import { LedgerStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BalanceAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}
  async releaseDue(accountId?: string) {
    const due = await this.prisma.ledgerEntry.findMany({
      where: {
        status: LedgerStatus.PENDING,
        availableAt: { lte: new Date() },
        ...(accountId ? { accountId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });
    let released = 0;
    for (const entry of due) {
      await this.prisma.$transaction(
        async (tx) => {
          const claimed = await tx.ledgerEntry.updateMany({
            where: { id: entry.id, status: LedgerStatus.PENDING },
            data: { status: LedgerStatus.AVAILABLE },
          });
          if (!claimed.count) return;
          const account = await tx.financialAccount.findUniqueOrThrow({
            where: { id: entry.accountId },
          });
          if (account.pendingBalance.lt(entry.amount))
            throw new Error('Saldo pendente inconsistente.');
          await tx.financialAccount.update({
            where: { id: entry.accountId },
            data: {
              pendingBalance: { decrement: entry.amount },
              availableBalance: { increment: entry.amount },
            },
          });
          if (entry.campaignId)
            await tx.campaignFinancialSummary.updateMany({
              where: { campaignId: entry.campaignId },
              data: {
                pendingBalance: { decrement: entry.amount },
                availableBalance: { increment: entry.amount },
              },
            });
          await tx.auditLog.create({
            data: {
              entityType: 'LedgerEntry',
              entityId: entry.id,
              action: 'BALANCE_RELEASED',
              metadata: { actor: 'SYSTEM_BALANCE_RELEASE' },
              newData: { amount: entry.amount, accountId: entry.accountId },
            },
          });
          released++;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    }
    return { released };
  }
}
