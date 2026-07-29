import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  InstantPrizeStatus,
  Prisma,
  PurchaseStatus,
  TicketStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateInstantPrizeDto,
  PrizeTicketQueryDto,
  UpdateInstantPrizeDto,
} from './dto/draw.dto';

@Injectable()
export class InstantPrizeDetectionService {
  constructor(private readonly prisma: PrismaService) {}
  async detectForPurchase(purchaseId: string) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: {
          tickets: true,
          buyer: { select: { city: true } },
          campaign: { include: { instantPrizes: true } },
        },
      });
      if (!purchase) return [];
      const sold = purchase.tickets.filter(
        (t) => t.status === TicketStatus.SOLD,
      );
      const found: unknown[] = [];
      for (const prize of purchase.campaign.instantPrizes) {
        if (!prize.exactNumber || prize.status === InstantPrizeStatus.CANCELLED)
          continue;
        const ticket = sold.find((t) => t.number === Number(prize.exactNumber));
        if (!ticket) continue;
        const existing = await tx.instantPrizeResult.findUnique({
          where: {
            instantPrizeId_ticketId: {
              instantPrizeId: prize.id,
              ticketId: ticket.id,
            },
          },
        });
        if (existing) {
          found.push(existing);
          continue;
        }
        const result = await tx.instantPrizeResult.create({
          data: {
            campaignId: purchase.campaignId,
            instantPrizeId: prize.id,
            ticketId: ticket.id,
            purchaseId: purchase.id,
            buyerId: purchase.buyerId,
            winningNumber: prize.exactNumber,
          },
        });
        found.push(result);
        await tx.campaignInstantPrize
          .update({
            where: { id: prize.id },
            data: {
              status: InstantPrizeStatus.FOUND,
              foundCount: { increment: 1 },
              winnerUserId: purchase.buyerId,
              winnerCity: purchase.buyer.city,
              foundAt: new Date(),
            },
          })
          .catch((error: unknown) => {
            if (
              error instanceof Prisma.PrismaClientKnownRequestError &&
              error.code === 'P2002'
            )
              return;
            throw error;
          });
      }
      return found;
    });
  }
  organizerResults(campaignId: string, organizerId: string) {
    return this.prisma.instantPrizeResult.findMany({
      where: { campaignId, campaign: { organizerId } },
      include: {
        instantPrize: true,
        ticket: true,
        buyer: {
          select: {
            id: true,
            name: true,
            city: true,
            state: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: { identifiedAt: 'desc' },
    });
  }
  async organizerPrizeTickets(
    organizerId: string,
    query: PrizeTicketQueryDto = new PrizeTicketQueryDto(),
  ) {
    const rows = await this.organizerPrizeTicketRows(
      organizerId,
      query.campaignId,
    );
    const search = query.search?.trim();
    const status = query.status?.toLowerCase();
    const start = query.startDate ? new Date(query.startDate) : null;
    const end = query.endDate ? new Date(query.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    const filtered = rows.filter((item) => {
      const matchesStatus =
        !status ||
        status === 'all' ||
        (status === 'available' &&
          item.status === InstantPrizeStatus.AVAILABLE &&
          !item.reservation) ||
        (status === 'reserved' && Boolean(item.reservation)) ||
        (status === 'found' && item.status === InstantPrizeStatus.FOUND) ||
        (status === 'paused' && item.status === InstantPrizeStatus.CANCELLED) ||
        (status === 'delivered' &&
          item.status === InstantPrizeStatus.DELIVERED);
      return (
        matchesStatus &&
        (!query.type || item.type === query.type) &&
        (!search ||
          item.exactNumber?.includes(search) ||
          item.description.toLowerCase().includes(search.toLowerCase())) &&
        (!start || item.createdAt >= start) &&
        (!end || item.createdAt <= end)
      );
    });
    filtered.sort((a, b) =>
      query.sort === 'oldest'
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : query.sort === 'number'
          ? Number(a.exactNumber ?? 0) - Number(b.exactNumber ?? 0)
          : b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const page = query.page || 1;
    const limit = query.limit || 25;
    return {
      items: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      pages: Math.max(1, Math.ceil(filtered.length / limit)),
    };
  }

  async organizerPrizeTicketSummary(organizerId: string, campaignId?: string) {
    const rows = await this.organizerPrizeTicketRows(organizerId, campaignId);
    const expired = await this.prisma.auditLog.count({
      where: {
        entityType: 'EXPIRED_INSTANT_PRIZE',
        AND: [
          { metadata: { path: ['organizerId'], equals: organizerId } },
          ...(campaignId
            ? [{ metadata: { path: ['campaignId'], equals: campaignId } }]
            : []),
        ],
      },
    });
    return {
      all: rows.length,
      available: rows.filter(
        (item) =>
          item.status === InstantPrizeStatus.AVAILABLE && !item.reservation,
      ).length,
      reserved: rows.filter((item) => Boolean(item.reservation)).length,
      found: rows.filter((item) => item.status === InstantPrizeStatus.FOUND)
        .length,
      paused: rows.filter(
        (item) => item.status === InstantPrizeStatus.CANCELLED,
      ).length,
      expired,
      delivered: rows.filter(
        (item) => item.status === InstantPrizeStatus.DELIVERED,
      ).length,
    };
  }

  private async organizerPrizeTicketRows(
    organizerId: string,
    campaignId?: string,
  ) {
    const prizes = await this.prisma.campaignInstantPrize.findMany({
      where: {
        campaign: { organizerId },
        ...(campaignId ? { campaignId } : {}),
      },
      include: {
        campaign: {
          select: { id: true, title: true, slug: true, totalNumbers: true },
        },
        results: {
          include: {
            purchase: { select: { id: true, quantity: true, total: true } },
            buyer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                city: true,
                state: true,
              },
            },
          },
          orderBy: { identifiedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const reservations = await this.prisma.ticket.findMany({
      where: {
        campaign: { organizerId },
        ...(campaignId ? { campaignId } : {}),
        status: TicketStatus.RESERVED,
        reservedUntil: { gt: new Date() },
        purchase: {
          status: {
            in: [PurchaseStatus.RESERVED, PurchaseStatus.AWAITING_PAYMENT],
          },
          expiresAt: { gt: new Date() },
        },
      },
      select: {
        campaignId: true,
        number: true,
        reservedUntil: true,
        createdAt: true,
        purchase: { select: { id: true, createdAt: true, expiresAt: true } },
        buyer: { select: { name: true, phone: true, city: true, state: true } },
      },
    });
    const reservationByNumber = new Map(
      reservations.map((item) => [`${item.campaignId}:${item.number}`, item]),
    );
    return prizes.map((prize) => ({
      ...prize,
      value: Number(prize.value),
      origin: this.metadata(prize.generationRule).origin ?? 'MANUAL',
      instructions: this.metadata(prize.generationRule).instructions ?? null,
      reservation: prize.exactNumber
        ? (() => {
            const item = reservationByNumber.get(
              `${prize.campaignId}:${Number(prize.exactNumber)}`,
            );
            return item
              ? {
                  purchaseId: item.purchase.id,
                  buyerName: this.maskName(item.buyer.name),
                  buyerPhone: this.maskPhone(item.buyer.phone ?? ''),
                  city: item.buyer.city,
                  state: item.buyer.state,
                  reservedAt: item.purchase.createdAt,
                  expiresAt: item.reservedUntil ?? item.purchase.expiresAt,
                }
              : null;
          })()
        : null,
      results: prize.results.map((result) => ({
        id: result.id,
        status: result.status,
        identifiedAt: result.identifiedAt,
        deliveredAt: result.deliveredAt,
        purchase: {
          id: result.purchase.id,
          quantity: result.purchase.quantity,
          total: Number(result.purchase.total),
        },
        buyer: {
          id: result.buyer.id,
          name: this.maskName(result.buyer.name),
          email: this.maskEmail(result.buyer.email),
          phone: this.maskPhone(result.buyer.phone ?? ''),
          city: result.buyer.city,
          state: result.buyer.state,
        },
      })),
    }));
  }
  async createPrizeTickets(
    user: AuthenticatedUser,
    dto: CreateInstantPrizeDto,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: dto.campaignId, organizerId: user.id },
      select: { id: true, totalNumbers: true, status: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (
      !(
        [CampaignStatus.PUBLISHED, CampaignStatus.PAUSED] as CampaignStatus[]
      ).includes(campaign.status)
    )
      throw new BadRequestException(
        'Selecione uma campanha publicada ou pausada.',
      );
    const numbers = [...new Set(dto.numbers.map((value) => value.trim()))];
    if (!numbers.length)
      throw new BadRequestException('Informe ao menos uma cota.');
    const numeric = numbers.map((value) => Number(value));
    if (
      numeric.some(
        (value) =>
          !Number.isInteger(value) ||
          value < 0 ||
          value >= campaign.totalNumbers,
      )
    )
      throw new BadRequestException(
        'Existe uma cota fora do intervalo da campanha.',
      );
    const [duplicate, unavailable] = await Promise.all([
      this.prisma.campaignInstantPrize.findFirst({
        where: { campaignId: campaign.id, exactNumber: { in: numbers } },
      }),
      this.prisma.ticket.findFirst({
        where: {
          campaignId: campaign.id,
          number: { in: numeric },
          status: { in: [TicketStatus.RESERVED, TicketStatus.SOLD] },
        },
      }),
    ]);
    if (duplicate)
      throw new BadRequestException(
        'Uma das cotas já está cadastrada como premiada.',
      );
    if (unavailable)
      throw new BadRequestException(
        'Uma das cotas já foi vendida ou está reservada.',
      );
    const created = await this.prisma.$transaction(
      numbers.map((number) =>
        this.prisma.campaignInstantPrize.create({
          data: {
            campaignId: campaign.id,
            exactNumber: number.padStart(
              String(campaign.totalNumbers - 1).length,
              '0',
            ),
            description: dto.description,
            value: new Prisma.Decimal(dto.value),
            type: dto.type,
            quantity: 1,
            status:
              dto.activate === false
                ? InstantPrizeStatus.CANCELLED
                : InstantPrizeStatus.AVAILABLE,
            generationRule: {
              origin: dto.origin ?? 'MANUAL',
              instructions: dto.instructions ?? null,
            },
          },
        }),
      ),
    );
    await this.prisma.auditLog.createMany({
      data: created.map((item) => ({
        entityType: 'INSTANT_PRIZE',
        entityId: item.id,
        action: 'INSTANT_PRIZES_CREATED',
        actorUserId: user.id,
        actorRole: user.role,
        newData: { id: item.id, number: item.exactNumber },
      })),
    });
    return created.map((item) => ({ ...item, value: Number(item.value) }));
  }
  async updatePrizeTicket(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateInstantPrizeDto,
  ) {
    const current = await this.ownedPrize(user.id, id);
    if (
      (
        [
          InstantPrizeStatus.FOUND,
          InstantPrizeStatus.DELIVERED,
        ] as InstantPrizeStatus[]
      ).includes(current.status)
    )
      throw new BadRequestException(
        'Uma cota encontrada não pode ter o prêmio alterado.',
      );
    const metadata = this.metadata(current.generationRule);
    const updated = await this.prisma.campaignInstantPrize.update({
      where: { id },
      data: {
        description: dto.description,
        value:
          dto.value === undefined ? undefined : new Prisma.Decimal(dto.value),
        type: dto.type,
        generationRule: {
          ...metadata,
          instructions: dto.instructions ?? metadata.instructions ?? null,
        },
      },
    });
    await this.audit(user, id, 'INSTANT_PRIZE_UPDATED', current, updated);
    return { ...updated, value: Number(updated.value) };
  }
  async prizeTicketAction(user: AuthenticatedUser, id: string, action: string) {
    const current = await this.ownedPrize(user.id, id);
    const map: Record<string, InstantPrizeStatus> = {
      pause: InstantPrizeStatus.CANCELLED,
      reactivate: InstantPrizeStatus.AVAILABLE,
      deliver: InstantPrizeStatus.DELIVERED,
    };
    if (action === 'remove') {
      if (current.foundCount > 0)
        throw new BadRequestException(
          'Cotas encontradas não podem ser removidas.',
        );
      await this.prisma.campaignInstantPrize.delete({ where: { id } });
      await this.audit(user, id, 'INSTANT_PRIZE_REMOVED', current, undefined);
      return { message: 'Cota premiada removida.' };
    }
    const status = map[action];
    if (!status) throw new BadRequestException('Ação inválida.');
    if (action === 'reactivate') {
      const ticket = await this.prisma.ticket.findFirst({
        where: {
          campaignId: current.campaignId,
          number: Number(current.exactNumber),
          status: { in: [TicketStatus.RESERVED, TicketStatus.SOLD] },
        },
      });
      if (ticket)
        throw new BadRequestException(
          'A cota está vendida ou reservada e não pode ser reativada.',
        );
    }
    const updated = await this.prisma.campaignInstantPrize.update({
      where: { id },
      data: {
        status,
        deliveredAt: action === 'deliver' ? new Date() : undefined,
      },
    });
    await this.audit(
      user,
      id,
      `INSTANT_PRIZE_${action.toUpperCase()}`,
      current,
      updated,
    );
    return { ...updated, value: Number(updated.value) };
  }
  async prizeTicketHistory(user: AuthenticatedUser, id: string) {
    await this.ownedPrize(user.id, id);
    return this.prisma.auditLog.findMany({
      where: { entityType: 'INSTANT_PRIZE', entityId: id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        actorUserId: true,
        previousData: true,
        newData: true,
        createdAt: true,
      },
    });
  }
  private ownedPrize(organizerId: string, id: string) {
    return this.prisma.campaignInstantPrize
      .findFirst({
        where: { id, campaign: { organizerId } },
      })
      .then((item) => {
        if (!item) throw new NotFoundException('Cota premiada não encontrada.');
        return item;
      });
  }
  private audit(
    user: AuthenticatedUser,
    id: string,
    action: string,
    previousData?: object,
    newData?: object,
  ) {
    return this.prisma.auditLog.create({
      data: {
        entityType: 'INSTANT_PRIZE',
        entityId: id,
        action,
        actorUserId: user.id,
        actorRole: user.role,
        previousData,
        newData,
      },
    });
  }
  private metadata(value: Prisma.JsonValue | null) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
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
  publicResults(slug: string) {
    return this.prisma.instantPrizeResult
      .findMany({
        where: {
          campaign: { slug },
          instantPrize: { status: { in: ['FOUND', 'DELIVERED'] } },
        },
        select: {
          winningNumber: true,
          status: true,
          identifiedAt: true,
          buyer: { select: { name: true, city: true, state: true } },
          instantPrize: {
            select: { description: true, value: true, type: true },
          },
        },
        orderBy: { identifiedAt: 'desc' },
      })
      .then((items) =>
        items.map((item) => ({
          ...item,
          winningNumber: this.maskNumber(item.winningNumber),
          buyer: {
            name: this.publicName(item.buyer.name),
            city: item.buyer.city,
            state: item.buyer.state,
          },
          instantPrize: {
            ...item.instantPrize,
            value: Number(item.instantPrize.value),
          },
        })),
      );
  }

  private maskNumber(number: string) {
    if (number.length <= 2) return '*'.repeat(number.length);
    return `${number.slice(0, 1)}${'*'.repeat(Math.max(2, number.length - 2))}${number.slice(-1)}`;
  }
  private publicName(name: string) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : parts[0];
  }
  myResults(buyerId: string) {
    return this.prisma.instantPrizeResult.findMany({
      where: { buyerId },
      include: { campaign: true, instantPrize: true, ticket: true },
      orderBy: { identifiedAt: 'desc' },
    });
  }
}
