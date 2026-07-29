import { Injectable } from '@nestjs/common';
import {
  InstantPrizeStatus,
  NotificationCategory,
  PaymentStatus,
  Prisma,
  PurchaseStatus,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CrmSyncService } from '../crm/crm-sync.service';

type Transaction = Prisma.TransactionClient;

@Injectable()
export class ReservationExpirationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crmSync: CrmSyncService,
  ) {}

  async expireDue(campaignId?: string) {
    return this.prisma.$transaction((transaction) =>
      this.expireDueInTransaction(transaction, campaignId),
    );
  }

  async expireDueInTransaction(
    transaction: Transaction,
    campaignId?: string,
    now = new Date(),
  ) {
    const purchases = await transaction.purchase.findMany({
      where: {
        ...(campaignId ? { campaignId } : {}),
        status: {
          in: [PurchaseStatus.RESERVED, PurchaseStatus.AWAITING_PAYMENT],
        },
        expiresAt: { lte: now },
        payments: {
          none: {
            status: {
              in: [
                PaymentStatus.CREATED,
                PaymentStatus.PENDING,
                PaymentStatus.PROCESSING,
                PaymentStatus.APPROVED,
              ],
            },
          },
        },
      },
      select: {
        id: true,
        campaignId: true,
        buyerId: true,
        quantity: true,
        total: true,
        createdAt: true,
        expiresAt: true,
        buyer: {
          select: {
            name: true,
            email: true,
            phone: true,
            city: true,
            state: true,
          },
        },
        tickets: {
          where: { status: TicketStatus.RESERVED },
          select: { number: true },
        },
        campaign: {
          select: {
            title: true,
            slug: true,
            organizerId: true,
            instantPrizes: {
              where: { status: InstantPrizeStatus.AVAILABLE },
              select: {
                id: true,
                exactNumber: true,
                description: true,
                value: true,
              },
            },
          },
        },
      },
    });
    if (!purchases.length) return { expiredPurchases: 0, releasedTickets: 0 };

    const alerts = purchases.flatMap((purchase) => {
      const numbers = new Set(purchase.tickets.map((ticket) => ticket.number));
      return purchase.campaign.instantPrizes
        .filter(
          (prize) =>
            prize.exactNumber && numbers.has(Number(prize.exactNumber)),
        )
        .map((prize) => ({ purchase, prize }));
    });
    const ids = purchases.map((purchase) => purchase.id);
    const released = await transaction.ticket.deleteMany({
      where: { purchaseId: { in: ids }, status: TicketStatus.RESERVED },
    });
    await transaction.purchase.updateMany({
      where: { id: { in: ids } },
      data: { status: PurchaseStatus.EXPIRED },
    });
    for (const purchase of purchases) {
      await this.crmSync.syncExpiredReservation(transaction, purchase.id);
    }
    for (const { purchase, prize } of alerts) {
      await this.registerReturnedPrize(transaction, purchase, prize, now);
    }

    const totals = new Map<string, number>();
    for (const purchase of purchases) {
      totals.set(
        purchase.campaignId,
        (totals.get(purchase.campaignId) ?? 0) + purchase.quantity,
      );
    }
    for (const [id, quantity] of totals) {
      const campaign = await transaction.campaign.findUnique({
        where: { id },
        select: { reservedNumbers: true },
      });
      if (campaign) {
        await transaction.campaign.update({
          where: { id },
          data: {
            reservedNumbers: Math.max(0, campaign.reservedNumbers - quantity),
          },
        });
      }
    }
    return {
      expiredPurchases: purchases.length,
      releasedTickets: released.count,
      returnedInstantPrizes: alerts.length,
    };
  }

  async organizerAlerts(organizerId: string) {
    const events = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'EXPIRED_INSTANT_PRIZE',
        metadata: { path: ['organizerId'], equals: organizerId },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return events.map((event) => this.serializeEvent(event));
  }

  async markViewed(organizerId: string, id: string) {
    const event = await this.prisma.auditLog.findFirst({
      where: {
        id,
        entityType: 'EXPIRED_INSTANT_PRIZE',
        metadata: { path: ['organizerId'], equals: organizerId },
      },
    });
    if (!event) return null;
    await this.prisma.notification.updateMany({
      where: { id: `notification:${id}`, userId: organizerId },
      data: { readAt: new Date() },
    });
    return { message: 'Alerta marcado como visualizado.' };
  }

  async prizeSummary(organizerId: string, campaignId?: string) {
    const where = {
      campaign: { organizerId },
      ...(campaignId ? { campaignId } : {}),
    };
    const [total, found, available] = await Promise.all([
      this.prisma.campaignInstantPrize.count({ where }),
      this.prisma.campaignInstantPrize.count({
        where: {
          ...where,
          status: {
            in: [InstantPrizeStatus.FOUND, InstantPrizeStatus.DELIVERED],
          },
        },
      }),
      this.prisma.campaignInstantPrize.count({
        where: { ...where, status: InstantPrizeStatus.AVAILABLE },
      }),
    ]);
    return { total, found, available };
  }

  private async registerReturnedPrize(
    transaction: Transaction,
    purchase: {
      id: string;
      campaignId: string;
      buyerId: string;
      quantity: number;
      total: Prisma.Decimal;
      createdAt: Date;
      expiresAt: Date;
      buyer: {
        name: string;
        email: string;
        phone: string | null;
        city: string | null;
        state: string | null;
      };
      campaign: { title: string; slug: string; organizerId: string };
    },
    prize: {
      id: string;
      exactNumber: string | null;
      description: string;
      value: Prisma.Decimal;
    },
    expiredAt: Date,
  ) {
    const eventId = `expired-prize:${purchase.id}:${prize.id}`;
    const metadata = {
      organizerId: purchase.campaign.organizerId,
      campaignId: purchase.campaignId,
      campaignTitle: purchase.campaign.title,
      campaignSlug: purchase.campaign.slug,
      purchaseId: purchase.id,
      buyerId: purchase.buyerId,
      buyerName: purchase.buyer.name,
      buyerEmail: purchase.buyer.email,
      buyerPhone: purchase.buyer.phone,
      city: purchase.buyer.city,
      state: purchase.buyer.state,
      winningNumber: prize.exactNumber,
      prizeName: prize.description,
      prizeValue: Number(prize.value),
      quantity: purchase.quantity,
      purchaseValue: Number(purchase.total),
      reservedAt: purchase.createdAt.toISOString(),
      expiredAt: expiredAt.toISOString(),
      reason: 'RESERVATION_EXPIRED',
      status: 'AVAILABLE_AGAIN',
      responsible: 'SYSTEM',
      emailDelivery: 'PENDING_CONFIGURATION',
      pushDelivery: 'PENDING_CONFIGURATION',
    };
    await transaction.campaignInstantPrize.updateMany({
      where: { id: prize.id, status: InstantPrizeStatus.AVAILABLE },
      data: { status: InstantPrizeStatus.AVAILABLE },
    });
    await transaction.auditLog.upsert({
      where: { id: eventId },
      create: {
        id: eventId,
        entityType: 'EXPIRED_INSTANT_PRIZE',
        entityId: purchase.id,
        action: 'INSTANT_PRIZE_RETURNED_TO_STOCK',
        metadata,
      },
      update: {},
    });
    await transaction.notification.upsert({
      where: { id: `notification:${eventId}` },
      create: {
        id: `notification:${eventId}`,
        userId: purchase.campaign.organizerId,
        type: 'EXPIRED_RESERVATION_WITH_INSTANT_PRIZE',
        category: NotificationCategory.PRIZE,
        title: '⚠️ Reserva expirada continha uma cota premiada',
        message:
          'O comprador não concluiu o pagamento. A cota premiada voltou automaticamente ao estoque.',
        data: {
          ...metadata,
          buyerName: this.maskName(purchase.buyer.name),
          buyerEmail: this.maskEmail(purchase.buyer.email),
          buyerPhone: this.maskPhone(purchase.buyer.phone || ''),
        },
      },
      update: {},
    });
  }

  private serializeEvent(event: {
    id: string;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }) {
    const data = (
      event.metadata &&
      typeof event.metadata === 'object' &&
      !Array.isArray(event.metadata)
        ? event.metadata
        : {}
    ) as Record<string, unknown>;
    return {
      id: event.id,
      campaignId: data.campaignId,
      campaignTitle: data.campaignTitle,
      campaignSlug: data.campaignSlug,
      purchaseId: data.purchaseId,
      buyerName: this.maskName(String(data.buyerName || 'Comprador')),
      buyerEmail: this.maskEmail(String(data.buyerEmail || '')),
      buyerPhone: this.maskPhone(String(data.buyerPhone || '')),
      city: data.city,
      state: data.state,
      winningNumber: data.winningNumber,
      prizeName: data.prizeName,
      prizeValue: data.prizeValue,
      quantity: data.quantity,
      purchaseValue: data.purchaseValue,
      reservedAt: data.reservedAt,
      expiredAt: data.expiredAt,
      status: 'AVAILABLE_AGAIN',
      createdAt: event.createdAt,
    };
  }

  private maskName(name: string) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : parts[0];
  }
  private maskEmail(email: string) {
    const [local, domain] = email.split('@');
    return domain ? `${local.slice(0, 3)}***@${domain}` : 'Não informado';
  }
  private maskPhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10
      ? `(${digits.slice(-11, -9)}) ${digits.slice(-9, -8)}****-${digits.slice(-4)}`
      : 'Não informado';
  }
}
