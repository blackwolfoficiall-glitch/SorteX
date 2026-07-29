import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  NumberSelectionMode,
  Prisma,
  PurchaseStatus,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { ListNumbersDto } from './dto/list-numbers.dto';
import { ReservationExpirationService } from './reservation-expiration.service';
import { CrmSyncService } from '../crm/crm-sync.service';

const activeStatuses: PurchaseStatus[] = [
  PurchaseStatus.RESERVED,
  PurchaseStatus.AWAITING_PAYMENT,
];
const reservationSeconds = Math.max(
  60,
  Number(process.env.RESERVATION_TTL_SECONDS || 900),
);

const purchaseInclude = {
  buyer: { select: { phone: true, email: true } },
  campaign: {
    select: {
      id: true,
      slug: true,
      title: true,
      coverImage: true,
      organizerId: true,
    },
  },
  promotion: {
    select: { id: true, name: true, numberQuantity: true, packagePrice: true },
  },
  tickets: { orderBy: { number: 'asc' as const } },
} as const satisfies Prisma.PurchaseInclude;

type ReserveInput = {
  campaignId: string;
  quantity: number;
  numbers?: number[];
  promotionId?: string;
  couponCode?: string;
  idempotencyKey?: string;
  affiliateCode?: string;
  mode: NumberSelectionMode;
};

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expiration: ReservationExpirationService,
    private readonly crmSync: CrmSyncService,
  ) {}

  reserveRandom(
    user: AuthenticatedUser,
    input: Omit<ReserveInput, 'mode' | 'numbers'>,
  ) {
    return this.reserve(user, { ...input, mode: NumberSelectionMode.RANDOM });
  }

  reserveManual(
    user: AuthenticatedUser,
    input: Omit<ReserveInput, 'mode' | 'quantity'> & { numbers: number[] },
  ) {
    const numbers = [...new Set(input.numbers)];
    if (numbers.length !== input.numbers.length) {
      throw new BadRequestException('A seleção contém números repetidos.');
    }
    return this.reserve(user, {
      ...input,
      quantity: numbers.length,
      numbers,
      mode: NumberSelectionMode.MANUAL,
    });
  }

  private async reserve(user: AuthenticatedUser, input: ReserveInput) {
    this.ensureBuyer(user);
    if (input.idempotencyKey) {
      const existing = await this.prisma.purchase.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: purchaseInclude,
      });
      if (existing) {
        if (existing.buyerId !== user.id) {
          throw new ConflictException('Chave de idempotência já utilizada.');
        }
        return this.serialize(existing);
      }
    }

    const attempts = input.mode === NumberSelectionMode.RANDOM ? 4 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (transaction) => {
            await this.expiration.expireDueInTransaction(
              transaction,
              input.campaignId,
            );
            const campaign = await transaction.campaign.findUnique({
              where: { id: input.campaignId },
              include: {
                promotions: true,
                organizer: {
                  select: {
                    organizerProfile: {
                      select: {
                        paymentsBlocked: true,
                        verificationStatus: true,
                      },
                    },
                  },
                },
              },
            });
            if (!campaign)
              throw new NotFoundException('Campanha não encontrada.');
            this.validateCampaign(campaign, user);
            if (campaign.numberSelectionMode !== input.mode) {
              throw new BadRequestException(
                input.mode === NumberSelectionMode.MANUAL
                  ? 'Esta campanha utiliza escolha aleatória.'
                  : 'Esta campanha exige escolha manual.',
              );
            }
            this.validateQuantity(campaign, input.quantity);
            const pricing = await this.calculatePrice(
              transaction,
              campaign,
              input,
              user.id,
            );
            const expiresAt = new Date(Date.now() + reservationSeconds * 1000);
            const numbers =
              input.mode === NumberSelectionMode.MANUAL
                ? this.validateManualNumbers(
                    input.numbers ?? [],
                    campaign.totalNumbers,
                  )
                : await this.generateAvailableNumbers(
                    transaction,
                    campaign.id,
                    campaign.totalNumbers,
                    input.quantity,
                  );

            const purchase = await transaction.purchase.create({
              data: {
                buyerId: user.id,
                campaignId: campaign.id,
                promotionId: pricing.promotionId,
                status: PurchaseStatus.AWAITING_PAYMENT,
                selectionMode: input.mode,
                quantity: input.quantity,
                unitPrice: campaign.numberPrice,
                subtotal: pricing.subtotal,
                discount: pricing.discount,
                total: pricing.total,
                expiresAt,
                idempotencyKey: input.idempotencyKey,
                affiliateCode: input.affiliateCode?.trim().toUpperCase(),
              },
            });
            if (pricing.promotionId) {
              await transaction.promotionUsage.create({
                data: {
                  promotionId: pricing.promotionId,
                  couponId: pricing.couponId,
                  buyerId: user.id,
                  purchaseId: purchase.id,
                  grossAmount: pricing.subtotal,
                  discountAmount: pricing.discount,
                  finalAmount: pricing.total,
                  metadata: {
                    couponCode: input.couponCode?.trim().toUpperCase(),
                  },
                },
              });
              await transaction.campaignPromotion.update({
                where: { id: pricing.promotionId },
                data: {
                  usageCount: { increment: 1 },
                  grantedDiscount: { increment: pricing.discount },
                },
              });
              if (pricing.couponId)
                await transaction.promotionCoupon.update({
                  where: { id: pricing.couponId },
                  data: { usageCount: { increment: 1 } },
                });
            }
            await transaction.ticket.createMany({
              data: numbers.map((number) => ({
                purchaseId: purchase.id,
                campaignId: campaign.id,
                buyerId: user.id,
                number,
                status: TicketStatus.RESERVED,
                reservedUntil: expiresAt,
              })),
            });
            await transaction.campaign.update({
              where: { id: campaign.id },
              data: { reservedNumbers: { increment: numbers.length } },
            });
            return transaction.purchase.findUniqueOrThrow({
              where: { id: purchase.id },
              include: purchaseInclude,
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        await this.crmSync.syncReservation(this.prisma, result.id);
        return this.serialize(result);
      } catch (error) {
        if (this.isConcurrencyError(error) && attempt + 1 < attempts) continue;
        if (this.isConcurrencyError(error)) {
          throw new ConflictException(
            'Um ou mais números acabaram de ser reservados. Tente novamente.',
          );
        }
        throw error;
      }
    }
    throw new ConflictException('Não foi possível concluir a reserva.');
  }

  async current(user: AuthenticatedUser) {
    this.ensureBuyer(user);
    await this.expiration.expireDue();
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        buyerId: user.id,
        status: { in: activeStatuses },
        expiresAt: { gt: new Date() },
      },
      include: purchaseInclude,
      orderBy: { createdAt: 'desc' },
    });
    return purchase ? this.serialize(purchase) : null;
  }

  async get(id: string, user: AuthenticatedUser) {
    this.ensureBuyer(user);
    await this.expiration.expireDue();
    return this.serialize(await this.findOwned(id, user.id));
  }

  async listMine(user: AuthenticatedUser, status?: PurchaseStatus) {
    this.ensureBuyer(user);
    await this.expiration.expireDue();
    const purchases = await this.prisma.purchase.findMany({
      where: { buyerId: user.id, ...(status ? { status } : {}) },
      include: purchaseInclude,
      orderBy: { createdAt: 'desc' },
    });
    return purchases.map((purchase) => this.serialize(purchase));
  }

  async tickets(id: string, user: AuthenticatedUser) {
    this.ensureBuyer(user);
    await this.expiration.expireDue();
    const purchase = await this.findOwned(id, user.id);
    if (
      purchase.status !== PurchaseStatus.PAID ||
      purchase.buyer.email.endsWith('@temporary.sortex.local')
    )
      return [];
    return this.prisma.ticket.findMany({
      where: { purchaseId: id, buyerId: user.id },
      orderBy: { number: 'asc' },
    });
  }

  async cancel(id: string, user: AuthenticatedUser) {
    this.ensureBuyer(user);
    const result = await this.prisma.$transaction(async (transaction) => {
      await this.expiration.expireDueInTransaction(transaction);
      const purchase = await transaction.purchase.findFirst({
        where: { id, buyerId: user.id },
        include: purchaseInclude,
      });
      if (!purchase) throw new NotFoundException('Compra não encontrada.');
      if (!activeStatuses.includes(purchase.status)) {
        throw new BadRequestException('Esta reserva não pode ser cancelada.');
      }
      const released = await transaction.ticket.deleteMany({
        where: { purchaseId: id, status: TicketStatus.RESERVED },
      });
      const campaign = await transaction.campaign.findUnique({
        where: { id: purchase.campaignId },
        select: { reservedNumbers: true },
      });
      await transaction.campaign.update({
        where: { id: purchase.campaignId },
        data: {
          reservedNumbers: Math.max(
            0,
            (campaign?.reservedNumbers ?? 0) - released.count,
          ),
        },
      });
      return transaction.purchase.update({
        where: { id },
        data: { status: PurchaseStatus.CANCELLED, cancelledAt: new Date() },
        include: purchaseInclude,
      });
    });
    return this.serialize(result);
  }

  async availability(slug: string) {
    const campaign = await this.publicCampaign(slug);
    await this.expiration.expireDue(campaign.id);
    const occupied = await this.prisma.ticket.count({
      where: {
        campaignId: campaign.id,
        status: { in: [TicketStatus.RESERVED, TicketStatus.SOLD] },
      },
    });
    return {
      campaignId: campaign.id,
      totalNumbers: campaign.totalNumbers,
      availableNumbers: Math.max(0, campaign.totalNumbers - occupied),
      reservedNumbers: campaign.reservedNumbers,
      soldNumbers: campaign.soldNumbers,
      reservationSeconds,
      selectionMode: campaign.numberSelectionMode,
      minimumPurchase: campaign.minimumPurchase,
      maximumPurchasePerBuyer: campaign.maximumPurchasePerBuyer,
    };
  }

  async listNumbers(slug: string, query: ListNumbersDto) {
    const campaign = await this.publicCampaign(slug);
    await this.expiration.expireDue(campaign.id);
    if (campaign.numberSelectionMode !== NumberSelectionMode.MANUAL) {
      throw new BadRequestException(
        'Esta campanha não permite escolha manual.',
      );
    }
    const start = Math.max(0, query.rangeStart ?? 0);
    const end = Math.min(
      campaign.totalNumbers - 1,
      query.rangeEnd ?? start + 9999,
    );
    if (start > end) throw new BadRequestException('Intervalo inválido.');
    const page = query.page || 1;
    const limit = query.limit || 100;

    if (query.search !== undefined) {
      if (query.search >= campaign.totalNumbers)
        return { items: [], page: 1, limit, total: 0 };
      const ticket = await this.prisma.ticket.findUnique({
        where: {
          campaignId_number: { campaignId: campaign.id, number: query.search },
        },
      });
      const status = ticket?.status ?? TicketStatus.AVAILABLE;
      return {
        items:
          !query.status || query.status === status
            ? [{ number: query.search, status }]
            : [],
        page: 1,
        limit,
        total: 1,
      };
    }

    if (query.status && query.status !== TicketStatus.AVAILABLE) {
      const where = {
        campaignId: campaign.id,
        number: { gte: start, lte: end },
        status: query.status,
      };
      const [items, total] = await this.prisma.$transaction([
        this.prisma.ticket.findMany({
          where,
          select: { number: true, status: true },
          orderBy: { number: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.ticket.count({ where }),
      ]);
      return { items, page, limit, total };
    }

    const windowStart = start + (page - 1) * limit;
    if (windowStart > end)
      return { items: [], page, limit, total: end - start + 1 };
    const windowEnd = Math.min(end, windowStart + limit - 1);
    const occupied = await this.prisma.ticket.findMany({
      where: {
        campaignId: campaign.id,
        number: { gte: windowStart, lte: windowEnd },
      },
      select: { number: true, status: true },
    });
    const map = new Map(
      occupied.map((ticket) => [ticket.number, ticket.status]),
    );
    const items = Array.from(
      { length: windowEnd - windowStart + 1 },
      (_, index) => {
        const number = windowStart + index;
        return { number, status: map.get(number) ?? TicketStatus.AVAILABLE };
      },
    ).filter((item) => !query.status || item.status === query.status);
    return {
      items,
      page,
      limit,
      total: end - start + 1,
      rangeStart: start,
      rangeEnd: end,
    };
  }

  async promotions(slug: string) {
    const campaign = await this.publicCampaign(slug);
    const now = new Date();
    const promotions = await this.prisma.campaignPromotion.findMany({
      where: {
        campaignId: campaign.id,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
    return promotions.map((promotion) => ({
      ...promotion,
      packagePrice: Number(promotion.packagePrice),
      discountRate: Number(promotion.discountRate),
    }));
  }

  async organizerSummary(user: AuthenticatedUser) {
    if (user.role !== UserRole.ORGANIZER)
      throw new ForbiddenException('Acesso exclusivo do organizador.');
    await this.expiration.expireDue();
    const where = { campaign: { organizerId: user.id } };
    const [activeReservations, awaitingPayment, reserved, sold, latest] =
      await Promise.all([
        this.prisma.purchase.count({
          where: {
            ...where,
            status: { in: activeStatuses },
            expiresAt: { gt: new Date() },
          },
        }),
        this.prisma.purchase.count({
          where: { ...where, status: PurchaseStatus.AWAITING_PAYMENT },
        }),
        this.prisma.ticket.count({
          where: {
            campaign: { organizerId: user.id },
            status: TicketStatus.RESERVED,
          },
        }),
        this.prisma.ticket.count({
          where: {
            campaign: { organizerId: user.id },
            status: TicketStatus.SOLD,
          },
        }),
        this.prisma.purchase.findMany({
          where,
          include: {
            campaign: { select: { id: true, title: true, slug: true } },
            buyer: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);
    return {
      activeReservations,
      awaitingPayment,
      reservedNumbers: reserved,
      soldNumbers: sold,
      conversionRate: null,
      latest: latest.map((purchase) => ({
        ...purchase,
        unitPrice: Number(purchase.unitPrice),
        subtotal: Number(purchase.subtotal),
        discount: Number(purchase.discount),
        total: Number(purchase.total),
      })),
    };
  }

  private validateCampaign(
    campaign: {
      status: CampaignStatus;
      organizerId: string;
      salesStartAt: Date | null;
      salesEndAt: Date | null;
      drawDate: Date | null;
      purchasesBlocked: boolean;
      organizer?: {
        organizerProfile?: {
          paymentsBlocked: boolean;
          verificationStatus: string;
        } | null;
      };
    },
    user: AuthenticatedUser,
  ) {
    if (campaign.status !== CampaignStatus.PUBLISHED)
      throw new BadRequestException('Esta campanha não aceita compras.');
    if (campaign.purchasesBlocked)
      throw new BadRequestException(
        'As compras desta campanha estão bloqueadas.',
      );
    if (
      campaign.organizer?.organizerProfile?.paymentsBlocked ||
      campaign.organizer?.organizerProfile?.verificationStatus !== 'VERIFIED'
    )
      throw new BadRequestException(
        'As vendas deste organizador estão temporariamente bloqueadas.',
      );
    const now = new Date();
    if (campaign.salesStartAt && campaign.salesStartAt > now)
      throw new BadRequestException('As vendas ainda não começaram.');
    if (campaign.salesEndAt && campaign.salesEndAt <= now)
      throw new BadRequestException('As vendas foram encerradas.');
    if (campaign.drawDate && campaign.drawDate <= now)
      throw new BadRequestException('O sorteio desta campanha já ocorreu.');
    if (
      campaign.organizerId === user.id &&
      process.env.ALLOW_SELF_PURCHASE !== 'true'
    ) {
      throw new ForbiddenException(
        'O organizador não pode comprar na própria campanha.',
      );
    }
  }

  private validateQuantity(
    campaign: {
      totalNumbers: number;
      minimumPurchase: number;
      maximumPurchasePerBuyer: number | null;
    },
    quantity: number,
  ) {
    if (!Number.isInteger(quantity) || quantity < campaign.minimumPurchase)
      throw new BadRequestException(
        `A compra mínima é de ${campaign.minimumPurchase} títulos.`,
      );
    if (
      campaign.maximumPurchasePerBuyer &&
      quantity > campaign.maximumPurchasePerBuyer
    )
      throw new BadRequestException(
        `A compra máxima é de ${campaign.maximumPurchasePerBuyer} títulos.`,
      );
    if (quantity > campaign.totalNumbers)
      throw new BadRequestException(
        'Quantidade maior que o total da campanha.',
      );
  }

  private async calculatePrice(
    transaction: Prisma.TransactionClient,
    campaign: {
      organizerId: string;
      numberPrice: Prisma.Decimal;
      promotions: Array<{
        id: string;
        numberQuantity: number;
        packagePrice: Prisma.Decimal;
        isActive: boolean;
        startsAt: Date | null;
        endsAt: Date | null;
      }>;
    },
    input: ReserveInput,
    buyerId: string,
  ) {
    const now = new Date();
    const valid = (promotion: (typeof campaign.promotions)[number]) =>
      promotion.isActive &&
      (!promotion.startsAt || promotion.startsAt <= now) &&
      (!promotion.endsAt || promotion.endsAt > now);
    let promotion = input.promotionId
      ? campaign.promotions.find((item) => item.id === input.promotionId)
      : campaign.promotions
          .filter(
            (item) => item.numberQuantity === input.quantity && valid(item),
          )
          .sort((a, b) => Number(a.packagePrice) - Number(b.packagePrice))[0];
    if (input.promotionId && (!promotion || !valid(promotion)))
      throw new BadRequestException('Promoção inválida ou inativa.');
    if (promotion && promotion.numberQuantity !== input.quantity)
      throw new BadRequestException('A quantidade não corresponde à promoção.');
    if (promotion && !valid(promotion)) promotion = undefined;
    const subtotal = new Prisma.Decimal(campaign.numberPrice).mul(
      input.quantity,
    );
    let total = promotion
      ? new Prisma.Decimal(promotion.packagePrice)
      : subtotal;
    let couponId: string | undefined;
    if (input.couponCode) {
      const coupon = await transaction.promotionCoupon.findFirst({
        where: {
          organizerId: campaign.organizerId,
          code: input.couponCode.trim().toUpperCase(),
          isActive: true,
          promotion: {
            campaignId: input.campaignId,
            status: 'ACTIVE',
            isActive: true,
          },
        },
      });
      if (
        !coupon ||
        (coupon.startsAt && coupon.startsAt > now) ||
        (coupon.endsAt && coupon.endsAt <= now) ||
        (coupon.totalLimit && coupon.usageCount >= coupon.totalLimit)
      )
        throw new BadRequestException('Cupom inválido, expirado ou esgotado.');
      if (coupon.perBuyerLimit) {
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
      const couponDiscount =
        coupon.discountType === 'PERCENTAGE'
          ? subtotal.mul(coupon.discountValue).div(100)
          : coupon.discountValue;
      total = Prisma.Decimal.max(
        0,
        total.sub(Prisma.Decimal.min(total, couponDiscount)),
      );
      promotion = campaign.promotions.find(
        (item) => item.id === coupon.promotionId,
      );
      couponId = coupon.id;
    }
    return {
      promotionId: promotion?.id,
      couponId,
      subtotal,
      discount: subtotal.sub(total),
      total,
    };
  }

  private validateManualNumbers(numbers: number[], total: number) {
    if (numbers.some((number) => number < 0 || number >= total))
      throw new BadRequestException(
        `Os números devem estar entre 0 e ${total - 1}.`,
      );
    return numbers;
  }

  private async generateAvailableNumbers(
    transaction: Prisma.TransactionClient,
    campaignId: string,
    total: number,
    quantity: number,
  ) {
    const selected = new Set<number>();
    let rounds = 0;
    while (selected.size < quantity && rounds < 20) {
      const candidates = new Set<number>();
      const needed = quantity - selected.size;
      while (candidates.size < Math.min(total, Math.max(needed * 3, 100)))
        candidates.add(Math.floor(Math.random() * total));
      const values = [...candidates].filter((number) => !selected.has(number));
      const occupied = await transaction.ticket.findMany({
        where: { campaignId, number: { in: values } },
        select: { number: true },
      });
      const blocked = new Set(occupied.map((ticket) => ticket.number));
      for (const number of values) {
        if (!blocked.has(number)) selected.add(number);
        if (selected.size === quantity) break;
      }
      rounds += 1;
    }
    if (selected.size < quantity)
      throw new BadRequestException('Não há títulos suficientes disponíveis.');
    return [...selected];
  }

  private async findOwned(id: string, buyerId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: { id, buyerId },
      include: purchaseInclude,
    });
    if (!purchase) throw new NotFoundException('Compra não encontrada.');
    return purchase;
  }

  private async publicCampaign(slug: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { slug, status: CampaignStatus.PUBLISHED },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return campaign;
  }

  private ensureBuyer(user: AuthenticatedUser) {
    if (user.role !== UserRole.BUYER && user.role !== UserRole.ADMIN)
      throw new ForbiddenException(
        'Apenas compradores podem reservar títulos.',
      );
  }

  private isConcurrencyError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    );
  }

  private serialize<
    T extends {
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      discount: Prisma.Decimal;
      total: Prisma.Decimal;
      status: PurchaseStatus;
      tickets: unknown[];
      buyer?: { email: string };
    },
  >(purchase: T) {
    return {
      ...purchase,
      unitPrice: Number(purchase.unitPrice),
      subtotal: Number(purchase.subtotal),
      discount: Number(purchase.discount),
      total: Number(purchase.total),
      tickets:
        purchase.status === PurchaseStatus.PAID &&
        !purchase.buyer?.email?.endsWith('@temporary.sortex.local')
          ? purchase.tickets
          : [],
    };
  }
}
