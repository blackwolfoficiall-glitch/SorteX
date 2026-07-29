import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AffiliateCommissionType,
  AffiliateConversionStatus,
  AffiliateProgramStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class AffiliateCommissionService {
  calculate(
    program: {
      commissionType: AffiliateCommissionType;
      commissionPercentage: Prisma.Decimal | null;
      commissionFixedAmount: Prisma.Decimal | null;
      commissionMixedPercentage: Prisma.Decimal | null;
      commissionMixedFixedAmount: Prisma.Decimal | null;
      commissionBasis?: string;
    },
    gross: Prisma.Decimal,
    quantity: number,
  ) {
    const percentage =
      program.commissionType === AffiliateCommissionType.MIXED
        ? program.commissionMixedPercentage
        : program.commissionPercentage;
    const fixed =
      program.commissionType === AffiliateCommissionType.MIXED
        ? program.commissionMixedFixedAmount
        : program.commissionFixedAmount;
    const percentagePart = percentage
      ? gross.mul(percentage).div(100)
      : new Prisma.Decimal(0);
    const fixedMultiplier =
      program.commissionBasis === 'SALE' || program.commissionBasis === 'BUYER'
        ? 1
        : quantity;
    const fixedPart = fixed
      ? fixed.mul(fixedMultiplier)
      : new Prisma.Decimal(0);
    const amount = percentagePart.add(fixedPart).toDecimalPlaces(2);
    if (amount.gt(gross))
      throw new BadRequestException('A comissão supera o valor elegível.');
    return amount;
  }

  async recordApprovedPayment(tx: Prisma.TransactionClient, paymentId: string) {
    if (await tx.affiliateConversion.findFirst({ where: { paymentId } }))
      return { duplicate: true };
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { purchase: true },
    });
    if (
      !payment ||
      payment.status !== PaymentStatus.APPROVED ||
      !payment.purchase.affiliateCode
    )
      return { skipped: true };
    const affiliate = await tx.affiliate.findFirst({
      where: {
        referralCode: payment.purchase.affiliateCode,
        status: 'ACTIVE',
        program: {
          status: AffiliateProgramStatus.ACTIVE,
          OR: [{ campaignId: null }, { campaignId: payment.campaignId }],
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
          ],
        },
      },
      include: { program: true },
    });
    if (!affiliate) return { skipped: true };
    if (
      !affiliate.program.allowSelfReferral &&
      affiliate.userId === payment.buyerId
    )
      throw new BadRequestException('Autoindicação não permitida.');
    const amount = this.calculate(
      affiliate.program,
      payment.amount,
      payment.purchase.quantity,
    );
    const availableAt = new Date(
      (payment.approvedAt ?? new Date()).getTime() +
        affiliate.program.releaseDelayDays * 86400000,
    );
    const conversion = await tx.affiliateConversion.create({
      data: {
        affiliateId: affiliate.id,
        programId: affiliate.programId,
        campaignId: payment.campaignId,
        purchaseId: payment.purchaseId,
        paymentId: payment.id,
        buyerId: payment.buyerId,
        grossAmount: payment.amount,
        eligibleAmount: payment.amount,
        commissionAmount: amount,
        status: AffiliateConversionStatus.APPROVED,
        approvedAt: payment.approvedAt ?? new Date(),
        availableAt,
      },
    });
    await tx.affiliateCommission.create({
      data: {
        affiliateId: affiliate.id,
        conversionId: conversion.id,
        amount,
        status: AffiliateConversionStatus.APPROVED,
        availableAt,
      },
    });
    await tx.affiliateLink.updateMany({
      where: {
        affiliateId: affiliate.id,
        OR: [{ campaignId: null }, { campaignId: payment.campaignId }],
      },
      data: { conversions: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: {
        entityType: 'AffiliateConversion',
        entityId: conversion.id,
        action: 'AFFILIATE_COMMISSION_CREATED',
        newData: { paymentId, amount, availableAt },
        metadata: { actor: 'SYSTEM_WEBHOOK' },
      },
    });
    return { duplicate: false, conversionId: conversion.id };
  }

  async reversePayment(
    tx: Prisma.TransactionClient,
    paymentId: string,
    reason: 'REFUNDED' | 'CHARGEBACK',
  ) {
    const conversion = await tx.affiliateConversion.findFirst({
      where: { paymentId },
      include: { commission: true },
    });
    if (!conversion || conversion.status === AffiliateConversionStatus.REVERSED)
      return { duplicate: true };
    await tx.affiliateConversion.update({
      where: { id: conversion.id },
      data: {
        status: AffiliateConversionStatus.REVERSED,
        cancelledAt: new Date(),
      },
    });
    if (conversion.commission)
      await tx.affiliateCommission.update({
        where: { id: conversion.commission.id },
        data: { status: AffiliateConversionStatus.REVERSED },
      });
    await tx.auditLog.create({
      data: {
        entityType: 'AffiliateConversion',
        entityId: conversion.id,
        action: 'AFFILIATE_COMMISSION_REVERSED',
        newData: { paymentId, reason },
        metadata: { actor: 'SYSTEM_WEBHOOK' },
      },
    });
    return { duplicate: false };
  }
  async releaseDue(tx: Prisma.TransactionClient | any) {
    const due = await tx.affiliateCommission.findMany({
      where: {
        status: AffiliateConversionStatus.APPROVED,
        availableAt: { lte: new Date() },
      },
      select: { id: true, conversionId: true },
    });
    if (!due.length) return { released: 0 };
    await tx.affiliateCommission.updateMany({
      where: { id: { in: due.map((item: { id: string }) => item.id) } },
      data: { status: AffiliateConversionStatus.AVAILABLE },
    });
    await tx.affiliateConversion.updateMany({
      where: {
        id: {
          in: due.map((item: { conversionId: string }) => item.conversionId),
        },
      },
      data: { status: AffiliateConversionStatus.AVAILABLE },
    });
    return { released: due.length };
  }
}
