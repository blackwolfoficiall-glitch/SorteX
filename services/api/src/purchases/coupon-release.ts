import {
  PaymentStatus,
  Prisma,
  PromotionUsageStatus,
  PurchaseStatus,
} from '@prisma/client';

export type ClosedProviderAttempt = {
  id: string;
  providerPaymentId: string;
  status: typeof PaymentStatus.CANCELLED | typeof PaymentStatus.EXPIRED;
};

/** Call inside a serializable purchase transition. Never infer a provider closure from the clock or from old rows. */
export async function releaseUnusedCouponCapacity(
  tx: Prisma.TransactionClient,
  purchaseIds: string[],
  attempt?: ClosedProviderAttempt,
) {
  if (!purchaseIds.length) return;
  const usages = await tx.promotionUsage.findMany({
    where: {
      purchaseId: { in: purchaseIds },
      couponId: { not: null },
      status: PromotionUsageStatus.RESERVED,
    },
    select: {
      id: true,
      purchaseId: true,
      couponId: true,
      promotionId: true,
      discountAmount: true,
    },
    // Concurrent releases see counters in a stable order.
    orderBy: [{ promotionId: 'asc' }, { id: 'asc' }],
  });
  if (!usages.length) return;

  const eligible = await tx.purchase.findMany({
    where: {
      id: { in: purchaseIds },
      status: { in: [PurchaseStatus.CANCELLED, PurchaseStatus.EXPIRED] },
      payments: attempt ? { some: attempt, every: attempt } : { none: {} },
    },
    select: { id: true },
  });
  const eligibleIds = new Set(eligible.map(({ id }) => id));
  for (const usage of usages) {
    if (
      !usage.purchaseId ||
      !usage.couponId ||
      !eligibleIds.has(usage.purchaseId)
    )
      continue;
    const coupon = await tx.promotionCoupon.findUnique({
      where: { id: usage.couponId },
      select: { promotionId: true, usageCount: true },
    });
    const promotion = await tx.campaignPromotion.findUnique({
      where: { id: usage.promotionId },
      select: { usageCount: true, grantedDiscount: true },
    });
    // Missing/inconsistent legacy counters are not evidence of capacity to return.
    if (
      !coupon ||
      coupon.promotionId !== usage.promotionId ||
      coupon.usageCount < 1 ||
      !promotion ||
      promotion.usageCount < 1 ||
      !usage.discountAmount.gt(0) ||
      promotion.grantedDiscount.lt(usage.discountAmount)
    )
      continue;
    // Never lower an aggregate below the uses that must remain counted,
    // including other holds and historically confirmed/reversed sales.
    const retained = {
      id: { not: usage.id },
      promotionId: usage.promotionId,
      status: { not: PromotionUsageStatus.CANCELLED },
    } as const;
    const remaining = await tx.promotionUsage.aggregate({
      where: retained,
      _count: { _all: true },
      _sum: { discountAmount: true },
    });
    const remainingCoupon = await tx.promotionUsage.count({
      where: { ...retained, couponId: usage.couponId },
    });
    if (
      coupon.usageCount - 1 < remainingCoupon ||
      promotion.usageCount - 1 < remaining._count._all ||
      promotion.grantedDiscount
        .sub(usage.discountAmount)
        .lt(remaining._sum.discountAmount ?? 0)
    )
      continue;
    const transition = await tx.promotionUsage.updateMany({
      where: { id: usage.id, status: PromotionUsageStatus.RESERVED },
      data: { status: PromotionUsageStatus.CANCELLED },
    });
    if (!transition.count) continue;
    await tx.campaignPromotion.update({
      where: { id: usage.promotionId },
      data: {
        usageCount: { decrement: 1 },
        grantedDiscount: { decrement: usage.discountAmount },
      },
    });
    await tx.promotionCoupon.update({
      where: { id: usage.couponId },
      data: { usageCount: { decrement: 1 } },
    });
  }
}
