import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AiRecommendationPriority,
  AiRecommendationStatus,
  CampaignStatus,
  Prisma,
  PromotionStatus,
  PromotionType,
  SortexAdChannel,
  SortexAdObjective,
  SortexAdStatus,
  UserRole,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdTrackDto,
  PromotionDto,
  PromotionListDto,
  PromotionQuoteDto,
  RecommendationFeedbackDto,
  SortexAdDto,
  SortexAdListDto,
  SortexAdsDashboardQueryDto,
} from './dto/growth.dto';
@Injectable()
export class GrowthService {
  constructor(private prisma: PrismaService) {}
  private organizer(user: AuthenticatedUser) {
    if (user.role !== UserRole.ORGANIZER)
      throw new ForbiddenException('Acesso exclusivo para organizadores.');
  }
  private async campaign(id: string, organizerId: string) {
    const c = await this.prisma.campaign.findFirst({
      where: { id, organizerId },
    });
    if (!c) throw new NotFoundException('Campanha não encontrada.');
    return c;
  }
  async promotionDashboard(user: AuthenticatedUser) {
    this.organizer(user);
    const rows = await this.prisma.campaignPromotion.findMany({
      where: { campaign: { organizerId: user.id }, deletedAt: null },
      select: {
        status: true,
        usageCount: true,
        attributedRevenue: true,
        grantedDiscount: true,
      },
    });
    return rows.reduce(
      (a, r) => ({
        ...a,
        [r.status.toLowerCase()]: a[r.status.toLowerCase()] + 1,
        usages: a.usages + r.usageCount,
        revenue: a.revenue + Number(r.attributedRevenue),
        discount: a.discount + Number(r.grantedDiscount),
      }),
      {
        draft: 0,
        scheduled: 0,
        active: 0,
        paused: 0,
        ended: 0,
        expired: 0,
        usages: 0,
        revenue: 0,
        discount: 0,
      } as Record<string, number>,
    );
  }
  async promotions(user: AuthenticatedUser, q: PromotionListDto) {
    this.organizer(user);
    const where: Prisma.CampaignPromotionWhereInput = {
      campaign: { organizerId: user.id },
      deletedAt: null,
      ...(q.campaignId ? { campaignId: q.campaignId } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              {
                campaign: {
                  title: { contains: q.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.campaignPromotion.findMany({
        where,
        include: {
          campaign: { select: { id: true, title: true, slug: true } },
          coupons: true,
        },
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.campaignPromotion.count({ where }),
    ]);
    return {
      items: items.map(this.promotionNumbers),
      total,
      page: q.page,
      pages: Math.ceil(total / q.limit),
    };
  }
  async createPromotion(user: AuthenticatedUser, d: PromotionDto) {
    this.organizer(user);
    const campaign = await this.campaign(d.campaignId, user.id);
    this.validatePeriod(d.startsAt, d.endsAt);
    const config = d.config ?? {};
    const qty = Number(config.quantity ?? config.minimumQuantity ?? 1);
    const promoPrice = new Prisma.Decimal(Number(config.promotionalPrice ?? 0));
    const regular = campaign.numberPrice.mul(qty);
    if (
      d.type === PromotionType.PACKAGE &&
      (promoPrice.lte(0) || promoPrice.gte(regular))
    )
      throw new BadRequestException(
        'O preço promocional deve ser menor que o preço normal.',
      );
    if (
      d.type === PromotionType.PACKAGE &&
      campaign.maximumPurchasePerBuyer &&
      qty > campaign.maximumPurchasePerBuyer
    )
      throw new BadRequestException(
        'O pacote ultrapassa a compra máxima da campanha.',
      );
    if (config.isPopular)
      await this.prisma.campaignPromotion.updateMany({
        where: { campaignId: d.campaignId, isPopular: true },
        data: { isPopular: false },
      });
    const status = d.status ?? this.initialPromotionStatus(d.startsAt);
    const item = await this.prisma.campaignPromotion.create({
      data: {
        campaignId: d.campaignId,
        name: d.name,
        description: d.description,
        type: d.type,
        status,
        numberQuantity: Math.max(1, qty),
        packagePrice:
          d.type === PromotionType.PACKAGE ? promoPrice : new Prisma.Decimal(0),
        discountRate:
          d.type === PromotionType.PACKAGE
            ? regular.sub(promoPrice).div(regular).mul(100)
            : new Prisma.Decimal(Number(config.discountValue ?? 0)),
        isPopular: Boolean(config.isPopular),
        isActive: status === PromotionStatus.ACTIVE,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        totalLimit: d.totalLimit,
        perBuyerLimit: d.perBuyerLimit,
        config: config as Prisma.InputJsonValue,
        stackRules: (d.stackRules ?? {}) as Prisma.InputJsonValue,
      },
    });
    if (d.type === PromotionType.COUPON) {
      const code = String(config.code ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
      if (!code) throw new BadRequestException('Informe o código do cupom.');
      await this.prisma.promotionCoupon.create({
        data: {
          organizerId: user.id,
          promotionId: item.id,
          code,
          name: d.name,
          discountType:
            String(config.discountType) === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
          discountValue: new Prisma.Decimal(Number(config.discountValue ?? 0)),
          minimumAmount: new Prisma.Decimal(Number(config.minimumAmount ?? 0)),
          totalLimit: d.totalLimit,
          perBuyerLimit: d.perBuyerLimit,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          isActive: item.isActive,
        },
      });
    }
    await this.audit(user, 'PROMOTION_CREATED', item.id);
    return this.promotionNumbers(item);
  }
  async updatePromotion(user: AuthenticatedUser, id: string, d: PromotionDto) {
    const current = await this.ownedPromotion(user, id);
    if (
      current.status === PromotionStatus.ENDED ||
      current.status === PromotionStatus.EXPIRED
    )
      throw new BadRequestException('Promoção encerrada não pode ser editada.');
    const campaign = await this.campaign(d.campaignId, user.id);
    this.validatePeriod(d.startsAt, d.endsAt);
    const nextStatus = d.status ?? current.status;
    if (
      nextStatus === PromotionStatus.ACTIVE &&
      (
        [
          CampaignStatus.FINISHED,
          CampaignStatus.CANCELLED,
          CampaignStatus.DRAWN,
          CampaignStatus.SOLD_OUT,
        ] as CampaignStatus[]
      ).includes(campaign.status)
    )
      throw new BadRequestException(
        'Esta promoção não pode ser ativada porque a campanha já foi encerrada.',
      );
    if (
      nextStatus === PromotionStatus.ACTIVE &&
      d.endsAt &&
      new Date(d.endsAt) <= new Date()
    )
      throw new BadRequestException('O período desta promoção já terminou.');
    const isActive = nextStatus === PromotionStatus.ACTIVE;
    const updated = await this.prisma.campaignPromotion.update({
      where: { id },
      data: {
        name: d.name,
        description: d.description,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        totalLimit: d.totalLimit,
        perBuyerLimit: d.perBuyerLimit,
        status: nextStatus,
        isActive,
        config: (d.config ?? {}) as Prisma.InputJsonValue,
        stackRules: (d.stackRules ?? {}) as Prisma.InputJsonValue,
      },
    });
    if (current.type === PromotionType.COUPON) {
      const config = d.config ?? {};
      const code = String(config.code ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
      if (!code) throw new BadRequestException('Informe o código do cupom.');
      await this.prisma.promotionCoupon.updateMany({
        where: { promotionId: id },
        data: {
          code,
          name: d.name,
          discountType:
            String(config.discountType) === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
          discountValue: new Prisma.Decimal(Number(config.discountValue ?? 0)),
          minimumAmount: new Prisma.Decimal(Number(config.minimumAmount ?? 0)),
          totalLimit: d.totalLimit,
          perBuyerLimit: d.perBuyerLimit,
          isActive,
          startsAt: updated.startsAt,
          endsAt: updated.endsAt,
        },
      });
    }
    await this.audit(user, 'PROMOTION_UPDATED', id);
    return this.promotionNumbers(updated);
  }
  async promotionAction(user: AuthenticatedUser, id: string, action: string) {
    const promotion = await this.ownedPromotion(user, id);
    const map: Record<string, PromotionStatus> = {
      activate: PromotionStatus.ACTIVE,
      pause: PromotionStatus.PAUSED,
      end: PromotionStatus.ENDED,
    };
    const status = map[action];
    if (!status) throw new BadRequestException('Ação inválida.');
    if (action === 'activate') {
      const campaign = await this.campaign(promotion.campaignId, user.id);
      if (
        (
          [
            CampaignStatus.FINISHED,
            CampaignStatus.CANCELLED,
            CampaignStatus.DRAWN,
            CampaignStatus.SOLD_OUT,
          ] as CampaignStatus[]
        ).includes(campaign.status)
      )
        throw new BadRequestException(
          'Esta promoção não pode ser ativada porque a campanha já foi encerrada.',
        );
      if (promotion.endsAt && promotion.endsAt <= new Date())
        throw new BadRequestException('O período desta promoção já terminou.');
      if (promotion.totalLimit && promotion.usageCount >= promotion.totalLimit)
        throw new BadRequestException(
          'O limite total de utilizações já foi atingido.',
        );
    }
    const isActive = status === PromotionStatus.ACTIVE;
    const [updated] = await this.prisma.$transaction([
      this.prisma.campaignPromotion.update({
        where: { id },
        data: { status, isActive },
      }),
      this.prisma.promotionCoupon.updateMany({
        where: { promotionId: id },
        data: { isActive },
      }),
    ]);
    await this.audit(user, `PROMOTION_${action.toUpperCase()}`, id);
    return this.promotionNumbers(updated);
  }
  async duplicatePromotion(user: AuthenticatedUser, id: string) {
    const p = await this.ownedPromotion(user, id);
    const sourceCoupon = await this.prisma.promotionCoupon.findFirst({
      where: { promotionId: id },
    });
    const copiedCode = sourceCoupon
      ? `${sourceCoupon.code.slice(0, 20)}-COPIA-${randomBytes(2).toString('hex').toUpperCase()}`
      : null;
    const sourceConfig = (p.config as Record<string, unknown> | null) ?? {};
    const copy = await this.prisma.campaignPromotion.create({
      data: {
        campaignId: p.campaignId,
        name: `${p.name} - cópia`,
        description: p.description,
        type: p.type,
        status: PromotionStatus.DRAFT,
        numberQuantity: p.numberQuantity,
        packagePrice: p.packagePrice,
        discountRate: p.discountRate,
        isPopular: false,
        isActive: false,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        sortOrder: p.sortOrder,
        config: {
          ...sourceConfig,
          ...(copiedCode ? { code: copiedCode } : {}),
        },
        stackRules: p.stackRules ?? undefined,
        totalLimit: p.totalLimit,
        perBuyerLimit: p.perBuyerLimit,
      },
    });
    if (sourceCoupon && copiedCode)
      await this.prisma.promotionCoupon.create({
        data: {
          organizerId: user.id,
          promotionId: copy.id,
          code: copiedCode,
          name: `${sourceCoupon.name} - Cópia`,
          discountType: sourceCoupon.discountType,
          discountValue: sourceCoupon.discountValue,
          minimumAmount: sourceCoupon.minimumAmount,
          totalLimit: sourceCoupon.totalLimit,
          perBuyerLimit: sourceCoupon.perBuyerLimit,
          startsAt: sourceCoupon.startsAt,
          endsAt: sourceCoupon.endsAt,
          isActive: false,
        },
      });
    await this.audit(user, 'PROMOTION_DUPLICATED', copy.id, undefined, {
      sourcePromotionId: id,
    });
    return this.promotionNumbers(copy);
  }

  async promotionReport(user: AuthenticatedUser, id: string) {
    const promotion = await this.ownedPromotion(user, id);
    const usages = await this.prisma.promotionUsage.findMany({
      where: { promotionId: id },
      select: {
        buyerId: true,
        status: true,
        grossAmount: true,
        discountAmount: true,
        finalAmount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    const approved = usages.filter((usage) => usage.status === 'APPROVED');
    const daily = new Map<string, { usages: number; revenue: number }>();
    for (const usage of approved) {
      const day = usage.createdAt.toISOString().slice(0, 10);
      const current = daily.get(day) ?? { usages: 0, revenue: 0 };
      current.usages += 1;
      current.revenue += Number(usage.finalAmount);
      daily.set(day, current);
    }
    const revenue = approved.reduce(
      (sum, usage) => sum + Number(usage.finalAmount),
      0,
    );
    return {
      promotion: this.promotionNumbers(promotion),
      usages: approved.length,
      uniqueBuyers: new Set(approved.map((usage) => usage.buyerId)).size,
      revenue,
      averageTicket: approved.length ? revenue / approved.length : 0,
      grantedDiscount: approved.reduce(
        (sum, usage) => sum + Number(usage.discountAmount),
        0,
      ),
      daily: [...daily].map(([date, values]) => ({ date, ...values })),
      source: 'Dados de utilizações aprovadas da própria promoção',
    };
  }

  async promotionHistory(user: AuthenticatedUser, id: string) {
    await this.ownedPromotion(user, id);
    return this.prisma.auditLog.findMany({
      where: { entityId: id, entityType: 'GROWTH' },
      select: {
        id: true,
        action: true,
        actorUserId: true,
        previousData: true,
        newData: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async deletePromotion(user: AuthenticatedUser, id: string) {
    const p = await this.ownedPromotion(user, id);
    if (p.usageCount > 0)
      throw new BadRequestException(
        'Promoções utilizadas não podem ser excluídas. Encerre a promoção.',
      );
    return this.prisma.campaignPromotion.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: PromotionStatus.ENDED,
        isActive: false,
      },
    });
  }
  async quote(d: PromotionQuoteDto) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: d.campaignId },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    const now = new Date(),
      promotions = await this.prisma.campaignPromotion.findMany({
        where: {
          campaignId: d.campaignId,
          status: PromotionStatus.ACTIVE,
          isActive: true,
          deletedAt: null,
          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
        },
      });
    const subtotal = campaign.numberPrice.mul(d.quantity);
    let discount = new Prisma.Decimal(0),
      promotionId: string | null = null;
    for (const p of promotions) {
      if (p.type === PromotionType.PACKAGE && p.numberQuantity === d.quantity) {
        discount = subtotal.sub(p.packagePrice);
        promotionId = p.id;
      }
      if (p.type === PromotionType.QUANTITY_DISCOUNT) {
        const tiers = Array.isArray((p.config as any)?.tiers)
          ? (p.config as any).tiers
          : [];
        const best = tiers
          .filter((t: any) => Number(t.quantity) <= d.quantity)
          .sort((a: any, b: any) => Number(b.quantity) - Number(a.quantity))[0];
        if (best) {
          const candidate = subtotal.mul(Number(best.percent)).div(100);
          if (candidate.gt(discount)) {
            discount = candidate;
            promotionId = p.id;
          }
        }
      }
    }
    if (d.couponCode) {
      const coupon = await this.prisma.promotionCoupon.findFirst({
        where: {
          organizerId: campaign.organizerId,
          code: d.couponCode.trim().toUpperCase(),
          isActive: true,
          promotion: {
            campaignId: d.campaignId,
            status: PromotionStatus.ACTIVE,
          },
        },
      });
      if (!coupon)
        throw new BadRequestException('Cupom inválido, expirado ou esgotado.');
      const candidate =
        coupon.discountType === 'PERCENTAGE'
          ? subtotal.mul(coupon.discountValue).div(100)
          : coupon.discountValue;
      discount = Prisma.Decimal.min(subtotal, candidate);
      promotionId = coupon.promotionId;
    }
    return {
      subtotal: Number(subtotal),
      discount: Number(discount),
      total: Number(Prisma.Decimal.max(0, subtotal.sub(discount))),
      promotionId,
    };
  }
  async adsDashboard(
    user: AuthenticatedUser,
    query: SortexAdsDashboardQueryDto,
  ) {
    this.organizer(user);
    const now = new Date();
    const periodDays =
      query.period === 'TODAY'
        ? 1
        : query.period === '7D'
          ? 7
          : query.period === '90D'
            ? 90
            : 30;
    const from =
      query.period === 'CUSTOM' && query.startDate
        ? new Date(query.startDate)
        : new Date(now.getTime() - periodDays * 86_400_000);
    const to =
      query.period === 'CUSTOM' && query.endDate
        ? new Date(query.endDate)
        : now;
    if (from > to)
      throw new BadRequestException(
        'A data inicial deve ser anterior à data final.',
      );
    const adWhere: Prisma.SortexAdCampaignWhereInput = {
      organizerId: user.id,
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(query.platform && query.platform !== 'ALL'
        ? {
            channels:
              query.platform === 'META_ADS'
                ? { hasSome: ['INSTAGRAM', 'FACEBOOK'] }
                : { has: query.platform as SortexAdChannel },
          }
        : {}),
      ...(query.adType ? { objective: query.adType as SortexAdObjective } : {}),
      createdAt: { lte: to },
    };
    const [ads, integrations, events, whatsappRows] = await Promise.all([
      this.prisma.sortexAdCampaign.findMany({
        where: adWhere,
        include: {
          campaign: { select: { id: true, title: true } },
        },
      }),
      this.prisma.organizerIntegration.findMany({
        where: { organizerId: user.id },
        select: {
          type: true,
          status: true,
          sandbox: true,
          lastSyncedAt: true,
          publicConfig: true,
        },
      }),
      this.prisma.sortexAdEvent.findMany({
        where: {
          ad: adWhere,
          occurredAt: { gte: from, lte: to },
        },
        select: { occurredAt: true, type: true, value: true, channel: true },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.outboundMessage.groupBy({
        by: ['status'],
        where: {
          organizerId: user.id,
          channel: 'WHATSAPP',
          createdAt: { gte: from, lte: to },
        },
        _count: { _all: true },
      }),
    ]);
    const totals = ads.reduce<{
      active: number;
      budget: number;
      views: number;
      clicks: number;
      registrations: number;
      reservations: number;
      sales: number;
      revenue: number;
      spent: number;
      reach: number;
      impressions: number;
    }>(
      (a, r) => ({
        active:
          a.active +
          (r.status === SortexAdStatus.SANDBOX_ACTIVE ||
          r.status === SortexAdStatus.LIVE_ACTIVE
            ? 1
            : 0),
        budget: a.budget + Number(r.budget),
        views: a.views + r.views,
        clicks: a.clicks + r.clicks,
        registrations: a.registrations + r.registrations,
        reservations: a.reservations + r.reservations,
        sales: a.sales + r.approvedSales,
        revenue: a.revenue + Number(r.attributedRevenue),
        spent: a.spent + Number(r.spent),
        reach: a.reach + r.reach,
        impressions: a.impressions + r.impressions,
      }),
      {
        active: 0,
        budget: 0,
        views: 0,
        clicks: 0,
        registrations: 0,
        reservations: 0,
        sales: 0,
        revenue: 0,
        spent: 0,
        reach: 0,
        impressions: 0,
      },
    );
    const eventDaily = new Map<
      string,
      { date: string; clicks: number; conversions: number; revenue: number }
    >();
    for (const event of events) {
      const date = event.occurredAt.toISOString().slice(0, 10);
      const day = eventDaily.get(date) ?? {
        date,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      };
      if (event.type === 'CLICK') day.clicks += 1;
      if (event.type === 'APPROVED_SALE') {
        day.conversions += 1;
        day.revenue += Number(event.value ?? 0);
      }
      eventDaily.set(date, day);
    }
    const integration = (types: string[]) =>
      integrations.find((item) => types.includes(item.type));
    const integrationMetrics = (types: string[]) => {
      const item = integration(types);
      const config =
        item?.publicConfig &&
        typeof item.publicConfig === 'object' &&
        !Array.isArray(item.publicConfig)
          ? (item.publicConfig as Record<string, unknown>)
          : {};
      const raw =
        config.metrics &&
        typeof config.metrics === 'object' &&
        !Array.isArray(config.metrics)
          ? (config.metrics as Record<string, unknown>)
          : {};
      return Object.fromEntries(
        Object.entries(raw).flatMap(([key, value]) =>
          typeof value === 'number' && Number.isFinite(value)
            ? [[key, value]]
            : [],
        ),
      );
    };
    const status = (types: string[]) => {
      const item = integration(types);
      return {
        connected: item?.status === 'CONNECTED' && !item.sandbox,
        status: item?.status ?? 'NOT_CONNECTED',
        lastSyncedAt: item?.lastSyncedAt ?? null,
      };
    };
    const whatsapp = Object.fromEntries(
      whatsappRows.map((row) => [row.status, row._count._all]),
    ) as Record<string, number>;
    const channelMetrics = (channels: string[]) => {
      const rows = ads.filter((ad) =>
        ad.channels.some((channel) => channels.includes(channel)),
      );
      return rows.reduce(
        (acc, ad) => ({
          campaigns: acc.campaigns + 1,
          investment: acc.investment + Number(ad.spent),
          reach: acc.reach + ad.reach,
          impressions: acc.impressions + ad.impressions,
          clicks: acc.clicks + ad.clicks,
          conversions: acc.conversions + ad.approvedSales,
          revenue: acc.revenue + Number(ad.attributedRevenue),
        }),
        {
          campaigns: 0,
          investment: 0,
          reach: 0,
          impressions: 0,
          clicks: 0,
          conversions: 0,
          revenue: 0,
        },
      );
    };
    const metaMetrics = channelMetrics(['INSTAGRAM', 'FACEBOOK']);
    const googleMetrics = channelMetrics(['GOOGLE']);
    const youtubeMetrics = channelMetrics(['YOUTUBE']);
    const metaStatus = status(['META_ADS']);
    const platforms = [
      {
        key: 'META_ADS',
        name: 'Meta Ads',
        ...metaStatus,
        metrics: {
          ...metaMetrics,
          ctr: metaMetrics.impressions
            ? (metaMetrics.clicks / metaMetrics.impressions) * 100
            : null,
          cpc: metaMetrics.clicks
            ? metaMetrics.investment / metaMetrics.clicks
            : null,
          cpm: metaMetrics.impressions
            ? (metaMetrics.investment / metaMetrics.impressions) * 1000
            : null,
          costPerConversion: metaMetrics.conversions
            ? metaMetrics.investment / metaMetrics.conversions
            : null,
          roas: metaMetrics.investment
            ? metaMetrics.revenue / metaMetrics.investment
            : null,
        },
      },
      {
        key: 'INSTAGRAM',
        name: 'Instagram',
        ...status(['INSTAGRAM', 'META_ADS']),
        metrics: integrationMetrics(['INSTAGRAM', 'META_ADS']),
      },
      {
        key: 'FACEBOOK',
        name: 'Facebook',
        ...status(['FACEBOOK', 'META_ADS']),
        metrics: integrationMetrics(['FACEBOOK', 'META_ADS']),
      },
      {
        key: 'WHATSAPP',
        name: 'WhatsApp Business',
        ...status(['WHATSAPP']),
        metrics: {
          sent: whatsapp.SENT ?? 0,
          failed: whatsapp.FAILED ?? 0,
          queued: (whatsapp.QUEUED ?? 0) + (whatsapp.PROCESSING ?? 0),
          ...integrationMetrics(['WHATSAPP']),
        },
      },
      {
        key: 'YOUTUBE',
        name: 'YouTube',
        ...status(['YOUTUBE']),
        metrics: { ...youtubeMetrics, ...integrationMetrics(['YOUTUBE']) },
      },
      {
        key: 'GOOGLE',
        name: 'Google Ads',
        ...status(['GOOGLE_ADS', 'GOOGLE']),
        metrics: {
          ...googleMetrics,
          ...integrationMetrics(['GOOGLE_ADS', 'GOOGLE']),
        },
      },
    ];
    const comparable = platforms
      .map((platform) => ({
        key: platform.key,
        name: platform.name,
        conversions: Number(platform.metrics.conversions ?? 0),
        investment: Number(platform.metrics.investment ?? 0),
      }))
      .filter((item) => item.conversions > 0 || item.investment > 0)
      .sort((a, b) => b.conversions - a.conversions);
    const elapsedDays = Math.max(
      1,
      Math.ceil((to.getTime() - from.getTime()) / 86_400_000),
    );
    const conversionEvents = events.filter(
      (event) => event.type === 'APPROVED_SALE',
    );
    const hourCounts = conversionEvents.reduce<Record<number, number>>(
      (result, event) => {
        const hour = event.occurredAt.getHours();
        result[hour] = (result[hour] ?? 0) + 1;
        return result;
      },
      {},
    );
    const bestHourEntry = Object.entries(hourCounts).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const adPerformance = ads.map((ad) => {
      const investment = Number(ad.spent);
      const revenue = Number(ad.attributedRevenue);
      const conversionRate = ad.clicks
        ? (ad.approvedSales / ad.clicks) * 100
        : 0;
      return {
        id: ad.campaign.id,
        title: ad.campaign.title,
        conversions: ad.approvedSales,
        conversionRate,
        roas: investment > 0 ? revenue / investment : null,
      };
    });
    const averageConversionRate = adPerformance.length
      ? adPerformance.reduce((sum, item) => sum + item.conversionRate, 0) /
        adPerformance.length
      : 0;
    const underperformingCampaigns = adPerformance
      .filter(
        (item) =>
          item.conversions === 0 ||
          item.conversionRate < averageConversionRate * 0.75,
      )
      .sort((a, b) => a.conversionRate - b.conversionRate)
      .slice(0, 5);
    const locationPerformance = new Map<
      string,
      { name: string; conversions: number }
    >();
    const audiencePerformance = new Map<
      string,
      { name: string; conversions: number }
    >();
    for (const ad of ads.filter((item) => item.approvedSales > 0)) {
      const location = jsonRecord(ad.location);
      for (const city of jsonStringList(location.cities)) {
        const current = locationPerformance.get(city) ?? {
          name: city,
          conversions: 0,
        };
        current.conversions += ad.approvedSales;
        locationPerformance.set(city, current);
      }
      const audience = jsonRecord(ad.audience);
      for (const interest of jsonStringList(audience.interests)) {
        const current = audiencePerformance.get(interest) ?? {
          name: interest,
          conversions: 0,
        };
        current.conversions += ad.approvedSales;
        audiencePerformance.set(interest, current);
      }
    }
    const topCities = [...locationPerformance.values()]
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5);
    const efficientAudiences = [...audiencePerformance.values()]
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5);
    const forecast =
      elapsedDays >= 7 && totals.revenue > 0
        ? {
            dailyRevenue: totals.revenue / elapsedDays,
            next30Days: (totals.revenue / elapsedDays) * 30,
            basisDays: elapsedDays,
          }
        : null;
    return {
      ...totals,
      period: { key: query.period, from, to },
      filters: {
        campaignId: query.campaignId ?? null,
        platform: query.platform ?? 'ALL',
        adType: query.adType ?? null,
      },
      daily: [...eventDaily.values()],
      platforms,
      comparisons: comparable,
      recommendations: {
        bestChannel: comparable[0] ?? null,
        worstChannel: comparable.at(-1) ?? null,
        campaignWithHighestReturn:
          [...ads]
            .filter((ad) => Number(ad.spent) > 0)
            .sort(
              (a, b) =>
                Number(b.attributedRevenue) / Number(b.spent) -
                Number(a.attributedRevenue) / Number(a.spent),
            )[0]?.campaign ?? null,
        investmentSuggestion:
          comparable.length >= 2
            ? `Revise a distribuição priorizando ${comparable[0].name}, que possui mais conversões no período.`
            : null,
        underperformingCampaigns,
        forecast,
        idealHour: bestHourEntry
          ? {
              hour: Number(bestHourEntry[0]),
              conversions: bestHourEntry[1],
            }
          : null,
        topCities,
        efficientAudiences,
        unavailable: [
          ...(!forecast
            ? [
                'Previsão de resultado exige ao menos 7 dias com receita atribuída.',
              ]
            : []),
          ...(!bestHourEntry
            ? ['Horários ideais exigem conversões registradas no período.']
            : []),
          ...(!topCities.length
            ? [
                'Cidades eficientes dependem de conversões com segmentação geográfica.',
              ]
            : []),
          ...(!efficientAudiences.length
            ? [
                'Públicos eficientes dependem de conversões com interesses atribuídos.',
              ]
            : []),
        ],
      },
    };
  }
  async ads(user: AuthenticatedUser, q: SortexAdListDto) {
    this.organizer(user);
    const where: Prisma.SortexAdCampaignWhereInput = {
      organizerId: user.id,
      ...(q.campaignId ? { campaignId: q.campaignId } : {}),
      ...(q.status ? { status: q.status as SortexAdStatus } : {}),
      ...(q.objective ? { objective: q.objective as SortexAdObjective } : {}),
      ...(q.channel ? { channels: { has: q.channel as SortexAdChannel } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.sortexAdCampaign.findMany({
        where,
        include: {
          campaign: { select: { id: true, title: true, slug: true } },
          promotion: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.sortexAdCampaign.count({ where }),
    ]);
    return {
      items: items.map(this.adNumbers),
      total,
      page: q.page,
      pages: Math.ceil(total / q.limit),
    };
  }
  async createAd(user: AuthenticatedUser, d: SortexAdDto) {
    this.organizer(user);
    await this.campaign(d.campaignId, user.id);
    if (d.promotionId) await this.ownedPromotion(user, d.promotionId);
    this.validatePeriod(d.startsAt, d.endsAt);
    const ad = await this.prisma.sortexAdCampaign.create({
      data: {
        organizerId: user.id,
        campaignId: d.campaignId,
        promotionId: d.promotionId,
        name: d.name,
        code: randomBytes(8).toString('hex'),
        objective: d.objective,
        channels: d.channels,
        audience: d.audience as Prisma.InputJsonValue,
        location: d.location as Prisma.InputJsonValue,
        budgetType: d.budgetType,
        budget: new Prisma.Decimal(d.budget),
        creative: d.creative as Prisma.InputJsonValue,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
      },
    });
    await this.audit(user, 'SORTEX_AD_CREATED', ad.id);
    return this.adNumbers(ad);
  }
  async updateAd(user: AuthenticatedUser, id: string, d: SortexAdDto) {
    const current = await this.ownedAd(user, id);
    if (
      current.status !== SortexAdStatus.DRAFT &&
      current.status !== SortexAdStatus.PAUSED
    )
      throw new BadRequestException('Pause a divulgação antes de editar.');
    await this.campaign(d.campaignId, user.id);
    const ad = await this.prisma.sortexAdCampaign.update({
      where: { id },
      data: {
        campaignId: d.campaignId,
        promotionId: d.promotionId,
        name: d.name,
        objective: d.objective,
        channels: d.channels,
        audience: d.audience as Prisma.InputJsonValue,
        location: d.location as Prisma.InputJsonValue,
        budgetType: d.budgetType,
        budget: new Prisma.Decimal(d.budget),
        creative: d.creative as Prisma.InputJsonValue,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
      },
    });
    await this.audit(user, 'SORTEX_AD_UPDATED', id);
    return this.adNumbers(ad);
  }
  async adAction(user: AuthenticatedUser, id: string, action: string) {
    await this.ownedAd(user, id);
    const status =
      action === 'activate'
        ? SortexAdStatus.SANDBOX_ACTIVE
        : action === 'pause'
          ? SortexAdStatus.PAUSED
          : action === 'end'
            ? SortexAdStatus.ENDED
            : null;
    if (!status) throw new BadRequestException('Ação inválida.');
    const updated = await this.prisma.sortexAdCampaign.update({
      where: { id },
      data: { status },
    });
    await this.audit(user, `SORTEX_AD_${action.toUpperCase()}`, id);
    return this.adNumbers(updated);
  }
  async duplicateAd(user: AuthenticatedUser, id: string) {
    const a = await this.ownedAd(user, id);
    return this.prisma.sortexAdCampaign.create({
      data: {
        organizerId: user.id,
        campaignId: a.campaignId,
        promotionId: a.promotionId,
        name: `${a.name} - cópia`,
        code: randomBytes(8).toString('hex'),
        objective: a.objective,
        channels: a.channels,
        audience: a.audience as Prisma.InputJsonValue,
        location: a.location as Prisma.InputJsonValue,
        budgetType: a.budgetType,
        budget: a.budget,
        creative: a.creative as Prisma.InputJsonValue,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: SortexAdStatus.DRAFT,
      },
    });
  }
  async deleteAd(user: AuthenticatedUser, id: string) {
    const a = await this.ownedAd(user, id);
    if (
      a.status !== SortexAdStatus.DRAFT &&
      a.status !== SortexAdStatus.CANCELLED
    )
      throw new BadRequestException(
        'Apenas rascunhos ou divulgações canceladas podem ser excluídos.',
      );
    return this.prisma.sortexAdCampaign.delete({ where: { id } });
  }
  async trackAd(code: string, d: AdTrackDto) {
    const ad = await this.prisma.sortexAdCampaign.findUnique({
      where: { code },
    });
    if (!ad || ad.status !== SortexAdStatus.SANDBOX_ACTIVE)
      throw new NotFoundException('Divulgação indisponível.');
    const hash = d.visitorId
      ? createHash('sha256').update(d.visitorId).digest('hex').slice(0, 32)
      : null;
    await this.prisma.sortexAdEvent.create({
      data: {
        adId: ad.id,
        visitorHash: hash,
        buyerId: d.buyerId,
        purchaseId: d.purchaseId,
        type: d.type,
        value: d.value ? new Prisma.Decimal(d.value) : null,
        channel: d.channel as any,
      },
    });
    const increments: any = {};
    if (
      [
        'VIEW',
        'CLICK',
        'REGISTRATION',
        'RESERVATION',
        'APPROVED_SALE',
      ].includes(d.type)
    )
      increments[
        {
          VIEW: 'views',
          CLICK: 'clicks',
          REGISTRATION: 'registrations',
          RESERVATION: 'reservations',
          APPROVED_SALE: 'approvedSales',
        }[d.type]!
      ] = { increment: 1 };
    if (d.type === 'APPROVED_SALE' && d.value)
      increments.attributedRevenue = { increment: new Prisma.Decimal(d.value) };
    await this.prisma.sortexAdCampaign.update({
      where: { id: ad.id },
      data: increments,
    });
    return {
      destination: `/campanha/${(await this.prisma.campaign.findUnique({ where: { id: ad.campaignId }, select: { slug: true } }))?.slug}`,
      windowDays: 7,
      attribution: 'LAST_CLICK',
      sandbox: true,
    };
  }
  async generateRecommendations(user: AuthenticatedUser) {
    this.organizer(user);
    const campaigns = await this.prisma.campaign.findMany({
      where: { organizerId: user.id },
      include: {
        purchases: {
          select: {
            status: true,
            total: true,
            createdAt: true,
            expiresAt: true,
          },
        },
        promotions: { where: { deletedAt: null } },
        galleryImages: { select: { id: true } },
      },
    });
    const now = new Date();
    for (const c of campaigns) {
      const abandoned = c.purchases.filter(
          (p) => p.status === 'PENDING' && p.expiresAt < now,
        ).length,
        approved = c.purchases.filter((p) => p.status === 'PAID'),
        days = c.drawDate
          ? Math.ceil((c.drawDate.getTime() - now.getTime()) / 86400000)
          : null;
      const rules: Array<
        [string, string, string, any, AiRecommendationPriority, string, string]
      > = [];
      if (abandoned > 0)
        rules.push([
          'ABANDONED',
          'Recupere reservas abandonadas',
          `${abandoned} reservas expiraram sem pagamento.`,
          { abandoned },
          AiRecommendationPriority.HIGH,
          'COMMUNICATION',
          `/dashboard/comunicacao?campaignId=${c.id}&audience=abandoned`,
        ]);
      if (
        c.status === CampaignStatus.PUBLISHED &&
        days !== null &&
        days <= 7 &&
        c.soldNumbers / Math.max(1, c.totalNumbers) < 0.7
      )
        rules.push([
          'DRAW_LOW_SALES',
          'Campanha próxima do sorteio com baixa venda',
          `Faltam ${days} dias e o progresso está em ${Math.round((c.soldNumbers / c.totalNumbers) * 100)}%.`,
          {
            days,
            soldPercent: Math.round((c.soldNumbers / c.totalNumbers) * 100),
          },
          AiRecommendationPriority.CRITICAL,
          'PROMOTION',
          `/dashboard/promocoes?campaignId=${c.id}`,
        ]);
      if (!c.coverImage && c.galleryImages.length === 0)
        rules.push([
          'MISSING_IMAGE',
          'Adicione uma imagem de destaque',
          'A campanha não possui imagem principal.',
          { images: 0 },
          AiRecommendationPriority.MEDIUM,
          'CAMPAIGN',
          `/dashboard/campanhas/${c.id}/editar`,
        ]);
      if (c.promotions.length === 0 && c.status === CampaignStatus.PUBLISHED)
        rules.push([
          'NO_PROMOTION',
          'Teste uma promoção',
          'A campanha publicada ainda não possui promoção ativa.',
          { promotions: 0, approvedSales: approved.length },
          AiRecommendationPriority.LOW,
          'PROMOTION',
          `/dashboard/promocoes?campaignId=${c.id}`,
        ]);
      for (const [
        rk,
        title,
        explanation,
        evidence,
        priority,
        actionType,
        actionUrl,
      ] of rules) {
        const existing = await this.prisma.aiRecommendation.findFirst({
          where: { organizerId: user.id, campaignId: c.id, ruleKey: rk },
        });
        if (existing)
          await this.prisma.aiRecommendation.update({
            where: { id: existing.id },
            data: {
              title,
              explanation,
              evidence,
              priority,
              actionType,
              actionUrl,
              generatedAt: now,
            },
          });
        else
          await this.prisma.aiRecommendation.create({
            data: {
              organizerId: user.id,
              campaignId: c.id,
              ruleKey: rk,
              title,
              explanation,
              evidence,
              priority,
              actionType,
              actionUrl,
              impact:
                priority === AiRecommendationPriority.CRITICAL
                  ? 'Ação recomendada hoje'
                  : 'Oportunidade de melhoria',
            },
          });
      }
    }
    return this.recommendations(user);
  }
  async recommendations(user: AuthenticatedUser) {
    this.organizer(user);
    const items = await this.prisma.aiRecommendation.findMany({
      where: { organizerId: user.id },
      include: { campaign: { select: { id: true, title: true, slug: true } } },
      orderBy: [{ priority: 'asc' }, { generatedAt: 'desc' }],
    });
    const campaigns = await this.prisma.campaign.findMany({
      where: { organizerId: user.id },
      select: {
        title: true,
        grossRevenue: true,
        soldNumbers: true,
        totalNumbers: true,
      },
    });
    const revenue = campaigns.reduce((s, c) => s + Number(c.grossRevenue), 0);
    return {
      summary: {
        campaigns: campaigns.length,
        revenue,
        averageProgress: campaigns.length
          ? Math.round(
              (campaigns.reduce(
                (s, c) => s + c.soldNumbers / Math.max(1, c.totalNumbers),
                0,
              ) /
                campaigns.length) *
                100,
            )
          : 0,
      },
      items,
    };
  }
  async feedback(
    user: AuthenticatedUser,
    id: string,
    d: RecommendationFeedbackDto,
  ) {
    this.organizer(user);
    const item = await this.prisma.aiRecommendation.findFirst({
      where: { id, organizerId: user.id },
    });
    if (!item) throw new NotFoundException('Recomendação não encontrada.');
    return this.prisma.aiRecommendation.update({
      where: { id },
      data: {
        status: d.status,
        feedback: d.feedback,
        viewedAt:
          d.status === AiRecommendationStatus.VIEWED
            ? new Date()
            : item.viewedAt,
        actedAt:
          d.status === AiRecommendationStatus.ACCEPTED ||
          d.status === AiRecommendationStatus.EXECUTED
            ? new Date()
            : item.actedAt,
      },
    });
  }
  private async ownedPromotion(u: AuthenticatedUser, id: string) {
    this.organizer(u);
    const p = await this.prisma.campaignPromotion.findFirst({
      where: { id, campaign: { organizerId: u.id }, deletedAt: null },
    });
    if (!p) throw new NotFoundException('Promoção não encontrada.');
    return p;
  }
  private async ownedAd(u: AuthenticatedUser, id: string) {
    this.organizer(u);
    const a = await this.prisma.sortexAdCampaign.findFirst({
      where: { id, organizerId: u.id },
    });
    if (!a) throw new NotFoundException('Divulgação não encontrada.');
    return a;
  }
  private validatePeriod(s?: string, e?: string) {
    if (s && e && new Date(s) >= new Date(e))
      throw new BadRequestException('O término deve ocorrer depois do início.');
  }
  private initialPromotionStatus(s?: string) {
    return s && new Date(s) > new Date()
      ? PromotionStatus.SCHEDULED
      : PromotionStatus.DRAFT;
  }
  private promotionNumbers = (p: any) => ({
    ...p,
    packagePrice: Number(p.packagePrice),
    discountRate: Number(p.discountRate),
    attributedRevenue: Number(p.attributedRevenue),
    grantedDiscount: Number(p.grantedDiscount),
  });
  private adNumbers = (a: any) => ({
    ...a,
    budget: Number(a.budget),
    attributedRevenue: Number(a.attributedRevenue),
    spent: Number(a.spent),
    ctr: Number(a.ctr),
    cpm: Number(a.cpm),
    cpc: Number(a.cpc),
  });
  private audit(
    u: AuthenticatedUser,
    action: string,
    id: string,
    previousData?: Prisma.InputJsonValue,
    newData?: Prisma.InputJsonValue,
  ) {
    return this.prisma.auditLog.create({
      data: {
        entityType: 'GROWTH',
        entityId: id,
        action,
        actorUserId: u.id,
        actorRole: u.role,
        previousData,
        newData,
        metadata: { sandbox: true },
      },
    });
  }
}

function jsonRecord(value: Prisma.JsonValue): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function jsonStringList(value: Prisma.JsonValue | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
