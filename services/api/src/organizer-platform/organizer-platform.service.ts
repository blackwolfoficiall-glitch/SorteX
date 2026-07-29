import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MiniCampaignStatus,
  OrganizerDomainStatus,
  OrganizerOnboardingStatus,
  OrganizerPlan,
  Prisma,
  SubscriptionStatus,
  UserRole,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizerStorageService } from '../organizers/organizer-storage.service';
import type { UploadedOrganizerFile } from '../organizers/types/uploaded-file.type';
import {
  CampaignTemplateDto,
  CommunityLinkDto,
  DomainDto,
  ListOrdersDto,
  MiniCampaignDto,
  MiniCampaignResultDto,
  ReserveMiniCampaignDto,
  SelectPlanDto,
  SocialLinkDto,
  UpdateBrandDto,
} from './dto/organizer-platform.dto';

const planEnumByCode: Record<string, OrganizerPlan> = {
  INITIAL: OrganizerPlan.BASIC,
  PROFESSIONAL: OrganizerPlan.PROFESSIONAL,
  ADVANCED: OrganizerPlan.PREMIUM,
  ENTERPRISE: OrganizerPlan.ENTERPRISE,
};

@Injectable()
export class OrganizerPlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: OrganizerStorageService,
  ) {}

  async dashboard(user: AuthenticatedUser) {
    this.organizer(user);
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidWhere = {
      status: 'PAID' as const,
      campaign: { organizerId: user.id },
    };
    const [campaigns, totals, todayTotals, monthTotals, participants] =
      await Promise.all([
        this.prisma.campaign.findMany({
          where: { organizerId: user.id },
          select: {
            id: true,
            title: true,
            status: true,
            soldNumbers: true,
            totalNumbers: true,
            grossRevenue: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.purchase.aggregate({
          where: paidWhere,
          _sum: { total: true, quantity: true },
          _count: { id: true },
        }),
        this.prisma.purchase.aggregate({
          where: { ...paidWhere, confirmedAt: { gte: today } },
          _sum: { total: true },
        }),
        this.prisma.purchase.aggregate({
          where: { ...paidWhere, confirmedAt: { gte: month } },
          _sum: { total: true },
        }),
        this.prisma.purchase.groupBy({
          by: ['buyerId'],
          where: paidWhere,
        }),
      ]);
    const grossRevenue = Number(totals._sum.total ?? 0);
    const paidOrders = totals._count.id;
    return {
      summary: {
        grossRevenue,
        revenueToday: Number(todayTotals._sum.total ?? 0),
        revenueMonth: Number(monthTotals._sum.total ?? 0),
        activeCampaigns: campaigns.filter((campaign) =>
          ['PUBLISHED', 'SOLD_OUT'].includes(campaign.status),
        ).length,
        soldTickets: totals._sum.quantity ?? 0,
        participants: participants.length,
        averageTicket: paidOrders ? grossRevenue / paidOrders : 0,
      },
      campaigns: campaigns.map((campaign) => ({
        ...campaign,
        grossRevenue: Number(campaign.grossRevenue),
      })),
      generatedAt: now.toISOString(),
    };
  }

  listPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      include: { features: { orderBy: { name: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async currentPlan(user: AuthenticatedUser) {
    this.organizer(user);
    await this.ensureOrganizerProfile(user);
    const [profile, subscription, campaigns] = await Promise.all([
      this.prisma.organizerProfile.findUnique({ where: { userId: user.id } }),
      this.prisma.subscription.findFirst({
        where: { organizerId: user.id },
        include: { selectedPlan: { include: { features: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaign.count({ where: { organizerId: user.id } }),
    ]);
    if (!profile)
      throw new NotFoundException('Perfil do organizador não encontrado.');
    const fallbackCode = this.codeFromEnum(profile.currentPlan);
    const configuredFallback = subscription?.selectedPlan
      ? null
      : await this.prisma.plan.findUnique({
          where: { code: fallbackCode },
          include: { features: true },
        });
    const fallbackPlan = subscription?.selectedPlan
      ? null
      : (configuredFallback ?? (await this.ensureFreePlan()));
    const selectedPlan = subscription?.selectedPlan ?? fallbackPlan;
    return {
      profile: {
        onboardingStatus: profile.onboardingStatus,
        planSelectedAt: profile.planSelectedAt,
      },
      subscription: subscription
        ? { ...subscription, monthlyPrice: Number(subscription.monthlyPrice) }
        : null,
      plan: selectedPlan
        ? {
            ...selectedPlan,
            monthlyPrice: Number(selectedPlan.monthlyPrice),
            platformFeeRate: Number(selectedPlan.platformFeeRate),
          }
        : null,
      consumption: { campaigns },
      sandbox: true,
      message:
        'Plano registrado em ambiente de teste. Nenhuma cobrança foi realizada.',
    };
  }

  async selectPlan(user: AuthenticatedUser, data: SelectPlanDto) {
    this.organizer(user);
    await this.ensureOrganizerProfile(user);
    const plan = await this.prisma.plan.findFirst({
      where: { id: data.planId, isActive: true },
      include: { features: true },
    });
    if (!plan) throw new NotFoundException('Plano não encontrado.');
    const enumPlan = planEnumByCode[plan.code];
    if (!enumPlan)
      throw new BadRequestException(
        'Este plano não possui mapeamento comercial válido.',
      );
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(
      periodEnd.getMonth() + (data.billingCycle === 'ANNUAL' ? 12 : 1),
    );
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          organizerId: user.id,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
        },
        data: {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: now,
          autoRenew: false,
        },
      });
      const subscription = await tx.subscription.create({
        data: {
          organizerId: user.id,
          plan: enumPlan,
          planId: plan.id,
          billingCycle: data.billingCycle,
          sandboxMode: true,
          status: SubscriptionStatus.ACTIVE,
          monthlyPrice: plan.monthlyPrice,
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextRenewalAt: periodEnd,
        },
      });
      await tx.organizerProfile.update({
        where: { userId: user.id },
        data: {
          currentPlan: enumPlan,
          platformFee: plan.platformFeeRate,
          monthlyFee: plan.monthlyPrice,
          onboardingStatus: OrganizerOnboardingStatus.IDENTITY_SETUP,
          planSelectedAt: now,
        },
      });
      await this.audit(
        tx,
        user,
        'SUBSCRIPTION',
        subscription.id,
        'PLAN_SELECTED',
        null,
        { planId: plan.id, billingCycle: data.billingCycle, sandbox: true },
      );
      return subscription;
    });
    return {
      ...result,
      monthlyPrice: Number(result.monthlyPrice),
      plan,
      message:
        'Plano ativado em ambiente de teste. Nenhuma cobrança foi realizada.',
    };
  }

  async cancelPlan(user: AuthenticatedUser) {
    const subscription = await this.ownedSubscription(user);
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        autoRenew: false,
      },
    });
    await this.audit(
      this.prisma,
      user,
      'SUBSCRIPTION',
      updated.id,
      'PLAN_CANCELLED',
    );
    return updated;
  }

  async reactivatePlan(user: AuthenticatedUser) {
    const subscription = await this.ownedSubscription(user);
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        cancelledAt: null,
        autoRenew: true,
      },
    });
    await this.audit(
      this.prisma,
      user,
      'SUBSCRIPTION',
      updated.id,
      'PLAN_REACTIVATED',
    );
    return updated;
  }

  async completeOnboarding(user: AuthenticatedUser, data: UpdateBrandDto = {}) {
    this.organizer(user);
    await this.ensureOrganizerProfile(user);
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const brandData = Object.fromEntries(
        Object.entries(data).filter(([, value]) => value !== undefined),
      ) as UpdateBrandDto;
      const hasBrandChanges = Object.keys(brandData).length > 0;
      const brand = hasBrandChanges
        ? await tx.organizerBrandProfile.upsert({
            where: { organizerId: user.id },
            create: {
              organizerId: user.id,
              publicName: brandData.publicName?.trim() || user.name,
              publicEmail: brandData.publicEmail || user.email,
              publicPhone: brandData.publicPhone || user.phone,
              ...brandData,
              appearanceConfig: brandData.appearanceConfig as
                Prisma.InputJsonValue | undefined,
            },
            update: {
              ...brandData,
              appearanceConfig: brandData.appearanceConfig as
                Prisma.InputJsonValue | undefined,
            },
          })
        : null;
      const profile = await tx.organizerProfile.update({
        where: { userId: user.id },
        data: {
          onboardingStatus: OrganizerOnboardingStatus.COMPLETE,
          identitySetupCompletedAt: now,
        },
      });
      await this.audit(
        tx,
        user,
        'ORGANIZER_PROFILE',
        profile.id,
        'ONBOARDING_COMPLETED',
        null,
        {
          personalizationSaved: hasBrandChanges,
          completedAt: now.toISOString(),
        },
      );
      return {
        onboardingStatus: profile.onboardingStatus,
        identitySetupCompletedAt: profile.identitySetupCompletedAt,
        brand,
      };
    });
  }

  async personalization(user: AuthenticatedUser) {
    this.organizer(user);
    const owner = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { name: true, email: true, phone: true },
    });
    if (!owner) throw new NotFoundException('Organizador não encontrado.');
    const brand = await this.ensureBrand(user.id, owner);
    const [socialLinks, communities, domains, templates] = await Promise.all([
      this.prisma.organizerSocialLink.findMany({
        where: { organizerId: user.id },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.organizerCommunityLink.findMany({
        where: { organizerId: user.id },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.organizerDomain.findMany({
        where: { organizerId: user.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaignTemplate.findMany({
        where: { organizerId: user.id, isActive: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return { brand, socialLinks, communities, domains, templates };
  }

  private async ensureBrand(
    organizerId: string,
    owner: { name: string; email: string; phone: string | null },
  ) {
    const current = await this.prisma.organizerBrandProfile.findUnique({
      where: { organizerId },
    });
    if (current) return current;
    try {
      return await this.prisma.organizerBrandProfile.create({
        data: {
          organizerId,
          publicName: owner.name,
          publicEmail: owner.email,
          publicPhone: owner.phone,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const created = await this.prisma.organizerBrandProfile.findUnique({
          where: { organizerId },
        });
        if (created) return created;
      }
      throw error;
    }
  }

  async updateBrand(user: AuthenticatedUser, data: UpdateBrandDto) {
    this.organizer(user);
    const current = await this.personalization(user);
    const brand = await this.prisma.organizerBrandProfile.update({
      where: { organizerId: user.id },
      data: {
        ...data,
        appearanceConfig: data.appearanceConfig as
          Prisma.InputJsonValue | undefined,
      },
    });
    await this.audit(
      this.prisma,
      user,
      'ORGANIZER_BRAND_PROFILE',
      user.id,
      'PERSONALIZATION_UPDATED',
      current.brand,
      brand,
    );
    return brand;
  }

  async uploadBrandAsset(
    user: AuthenticatedUser,
    kind: 'logo' | 'profile' | 'banner',
    file?: UploadedOrganizerFile,
  ) {
    this.organizer(user);
    await this.personalization(user);
    const saved = await this.storage.save(`brand-${user.id}`, file, {
      maxSize: 5 * 1024 * 1024,
      allowedMimeTypes: {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      },
    });
    const field =
      kind === 'logo'
        ? 'primaryLogoUrl'
        : kind === 'profile'
          ? 'profileImageUrl'
          : 'bannerUrl';
    const brand = await this.prisma.organizerBrandProfile.update({
      where: { organizerId: user.id },
      data: { [field]: saved.storageKey },
    });
    await this.audit(
      this.prisma,
      user,
      'ORGANIZER_BRAND_PROFILE',
      user.id,
      'BRAND_ASSET_UPLOADED',
      null,
      { kind, mimeType: saved.mimeType },
    );
    return { brand, url: `/organizers/${user.id}/brand-assets/${kind}` };
  }

  async brandAsset(organizerId: string, kind: 'logo' | 'profile' | 'banner') {
    const brand = await this.prisma.organizerBrandProfile.findUnique({
      where: { organizerId },
      select: { primaryLogoUrl: true, profileImageUrl: true, bannerUrl: true },
    });
    const storageKey =
      kind === 'logo'
        ? brand?.primaryLogoUrl
        : kind === 'profile'
          ? brand?.profileImageUrl
          : brand?.bannerUrl;
    if (!storageKey || /^https?:\/\//.test(storageKey))
      throw new NotFoundException('Imagem não encontrada.');
    const path = this.storage.resolve(storageKey);
    if (!existsSync(path))
      throw new NotFoundException('Arquivo não encontrado.');
    return {
      stream: createReadStream(path),
      mimeType: this.storage.mimeType(storageKey),
    };
  }
  async removeBrandAsset(
    user: AuthenticatedUser,
    kind: 'logo' | 'profile' | 'banner',
  ) {
    this.organizer(user);
    await this.personalization(user);
    const field =
      kind === 'logo'
        ? 'primaryLogoUrl'
        : kind === 'profile'
          ? 'profileImageUrl'
          : 'bannerUrl';
    const brand = await this.prisma.organizerBrandProfile.update({
      where: { organizerId: user.id },
      data: { [field]: null },
    });
    await this.audit(
      this.prisma,
      user,
      'ORGANIZER_BRAND_PROFILE',
      user.id,
      'BRAND_ASSET_REMOVED',
      null,
      { kind },
    );
    return brand;
  }
  async resetBrand(user: AuthenticatedUser) {
    this.organizer(user);
    const owner = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, email: true, phone: true },
    });
    const brand = await this.prisma.organizerBrandProfile.update({
      where: { organizerId: user.id },
      data: {
        publicName: owner.name,
        publicEmail: owner.email,
        publicPhone: owner.phone,
        primaryColor: '#6D28D9',
        secondaryColor: '#111827',
        accentColor: '#22C55E',
        textColor: '#FFFFFF',
        buttonColor: '#2563EB',
        progressColor: '#22C55E',
        backgroundColor: '#FFFFFF',
        cardColor: '#FFFFFF',
        themeMode: 'LIGHT',
        layoutStyle: 'MODERN',
        appearanceConfig: Prisma.JsonNull,
      },
    });
    await this.audit(
      this.prisma,
      user,
      'ORGANIZER_BRAND_PROFILE',
      user.id,
      'PERSONALIZATION_RESET',
    );
    return brand;
  }

  async addSocial(user: AuthenticatedUser, data: SocialLinkDto) {
    this.organizer(user);
    return this.prisma.organizerSocialLink.upsert({
      where: { organizerId_type: { organizerId: user.id, type: data.type } },
      create: { organizerId: user.id, ...data },
      update: data,
    });
  }

  async updateSocial(user: AuthenticatedUser, id: string, data: SocialLinkDto) {
    await this.owned('organizerSocialLink', id, user.id);
    return this.prisma.organizerSocialLink.update({ where: { id }, data });
  }

  async deleteSocial(user: AuthenticatedUser, id: string) {
    await this.owned('organizerSocialLink', id, user.id);
    return this.prisma.organizerSocialLink.delete({ where: { id } });
  }

  async addCommunity(user: AuthenticatedUser, data: CommunityLinkDto) {
    this.organizer(user);
    return this.prisma.organizerCommunityLink.create({
      data: { organizerId: user.id, ...data },
    });
  }

  async updateCommunity(
    user: AuthenticatedUser,
    id: string,
    data: CommunityLinkDto,
  ) {
    await this.owned('organizerCommunityLink', id, user.id);
    return this.prisma.organizerCommunityLink.update({ where: { id }, data });
  }

  async deleteCommunity(user: AuthenticatedUser, id: string) {
    await this.owned('organizerCommunityLink', id, user.id);
    return this.prisma.organizerCommunityLink.delete({ where: { id } });
  }

  async addDomain(user: AuthenticatedUser, data: DomainDto) {
    this.organizer(user);
    await this.requireFeature(user.id, 'customDomain');
    const domain = this.normalizeDomain(data.domain);
    const verificationToken = randomBytes(18).toString('hex');
    const record = await this.prisma.organizerDomain.create({
      data: {
        organizerId: user.id,
        type: data.type,
        domain,
        isPrimary: data.isPrimary ?? false,
        verificationToken,
        dnsInstructions: {
          mode: 'sandbox',
          recordType: data.type === 'ROOT' ? 'A' : 'CNAME',
          host: data.type === 'ROOT' ? '@' : domain.split('.')[0],
          target: 'domains.sandbox.sortex.local',
          verification: {
            type: 'TXT',
            name: '_sortex-verification',
            value: verificationToken,
          },
        },
      },
    });
    await this.audit(
      this.prisma,
      user,
      'ORGANIZER_DOMAIN',
      record.id,
      'DOMAIN_CREATED',
    );
    return {
      ...record,
      sandbox: true,
      message:
        'Domínio salvo. A verificação está em modo de teste e não altera seu DNS.',
    };
  }

  async verifyDomain(user: AuthenticatedUser, id: string) {
    await this.owned('organizerDomain', id, user.id);
    const domain = await this.prisma.organizerDomain.update({
      where: { id },
      data: {
        status: OrganizerDomainStatus.VERIFYING,
        lastCheckedAt: new Date(),
        errorMessage: null,
      },
    });
    return {
      ...domain,
      sandbox: true,
      message:
        'Verificação solicitada em modo de teste. O domínio não será marcado como ativo sem confirmação DNS real.',
    };
  }

  async deleteDomain(user: AuthenticatedUser, id: string) {
    await this.owned('organizerDomain', id, user.id);
    return this.prisma.organizerDomain.delete({ where: { id } });
  }

  async createTemplate(user: AuthenticatedUser, data: CampaignTemplateDto) {
    this.organizer(user);
    if (data.sourceCampaignId)
      await this.ownedCampaign(data.sourceCampaignId, user.id);
    return this.prisma.campaignTemplate.create({
      data: {
        organizerId: user.id,
        ...data,
        configuration: data.configuration as Prisma.InputJsonValue,
      },
    });
  }

  async deleteTemplate(user: AuthenticatedUser, id: string) {
    await this.owned('campaignTemplate', id, user.id);
    return this.prisma.campaignTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async listOrders(user: AuthenticatedUser, query: ListOrdersDto) {
    this.organizer(user);
    const where: Prisma.PurchaseWhereInput = {
      campaign: { organizerId: user.id },
      ...(query.campaignId ? { campaignId: query.campaignId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                buyer: {
                  name: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                buyer: {
                  email: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      ...(query.minValue != null || query.maxValue != null
        ? {
            total: {
              ...(query.minValue != null ? { gte: query.minValue } : {}),
              ...(query.maxValue != null ? { lte: query.maxValue } : {}),
            },
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.method
        ? { payments: { some: { method: query.method as never } } }
        : {}),
    };
    const orderBy: Prisma.PurchaseOrderByWithRelationInput =
      query.sort === 'value_desc'
        ? { total: 'desc' }
        : query.sort === 'value_asc'
          ? { total: 'asc' }
          : query.sort === 'quantity_desc'
            ? { quantity: 'desc' }
            : query.sort === 'buyer_desc'
              ? { buyer: { name: 'desc' } }
              : { createdAt: 'desc' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const periodEnd = query.to ? new Date(query.to) : new Date();
    const periodStart = query.from
      ? new Date(query.from)
      : new Date(periodEnd.getTime() - 30 * 86400000);
    const duration = Math.max(
      86400000,
      periodEnd.getTime() - periodStart.getTime(),
    );
    const previousStart = new Date(periodStart.getTime() - duration);
    const baseOrganizerWhere: Prisma.PurchaseWhereInput = {
      campaign: { organizerId: user.id },
    };
    const [items, total, approved, pending, todayCount, period, previous] =
      await Promise.all([
        this.prisma.purchase.findMany({
          where,
          include: {
            campaign: { select: { id: true, title: true, slug: true } },
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
            payments: {
              select: {
                id: true,
                status: true,
                method: true,
                provider: true,
                amount: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            promotion: { select: { id: true, name: true } },
            affiliateConversion: {
              select: { affiliate: { select: { name: true } } },
            },
            _count: { select: { tickets: true } },
          },
          orderBy,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        }),
        this.prisma.purchase.count({ where }),
        this.prisma.purchase.aggregate({
          where: { ...baseOrganizerWhere, status: 'PAID' },
          _sum: { total: true },
        }),
        this.prisma.purchase.count({
          where: {
            ...baseOrganizerWhere,
            status: { in: ['PENDING', 'RESERVED', 'AWAITING_PAYMENT'] },
          },
        }),
        this.prisma.purchase.count({
          where: { ...baseOrganizerWhere, createdAt: { gte: today } },
        }),
        this.prisma.purchase.aggregate({
          where: {
            ...baseOrganizerWhere,
            status: 'PAID',
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          _sum: { total: true },
        }),
        this.prisma.purchase.aggregate({
          where: {
            ...baseOrganizerWhere,
            status: 'PAID',
            createdAt: { gte: previousStart, lt: periodStart },
          },
          _sum: { total: true },
        }),
      ]);
    const periodRevenue = Number(period._sum.total ?? 0);
    const previousRevenue = Number(previous._sum.total ?? 0);
    return {
      items: items.map((item) => ({
        ...item,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        discount: Number(item.discount),
        total: Number(item.total),
        payments: item.payments.map((p) => ({
          ...p,
          amount: Number(p.amount),
        })),
      })),
      total,
      page: query.page,
      pages: Math.ceil(total / query.limit),
      summary: {
        approvedSales: Number(approved._sum.total ?? 0),
        pendingReservations: pending,
        ordersToday: todayCount,
        periodRevenue,
        comparison: previousRevenue
          ? ((periodRevenue - previousRevenue) / previousRevenue) * 100
          : 0,
      },
    };
  }

  async order(user: AuthenticatedUser, id: string) {
    this.organizer(user);
    const order = await this.prisma.purchase.findFirst({
      where: { id, campaign: { organizerId: user.id } },
      include: {
        campaign: true,
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
        _count: { select: { tickets: true } },
        payments: {
          include: {
            events: {
              select: {
                id: true,
                eventType: true,
                processed: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        promotion: true,
        affiliateConversion: {
          select: { affiliate: { select: { name: true } } },
        },
      },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado.');
    return {
      ...order,
      affiliateConversion: order.affiliateConversion
        ? { affiliate: order.affiliateConversion.affiliate.name }
        : null,
      unitPrice: Number(order.unitPrice),
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      total: Number(order.total),
      payments: order.payments.map(
        ({
          pixQrCode,
          pixQrCodeBase64,
          pixCopyPaste,
          metadata,
          ...payment
        }) => ({
          ...payment,
          amount: Number(payment.amount),
          platformFee: Number(payment.platformFee),
          gatewayFee: Number(payment.gatewayFee),
          netAmount: Number(payment.netAmount),
          metadata: metadata ? { protected: true } : null,
          pixAvailable: Boolean(pixQrCode || pixQrCodeBase64 || pixCopyPaste),
        }),
      ),
    };
  }

  async listMiniCampaigns(user: AuthenticatedUser) {
    this.organizer(user);
    return this.prisma.miniCampaign.findMany({
      where: { organizerId: user.id, deletedAt: null },
      include: {
        mainCampaign: { select: { id: true, title: true } },
        _count: { select: { orders: true, tickets: true } },
        result: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async miniCampaign(user: AuthenticatedUser, id: string) {
    this.organizer(user);
    const item = await this.prisma.miniCampaign.findFirst({
      where: { id, organizerId: user.id, deletedAt: null },
      include: {
        mainCampaign: { select: { id: true, title: true, slug: true } },
        orders: {
          include: {
            buyer: {
              select: { id: true, name: true, city: true, state: true },
            },
            _count: { select: { tickets: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        result: {
          include: {
            winner: {
              select: { id: true, name: true, city: true, state: true },
            },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Mini Campanha não encontrada.');
    return item;
  }

  async publicMiniCampaign(slug: string) {
    const item = await this.prisma.miniCampaign.findFirst({
      where: { slug, status: MiniCampaignStatus.PUBLISHED, deletedAt: null },
      include: {
        mainCampaign: { select: { id: true, title: true, slug: true } },
        organizer: {
          select: {
            organizerBrandProfile: {
              select: {
                publicName: true,
                primaryLogoUrl: true,
                primaryColor: true,
              },
            },
          },
        },
        result: {
          include: {
            winner: { select: { name: true, city: true, state: true } },
          },
        },
      },
    });
    if (!item)
      throw new NotFoundException(
        'Mini Campanha não encontrada ou indisponível.',
      );
    return {
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      imageUrl: item.imageUrl,
      prizeType: item.prizeType,
      prizeDescription: item.prizeDescription,
      maxTickets: item.maxTickets,
      soldTickets: item.soldTickets,
      availableTickets: Math.max(0, item.maxTickets - item.soldTickets),
      ticketPrice: Number(item.ticketPrice),
      purchaseLimitPerBuyer: item.purchaseLimitPerBuyer,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      drawAt: item.drawAt,
      rules: item.rules,
      mainCampaign: item.mainCampaign,
      organizer: item.organizer.organizerBrandProfile,
      result: item.result,
    };
  }

  async reserveMiniCampaign(
    user: AuthenticatedUser,
    slug: string,
    data: ReserveMiniCampaignDto,
  ) {
    if (user.role !== UserRole.BUYER)
      throw new ForbiddenException(
        'Apenas compradores podem reservar títulos.',
      );
    return this.prisma.$transaction(
      async (tx) => {
        const item = await tx.miniCampaign.findFirst({
          where: {
            slug,
            status: MiniCampaignStatus.PUBLISHED,
            deletedAt: null,
          },
        });
        if (!item)
          throw new NotFoundException(
            'Mini Campanha não encontrada ou indisponível.',
          );
        const now = new Date();
        if (item.startsAt && item.startsAt > now)
          throw new BadRequestException(
            'Esta Mini Campanha ainda não começou.',
          );
        if (item.endsAt && item.endsAt <= now)
          throw new BadRequestException('Esta Mini Campanha já foi encerrada.');
        if (
          item.purchaseLimitPerBuyer &&
          data.quantity > item.purchaseLimitPerBuyer
        )
          throw new BadRequestException(
            `O limite por comprador é de ${item.purchaseLimitPerBuyer} títulos.`,
          );
        if (item.soldTickets + data.quantity > item.maxTickets)
          throw new BadRequestException(
            'Não há títulos suficientes disponíveis.',
          );
        const used = new Set(
          (
            await tx.miniCampaignTicket.findMany({
              where: { miniCampaignId: item.id },
              select: { number: true },
            })
          ).map((row) => row.number),
        );
        const numbers: number[] = [];
        for (
          let number = 1;
          number <= item.maxTickets && numbers.length < data.quantity;
          number += 1
        )
          if (!used.has(number)) numbers.push(number);
        if (numbers.length !== data.quantity)
          throw new BadRequestException(
            'Não há títulos suficientes disponíveis.',
          );
        const order = await tx.miniCampaignOrder.create({
          data: {
            miniCampaignId: item.id,
            buyerId: user.id,
            code: `MINI-${randomBytes(6).toString('hex').toUpperCase()}`,
            status: 'AWAITING_PAYMENT',
            quantity: data.quantity,
            unitPrice: item.ticketPrice,
            total: item.ticketPrice.mul(data.quantity),
            expiresAt: new Date(now.getTime() + 15 * 60 * 1000),
          },
        });
        await tx.miniCampaignTicket.createMany({
          data: numbers.map((number) => ({
            miniCampaignId: item.id,
            orderId: order.id,
            number,
          })),
        });
        await tx.miniCampaign.update({
          where: { id: item.id },
          data: { soldTickets: { increment: data.quantity } },
        });
        return {
          orderId: order.id,
          code: order.code,
          quantity: order.quantity,
          total: Number(order.total),
          numbers,
          sandbox: true,
          message:
            'Reserva registrada em modo de teste. Nenhum pagamento real foi processado.',
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createMiniCampaign(user: AuthenticatedUser, data: MiniCampaignDto) {
    this.organizer(user);
    await this.requireFeature(user.id, 'miniCampaigns');
    await this.ownedCampaign(data.mainCampaignId, user.id);
    this.validateMiniCampaign(data);
    const item = await this.prisma.miniCampaign.create({
      data: {
        organizerId: user.id,
        ...this.miniData(data),
        slug: await this.uniqueSlug(data.name),
      },
    });
    await this.audit(
      this.prisma,
      user,
      'MINI_CAMPAIGN',
      item.id,
      'MINI_CAMPAIGN_CREATED',
    );
    return item;
  }

  async updateMiniCampaign(
    user: AuthenticatedUser,
    id: string,
    data: MiniCampaignDto,
  ) {
    const current = await this.ownedMiniCampaign(id, user.id);
    await this.ownedCampaign(data.mainCampaignId, user.id);
    this.validateMiniCampaign(data);
    if (
      current.status !== MiniCampaignStatus.DRAFT &&
      current.status !== MiniCampaignStatus.PAUSED
    )
      throw new BadRequestException('Pause a Mini Campanha antes de editar.');
    return this.prisma.miniCampaign.update({
      where: { id },
      data: this.miniData(data),
    });
  }

  async miniAction(
    user: AuthenticatedUser,
    id: string,
    action: 'publish' | 'pause' | 'finish',
  ) {
    const current = await this.ownedMiniCampaign(id, user.id);
    const status =
      action === 'publish'
        ? MiniCampaignStatus.PUBLISHED
        : action === 'pause'
          ? MiniCampaignStatus.PAUSED
          : MiniCampaignStatus.FINISHED;
    if (action === 'publish' && current.status === MiniCampaignStatus.FINISHED)
      throw new BadRequestException(
        'Mini Campanha finalizada não pode ser republicada.',
      );
    const updated = await this.prisma.miniCampaign.update({
      where: { id },
      data: {
        status,
        ...(action === 'publish'
          ? { publishedAt: current.publishedAt ?? new Date() }
          : {}),
        ...(action === 'finish' ? { finishedAt: new Date() } : {}),
      },
    });
    await this.audit(
      this.prisma,
      user,
      'MINI_CAMPAIGN',
      id,
      `MINI_CAMPAIGN_${action.toUpperCase()}`,
    );
    return updated;
  }

  async duplicateMiniCampaign(user: AuthenticatedUser, id: string) {
    const current = await this.ownedMiniCampaign(id, user.id);
    return this.prisma.miniCampaign.create({
      data: {
        organizerId: user.id,
        mainCampaignId: current.mainCampaignId,
        name: `${current.name} - cópia`,
        slug: await this.uniqueSlug(`${current.name}-copia`),
        description: current.description,
        imageUrl: current.imageUrl,
        prizeType: current.prizeType,
        prizeDescription: current.prizeDescription,
        maxTickets: current.maxTickets,
        ticketPrice: current.ticketPrice,
        purchaseLimitPerBuyer: current.purchaseLimitPerBuyer,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        drawAt: current.drawAt,
        rules: current.rules,
        status: MiniCampaignStatus.DRAFT,
      },
    });
  }

  async recordMiniCampaignResult(
    user: AuthenticatedUser,
    id: string,
    data: MiniCampaignResultDto,
  ) {
    const current = await this.ownedMiniCampaign(id, user.id);
    const ticket = await this.prisma.miniCampaignTicket.findFirst({
      where: { miniCampaignId: id, number: data.winningNumber },
      include: { order: { select: { buyerId: true } } },
    });
    if (!ticket)
      throw new BadRequestException(
        'O número vencedor não pertence a um pedido desta Mini Campanha.',
      );
    const existing = await this.prisma.miniCampaignResult.findUnique({
      where: { miniCampaignId: id },
    });
    if (existing)
      throw new BadRequestException(
        'O resultado desta Mini Campanha já foi registrado.',
      );
    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.miniCampaignResult.create({
        data: {
          miniCampaignId: id,
          winningNumber: data.winningNumber,
          winnerId: ticket.order.buyerId,
          notes: data.notes,
          drawnAt: new Date(),
        },
      });
      await tx.miniCampaign.update({
        where: { id },
        data: { status: MiniCampaignStatus.FINISHED, finishedAt: new Date() },
      });
      await this.audit(
        tx,
        user,
        'MINI_CAMPAIGN',
        id,
        'MINI_CAMPAIGN_RESULT_RECORDED',
        null,
        { winningNumber: data.winningNumber, previousStatus: current.status },
      );
      return created;
    });
    return result;
  }

  async deleteMiniCampaign(user: AuthenticatedUser, id: string) {
    const current = await this.ownedMiniCampaign(id, user.id);
    if (current.soldTickets > 0)
      throw new BadRequestException(
        'Mini Campanhas com pedidos não podem ser excluídas. Finalize ou pause.',
      );
    return this.prisma.miniCampaign.update({
      where: { id },
      data: { deletedAt: new Date(), status: MiniCampaignStatus.CANCELLED },
    });
  }

  private miniData(data: MiniCampaignDto) {
    return {
      ...data,
      ticketPrice: new Prisma.Decimal(data.ticketPrice),
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      drawAt: data.drawAt ? new Date(data.drawAt) : null,
    };
  }

  private validateMiniCampaign(data: MiniCampaignDto) {
    if (
      data.purchaseLimitPerBuyer &&
      data.purchaseLimitPerBuyer > data.maxTickets
    )
      throw new BadRequestException(
        'O limite por comprador não pode superar o estoque.',
      );
    if (
      data.startsAt &&
      data.endsAt &&
      new Date(data.startsAt) >= new Date(data.endsAt)
    )
      throw new BadRequestException('O término deve ocorrer depois do início.');
  }

  private async ownedSubscription(user: AuthenticatedUser) {
    this.organizer(user);
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizerId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription)
      throw new NotFoundException('Plano do organizador não encontrado.');
    return subscription;
  }

  private async requireFeature(organizerId: string, feature: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        organizerId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      },
      include: { selectedPlan: { include: { features: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const allowed = subscription?.selectedPlan?.features.some(
      (item) => item.key === feature && item.value === true,
    );
    if (!allowed)
      throw new ForbiddenException(
        'Recurso indisponível no plano atual. Consulte Ver planos para liberar o acesso.',
      );
  }

  private async owned(
    model:
      | 'organizerSocialLink'
      | 'organizerCommunityLink'
      | 'organizerDomain'
      | 'campaignTemplate',
    id: string,
    organizerId: string,
  ) {
    const row = await (
      this.prisma[model] as never as {
        findFirst(args: unknown): Promise<{ id: string } | null>;
      }
    ).findFirst({ where: { id, organizerId } });
    if (!row) throw new NotFoundException('Registro não encontrado.');
    return row;
  }

  private async ownedCampaign(id: string, organizerId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, organizerId },
      select: { id: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return campaign;
  }

  private async ownedMiniCampaign(id: string, organizerId: string) {
    const item = await this.prisma.miniCampaign.findFirst({
      where: { id, organizerId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Mini Campanha não encontrada.');
    return item;
  }

  private normalizeDomain(value: string) {
    const domain = value
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.$/, '');
    if (!/^(?=.{4,253}$)(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(domain))
      throw new BadRequestException(
        'Informe um domínio válido, sem protocolo ou caminho.',
      );
    return domain;
  }

  private async uniqueSlug(name: string) {
    const base =
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 70) || 'mini-campanha';
    let slug = base;
    let suffix = 1;
    while (
      await this.prisma.miniCampaign.findUnique({
        where: { slug },
        select: { id: true },
      })
    )
      slug = `${base}-${suffix++}`;
    return slug;
  }

  private codeFromEnum(plan: OrganizerPlan) {
    return plan === OrganizerPlan.BASIC
      ? 'INITIAL'
      : plan === OrganizerPlan.PREMIUM
        ? 'ADVANCED'
        : plan;
  }

  private ensureFreePlan() {
    return this.prisma.plan.upsert({
      where: { code: 'INITIAL' },
      update: {},
      create: {
        id: 'plan_inicial',
        code: 'INITIAL',
        name: 'Inicial',
        description: 'Plano gratuito com os recursos essenciais para começar.',
        monthlyPrice: 0,
        platformFeeRate: 2.9,
        isActive: true,
        sortOrder: 10,
      },
      include: { features: true },
    });
  }

  private ensureOrganizerProfile(user: AuthenticatedUser) {
    return this.prisma.organizerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        fullName: user.name,
        cpf: user.cpf ?? '',
        phone: user.phone ?? '',
        cnpj: user.cnpj,
        city: user.city,
        state: user.state,
      },
    });
  }

  private organizer(user: AuthenticatedUser) {
    if (user.role !== UserRole.ORGANIZER)
      throw new ForbiddenException('Acesso exclusivo para organizadores.');
  }

  private audit(
    client: PrismaService | Prisma.TransactionClient,
    user: AuthenticatedUser,
    entityType: string,
    entityId: string,
    action: string,
    previousData?: Prisma.InputJsonValue | null,
    newData?: Prisma.InputJsonValue | null,
  ) {
    return client.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        actorUserId: user.id,
        actorRole: user.role,
        previousData: previousData ?? undefined,
        newData: newData ?? undefined,
        metadata: { sandbox: true },
      },
    });
  }
}
