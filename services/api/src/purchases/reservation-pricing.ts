import { BadRequestException } from '@nestjs/common';
import {
  Prisma,
  PromotionStatus,
  PromotionType,
  type CampaignPromotion,
} from '@prisma/client';

type Promotion = Pick<
  CampaignPromotion,
  | 'id'
  | 'type'
  | 'status'
  | 'isActive'
  | 'deletedAt'
  | 'startsAt'
  | 'endsAt'
  | 'numberQuantity'
  | 'packagePrice'
  | 'totalLimit'
  | 'usageCount'
>;

export function eligiblePromotion(promotion: Promotion, now: Date) {
  return (
    promotion.status === PromotionStatus.ACTIVE &&
    promotion.isActive &&
    !promotion.deletedAt &&
    (!promotion.startsAt || promotion.startsAt <= now) &&
    (!promotion.endsAt || promotion.endsAt > now) &&
    (promotion.totalLimit == null ||
      promotion.usageCount < promotion.totalLimit)
  );
}

export async function reservationPricing(
  transaction: Pick<
    Prisma.TransactionClient,
    'promotionCoupon' | 'promotionUsage'
  >,
  campaign: {
    organizerId: string;
    numberPrice: Prisma.Decimal;
    promotions: Promotion[];
  },
  input: {
    campaignId: string;
    quantity: number;
    promotionId?: string;
    couponCode?: string;
  },
  buyerId?: string,
  now = new Date(),
) {
  const subtotal = campaign.numberPrice.mul(input.quantity).toDecimalPlaces(2);
  const packages = campaign.promotions.filter(
    (item) =>
      item.type === PromotionType.PACKAGE &&
      item.numberQuantity === input.quantity &&
      eligiblePromotion(item, now) &&
      item.packagePrice.gt(0) &&
      item.packagePrice.lte(subtotal),
  );
  const bundle = input.promotionId
    ? packages.find((item) => item.id === input.promotionId)
    : packages.sort((a, b) => a.packagePrice.cmp(b.packagePrice))[0];
  if (input.promotionId && !bundle)
    throw new BadRequestException(
      'Pacote promocional inválido para esta quantidade.',
    );

  let total = bundle ? bundle.packagePrice : subtotal;
  let promotionId = bundle?.id;
  let couponId: string | undefined;
  if (input.couponCode) {
    const coupon = await transaction.promotionCoupon.findFirst({
      where: {
        organizerId: campaign.organizerId,
        code: input.couponCode.trim().toUpperCase(),
        isActive: true,
        promotion: {
          campaignId: input.campaignId,
          type: PromotionType.COUPON,
        },
      },
      include: { promotion: true },
    });
    if (
      !coupon ||
      !eligiblePromotion(coupon.promotion, now) ||
      (coupon.startsAt && coupon.startsAt > now) ||
      (coupon.endsAt && coupon.endsAt <= now) ||
      (coupon.totalLimit != null && coupon.usageCount >= coupon.totalLimit)
    )
      throw new BadRequestException('Cupom inválido, expirado ou esgotado.');
    if (buyerId && coupon.perBuyerLimit != null) {
      const used = await transaction.promotionUsage.count({
        where: {
          couponId: coupon.id,
          buyerId,
          status: { in: ['RESERVED', 'APPROVED'] },
        },
      });
      if (used >= coupon.perBuyerLimit)
        throw new BadRequestException(
          'Você já atingiu o limite de uso deste cupom.',
        );
    }
    if (subtotal.lt(coupon.minimumAmount))
      throw new BadRequestException(
        'Esta compra não atingiu o valor mínimo do cupom.',
      );
    const couponDiscount = (
      coupon.discountType === 'PERCENTAGE'
        ? subtotal.mul(coupon.discountValue).div(100)
        : coupon.discountValue
    ).toDecimalPlaces(2);
    if (!couponDiscount.gt(0))
      throw new BadRequestException(
        'O cupom não gera desconto para esta compra.',
      );
    // No free-order settlement path exists. Reject rather than asking the
    // provider to create an invalid zero-value charge or claiming payment.
    if (couponDiscount.gte(total))
      throw new BadRequestException('O cupom precisa deixar um valor a pagar.');
    total = total.sub(couponDiscount);
    promotionId = coupon.promotionId;
    couponId = coupon.id;
  }

  return {
    promotionId,
    couponId,
    subtotal,
    discount: subtotal.sub(total),
    total,
  };
}
