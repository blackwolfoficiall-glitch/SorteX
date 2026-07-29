import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  Prisma,
  SupportCategory,
  SupportStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import type { BuyerCampaignQueryDto } from './dto/buyer-query.dto';
import type {
  BuyerProfileDto,
  CreateSupportTicketDto,
  SupportMessageDto,
} from './dto/buyer-profile.dto';
import { CrmSyncService } from '../crm/crm-sync.service';

const campaignSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  category: true,
  status: true,
  coverImage: true,
  mainPrizeName: true,
  cashAlternative: true,
  numberPrice: true,
  soldNumbers: true,
  totalNumbers: true,
  drawDate: true,
  salesStartAt: true,
  publishedAt: true,
  isFeatured: true,
  organizer: {
    select: {
      name: true,
      verified: true,
      organizerProfile: {
        select: { organizationName: true, logoStorageKey: true },
      },
    },
  },
} as const satisfies Prisma.CampaignSelect;

@Injectable()
export class BuyerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crmSync: CrmSyncService,
  ) {}

  async home(user: AuthenticatedUser) {
    const now = new Date();
    const profile = await this.profile(user.id);
    const [campaignsResult, bannersResult, notificationsResult] =
      await Promise.allSettled([
        this.prisma.campaign.findMany({
          where: {
            status: CampaignStatus.PUBLISHED,
            publicationBlocked: false,
          },
          select: campaignSelect,
          orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
          take: 24,
        }),
        this.prisma.platformBanner.findMany({
          where: {
            isActive: true,
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
              { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
            ],
          },
          orderBy: { sortOrder: 'asc' },
        }),
        this.prisma.notification.count({
          where: { userId: user.id, readAt: null },
        }),
      ]);
    const campaigns =
      campaignsResult.status === 'fulfilled' ? campaignsResult.value : [];
    const banners =
      bannersResult.status === 'fulfilled' ? bannersResult.value : [];
    const unreadNotifications =
      notificationsResult.status === 'fulfilled'
        ? notificationsResult.value
        : 0;
    const serialized = campaigns.map((item) => this.serializeCampaign(item));
    return {
      profile,
      banners,
      unreadNotifications,
      featured: serialized.filter((item) => item.isFeatured).slice(0, 8),
      live: serialized
        .filter(
          (item) => !item.salesStartAt || new Date(item.salesStartAt) <= now,
        )
        .slice(0, 12),
      upcoming: serialized
        .filter(
          (item) => item.salesStartAt && new Date(item.salesStartAt) > now,
        )
        .slice(0, 12),
    };
  }

  async campaigns(query: BuyerCampaignQueryDto) {
    const now = new Date();
    const where: Prisma.CampaignWhereInput = {
      status: CampaignStatus.PUBLISHED,
      publicationBlocked: false,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              {
                mainPrizeName: { contains: query.search, mode: 'insensitive' },
              },
            ],
          }
        : {}),
      ...(query.category && query.category !== 'ALL'
        ? { category: query.category as never }
        : {}),
      ...(query.filter === 'UPCOMING' ? { salesStartAt: { gt: now } } : {}),
    };
    const orderBy: Prisma.CampaignOrderByWithRelationInput[] =
      query.filter === 'LOWEST_PRICE'
        ? [{ numberPrice: 'asc' }]
        : query.filter === 'MOST_SOLD'
          ? [{ soldNumbers: 'desc' }]
          : query.filter === 'ENDING'
            ? [{ drawDate: 'asc' }]
            : [{ isFeatured: 'desc' }, { publishedAt: 'desc' }];
    const [items, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        select: campaignSelect,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.campaign.count({ where }),
    ]);
    return {
      items: items.map((item) => this.serializeCampaign(item)),
      total,
      page: query.page,
      limit: query.limit,
      pages: Math.ceil(total / query.limit),
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        city: true,
        state: true,
        verified: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('Comprador não encontrado.');
    return { ...user, cpf: this.mask(user.cpf) };
  }
  async updateProfile(userId: string, body: BuyerProfileDto) {
    await this.prisma.user.update({ where: { id: userId }, data: body });
    return this.profile(userId);
  }
  async favorites(userId: string) {
    const rows = await this.prisma.buyerFavorite.findMany({
      where: { buyerId: userId },
      include: { campaign: { select: campaignSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      campaign: this.serializeCampaign(row.campaign),
    }));
  }
  async favorite(userId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id: campaignId,
        status: {
          in: [
            CampaignStatus.PUBLISHED,
            CampaignStatus.DRAWN,
            CampaignStatus.FINISHED,
          ],
        },
      },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    const favorite = await this.prisma.buyerFavorite.upsert({
      where: { buyerId_campaignId: { buyerId: userId, campaignId } },
      create: { buyerId: userId, campaignId },
      update: {},
    });
    await this.crmSync.syncFavorite(this.prisma, userId, campaignId);
    return favorite;
  }
  async unfavorite(userId: string, campaignId: string) {
    await this.prisma.buyerFavorite.deleteMany({
      where: { buyerId: userId, campaignId },
    });
    return { message: 'Favorito removido.' };
  }
  notifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async readAll(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'Notificações lidas.' };
  }
  async read(userId: string, id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    if (!result.count)
      throw new NotFoundException('Notificação não encontrada.');
    return { message: 'Notificação lida.' };
  }
  support(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { requesterUserId: userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { updatedAt: 'desc' },
    });
  }
  async supportDetail(userId: string, id: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, requesterUserId: userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket) throw new NotFoundException('Chamado não encontrado.');
    return ticket;
  }
  createSupport(userId: string, body: CreateSupportTicketDto) {
    if (!(body.category in SupportCategory))
      throw new BadRequestException('Categoria inválida.');
    return this.prisma.supportTicket.create({
      data: {
        requesterUserId: userId,
        category: body.category as SupportCategory,
        subject: body.subject,
        description: body.description,
      },
    });
  }
  async reply(userId: string, id: string, body: SupportMessageDto) {
    const ticket = await this.supportDetail(userId, id);
    if (
      ticket.status === SupportStatus.CLOSED ||
      ticket.status === SupportStatus.RESOLVED
    )
      throw new BadRequestException('Chamado encerrado.');
    return this.prisma.supportMessage.create({
      data: {
        ticketId: id,
        senderUserId: userId,
        message: body.message,
        attachmentUrl: body.attachmentUrl,
      },
    });
  }
  async close(userId: string, id: string) {
    await this.supportDetail(userId, id);
    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: SupportStatus.CLOSED, closedAt: new Date() },
    });
  }
  private mask(value: string | null) {
    return value ? `***.${value.slice(-6, -2)}.***-${value.slice(-2)}` : null;
  }
  private serializeCampaign(
    item: Prisma.CampaignGetPayload<{ select: typeof campaignSelect }>,
  ) {
    return {
      ...item,
      numberPrice: Number(item.numberPrice),
      cashAlternative:
        item.cashAlternative === null ? null : Number(item.cashAlternative),
      coverImageUrl: item.coverImage
        ? `/api/public/campaign-media/${item.coverImage}`
        : null,
      soldPercentage: item.totalNumbers
        ? Math.min(
            100,
            Number(((item.soldNumbers / item.totalNumbers) * 100).toFixed(2)),
          )
        : 0,
      organizer: {
        name:
          item.organizer.organizerProfile?.organizationName ||
          item.organizer.name,
        verified: item.organizer.verified,
        logoUrl: item.organizer.organizerProfile?.logoStorageKey
          ? `/api/public/organizer-files/${item.organizer.organizerProfile.logoStorageKey}`
          : null,
      },
    };
  }
}
