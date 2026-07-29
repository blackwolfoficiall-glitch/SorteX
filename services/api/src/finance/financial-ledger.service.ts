import { ConflictException, Injectable } from '@nestjs/common';
import {
  FinancialOwnerType,
  LedgerDirection,
  LedgerEntryType,
  LedgerStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class FinancialLedgerService {
  availabilityDate(method: PaymentMethod, approvedAt: Date) {
    const key =
      method === PaymentMethod.CREDIT_CARD
        ? 'CARD'
        : method === PaymentMethod.DEBIT_CARD
          ? 'DEBIT'
          : 'PIX';
    const days = Math.max(
      0,
      Number(
        process.env[`FINANCE_${key}_AVAILABLE_DAYS`] ??
          (key === 'CARD' ? 14 : 1),
      ),
    );
    return new Date(approvedAt.getTime() + days * 86400000);
  }

  async recordApprovedPayment(tx: Prisma.TransactionClient, paymentId: string) {
    const marker = `payment:${paymentId}:organizer-net`;
    if (await tx.ledgerEntry.findUnique({ where: { reference: marker } }))
      return { duplicate: true };
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { campaign: true },
    });
    if (!payment || payment.status !== 'APPROVED')
      throw new Error('Ledger exige pagamento aprovado.');
    const availableAt = this.availabilityDate(
      payment.method,
      payment.approvedAt ?? new Date(),
    );
    const organizer = await tx.financialAccount.upsert({
      where: {
        ownerType_ownerId_currency: {
          ownerType: FinancialOwnerType.ORGANIZER,
          ownerId: payment.organizerId,
          currency: payment.currency,
        },
      },
      create: {
        ownerType: FinancialOwnerType.ORGANIZER,
        ownerId: payment.organizerId,
        currency: payment.currency,
      },
      update: {},
    });
    const platform = await tx.financialAccount.upsert({
      where: {
        ownerType_ownerId_currency: {
          ownerType: FinancialOwnerType.PLATFORM,
          ownerId: 'SORTEX',
          currency: payment.currency,
        },
      },
      create: {
        ownerType: FinancialOwnerType.PLATFORM,
        ownerId: 'SORTEX',
        currency: payment.currency,
      },
      update: {},
    });
    await this.info(
      tx,
      organizer.id,
      payment,
      LedgerEntryType.GROSS_SALE,
      LedgerDirection.CREDIT,
      payment.amount,
      'Venda bruta aprovada',
      'gross',
    );
    await this.info(
      tx,
      organizer.id,
      payment,
      LedgerEntryType.PLATFORM_FEE,
      LedgerDirection.DEBIT,
      payment.platformFee,
      'Taxa da plataforma',
      'platform-fee',
    );
    await this.info(
      tx,
      organizer.id,
      payment,
      LedgerEntryType.GATEWAY_FEE,
      LedgerDirection.DEBIT,
      payment.gatewayFee,
      'Taxa estimada do gateway',
      'gateway-fee',
    );
    await tx.ledgerEntry.create({
      data: {
        accountId: organizer.id,
        campaignId: payment.campaignId,
        purchaseId: payment.purchaseId,
        paymentId: payment.id,
        type: LedgerEntryType.ORGANIZER_NET_REVENUE,
        direction: LedgerDirection.CREDIT,
        status: LedgerStatus.PENDING,
        amount: payment.netAmount,
        balanceBefore: organizer.pendingBalance,
        balanceAfter: organizer.pendingBalance.add(payment.netAmount),
        currency: payment.currency,
        reference: marker,
        description: 'Receita líquida do organizador',
        availableAt,
        metadata: { provider: payment.provider, method: payment.method },
      },
    });
    await tx.financialAccount.update({
      where: { id: organizer.id },
      data: {
        pendingBalance: { increment: payment.netAmount },
        lifetimeGrossRevenue: { increment: payment.amount },
        lifetimePlatformFees: { increment: payment.platformFee },
        lifetimeGatewayFees: { increment: payment.gatewayFee },
        lifetimeNetRevenue: { increment: payment.netAmount },
      },
    });
    await tx.ledgerEntry.create({
      data: {
        accountId: platform.id,
        campaignId: payment.campaignId,
        purchaseId: payment.purchaseId,
        paymentId: payment.id,
        type: LedgerEntryType.PLATFORM_REVENUE,
        direction: LedgerDirection.CREDIT,
        status: LedgerStatus.PENDING,
        amount: payment.platformFee,
        balanceBefore: platform.pendingBalance,
        balanceAfter: platform.pendingBalance.add(payment.platformFee),
        currency: payment.currency,
        reference: `payment:${payment.id}:platform-revenue`,
        description: 'Receita SorteX por venda',
        availableAt,
        metadata: { planRate: payment.platformFeeRate },
      },
    });
    await tx.financialAccount.update({
      where: { id: platform.id },
      data: {
        pendingBalance: { increment: payment.platformFee },
        lifetimeGrossRevenue: { increment: payment.amount },
        lifetimeNetRevenue: { increment: payment.platformFee },
      },
    });
    await tx.campaignFinancialSummary.upsert({
      where: { campaignId: payment.campaignId },
      create: {
        campaignId: payment.campaignId,
        organizerId: payment.organizerId,
        grossRevenue: payment.amount,
        approvedPayments: 1,
        platformFees: payment.platformFee,
        gatewayFees: payment.gatewayFee,
        netRevenue: payment.netAmount,
        pendingBalance: payment.netAmount,
      },
      update: {
        grossRevenue: { increment: payment.amount },
        approvedPayments: { increment: 1 },
        platformFees: { increment: payment.platformFee },
        gatewayFees: { increment: payment.gatewayFee },
        netRevenue: { increment: payment.netAmount },
        pendingBalance: { increment: payment.netAmount },
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: 'Payment',
        entityId: payment.id,
        action: 'FINANCIAL_LEDGER_CREATED',
        metadata: { actor: 'SYSTEM_WEBHOOK' },
        newData: {
          organizerAccountId: organizer.id,
          platformAccountId: platform.id,
          amount: payment.amount,
          platformFee: payment.platformFee,
          gatewayFee: payment.gatewayFee,
          netAmount: payment.netAmount,
          availableAt,
        },
      },
    });
    return {
      duplicate: false,
      organizerAccountId: organizer.id,
      platformAccountId: platform.id,
    };
  }
  async recordReversal(
    tx: Prisma.TransactionClient,
    paymentId: string,
    status: 'REFUNDED' | 'CHARGEBACK',
  ) {
    const suffix = status === PaymentStatus.REFUNDED ? 'refund' : 'chargeback';
    const reference = `payment:${paymentId}:${suffix}`;
    if (await tx.ledgerEntry.findUnique({ where: { reference } }))
      return { duplicate: true };
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error('Pagamento não encontrado para reversão.');
    const account = await tx.financialAccount.findUnique({
      where: {
        ownerType_ownerId_currency: {
          ownerType: FinancialOwnerType.ORGANIZER,
          ownerId: payment.organizerId,
          currency: payment.currency,
        },
      },
    });
    if (!account) throw new Error('Conta financeira não encontrada.');
    const availableDebit = Prisma.Decimal.min(
      account.availableBalance,
      payment.netAmount,
    );
    const remaining = payment.netAmount.sub(availableDebit);
    const pendingDebit = Prisma.Decimal.min(account.pendingBalance, remaining);
    if (availableDebit.add(pendingDebit).lt(payment.netAmount))
      throw new ConflictException(
        'Saldo insuficiente para reversão automática; requer ajuste administrativo.',
      );
    const blocked =
      status === PaymentStatus.CHARGEBACK
        ? payment.netAmount
        : new Prisma.Decimal(0);
    await tx.financialAccount.update({
      where: { id: account.id },
      data: {
        availableBalance: { decrement: availableDebit },
        pendingBalance: { decrement: pendingDebit },
        blockedBalance: blocked.gt(0) ? { increment: blocked } : undefined,
        lifetimeNetRevenue: { decrement: payment.netAmount },
      },
    });
    await tx.ledgerEntry.create({
      data: {
        accountId: account.id,
        campaignId: payment.campaignId,
        purchaseId: payment.purchaseId,
        paymentId: payment.id,
        type:
          status === PaymentStatus.REFUNDED
            ? LedgerEntryType.REFUND
            : LedgerEntryType.CHARGEBACK,
        direction: LedgerDirection.DEBIT,
        status:
          status === PaymentStatus.CHARGEBACK
            ? LedgerStatus.BLOCKED
            : LedgerStatus.REVERSED,
        amount: payment.netAmount,
        balanceBefore: account.availableBalance.add(account.pendingBalance),
        balanceAfter: account.availableBalance
          .add(account.pendingBalance)
          .sub(payment.netAmount),
        currency: payment.currency,
        reference,
        description:
          status === PaymentStatus.REFUNDED
            ? 'Estorno do pagamento'
            : 'Valor bloqueado por chargeback',
        metadata: { availableDebit, pendingDebit },
      },
    });
    await tx.campaignFinancialSummary.updateMany({
      where: { campaignId: payment.campaignId },
      data: {
        netRevenue: { decrement: payment.netAmount },
        ...(status === PaymentStatus.REFUNDED
          ? { refundedAmount: { increment: payment.amount } }
          : { chargebackAmount: { increment: payment.amount } }),
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: 'Payment',
        entityId: payment.id,
        action: `FINANCIAL_${status}`,
        metadata: { actor: 'SYSTEM_WEBHOOK' },
        newData: {
          amount: payment.amount,
          netAmount: payment.netAmount,
          reference,
        },
      },
    });
    return { duplicate: false };
  }
  private async info(
    tx: Prisma.TransactionClient,
    accountId: string,
    payment: {
      id: string;
      campaignId: string;
      purchaseId: string;
      currency: string;
    },
    type: LedgerEntryType,
    direction: LedgerDirection,
    amount: Prisma.Decimal,
    description: string,
    suffix: string,
  ) {
    await tx.ledgerEntry.create({
      data: {
        accountId,
        campaignId: payment.campaignId,
        purchaseId: payment.purchaseId,
        paymentId: payment.id,
        type,
        direction,
        status: LedgerStatus.COMPLETED,
        amount,
        balanceBefore: 0,
        balanceAfter: 0,
        currency: payment.currency,
        reference: `payment:${payment.id}:${suffix}`,
        description,
        metadata: { informational: true },
      },
    });
  }
}
