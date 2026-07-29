import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignStatus,
  AdminInvitationStatus,
  AdminTeamRole,
  OrganizerDocumentStatus,
  OrganizerInternalNoteCategory,
  OrganizerRiskLevel,
  PlatformFeeRuleType,
  FinancialAccountStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  ReportStatus,
  SupportStatus,
  UserRole,
  UserStatus,
  VerificationStatus,
  WinnerStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  effectiveAdminPermissions,
  permissionsForAdminRole,
} from '../auth/policies/admin-authorization.policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminListDto,
  AdminGatewayDto,
  AdminTeamDto,
  AcceptAdminInvitationDto,
  AdminMemberActionDto,
  ApprovalListDto,
  AdminNoteDto,
  CampaignActionDto,
  CampaignListDto,
  CreateBannerDto,
  CreateNoticeDto,
  PaymentListDto,
  PlanDto,
  DocumentDecisionDto,
  InternalNoteDto,
  OrganizerDecisionDto,
  OrganizerChecklistDto,
  OrganizerFeeDto,
  ResolveReportDto,
  SupportActionDto,
  SupportListDto,
  SupportMessageDto,
  UpdateAdminPermissionsDto,
  UpsertContentDto,
  UserActionDto,
  UserListDto,
  WinnerActionDto,
  WinnerListDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  async dashboard(q: AdminListDto) {
    const from = q.from
      ? new Date(q.from)
      : q.to
        ? undefined
        : new Date(Date.now() - 30 * 86400000);
    const to = q.to ? new Date(q.to) : undefined;
    const date = { gte: from, lte: to };
    const [
      roles,
      verification,
      campaigns,
      payments,
      gmv,
      platform,
      payouts,
      draws,
      winners,
      support,
      usersSeries,
      campaignSeries,
      topCampaigns,
      topOrganizers,
      plans,
      balances,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      this.prisma.organizerProfile.groupBy({
        by: ['verificationStatus'],
        _count: { _all: true },
      }),
      this.prisma.campaign.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.payment.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.APPROVED, approvedAt: date },
        _sum: { amount: true, platformFee: true },
      }),
      this.prisma.financialAccount.findUnique({
        where: {
          ownerType_ownerId_currency: {
            ownerType: 'PLATFORM',
            ownerId: 'SORTEX',
            currency: 'BRL',
          },
        },
      }),
      this.prisma.payoutRequest.count({
        where: {
          status: { in: [PayoutStatus.REQUESTED, PayoutStatus.UNDER_REVIEW] },
        },
      }),
      this.prisma.campaignDraw.count({
        where: { status: 'PENDING_CONFIRMATION' },
      }),
      this.prisma.winner.count({
        where: {
          status: {
            notIn: [
              WinnerStatus.DELIVERED,
              WinnerStatus.CONFIRMED_BY_WINNER,
              WinnerStatus.CANCELLED,
            ],
          },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          status: { in: [SupportStatus.OPEN, SupportStatus.IN_PROGRESS] },
        },
      }),
      this.prisma.user.findMany({
        where: { createdAt: date },
        select: { createdAt: true, role: true },
      }),
      this.prisma.campaign.findMany({
        where: { createdAt: date },
        select: { createdAt: true, status: true },
      }),
      this.prisma.campaign.findMany({
        orderBy: { grossRevenue: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          grossRevenue: true,
          soldNumbers: true,
          organizer: { select: { name: true } },
        },
      }),
      this.prisma.financialAccount.findMany({
        where: { ownerType: 'ORGANIZER' },
        orderBy: { lifetimeGrossRevenue: 'desc' },
        take: 5,
      }),
      this.prisma.organizerProfile.groupBy({
        by: ['currentPlan'],
        _count: { _all: true },
      }),
      this.prisma.financialAccount.aggregate({
        where: { ownerType: 'ORGANIZER' },
        _sum: {
          pendingBalance: true,
          blockedBalance: true,
          availableBalance: true,
        },
      }),
    ]);
    const roleCounts = new Map(
      roles.map((item) => [item.role, item._count._all]),
    );
    const verificationCounts = new Map(
      verification.map((item) => [item.verificationStatus, item._count._all]),
    );
    const campaignCounts = new Map(
      campaigns.map((item) => [item.status, item._count._all]),
    );
    return this.serialize({
      totals: {
        buyers: roleCounts.get(UserRole.BUYER) ?? 0,
        organizers: roleCounts.get(UserRole.ORGANIZER) ?? 0,
        admins: roleCounts.get(UserRole.ADMIN) ?? 0,
        organizersPending:
          (verificationCounts.get(VerificationStatus.PENDING) ?? 0) +
          (verificationCounts.get(VerificationStatus.UNDER_REVIEW) ?? 0),
        organizersVerified:
          verificationCounts.get(VerificationStatus.VERIFIED) ?? 0,
        campaignDrafts: campaignCounts.get(CampaignStatus.DRAFT) ?? 0,
        campaignsPending:
          campaignCounts.get(CampaignStatus.PENDING_REVIEW) ?? 0,
        campaignsPublished: campaignCounts.get(CampaignStatus.PUBLISHED) ?? 0,
        campaignsFinished: campaignCounts.get(CampaignStatus.FINISHED) ?? 0,
        gmv: gmv._sum.amount ?? 0,
        sortexRevenue:
          gmv._sum.platformFee ?? platform?.lifetimeNetRevenue ?? 0,
        payments,
        pendingPayouts: payouts,
        pendingDraws: draws,
        pendingWinners: winners,
        openSupport: support,
      },
      series: {
        users: this.daily(usersSeries),
        campaigns: this.daily(campaignSeries),
      },
      topCampaigns,
      topOrganizers,
      plans,
      balances: balances._sum,
      alerts: await this.health(),
    });
  }
  async users(q: UserListDto) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.role ? { role: q.role } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.verified !== undefined ? { verified: q.verified } : {}),
      ...(q.city ? { city: { contains: q.city, mode: 'insensitive' } } : {}),
      ...(q.state ? { state: q.state } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { cpf: { contains: q.search } },
              { cnpj: { contains: q.search } },
              { phone: { contains: q.search } },
            ],
          }
        : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
    };
    return this.paginate(this.prisma.user, where, q, {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      cnpj: true,
      role: true,
      status: true,
      isActive: true,
      verified: true,
      city: true,
      state: true,
      lastAccessAt: true,
      createdAt: true,
    });
  }
  async user(id: string) {
    const item = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        cnpj: true,
        role: true,
        adminTeamRole: true,
        adminPermissions: true,
        status: true,
        isActive: true,
        verified: true,
        city: true,
        state: true,
        lastAccessAt: true,
        createdAt: true,
        organizerProfile: { include: { documents: true } },
        campaigns: { select: { id: true, title: true, status: true } },
        purchases: { select: { id: true, total: true, status: true } },
        paymentsAsBuyer: {
          select: { id: true, status: true, amount: true, method: true },
        },
        winners: { select: { id: true, status: true, prizeName: true } },
        auditLogs: { orderBy: { createdAt: 'desc' }, take: 30 },
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: {
            id: true,
            createdAt: true,
            expiresAt: true,
            ipAddress: true,
            userAgent: true,
          },
        },
      },
    });
    if (!item) throw new NotFoundException();
    return this.serialize(item);
  }
  async userAction(id: string, dto: UserActionDto, admin: AuthenticatedUser) {
    if (
      id === admin.id &&
      ['BLOCK', 'SUSPEND', 'DEACTIVATE'].includes(dto.action)
    )
      throw new BadRequestException(
        'Você não pode bloquear sua própria conta.',
      );
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id } });
      if (!current) throw new NotFoundException();
      const map: Partial<
        Record<UserActionDto['action'], Prisma.UserUpdateInput>
      > = {
        ACTIVATE: { status: UserStatus.ACTIVE, isActive: true },
        DEACTIVATE: { status: UserStatus.INACTIVE, isActive: false },
        SUSPEND: { status: UserStatus.SUSPENDED, isActive: false },
        BLOCK: { status: UserStatus.BLOCKED, isActive: false },
        UNBLOCK: { status: UserStatus.ACTIVE, isActive: true },
        FORCE_PASSWORD_RESET: { forcePasswordReset: true },
      };
      if (dto.action === 'REVOKE_SESSIONS')
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      else
        await tx.user.update({
          where: { id },
          data: map[dto.action] ?? {},
        });
      await this.audit(
        tx,
        'User',
        id,
        `USER_${dto.action}`,
        admin,
        current,
        map[dto.action] ?? null,
        dto.reason,
      );
      return { message: 'Ação administrativa registrada.' };
    });
  }
  async permissions(
    id: string,
    dto: UpdateAdminPermissionsDto,
    admin: AuthenticatedUser,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.role !== UserRole.ADMIN)
      throw new BadRequestException('Usuário não é administrador.');
    const permissions = effectiveAdminPermissions(
      target.adminTeamRole,
      dto.permissions,
    );
    const next = await this.prisma.user.update({
      where: { id },
      data: { adminPermissions: permissions },
    });
    await this.audit(
      this.prisma,
      'User',
      id,
      'ADMIN_PERMISSIONS_UPDATED',
      admin,
      target,
      { permissions },
      dto.reason,
    );
    return { id: next.id, permissions: next.adminPermissions };
  }
  async campaigns(q: CampaignListDto) {
    const where: Prisma.CampaignWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.category ? { category: q.category } : {}),
      ...(q.organizerId ? { organizerId: q.organizerId } : {}),
      ...(q.blocked !== undefined
        ? {
            OR: [
              { purchasesBlocked: q.blocked },
              { publicationBlocked: q.blocked },
            ],
          }
        : {}),
      ...(q.featured !== undefined ? { isFeatured: q.featured } : {}),
      ...(q.search
        ? { title: { contains: q.search, mode: 'insensitive' } }
        : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
    };
    return this.paginate(this.prisma.campaign, where, q, undefined, {
      organizer: { select: { id: true, name: true, email: true } },
      drawRuleTemplate: true,
      instantPrizes: true,
      promotions: true,
      _count: { select: { purchases: true, payments: true } },
    });
  }
  async campaign(id: string) {
    const item = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        organizer: {
          select: { id: true, name: true, email: true, organizerProfile: true },
        },
        galleryImages: true,
        instantPrizes: true,
        promotions: true,
        drawRuleTemplate: true,
        draws: true,
        _count: { select: { purchases: true, payments: true, tickets: true } },
      },
    });
    if (!item) throw new NotFoundException();
    const audit = await this.entityAudit('Campaign', id);
    return this.serialize({ ...item, audit });
  }
  async campaignAction(
    id: string,
    dto: CampaignActionDto,
    admin: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.campaign.findUnique({ where: { id } });
      if (!current) throw new NotFoundException();
      const data: Prisma.CampaignUpdateInput = {
        adminNotes: dto.note ?? dto.reason,
      };
      switch (dto.action) {
        case 'APPROVE':
          if (current.status !== CampaignStatus.PENDING_REVIEW)
            throw new BadRequestException('Campanha não está pendente.');
          Object.assign(data, {
            status: CampaignStatus.PUBLISHED,
            publishedAt: current.publishedAt ?? new Date(),
            adminReviewStatus: 'APPROVED',
          });
          break;
        case 'REJECT':
          Object.assign(data, {
            status: CampaignStatus.DRAFT,
            adminReviewStatus: 'REJECTED',
          });
          break;
        case 'REQUEST_CHANGES':
          Object.assign(data, {
            status: CampaignStatus.DRAFT,
            adminReviewStatus: 'CHANGES_REQUESTED',
          });
          break;
        case 'PAUSE':
          data.status = CampaignStatus.PAUSED;
          break;
        case 'REACTIVATE':
          data.status = CampaignStatus.PUBLISHED;
          break;
        case 'CANCEL':
          data.status = CampaignStatus.CANCELLED;
          break;
        case 'BLOCK_PURCHASES':
          data.purchasesBlocked = true;
          break;
        case 'UNBLOCK_PURCHASES':
          data.purchasesBlocked = false;
          break;
        case 'BLOCK_PUBLICATION':
          data.publicationBlocked = true;
          break;
        case 'UNBLOCK_PUBLICATION':
          data.publicationBlocked = false;
          break;
        case 'FEATURE':
          Object.assign(data, { isFeatured: true });
          break;
        case 'UNFEATURE':
          data.isFeatured = false;
          break;
        default:
          throw new BadRequestException('Ação inválida.');
      }
      const updated = await tx.campaign.update({ where: { id }, data });
      await this.audit(
        tx,
        'Campaign',
        id,
        `CAMPAIGN_${dto.action}`,
        admin,
        current,
        updated,
        dto.reason,
      );
      await tx.notification.create({
        data: {
          userId: current.organizerId,
          type: 'CAMPAIGN_ADMIN_ACTION',
          title: 'Atualização da campanha',
          message: `A campanha ${current.title} recebeu a ação ${dto.action}.`,
          data: { campaignId: id, reason: dto.reason },
        },
      });
      return this.serialize(updated);
    });
  }
  async payments(q: PaymentListDto) {
    const where: Prisma.PaymentWhereInput = {
      ...(q.provider ? { provider: q.provider } : {}),
      ...(q.method ? { method: q.method } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.campaignId ? { campaignId: q.campaignId } : {}),
      ...(q.buyerId ? { buyerId: q.buyerId } : {}),
      ...(q.organizerId ? { organizerId: q.organizerId } : {}),
      ...(q.minValue !== undefined || q.maxValue !== undefined
        ? { amount: { gte: q.minValue, lte: q.maxValue } }
        : {}),
      ...(q.search
        ? {
            OR: [
              { id: { contains: q.search } },
              {
                externalReference: { contains: q.search, mode: 'insensitive' },
              },
              {
                providerPaymentId: { contains: q.search, mode: 'insensitive' },
              },
              { buyer: { name: { contains: q.search, mode: 'insensitive' } } },
              { buyer: { email: { contains: q.search, mode: 'insensitive' } } },
              {
                campaign: {
                  title: { contains: q.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
    };
    return this.paginate(this.prisma.payment, where, q, {
      id: true,
      provider: true,
      providerPaymentId: true,
      externalReference: true,
      method: true,
      status: true,
      amount: true,
      platformFee: true,
      gatewayFee: true,
      netAmount: true,
      currency: true,
      cardLastFour: true,
      cardBrand: true,
      installments: true,
      approvedAt: true,
      failureReason: true,
      createdAt: true,
      buyer: { select: { id: true, name: true, email: true } },
      organizer: { select: { id: true, name: true } },
      campaign: { select: { id: true, title: true } },
      events: {
        select: {
          id: true,
          eventType: true,
          processed: true,
          processedAt: true,
          errorMessage: true,
          createdAt: true,
        },
      },
    });
  }
  async payment(id: string) {
    const item = await this.prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        provider: true,
        providerPaymentId: true,
        externalReference: true,
        method: true,
        status: true,
        amount: true,
        platformFee: true,
        gatewayFee: true,
        netAmount: true,
        currency: true,
        cardLastFour: true,
        cardBrand: true,
        installments: true,
        approvedAt: true,
        rejectedAt: true,
        cancelledAt: true,
        refundedAt: true,
        failureReason: true,
        createdAt: true,
        buyer: { select: { id: true, name: true, email: true } },
        organizer: { select: { id: true, name: true, email: true } },
        campaign: { select: { id: true, title: true } },
        events: {
          select: {
            id: true,
            eventType: true,
            processed: true,
            processedAt: true,
            errorMessage: true,
            createdAt: true,
          },
        },
      },
    });
    if (!item) throw new NotFoundException();
    const audit = await this.entityAudit('Payment', id);
    return this.serialize({ ...item, audit });
  }
  async paymentNote(id: string, dto: AdminNoteDto, admin: AuthenticatedUser) {
    const current = await this.prisma.payment.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    const metadata = {
      ...((current.metadata as object) ?? {}),
      adminReview: {
        note: dto.note ?? dto.reason,
        reviewedBy: admin.id,
        reviewedAt: new Date().toISOString(),
      },
    };
    const next = await this.prisma.payment.update({
      where: { id },
      data: { metadata },
    });
    await this.audit(
      this.prisma,
      'Payment',
      id,
      'PAYMENT_MARKED_FOR_REVIEW',
      admin,
      current,
      { metadata },
      dto.reason,
    );
    return {
      id: next.id,
      status: next.status,
      message:
        'Pagamento marcado para revisão; status financeiro não foi alterado.',
    };
  }
  reports(q: AdminListDto, status?: ReportStatus) {
    const where: Prisma.ReportWhereInput = {
      ...(status ? { status } : {}),
      ...(q.search
        ? {
            OR: [
              { reason: { contains: q.search, mode: 'insensitive' } },
              { description: { contains: q.search, mode: 'insensitive' } },
              { entityId: { contains: q.search } },
            ],
          }
        : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
    };
    return this.paginate(this.prisma.report, where, q);
  }
  async report(id: string) {
    const item = await this.prisma.report.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Denúncia não encontrada.');
    const audit = await this.entityAudit('Report', id);
    return this.serialize({ ...item, audit });
  }
  async resolveReport(
    id: string,
    dto: ResolveReportDto,
    admin: AuthenticatedUser,
  ) {
    const current = await this.prisma.report.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    const next = await this.prisma.report.update({
      where: { id },
      data: {
        status: dto.status,
        resolution: dto.resolution,
        reviewedByUserId: admin.id,
        reviewedAt: new Date(),
      },
    });
    await this.audit(
      this.prisma,
      'Report',
      id,
      'REPORT_REVIEWED',
      admin,
      current,
      next,
      dto.resolution,
    );
    return next;
  }
  winners(q: WinnerListDto) {
    const where: Prisma.WinnerWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { prizeName: { contains: q.search, mode: 'insensitive' } },
              { winningNumber: { contains: q.search } },
              { buyer: { name: { contains: q.search, mode: 'insensitive' } } },
              {
                campaign: {
                  title: { contains: q.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
    };
    return this.paginate(this.prisma.winner, where, q, undefined, {
      campaign: {
        select: {
          id: true,
          title: true,
          organizer: { select: { id: true, name: true } },
        },
      },
      buyer: { select: { id: true, name: true, email: true, city: true } },
      ticket: true,
    });
  }
  async winner(id: string) {
    const item = await this.prisma.winner.findUnique({
      where: { id },
      include: {
        campaign: {
          include: {
            organizer: { select: { id: true, name: true, email: true } },
          },
        },
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
        ticket: true,
        purchase: true,
        campaignDraw: true,
      },
    });
    if (!item) throw new NotFoundException('Ganhador não encontrado.');
    const audit = await this.entityAudit('Winner', id);
    return this.serialize({ ...item, audit });
  }
  async winnerAction(
    id: string,
    dto: WinnerActionDto,
    admin: AuthenticatedUser,
  ) {
    const current = await this.prisma.winner.findUnique({ where: { id } });
    if (!current) throw new NotFoundException();
    const next = await this.prisma.winner.update({
      where: { id },
      data: {
        status: dto.status,
        publicDisclosureAuthorized: dto.publicDisclosureAuthorized,
      },
    });
    await this.audit(
      this.prisma,
      'Winner',
      id,
      'WINNER_ADMIN_REVIEW',
      admin,
      current,
      next,
      dto.reason,
    );
    return next;
  }
  content() {
    return Promise.all([
      this.prisma.platformBanner.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.platformNotice.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.contentPage.findMany({ orderBy: { updatedAt: 'desc' } }),
      this.prisma.featuredCampaign.findMany({ orderBy: { sortOrder: 'asc' } }),
    ]).then(([banners, notices, pages, featured]) => ({
      banners,
      notices,
      pages,
      featured,
    }));
  }
  async banner(dto: CreateBannerDto, admin: AuthenticatedUser) {
    const { reason, ...data } = dto;
    const item = await this.prisma.platformBanner.create({
      data: {
        ...data,
        startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
        endsAt: data.endsAt ? new Date(data.endsAt) : undefined,
        createdByUserId: admin.id,
      },
    });
    await this.audit(
      this.prisma,
      'PlatformBanner',
      item.id,
      'BANNER_CREATED',
      admin,
      undefined,
      item,
      reason,
    );
    return item;
  }
  async notice(dto: CreateNoticeDto, admin: AuthenticatedUser) {
    const { reason, ...data } = dto;
    const item = await this.prisma.platformNotice.create({
      data: { ...data, createdByUserId: admin.id },
    });
    await this.audit(
      this.prisma,
      'PlatformNotice',
      item.id,
      'NOTICE_CREATED',
      admin,
      undefined,
      item,
      reason,
    );
    return item;
  }
  async updateBanner(
    id: string,
    dto: CreateBannerDto,
    admin: AuthenticatedUser,
  ) {
    const previous = await this.prisma.platformBanner.findUnique({
      where: { id },
    });
    if (!previous) throw new NotFoundException('Banner não encontrado.');
    const { reason, ...data } = dto;
    const item = await this.prisma.platformBanner.update({
      where: { id },
      data: {
        ...data,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
    await this.audit(
      this.prisma,
      'PlatformBanner',
      id,
      'BANNER_UPDATED',
      admin,
      previous,
      item,
      reason,
    );
    return item;
  }
  async updateNotice(
    id: string,
    dto: CreateNoticeDto,
    admin: AuthenticatedUser,
  ) {
    const previous = await this.prisma.platformNotice.findUnique({
      where: { id },
    });
    if (!previous) throw new NotFoundException('Aviso não encontrado.');
    const { reason, ...data } = dto;
    const item = await this.prisma.platformNotice.update({
      where: { id },
      data,
    });
    await this.audit(
      this.prisma,
      'PlatformNotice',
      id,
      'NOTICE_UPDATED',
      admin,
      previous,
      item,
      reason,
    );
    return item;
  }
  async contentPage(dto: UpsertContentDto, admin: AuthenticatedUser) {
    const { reason, ...data } = dto;
    const previous = await this.prisma.contentPage.findUnique({
      where: { slug: data.slug },
    });
    const item = await this.prisma.contentPage.upsert({
      where: { slug: data.slug },
      create: { ...data, updatedByUserId: admin.id },
      update: { ...data, updatedByUserId: admin.id },
    });
    await this.audit(
      this.prisma,
      'ContentPage',
      item.id,
      'CONTENT_UPSERTED',
      admin,
      previous,
      item,
      reason,
    );
    return item;
  }
  auditLogs(
    q: AdminListDto,
    filters: {
      action?: string;
      entityType?: string;
      actorUserId?: string;
      role?: UserRole;
    },
  ) {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.action
        ? { action: { contains: filters.action, mode: 'insensitive' } }
        : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.actorUserId ? { actorUserId: filters.actorUserId } : {}),
      ...(filters.role ? { actorRole: filters.role } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
    };
    return this.paginate(this.prisma.auditLog, where, q, undefined, {
      actor: { select: { id: true, name: true, email: true, role: true } },
    });
  }
  async health() {
    const now = new Date();
    const [
      webhooks,
      reservations,
      balances,
      campaignRules,
      draws,
      documents,
      payouts,
    ] = await Promise.all([
      this.prisma.paymentEvent.count({
        where: { processed: false, errorMessage: { not: null } },
      }),
      this.prisma.purchase.count({
        where: {
          expiresAt: { lt: now },
          status: { in: ['RESERVED', 'AWAITING_PAYMENT'] },
        },
      }),
      this.prisma.financialAccount.count({
        where: {
          OR: [
            { availableBalance: { lt: 0 } },
            { pendingBalance: { lt: 0 } },
            { blockedBalance: { lt: 0 } },
          ],
        },
      }),
      this.prisma.campaign.count({
        where: {
          status: 'PUBLISHED',
          publishedRuleSnapshot: { equals: Prisma.DbNull },
        },
      }),
      this.prisma.campaignDraw.count({
        where: { status: 'PENDING_CONFIRMATION' },
      }),
      this.prisma.organizerProfile.count({
        where: { verificationStatus: { in: ['PENDING', 'UNDER_REVIEW'] } },
      }),
      this.prisma.payoutRequest.count({
        where: {
          status: {
            in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING'],
          },
          requestedAt: { lt: new Date(now.getTime() - 7 * 86400000) },
        },
      }),
    ]);
    return [
      { key: 'WEBHOOK_FAILURES', count: webhooks, severity: 'CRITICAL' },
      { key: 'EXPIRED_RESERVATIONS', count: reservations, severity: 'WARNING' },
      { key: 'BALANCE_INCONSISTENCY', count: balances, severity: 'CRITICAL' },
      {
        key: 'CAMPAIGNS_WITHOUT_RULE',
        count: campaignRules,
        severity: 'WARNING',
      },
      { key: 'PENDING_DRAWS', count: draws, severity: 'WARNING' },
      { key: 'PENDING_DOCUMENTS', count: documents, severity: 'INFO' },
      { key: 'LATE_PAYOUTS', count: payouts, severity: 'CRITICAL' },
    ].filter((x) => x.count > 0);
  }
  support(q: SupportListDto) {
    const where: Prisma.SupportTicketWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.search
        ? {
            OR: [
              { subject: { contains: q.search, mode: 'insensitive' } },
              { description: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
    };
    return this.paginate(this.prisma.supportTicket, where, q, undefined, {
      messages: { orderBy: { createdAt: 'asc' } },
    });
  }
  async supportTicket(id: string) {
    const item = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!item) throw new NotFoundException('Chamado não encontrado.');
    const audit = await this.entityAudit('SupportTicket', id);
    return this.serialize({ ...item, audit });
  }
  async supportAction(
    id: string,
    dto: SupportActionDto,
    admin: AuthenticatedUser,
  ) {
    const current = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException();
    const next = await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status,
        priority: dto.priority,
        assignedAdminId: dto.assignedAdminId ?? admin.id,
        closedAt:
          dto.status === SupportStatus.CLOSED ||
          dto.status === SupportStatus.RESOLVED
            ? new Date()
            : undefined,
      },
    });
    await this.audit(
      this.prisma,
      'SupportTicket',
      id,
      'SUPPORT_UPDATED',
      admin,
      current,
      next,
      dto.reason,
    );
    return next;
  }
  async supportMessage(
    id: string,
    dto: SupportMessageDto,
    admin: AuthenticatedUser,
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
    });
    if (!ticket) throw new NotFoundException();
    const message = await this.prisma.supportMessage.create({
      data: {
        ticketId: id,
        senderUserId: admin.id,
        message: dto.message,
        attachmentUrl: dto.attachmentUrl,
      },
    });
    await this.prisma.notification.create({
      data: {
        userId: ticket.requesterUserId,
        type: 'SUPPORT_REPLY',
        title: 'Nova resposta no suporte',
        message: 'A equipe SorteX respondeu seu chamado.',
        data: { ticketId: id },
      },
    });
    await this.audit(
      this.prisma,
      'SupportTicket',
      id,
      'SUPPORT_MESSAGE_SENT',
      admin,
      undefined,
      { messageId: message.id },
      'Resposta administrativa',
    );
    return message;
  }
  plans() {
    return this.prisma.plan.findMany({
      include: { features: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
  async plan(dto: PlanDto, admin: AuthenticatedUser) {
    const { reason, ...data } = dto;
    const previous = await this.prisma.plan.findUnique({
      where: { code: data.code },
    });
    const item = await this.prisma.plan.upsert({
      where: { code: data.code },
      create: data,
      update: data,
    });
    await this.audit(
      this.prisma,
      'Plan',
      item.id,
      'PLAN_UPSERTED',
      admin,
      previous,
      item,
      reason,
    );
    return item;
  }

  async approvals(q: ApprovalListDto) {
    return this.organizerListing(q, true);
  }

  async organizers(q: ApprovalListDto) {
    return this.organizerListing(q, false);
  }

  private async organizerListing(
    q: ApprovalListDto,
    operationalQueue: boolean,
  ) {
    const createdAt =
      q.from || q.to
        ? {
            ...(q.from ? { gte: new Date(q.from) } : {}),
            ...(q.to ? { lte: new Date(q.to) } : {}),
          }
        : undefined;
    const operationalStatuses: VerificationStatus[] = [
      VerificationStatus.PENDING,
      VerificationStatus.UNDER_REVIEW,
      VerificationStatus.CORRECTION_REQUESTED,
      VerificationStatus.DOCUMENT_REQUESTED,
    ];
    const where: Prisma.OrganizerProfileWhereInput = {
      ...(q.status
        ? { verificationStatus: q.status }
        : operationalQueue
          ? { verificationStatus: { in: operationalStatuses } }
          : {}),
      ...(q.riskLevel ? { riskLevel: q.riskLevel } : {}),
      ...(q.state ? { state: q.state } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(q.assignedAdminId ? { assignedAdminId: q.assignedAdminId } : {}),
      ...(q.city ? { city: { contains: q.city, mode: 'insensitive' } } : {}),
      ...(q.plan ? { currentPlan: q.plan } : {}),
      ...(q.personType === 'PJ'
        ? { cnpj: { not: null } }
        : q.personType === 'PF'
          ? { cnpj: null }
          : {}),
      ...(q.documentation === 'pending'
        ? { documents: { none: { status: OrganizerDocumentStatus.APPROVED } } }
        : {}),
      ...(q.search
        ? {
            OR: [
              { fullName: { contains: q.search, mode: 'insensitive' } },
              { organizationName: { contains: q.search, mode: 'insensitive' } },
              { cpf: { contains: q.search } },
              { cnpj: { contains: q.search } },
              { user: { email: { contains: q.search, mode: 'insensitive' } } },
              { phone: { contains: q.search } },
              { user: { phone: { contains: q.search } } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.OrganizerProfileOrderByWithRelationInput[] =
      q.sort === 'priority'
        ? [{ riskScore: 'desc' }, { createdAt: 'asc' }]
        : q.sort === 'oldest'
          ? [{ createdAt: 'asc' }]
          : q.sort === 'risk_desc'
            ? [{ riskScore: 'desc' }, { createdAt: 'asc' }]
            : q.sort === 'risk_asc'
              ? [{ riskScore: 'asc' }, { createdAt: 'asc' }]
              : [{ createdAt: 'desc' }];
    const [data, total, statuses, highRisk, approvedToday, rejectedToday] =
      await Promise.all([
        this.prisma.organizerProfile.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                isActive: true,
                createdAt: true,
                _count: { select: { campaigns: true } },
              },
            },
            documents: {
              select: { id: true, type: true, status: true, version: true },
            },
            _count: {
              select: { reviewDecisions: true, internalNoteEntries: true },
            },
          },
          orderBy,
          skip: (q.page - 1) * q.limit,
          take: q.limit,
        }),
        this.prisma.organizerProfile.count({ where }),
        this.prisma.organizerProfile.groupBy({
          by: ['verificationStatus'],
          _count: true,
        }),
        this.prisma.organizerProfile.count({
          where: { riskLevel: OrganizerRiskLevel.HIGH },
        }),
        this.prisma.organizerReviewDecision.count({
          where: {
            nextStatus: VerificationStatus.VERIFIED,
            createdAt: { gte: startOfToday() },
          },
        }),
        this.prisma.organizerReviewDecision.count({
          where: {
            nextStatus: VerificationStatus.REJECTED,
            createdAt: { gte: startOfToday() },
          },
        }),
      ]);
    const statusCount = Object.fromEntries(
      statuses.map((item) => [item.verificationStatus, item._count]),
    );
    return this.serialize({
      data,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        pages: Math.ceil(total / q.limit),
      },
      summary: {
        pending: statusCount.PENDING ?? 0,
        underReview: statusCount.UNDER_REVIEW ?? 0,
        corrections: statusCount.CORRECTION_REQUESTED ?? 0,
        documents: statusCount.DOCUMENT_REQUESTED ?? 0,
        highRisk,
        approvedToday,
        rejectedToday,
      },
    });
  }

  async analyzeOrganizerRisk(id: string, admin: AuthenticatedUser) {
    const profile = await this.prisma.organizerProfile.findUnique({
      where: { userId: id },
      include: { user: true, documents: true },
    });
    if (!profile) throw new NotFoundException('Organizador não encontrado.');
    const reasons: string[] = [];
    let score = 0;
    if (!isValidCpf(profile.cpf)) {
      reasons.push('CPF com formato ou dígitos inválidos.');
      score += 35;
    }
    if (profile.cnpj && !/^\d{14}$/.test(profile.cnpj.replace(/\D/g, ''))) {
      reasons.push('CNPJ com formato inválido.');
      score += 35;
    }
    const duplicates = await this.prisma.user.count({
      where: {
        id: { not: id },
        OR: [
          { email: profile.user.email },
          ...(profile.user.phone ? [{ phone: profile.user.phone }] : []),
          ...(profile.cpf ? [{ cpf: profile.cpf }] : []),
          ...(profile.cnpj ? [{ cnpj: profile.cnpj }] : []),
        ],
      },
    });
    if (duplicates) {
      reasons.push('Há dados de identificação utilizados em outra conta.');
      score += 45;
    }
    const required = [
      'fullName',
      'cpf',
      'phone',
      'birthDate',
      'postalCode',
      'address',
      'city',
      'state',
    ] as const;
    const missing = required.filter((field) => !profile[field]);
    if (missing.length) {
      reasons.push(`${missing.length} dado(s) obrigatório(s) ausente(s).`);
      score += Math.min(30, missing.length * 5);
    }
    if (!profile.instagram) {
      reasons.push('Rede social não informada.');
      score += 5;
    }
    if (!profile.documents.some((document) => document.type === 'IDENTITY')) {
      reasons.push('Documento com foto ausente.');
      score += 20;
    }
    if (
      profile.documents.some(
        (document) => document.expiresAt && document.expiresAt < new Date(),
      )
    ) {
      reasons.push('Existe documento expirado.');
      score += 30;
    }
    const level =
      score >= 70
        ? OrganizerRiskLevel.HIGH
        : score >= 30
          ? OrganizerRiskLevel.MEDIUM
          : OrganizerRiskLevel.LOW;
    const next = await this.prisma.organizerProfile.update({
      where: { id: profile.id },
      data: {
        riskScore: Math.min(score, 100),
        riskLevel: level,
        riskReasons: reasons,
        riskAnalyzedAt: new Date(),
      },
    });
    await this.audit(
      this.prisma,
      'OrganizerProfile',
      profile.id,
      'ORGANIZER_RISK_ANALYZED',
      admin,
      { riskScore: profile.riskScore, riskLevel: profile.riskLevel },
      { riskScore: next.riskScore, riskLevel: next.riskLevel, reasons },
      'Análise preliminar por regras locais',
    );
    return this.serialize({
      riskScore: next.riskScore,
      riskLevel: next.riskLevel,
      reasons,
      automatic: true,
      decision: 'A análise automática não aprova nem reprova o cadastro.',
    });
  }

  async updateOrganizerChecklist(
    id: string,
    dto: OrganizerChecklistDto,
    admin: AuthenticatedUser,
  ) {
    const profile = await this.prisma.organizerProfile.findUnique({
      where: { userId: id },
    });
    if (!profile) throw new NotFoundException('Organizador não encontrado.');
    const next = await this.prisma.organizerProfile.update({
      where: { id: profile.id },
      data: { reviewChecklist: dto.checklist },
    });
    await this.audit(
      this.prisma,
      'OrganizerProfile',
      profile.id,
      'ORGANIZER_CHECKLIST_UPDATED',
      admin,
      profile.reviewChecklist,
      dto.checklist,
      'Checklist da análise atualizado',
    );
    return next.reviewChecklist;
  }

  async organizerBackoffice(id: string) {
    const [item, financialAccount] = await Promise.all([
      this.prisma.organizerProfile.findUnique({
        where: { userId: id },
        include: {
          user: {
            include: {
              subscriptions: {
                include: { selectedPlan: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              campaigns: { orderBy: { createdAt: 'desc' } },
            },
          },
          documents: true,
          reviewDecisions: {
            include: { admin: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
          internalNoteEntries: {
            include: { author: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
          feeHistory: {
            include: { admin: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.financialAccount.findUnique({
        where: {
          ownerType_ownerId_currency: {
            ownerType: 'ORGANIZER',
            ownerId: id,
            currency: 'BRL',
          },
        },
      }),
    ]);
    if (!item) throw new NotFoundException('Organizador não encontrado.');
    return this.serialize({ ...item, financialAccount });
  }

  async organizerDecision(
    id: string,
    dto: OrganizerDecisionDto,
    admin: AuthenticatedUser,
  ) {
    const allowed: VerificationStatus[] = [
      VerificationStatus.UNDER_REVIEW,
      VerificationStatus.CORRECTION_REQUESTED,
      VerificationStatus.DOCUMENT_REQUESTED,
      VerificationStatus.VERIFIED,
      VerificationStatus.REJECTED,
      VerificationStatus.SUSPENDED,
      VerificationStatus.BLOCKED,
      VerificationStatus.CLOSED,
      VerificationStatus.PENDING,
    ];
    if (!allowed.includes(dto.status))
      throw new BadRequestException('Status administrativo inválido.');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.organizerProfile.findUnique({
        where: { userId: id },
      });
      if (!current) throw new NotFoundException('Organizador não encontrado.');
      const mayReassign =
        admin.adminTeamRole === AdminTeamRole.SUPERADMIN ||
        admin.adminTeamRole === AdminTeamRole.ADMIN;
      if (
        dto.status === VerificationStatus.UNDER_REVIEW &&
        current.assignedAdminId &&
        current.assignedAdminId !== admin.id &&
        !mayReassign
      ) {
        const owner = await tx.user.findUnique({
          where: { id: current.assignedAdminId },
          select: { name: true },
        });
        throw new BadRequestException(
          `Esta solicitação está sendo analisada por ${owner?.name ?? 'outro funcionário'}.`,
        );
      }
      const verified = dto.status === VerificationStatus.VERIFIED;
      const hardBlocked = (
        [
          VerificationStatus.BLOCKED,
          VerificationStatus.CLOSED,
        ] as VerificationStatus[]
      ).includes(dto.status);
      const operationallyBlocked = !verified;
      const next = await tx.organizerProfile.update({
        where: { userId: id },
        data: {
          verificationStatus: dto.status,
          assignedAdminId: admin.id,
          publicReviewMessage: dto.externalMessage || dto.reason,
          rejectionReason:
            dto.status === VerificationStatus.REJECTED ? dto.reason : null,
          correctionDeadline: dto.deadline ? new Date(dto.deadline) : null,
          reviewedAt: (
            [
              VerificationStatus.VERIFIED,
              VerificationStatus.REJECTED,
            ] as VerificationStatus[]
          ).includes(dto.status)
            ? new Date()
            : undefined,
          reviewedById: admin.id,
          analysisStartedAt:
            dto.status === VerificationStatus.UNDER_REVIEW
              ? new Date()
              : current.analysisStartedAt,
          suspensionEndsAt:
            dto.status === VerificationStatus.SUSPENDED && dto.deadline
              ? new Date(dto.deadline)
              : null,
          readOnlyAccess:
            dto.status === VerificationStatus.SUSPENDED
              ? (dto.readOnlyAccess ?? true)
              : false,
          campaignsBlocked: dto.blockCampaigns ?? operationallyBlocked,
          paymentsBlocked: dto.blockSales ?? operationallyBlocked,
        },
      });
      await tx.user.update({
        where: { id },
        data: {
          verified,
          isActive: !hardBlocked,
          status: hardBlocked
            ? dto.status === VerificationStatus.BLOCKED
              ? UserStatus.BLOCKED
              : UserStatus.INACTIVE
            : UserStatus.ACTIVE,
        },
      });
      await tx.organizerReviewDecision.create({
        data: {
          organizerProfileId: current.id,
          adminId: admin.id,
          previousStatus: current.verificationStatus,
          nextStatus: dto.status,
          reason: dto.externalMessage || dto.reason,
          requestedFields: dto.requestedFields ?? undefined,
          requestedDocuments: dto.requestedDocuments ?? undefined,
          deadline: dto.deadline ? new Date(dto.deadline) : undefined,
          canResubmit: dto.canResubmit ?? true,
        },
      });
      await tx.notification.create({
        data: {
          userId: id,
          type: 'ORGANIZER_REVIEW',
          title: reviewTitle(dto.status),
          message: dto.externalMessage || dto.reason,
          data: { status: dto.status, deadline: dto.deadline },
        },
      });
      if (dto.internalNote?.trim())
        await tx.organizerInternalNote.create({
          data: {
            organizerProfileId: current.id,
            authorId: admin.id,
            category: OrganizerInternalNoteCategory.GENERAL,
            text: dto.internalNote.trim(),
          },
        });
      if (hardBlocked)
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      await this.audit(
        tx,
        'OrganizerProfile',
        current.id,
        `ORGANIZER_${dto.status}`,
        admin,
        current,
        next,
        dto.reason,
      );
      return this.serialize(next);
    });
  }

  async documentDecision(
    id: string,
    dto: DocumentDecisionDto,
    admin: AuthenticatedUser,
  ) {
    const current = await this.prisma.organizerDocument.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Documento não encontrado.');
    if (dto.status === OrganizerDocumentStatus.REJECTED && !dto.reason?.trim())
      throw new BadRequestException('Informe o motivo da rejeição.');
    const next = await this.prisma.organizerDocument.update({
      where: { id },
      data: {
        status: dto.status,
        reviewedById: admin.id,
        reviewedAt: new Date(),
        rejectionReason:
          dto.status === OrganizerDocumentStatus.REJECTED ? dto.reason : null,
        reviewNote: dto.note,
      },
    });
    await this.audit(
      this.prisma,
      'OrganizerDocument',
      id,
      `DOCUMENT_${dto.status}`,
      admin,
      current,
      next,
      dto.reason || 'Análise do documento',
    );
    return next;
  }

  async internalNote(
    id: string,
    dto: InternalNoteDto,
    admin: AuthenticatedUser,
  ) {
    const profile = await this.prisma.organizerProfile.findUnique({
      where: { userId: id },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Organizador não encontrado.');
    const note = await this.prisma.organizerInternalNote.create({
      data: {
        organizerProfileId: profile.id,
        authorId: admin.id,
        category: dto.category,
        text: dto.text,
      },
    });
    await this.audit(
      this.prisma,
      'OrganizerProfile',
      profile.id,
      'INTERNAL_NOTE_CREATED',
      admin,
      undefined,
      { noteId: note.id, category: dto.category },
      'Observação interna',
    );
    return note;
  }

  async organizerFee(
    id: string,
    dto: OrganizerFeeDto,
    admin: AuthenticatedUser,
  ) {
    if (
      dto.endsAt &&
      new Date(dto.endsAt) <= new Date(dto.startsAt || Date.now())
    )
      throw new BadRequestException(
        'O fim da condição deve ser posterior ao início.',
      );
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.organizerProfile.findUnique({
        where: { userId: id },
      });
      if (!current) throw new NotFoundException('Organizador não encontrado.');
      const zero = (
        [
          PlatformFeeRuleType.ZERO_FEE,
          PlatformFeeRuleType.FIRST_CAMPAIGN_FREE,
        ] as PlatformFeeRuleType[]
      ).includes(dto.ruleType);
      const rate = zero ? 0 : dto.rate;
      const campaignScoped = Boolean(dto.campaignId);
      if (campaignScoped) {
        const campaign = await tx.campaign.findFirst({
          where: { id: dto.campaignId, organizerId: id },
        });
        if (!campaign)
          throw new BadRequestException(
            'Campanha não encontrada para este organizador.',
          );
        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            platformFeeWaived: zero,
            customPlatformFee: zero ? null : rate,
          },
        });
      }
      const next = campaignScoped
        ? current
        : await tx.organizerProfile.update({
            where: { userId: id },
            data: {
              customPlatformFee:
                dto.ruleType === PlatformFeeRuleType.PLAN ? null : rate,
              platformFeeWaived:
                zero &&
                dto.ruleType !== PlatformFeeRuleType.FIRST_CAMPAIGN_FREE,
              firstCampaignFree:
                dto.ruleType === PlatformFeeRuleType.FIRST_CAMPAIGN_FREE,
            },
          });
      await tx.organizerFeeHistory.create({
        data: {
          organizerProfileId: current.id,
          adminId: admin.id,
          ruleType: dto.ruleType,
          previousRate: current.customPlatformFee ?? current.platformFee,
          newRate: rate,
          startsAt: dto.startsAt ? new Date(dto.startsAt) : new Date(),
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
          reason: dto.reason,
          campaignId: dto.campaignId,
        },
      });
      await this.audit(
        tx,
        'OrganizerProfile',
        current.id,
        'PLATFORM_FEE_UPDATED',
        admin,
        { rate: current.customPlatformFee ?? current.platformFee },
        { rate, ruleType: dto.ruleType },
        dto.reason,
      );
      return this.serialize(next);
    });
  }

  gateways() {
    return this.prisma.adminGatewayConfig.findMany({
      orderBy: [{ priority: 'asc' }, { displayName: 'asc' }],
    });
  }
  async gateway(dto: AdminGatewayDto, admin: AuthenticatedUser) {
    const { reason, ...data } = dto;
    if (data.productionEnabled)
      throw new BadRequestException(
        'A ativação em produção exige validação externa e não está disponível nesta etapa.',
      );
    const previous = await this.prisma.adminGatewayConfig.findUnique({
      where: { provider: data.provider },
    });
    const next = await this.prisma.adminGatewayConfig.upsert({
      where: { provider: data.provider },
      create: { ...data, updatedByUserId: admin.id },
      update: { ...data, updatedByUserId: admin.id },
    });
    await this.audit(
      this.prisma,
      'AdminGatewayConfig',
      next.id,
      'GATEWAY_CONFIG_UPDATED',
      admin,
      previous,
      next,
      reason,
    );
    return this.serialize(next);
  }

  async team() {
    await this.prisma.adminTeamInvitation.updateMany({
      where: {
        status: AdminInvitationStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: AdminInvitationStatus.EXPIRED },
    });
    const [members, invitations] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: UserRole.ADMIN, deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          adminTeamRole: true,
          adminPermissions: true,
          status: true,
          isActive: true,
          lastAccessAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminTeamInvitation.findMany({
        where: {
          status: {
            in: [AdminInvitationStatus.PENDING, AdminInvitationStatus.EXPIRED],
          },
        },
        include: { invitedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      members,
      invitations,
      summary: {
        total: members.length,
        active: members.filter((member) => member.isActive).length,
        pending: invitations.filter(
          (invite) => invite.status === AdminInvitationStatus.PENDING,
        ).length,
        inactive: members.filter((member) => !member.isActive).length,
      },
    };
  }
  async inviteTeam(dto: AdminTeamDto, admin: AuthenticatedUser) {
    if (
      dto.adminTeamRole === AdminTeamRole.SUPERADMIN &&
      !(await this.isSuperadmin(admin.id))
    )
      throw new ForbiddenException(
        'Somente o Superadministrador pode convidar outro Superadministrador.',
      );
    const email = dto.email.toLowerCase().trim();
    const activeInvite = await this.prisma.adminTeamInvitation.findFirst({
      where: {
        email,
        status: AdminInvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });
    if (activeInvite)
      throw new BadRequestException(
        'Já existe um convite válido para este e-mail.',
      );
    const token = randomBytes(32).toString('hex');
    const item = await this.prisma.adminTeamInvitation.create({
      data: {
        name: dto.name.trim(),
        email,
        tokenHash: this.hashInvitationToken(token),
        role: dto.adminTeamRole,
        permissions: dto.permissions
          ? effectiveAdminPermissions(dto.adminTeamRole, dto.permissions)
          : permissionsForAdminRole(dto.adminTeamRole),
        message: dto.message?.trim() || null,
        expiresAt: new Date(Date.now() + (dto.validityDays ?? 7) * 86400000),
        invitedById: admin.id,
      },
    });
    await this.audit(
      this.prisma,
      'AdminTeamInvitation',
      item.id,
      'ADMIN_TEAM_INVITED',
      admin,
      undefined,
      { role: dto.adminTeamRole, email, expiresAt: item.expiresAt },
      dto.reason,
    );
    return {
      id: item.id,
      name: item.name,
      email: item.email,
      status: item.status,
      expiresAt: item.expiresAt,
      invitationPath: `/admin/convite/${token}`,
      sandbox: true,
      message: 'Convite criado em modo local. Nenhum e-mail foi enviado.',
    };
  }

  async invitation(token: string) {
    const invite = await this.findInvitation(token);
    return {
      name: invite.name,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      invitedBy: invite.invitedBy.name,
      message: invite.message,
    };
  }

  async acceptInvitation(token: string, dto: AcceptAdminInvitationDto) {
    if (dto.password !== dto.passwordConfirmation)
      throw new BadRequestException('As senhas não coincidem.');
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{12,}$/.test(
        dto.password,
      )
    ) {
      throw new BadRequestException(
        'Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.',
      );
    }
    const invite = await this.findInvitation(token);
    const password = await bcrypt.hash(dto.password, 12);
    const existing = await this.prisma.user.findUnique({
      where: { email: invite.email },
    });
    const now = new Date();
    const user = await this.prisma.$transaction(async (tx) => {
      const accepted = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: {
              name: dto.name.trim(),
              password,
              role: UserRole.ADMIN,
              adminTeamRole: invite.role,
              adminPermissions: invite.permissions,
              isActive: true,
              status: UserStatus.ACTIVE,
              verified: true,
              forcePasswordReset: false,
            },
          })
        : await tx.user.create({
            data: {
              name: dto.name.trim(),
              email: invite.email,
              password,
              role: UserRole.ADMIN,
              adminTeamRole: invite.role,
              adminPermissions: invite.permissions,
              isActive: true,
              status: UserStatus.ACTIVE,
              verified: true,
            },
          });
      await tx.adminTeamInvitation.update({
        where: { id: invite.id },
        data: {
          status: AdminInvitationStatus.ACCEPTED,
          acceptedAt: now,
          acceptedUserId: accepted.id,
          tokenHash: this.hashInvitationToken(`${token}:${now.toISOString()}`),
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'AdminTeamInvitation',
          entityId: invite.id,
          action: 'ADMIN_INVITATION_ACCEPTED',
          actorUserId: accepted.id,
          actorRole: UserRole.ADMIN,
          newData: {
            role: invite.role,
            promotedExistingUser: Boolean(existing),
          },
        },
      });
      return accepted;
    });
    return {
      message: 'Convite aceito. Entre com sua nova credencial administrativa.',
      userId: user.id,
    };
  }

  async memberAction(
    id: string,
    dto: AdminMemberActionDto,
    admin: AuthenticatedUser,
  ) {
    const actorIsSuperadmin = await this.isSuperadmin(admin.id);
    const current = await this.prisma.user.findFirst({
      where: { id, role: UserRole.ADMIN, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Membro não encontrado.');
    if (
      !actorIsSuperadmin &&
      (current.adminTeamRole === AdminTeamRole.SUPERADMIN ||
        dto.adminTeamRole === AdminTeamRole.SUPERADMIN)
    )
      throw new ForbiddenException(
        'Somente o Superadministrador pode gerenciar esse nível de acesso.',
      );
    if (
      id === admin.id &&
      dto.action === 'CHANGE_ROLE' &&
      dto.adminTeamRole !== AdminTeamRole.SUPERADMIN
    )
      throw new BadRequestException(
        'Você não pode reduzir o próprio nível de acesso.',
      );
    if (
      (dto.action === 'DEACTIVATE' ||
        (dto.action === 'CHANGE_ROLE' &&
          dto.adminTeamRole !== AdminTeamRole.SUPERADMIN)) &&
      current.adminTeamRole === AdminTeamRole.SUPERADMIN
    ) {
      const activeSuperadmins = await this.prisma.user.count({
        where: {
          role: UserRole.ADMIN,
          adminTeamRole: AdminTeamRole.SUPERADMIN,
          isActive: true,
          deletedAt: null,
        },
      });
      if (activeSuperadmins <= 1)
        throw new BadRequestException(
          'Não é possível remover ou desativar o último Superadministrador ativo.',
        );
    }
    const now = new Date();
    const data: Prisma.UserUpdateInput =
      dto.action === 'CHANGE_ROLE'
        ? {
            adminTeamRole: dto.adminTeamRole,
            adminPermissions: permissionsForAdminRole(dto.adminTeamRole),
          }
        : dto.action === 'DEACTIVATE'
          ? { isActive: false, status: UserStatus.INACTIVE }
          : dto.action === 'REACTIVATE'
            ? { isActive: true, status: UserStatus.ACTIVE }
            : {};
    const updated = await this.prisma.$transaction(async (tx) => {
      const next = Object.keys(data).length
        ? await tx.user.update({ where: { id }, data })
        : current;
      if (dto.action === 'DEACTIVATE' || dto.action === 'REVOKE_SESSIONS')
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: now },
        });
      await this.audit(
        tx,
        'User',
        id,
        `ADMIN_MEMBER_${dto.action}`,
        admin,
        { role: current.adminTeamRole, active: current.isActive },
        { role: next.adminTeamRole, active: next.isActive },
        dto.reason || 'Gestão da equipe administrativa',
      );
      return next;
    });
    return this.serialize(updated);
  }

  async cancelInvitation(id: string, admin: AuthenticatedUser) {
    const invite = await this.prisma.adminTeamInvitation.findUnique({
      where: { id },
    });
    if (!invite || invite.status !== AdminInvitationStatus.PENDING)
      throw new BadRequestException('Convite pendente não encontrado.');
    if (
      invite.role === AdminTeamRole.SUPERADMIN &&
      !(await this.isSuperadmin(admin.id))
    )
      throw new ForbiddenException(
        'Somente o Superadministrador pode cancelar este convite.',
      );
    const next = await this.prisma.adminTeamInvitation.update({
      where: { id },
      data: {
        status: AdminInvitationStatus.CANCELLED,
        cancelledAt: new Date(),
        tokenHash: this.hashInvitationToken(`${id}:${Date.now()}`),
      },
    });
    await this.audit(
      this.prisma,
      'AdminTeamInvitation',
      id,
      'ADMIN_INVITATION_CANCELLED',
      admin,
      invite,
      next,
      'Convite cancelado pela equipe',
    );
    return { message: 'Convite cancelado.' };
  }

  async regenerateInvitation(id: string, admin: AuthenticatedUser) {
    const invite = await this.prisma.adminTeamInvitation.findUnique({
      where: { id },
    });
    if (!invite || invite.status === AdminInvitationStatus.ACCEPTED)
      throw new BadRequestException('Este convite não pode ser regenerado.');
    if (
      invite.role === AdminTeamRole.SUPERADMIN &&
      !(await this.isSuperadmin(admin.id))
    )
      throw new ForbiddenException(
        'Somente o Superadministrador pode regenerar este convite.',
      );
    const token = randomBytes(32).toString('hex');
    const next = await this.prisma.adminTeamInvitation.update({
      where: { id },
      data: {
        status: AdminInvitationStatus.PENDING,
        tokenHash: this.hashInvitationToken(token),
        expiresAt: new Date(Date.now() + 7 * 86400000),
        cancelledAt: null,
      },
    });
    await this.audit(
      this.prisma,
      'AdminTeamInvitation',
      id,
      'ADMIN_INVITATION_REGENERATED',
      admin,
      invite,
      { expiresAt: next.expiresAt },
      'Novo link de convite gerado',
    );
    return {
      invitationPath: `/admin/convite/${token}`,
      expiresAt: next.expiresAt,
      sandbox: true,
      message: 'Novo link gerado. Nenhum e-mail foi enviado.',
    };
  }

  private async findInvitation(token: string) {
    const invite = await this.prisma.adminTeamInvitation.findUnique({
      where: { tokenHash: this.hashInvitationToken(token) },
      include: { invitedBy: { select: { name: true } } },
    });
    if (
      !invite ||
      invite.status !== AdminInvitationStatus.PENDING ||
      invite.expiresAt <= new Date()
    ) {
      if (invite?.status === AdminInvitationStatus.PENDING)
        await this.prisma.adminTeamInvitation.update({
          where: { id: invite.id },
          data: { status: AdminInvitationStatus.EXPIRED },
        });
      throw new BadRequestException(
        'Este convite expirou. Solicite um novo convite à equipe SorteX.',
      );
    }
    return invite;
  }

  private hashInvitationToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  async searchGlobal(search: string) {
    const term = search.trim();
    if (term.length < 2) return { organizers: [], campaigns: [], payments: [] };
    const [organizers, campaigns, payments] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: UserRole.ORGANIZER,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { cpf: { contains: term } },
            { cnpj: { contains: term } },
          ],
        },
        select: { id: true, name: true, email: true, status: true },
        take: 10,
      }),
      this.prisma.campaign.findMany({
        where: {
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { slug: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, slug: true, status: true },
        take: 10,
      }),
      this.prisma.payment.findMany({
        where: {
          OR: [
            { id: { contains: term } },
            { externalReference: { contains: term } },
          ],
        },
        select: { id: true, status: true, amount: true, campaignId: true },
        take: 10,
      }),
    ]);
    return this.serialize({ organizers, campaigns, payments });
  }

  private async isSuperadmin(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { adminTeamRole: true },
    });
    return user?.adminTeamRole === AdminTeamRole.SUPERADMIN;
  }
  async financialAccount(
    id: string,
    status: FinancialAccountStatus,
    reason: string,
    admin: AuthenticatedUser,
  ) {
    const current = await this.prisma.financialAccount.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException();
    const next = await this.prisma.financialAccount.update({
      where: { id },
      data: { status },
    });
    await this.audit(
      this.prisma,
      'FinancialAccount',
      id,
      'FINANCIAL_ACCOUNT_STATUS',
      admin,
      current,
      next,
      reason,
    );
    return next;
  }
  private async paginate(
    model: unknown,
    where: unknown,
    q: AdminListDto,
    select?: unknown,
    include?: unknown,
  ) {
    const delegate = model as {
      findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
      count: (args: { where: unknown }) => Promise<number>;
    };
    const [data, total] = await Promise.all([
      delegate.findMany({
        where,
        select,
        include,
        orderBy: { createdAt: q.sort === 'oldest' ? 'asc' : 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      delegate.count({ where }),
    ]);
    return {
      data: this.serialize(data),
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        pages: Math.ceil(total / q.limit),
      },
    };
  }
  private daily(items: Array<{ createdAt: Date }>) {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = item.createdAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map].map(([date, value]) => ({ date, value }));
  }
  private entityAudit(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  private serialize<T>(v: T): T {
    const json = JSON.stringify(v, (_key: string, value: unknown) =>
      Prisma.Decimal.isDecimal(value) ? Number(value) : value,
    );
    const parsed = JSON.parse(json) as unknown;
    return parsed as T;
  }
  private audit(
    tx: Prisma.TransactionClient | PrismaService,
    entityType: string,
    entityId: string,
    action: string,
    user: AuthenticatedUser,
    previousData: unknown,
    newData: unknown,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException('Justificativa obrigatória.');
    return tx.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        actorUserId: user.id,
        actorRole: user.role,
        previousData: previousData as Prisma.InputJsonValue,
        newData: newData as Prisma.InputJsonValue,
        metadata: { reason },
      },
    });
  }
}

function reviewTitle(status: VerificationStatus) {
  const labels: Partial<Record<VerificationStatus, string>> = {
    UNDER_REVIEW: 'Análise iniciada',
    CORRECTION_REQUESTED: 'Correção solicitada',
    DOCUMENT_REQUESTED: 'Documentação solicitada',
    VERIFIED: 'Cadastro aprovado',
    REJECTED: 'Cadastro reprovado',
    SUSPENDED: 'Conta suspensa',
    BLOCKED: 'Conta bloqueada',
    CLOSED: 'Cadastro encerrado',
    PENDING: 'Cadastro aguardando análise',
  };
  return labels[status] ?? 'Atualização do cadastro';
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function isValidCpf(raw: string) {
  const value = raw.replace(/\D/g, '');
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  const digit = (length: number) => {
    let total = 0;
    for (let index = 0; index < length; index += 1)
      total += Number(value[index]) * (length + 1 - index);
    const remainder = (total * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}
