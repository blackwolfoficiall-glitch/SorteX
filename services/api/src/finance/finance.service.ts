import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FinancialAccountStatus,
  FinancialOwnerType,
  LedgerDirection,
  LedgerEntryType,
  LedgerStatus,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  VerificationStatus,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { BalanceAvailabilityService } from './balance-availability.service';
import {
  CreateAdjustmentDto,
  CreatePayoutDto,
  AdminAccountQueryDto,
  AdminPayoutQueryDto,
  AdminSubscriptionQueryDto,
  ReportQueryDto,
  StatementQueryDto,
} from './dto/finance.dto';

type CampaignFinanceSummary = Prisma.CampaignFinancialSummaryGetPayload<{
  include: {
    campaign: {
      include: {
        purchases: {
          select: { buyerId: true; total: true; status: true };
        };
      };
    };
  };
}>;

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: BalanceAvailabilityService,
  ) {}
  async accountForOrganizer(id: string) {
    return this.prisma.financialAccount.upsert({
      where: {
        ownerType_ownerId_currency: {
          ownerType: FinancialOwnerType.ORGANIZER,
          ownerId: id,
          currency: 'BRL',
        },
      },
      create: {
        ownerType: FinancialOwnerType.ORGANIZER,
        ownerId: id,
        currency: 'BRL',
      },
      update: {},
    });
  }
  async overview(user: AuthenticatedUser) {
    const account = await this.accountForOrganizer(user.id);
    await this.availability.releaseDue(account.id);
    const fresh = await this.prisma.financialAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
    const now = new Date(),
      day = new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      week = new Date(now.getTime() - 7 * 86400000),
      month = new Date(now.getFullYear(), now.getMonth(), 1);
    const sums = await Promise.all(
      [day, week, month].map((from) =>
        this.prisma.payment.aggregate({
          where: {
            organizerId: user.id,
            status: PaymentStatus.APPROVED,
            approvedAt: { gte: from },
          },
          _sum: { amount: true, netAmount: true },
        }),
      ),
    );
    const payouts = await this.prisma.payoutRequest.aggregate({
      where: { organizerId: user.id },
      _sum: { amount: true },
    });
    return this.serialize({
      account: fresh,
      balance: {
        gross: Number(fresh.lifetimeGrossRevenue),
        net: Number(fresh.lifetimeNetRevenue),
        available: Number(fresh.availableBalance),
        pending: Number(fresh.pendingBalance),
        blocked: Number(fresh.blockedBalance),
        platformFees: Number(fresh.lifetimePlatformFees),
        gatewayFees: Number(fresh.lifetimeGatewayFees),
        totalRequested: Number(payouts._sum.amount ?? 0),
      },
      periods: {
        today: this.sum(sums[0]),
        last7Days: this.sum(sums[1]),
        currentMonth: this.sum(sums[2]),
      },
    });
  }
  async statement(user: AuthenticatedUser, q: StatementQueryDto) {
    const account = await this.accountForOrganizer(user.id);
    const where: Prisma.LedgerEntryWhereInput = {
      accountId: account.id,
      ...(q.type ? { type: q.type } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.direction ? { direction: q.direction } : {}),
      ...(q.campaignId ? { campaignId: q.campaignId } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              gte: q.from ? new Date(q.from) : undefined,
              lte: q.to ? new Date(q.to) : undefined,
            },
          }
        : {}),
      ...(q.minAmount != null || q.maxAmount != null
        ? { amount: { gte: q.minAmount, lte: q.maxAmount } }
        : {}),
    };
    if (q.gateway || q.method)
      where.payment = { provider: q.gateway, method: q.method };
    const [data, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        include: {
          campaign: { select: { title: true, slug: true } },
          payment: { select: { provider: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);
    return {
      data: data.map((v) => this.serialize(v)),
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        pages: Math.ceil(total / q.limit),
      },
    };
  }
  async campaigns(user: AuthenticatedUser) {
    const [summaries, paymentCounts] = await Promise.all([
      this.prisma.campaignFinancialSummary.findMany({
        where: { organizerId: user.id },
        include: {
          campaign: {
            include: {
              purchases: {
                select: { buyerId: true, total: true, status: true },
              },
            },
          },
        },
        orderBy: { grossRevenue: 'desc' },
      }),
      this.prisma.payment.groupBy({
        by: ['campaignId', 'status'],
        where: { organizerId: user.id },
        _count: { _all: true },
      }),
    ]);
    return summaries.map((s) =>
      this.campaignSummary(
        s,
        paymentCounts.filter((item) => item.campaignId === s.campaignId),
      ),
    );
  }
  async campaign(user: AuthenticatedUser, id: string) {
    const summary = await this.prisma.campaignFinancialSummary.findFirst({
      where: { campaignId: id, organizerId: user.id },
      include: {
        campaign: {
          include: {
            purchases: { select: { buyerId: true, total: true, status: true } },
          },
        },
      },
    });
    if (!summary)
      throw new NotFoundException('Resumo financeiro não encontrado.');
    const paymentCounts = await this.prisma.payment.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: id, organizerId: user.id },
      _count: { _all: true },
    });
    return this.campaignSummary(summary, paymentCounts);
  }
  async fees(user: AuthenticatedUser) {
    const profile = await this.prisma.organizerProfile.findUnique({
      where: { userId: user.id },
    });
    const account = await this.accountForOrganizer(user.id);
    return {
      plan: profile?.currentPlan ?? 'BASIC',
      configuredRate: Number(
        profile?.customPlatformFee ?? profile?.platformFee ?? 2.9,
      ),
      customRate:
        profile?.customPlatformFee == null
          ? null
          : Number(profile.customPlatformFee),
      platformFeeWaived: profile?.platformFeeWaived ?? false,
      monthlyFee: Number(profile?.monthlyFee ?? 0),
      monthlyFeeWaived: profile?.monthlyFeeWaived ?? false,
      totalPlatformFees: Number(account.lifetimePlatformFees),
      totalGatewayFees: Number(account.lifetimeGatewayFees),
    };
  }
  payouts(user: AuthenticatedUser) {
    return this.prisma.payoutRequest
      .findMany({
        where: { organizerId: user.id },
        orderBy: { requestedAt: 'desc' },
      })
      .then((v) => v.map((x) => this.serialize(x)));
  }
  async payout(user: AuthenticatedUser, id: string) {
    const item = await this.prisma.payoutRequest.findFirst({
      where: { id, organizerId: user.id },
    });
    if (!item) throw new NotFoundException('Repasse não encontrado.');
    return this.serialize(item);
  }
  async requestPayout(user: AuthenticatedUser, dto: CreatePayoutDto) {
    const minimum = new Prisma.Decimal(process.env.MIN_PAYOUT_AMOUNT ?? '50');
    const amount = new Prisma.Decimal(dto.amount).toDecimalPlaces(2);
    if (amount.lt(minimum))
      throw new BadRequestException(`Valor mínimo: R$ ${minimum.toFixed(2)}.`);
    const profile = await this.prisma.organizerProfile.findUnique({
      where: { userId: user.id },
      include: { user: true },
    });
    if (
      !profile ||
      profile.verificationStatus !== VerificationStatus.VERIFIED ||
      !profile.user.verified
    )
      throw new ForbiddenException('O organizador precisa estar verificado.');
    this.validateDestination(dto);
    const account = await this.accountForOrganizer(user.id);
    return this.prisma.$transaction(
      async (tx) => {
        const current = await tx.financialAccount.findUniqueOrThrow({
          where: { id: account.id },
        });
        if (current.status !== FinancialAccountStatus.ACTIVE)
          throw new ForbiddenException('Conta financeira indisponível.');
        if (current.availableBalance.lt(amount))
          throw new BadRequestException('Saldo disponível insuficiente.');
        const conflict = await tx.payoutRequest.count({
          where: {
            organizerId: user.id,
            status: {
              in: [
                PayoutStatus.REQUESTED,
                PayoutStatus.UNDER_REVIEW,
                PayoutStatus.APPROVED,
                PayoutStatus.PROCESSING,
              ],
            },
          },
        });
        if (conflict)
          throw new ConflictException(
            'Já existe uma solicitação em andamento.',
          );
        const snapshot = this.maskDestination(dto);
        const payout = await tx.payoutRequest.create({
          data: {
            organizerId: user.id,
            financialAccountId: current.id,
            amount,
            netAmount: amount,
            status: PayoutStatus.REQUESTED,
            destinationType: dto.destinationType,
            destinationSnapshot: snapshot,
            notes: dto.notes,
          },
        });
        await tx.financialAccount.update({
          where: { id: current.id },
          data: {
            availableBalance: { decrement: amount },
            blockedBalance: { increment: amount },
          },
        });
        await tx.ledgerEntry.create({
          data: {
            accountId: current.id,
            payoutRequestId: payout.id,
            type: LedgerEntryType.PAYOUT_REQUEST,
            direction: LedgerDirection.DEBIT,
            status: LedgerStatus.BLOCKED,
            amount,
            balanceBefore: current.availableBalance,
            balanceAfter: current.availableBalance.sub(amount),
            currency: current.currency,
            reference: `payout:${payout.id}:request`,
            description: 'Valor bloqueado para solicitação de repasse',
          },
        });
        await this.audit(
          tx,
          'PayoutRequest',
          payout.id,
          'PAYOUT_REQUESTED',
          user,
          { amount, destination: snapshot },
        );
        return this.serialize(payout);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
  async cancelPayout(user: AuthenticatedUser, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.findFirst({
        where: { id, organizerId: user.id },
      });
      if (!payout) throw new NotFoundException();
      if (payout.status !== PayoutStatus.REQUESTED)
        throw new BadRequestException(
          'Somente solicitações novas podem ser canceladas.',
        );
      const account = await tx.financialAccount.findUniqueOrThrow({
        where: { id: payout.financialAccountId },
      });
      await tx.payoutRequest.update({
        where: { id },
        data: { status: PayoutStatus.CANCELLED, cancelledAt: new Date() },
      });
      await tx.financialAccount.update({
        where: { id: account.id },
        data: {
          blockedBalance: { decrement: payout.amount },
          availableBalance: { increment: payout.amount },
        },
      });
      await tx.ledgerEntry.updateMany({
        where: { payoutRequestId: id, status: LedgerStatus.BLOCKED },
        data: { status: LedgerStatus.CANCELLED },
      });
      await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          payoutRequestId: id,
          type: LedgerEntryType.PAYOUT_CANCELLED,
          direction: LedgerDirection.CREDIT,
          status: LedgerStatus.COMPLETED,
          amount: payout.amount,
          balanceBefore: account.availableBalance,
          balanceAfter: account.availableBalance.add(payout.amount),
          currency: account.currency,
          reference: `payout:${id}:cancel`,
          description: 'Saldo devolvido após cancelamento',
        },
      });
      await this.audit(tx, 'PayoutRequest', id, 'PAYOUT_CANCELLED', user, {
        amount: payout.amount,
      });
      return { message: 'Solicitação cancelada e saldo desbloqueado.' };
    });
  }
  async report(user: AuthenticatedUser, q: ReportQueryDto) {
    const entries = await this.prisma.payment.findMany({
      where: {
        organizerId: user.id,
        status: PaymentStatus.APPROVED,
        approvedAt: {
          gte: q.from ? new Date(q.from) : undefined,
          lte: q.to ? new Date(q.to) : undefined,
        },
      },
      include: {
        campaign: { select: { title: true } },
        purchase: {
          select: { quantity: true, buyerId: true, promotionId: true },
        },
      },
      orderBy: { approvedAt: 'asc' },
    });
    const data = entries.map((p) => ({
      date: p.approvedAt?.toISOString() ?? '',
      campaign: p.campaign.title,
      gross: Number(p.amount),
      platformFee: Number(p.platformFee),
      gatewayFee: Number(p.gatewayFee),
      net: Number(p.netAmount),
      method: p.method,
      quantity: p.purchase.quantity,
      buyerId: p.purchase.buyerId,
      promotionId: p.purchase.promotionId,
    }));
    if (q.format === 'csv') {
      const header =
        'data,campanha,bruto,taxa_sortex,taxa_gateway,liquido,metodo,quantidade';
      return [
        header,
        ...data.map((v) =>
          [
            v.date,
            JSON.stringify(v.campaign),
            v.gross,
            v.platformFee,
            v.gatewayFee,
            v.net,
            v.method,
            v.quantity,
          ].join(','),
        ),
      ].join('\n');
    }
    return data;
  }

  async adminOverview() {
    const [platform, organizers, payments, payouts] = await Promise.all([
      this.prisma.financialAccount.findUnique({
        where: {
          ownerType_ownerId_currency: {
            ownerType: FinancialOwnerType.PLATFORM,
            ownerId: 'SORTEX',
            currency: 'BRL',
          },
        },
      }),
      this.prisma.financialAccount.aggregate({
        where: { ownerType: FinancialOwnerType.ORGANIZER },
        _sum: {
          availableBalance: true,
          pendingBalance: true,
          blockedBalance: true,
          lifetimeGrossRevenue: true,
          lifetimeNetRevenue: true,
        },
      }),
      this.prisma.payment.groupBy({
        by: ['status'],
        _count: { _all: true },
        _sum: { amount: true, platformFee: true },
      }),
      this.prisma.payoutRequest.count({
        where: {
          status: { in: [PayoutStatus.REQUESTED, PayoutStatus.UNDER_REVIEW] },
        },
      }),
    ]);
    return this.serialize({
      platform,
      organizers: organizers._sum,
      payments,
      pendingPayouts: payouts,
    });
  }
  adminRevenue() {
    return this.prisma.ledgerEntry
      .findMany({
        where: { account: { ownerType: FinancialOwnerType.PLATFORM } },
        include: { campaign: true },
        orderBy: { createdAt: 'desc' },
      })
      .then((v) => v.map((x) => this.serialize(x)));
  }
  adminOrganizers() {
    return this.prisma.financialAccount
      .findMany({
        where: { ownerType: FinancialOwnerType.ORGANIZER },
        orderBy: { lifetimeGrossRevenue: 'desc' },
      })
      .then((v) => v.map((x) => this.serialize(x)));
  }
  adminCampaigns() {
    return this.prisma.campaignFinancialSummary
      .findMany({
        include: { campaign: { select: { title: true, slug: true } } },
        orderBy: { grossRevenue: 'desc' },
      })
      .then((v) => v.map((x) => this.serialize(x)));
  }
  async adminLedger(q: StatementQueryDto) {
    const where: Prisma.LedgerEntryWhereInput = {
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.campaignId ? { campaignId: q.campaignId } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.direction ? { direction: q.direction } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(q.minAmount != null || q.maxAmount != null
        ? {
            amount: {
              ...(q.minAmount != null ? { gte: q.minAmount } : {}),
              ...(q.maxAmount != null ? { lte: q.maxAmount } : {}),
            },
          }
        : {}),
      ...(q.search
        ? {
            OR: [
              { reference: { contains: q.search, mode: 'insensitive' } },
              { description: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: this.financeOrder(q.sort),
        take: q.limit,
        skip: (q.page - 1) * q.limit,
        include: { account: true, campaign: true },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);
    return this.page(data, total, q);
  }
  async adminLedgerDetail(id: string) {
    const item = await this.prisma.ledgerEntry.findUnique({
      where: { id },
      include: {
        account: true,
        campaign: true,
        payment: true,
        payoutRequest: true,
      },
    });
    if (!item) throw new NotFoundException('Lançamento não encontrado.');
    const audit = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'LedgerEntry', entityId: id },
          ...(item.payoutRequestId
            ? [{ entityType: 'PayoutRequest', entityId: item.payoutRequestId }]
            : []),
        ],
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.serialize({ ...item, audit });
  }
  async adminAccounts(q: AdminAccountQueryDto) {
    const matchingUsers = q.search
      ? await this.prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { cpf: { contains: q.search } },
              { cnpj: { contains: q.search } },
            ],
          },
          select: { id: true },
        })
      : [];
    const where: Prisma.FinancialAccountWhereInput = {
      ownerType: FinancialOwnerType.ORGANIZER,
      ...(q.accountStatus ? { status: q.accountStatus } : {}),
      ...(q.search ? { ownerId: { in: matchingUsers.map((v) => v.id) } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.financialAccount.findMany({
        where,
        orderBy: this.financeOrder(q.sort),
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.financialAccount.count({ where }),
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: data.map((v) => v.ownerId) } },
      select: { id: true, name: true, email: true, cpf: true, cnpj: true },
    });
    const byId = new Map(users.map((v) => [v.id, v]));
    return this.page(
      data.map((v) => ({ ...v, organizer: byId.get(v.ownerId) })),
      total,
      q,
    );
  }
  async adminAccount(id: string) {
    const item = await this.prisma.financialAccount.findUnique({
      where: { id },
      include: {
        ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 100 },
        payoutRequests: { orderBy: { requestedAt: 'desc' }, take: 50 },
        adjustments: {
          include: { createdBy: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!item) throw new NotFoundException('Conta financeira não encontrada.');
    const [organizer, audit] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: item.ownerId },
        select: { id: true, name: true, email: true, cpf: true, cnpj: true },
      }),
      this.prisma.auditLog.findMany({
        where: { entityType: 'FinancialAccount', entityId: id },
        include: { actor: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return this.serialize({ ...item, organizer, audit });
  }
  async changeAccountStatus(
    id: string,
    status: FinancialAccountStatus,
    reason: string,
    user: AuthenticatedUser,
  ) {
    if (reason.trim().length < 5)
      throw new BadRequestException('Justificativa obrigatória.');
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.financialAccount.findUnique({ where: { id } });
      if (!current)
        throw new NotFoundException('Conta financeira não encontrada.');
      const next = await tx.financialAccount.update({
        where: { id },
        data: { status },
      });
      await this.audit(
        tx,
        'FinancialAccount',
        id,
        `FINANCIAL_ACCOUNT_${status}`,
        user,
        { previousStatus: current.status, nextStatus: status, reason },
      );
      return this.serialize(next);
    });
  }
  async adminPayouts(q: AdminPayoutQueryDto = new AdminPayoutQueryDto()) {
    const where: Prisma.PayoutRequestWhereInput = {
      ...(q.payoutStatus ? { status: q.payoutStatus } : {}),
      ...(q.from || q.to
        ? {
            requestedAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(q.search
        ? {
            OR: [
              {
                organizer: {
                  name: { contains: q.search, mode: 'insensitive' },
                },
              },
              {
                organizer: {
                  email: { contains: q.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.payoutRequest.findMany({
        where,
        include: {
          organizer: { select: { id: true, name: true, email: true } },
        },
        orderBy:
          q.sort === 'oldest'
            ? { requestedAt: 'asc' }
            : { requestedAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.payoutRequest.count({ where }),
    ]);
    return this.page(data, total, q);
  }
  async adminPayout(id: string) {
    const item = await this.prisma.payoutRequest.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true } },
        financialAccount: true,
        reviewedBy: { select: { id: true, name: true, email: true } },
        ledgerEntries: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!item) throw new NotFoundException();
    const audit = await this.prisma.auditLog.findMany({
      where: { entityType: 'PayoutRequest', entityId: id },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.serialize({ ...item, audit });
  }
  async transitionPayout(
    id: string,
    user: AuthenticatedUser,
    status: PayoutStatus,
    reason?: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException('Justificativa obrigatória.');
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.payoutRequest.findUnique({ where: { id } });
      if (!item) throw new NotFoundException();
      const allowed: Record<PayoutStatus, PayoutStatus[]> = {
        REQUESTED: [
          PayoutStatus.UNDER_REVIEW,
          PayoutStatus.APPROVED,
          PayoutStatus.REJECTED,
        ],
        UNDER_REVIEW: [PayoutStatus.APPROVED, PayoutStatus.REJECTED],
        APPROVED: [PayoutStatus.PROCESSING],
        PROCESSING: [PayoutStatus.COMPLETED, PayoutStatus.FAILED],
        COMPLETED: [],
        REJECTED: [],
        CANCELLED: [],
        FAILED: [],
      };
      if (!allowed[item.status].includes(status))
        throw new BadRequestException(
          `Transição ${item.status} → ${status} não permitida.`,
        );
      if (status === PayoutStatus.REJECTED && !reason)
        throw new BadRequestException('Justificativa obrigatória.');
      const now = new Date();
      const reviewed =
        status === PayoutStatus.APPROVED || status === PayoutStatus.REJECTED;
      const updated = await tx.payoutRequest.update({
        where: { id },
        data: {
          status,
          reviewedAt: reviewed ? now : undefined,
          reviewedByUserId: reviewed ? user.id : undefined,
          rejectionReason:
            status === PayoutStatus.REJECTED ? reason : undefined,
          approvedAt: status === PayoutStatus.APPROVED ? now : undefined,
          completedAt: status === PayoutStatus.COMPLETED ? now : undefined,
        },
      });
      if (status === PayoutStatus.REJECTED) {
        await tx.financialAccount.update({
          where: { id: item.financialAccountId },
          data: {
            blockedBalance: { decrement: item.amount },
            availableBalance: { increment: item.amount },
          },
        });
        await tx.ledgerEntry.updateMany({
          where: { payoutRequestId: id, status: LedgerStatus.BLOCKED },
          data: { status: LedgerStatus.CANCELLED },
        });
      }
      if (status === PayoutStatus.COMPLETED) {
        await tx.financialAccount.update({
          where: { id: item.financialAccountId },
          data: { blockedBalance: { decrement: item.amount } },
        });
        await tx.ledgerEntry.updateMany({
          where: { payoutRequestId: id, status: LedgerStatus.BLOCKED },
          data: { status: LedgerStatus.COMPLETED },
        });
        await tx.ledgerEntry.create({
          data: {
            accountId: item.financialAccountId,
            payoutRequestId: id,
            type: LedgerEntryType.PAYOUT_COMPLETED,
            direction: LedgerDirection.DEBIT,
            status: LedgerStatus.COMPLETED,
            amount: item.amount,
            balanceBefore: item.amount,
            balanceAfter: 0,
            currency: 'BRL',
            reference: `payout:${id}:completed`,
            description: 'Repasse marcado manualmente como concluído',
          },
        });
      }
      await this.audit(tx, 'PayoutRequest', id, `PAYOUT_${status}`, user, {
        reason,
      });
      return this.serialize(updated);
    });
  }
  async adjustment(user: AuthenticatedUser, dto: CreateAdjustmentDto) {
    const amount = new Prisma.Decimal(dto.amount).toDecimalPlaces(2);
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.financialAccount.findUnique({
        where: { id: dto.accountId },
      });
      if (!account) throw new NotFoundException();
      if (
        dto.direction === LedgerDirection.DEBIT &&
        account.availableBalance.lt(amount)
      )
        throw new BadRequestException('Ajuste deixaria saldo negativo.');
      const adjustment = await tx.financialAdjustment.create({
        data: {
          accountId: account.id,
          organizerId:
            account.ownerType === FinancialOwnerType.ORGANIZER
              ? account.ownerId
              : null,
          amount,
          direction: dto.direction,
          reason: dto.reason,
          notes: dto.notes,
          createdByUserId: user.id,
          approvedByUserId: user.id,
        },
      });
      await tx.financialAccount.update({
        where: { id: account.id },
        data: {
          availableBalance:
            dto.direction === LedgerDirection.CREDIT
              ? { increment: amount }
              : { decrement: amount },
        },
      });
      await tx.ledgerEntry.create({
        data: {
          accountId: account.id,
          type: LedgerEntryType.MANUAL_ADJUSTMENT,
          direction: dto.direction,
          status: LedgerStatus.COMPLETED,
          amount,
          balanceBefore: account.availableBalance,
          balanceAfter:
            dto.direction === LedgerDirection.CREDIT
              ? account.availableBalance.add(amount)
              : account.availableBalance.sub(amount),
          currency: account.currency,
          reference: `adjustment:${adjustment.id}`,
          description: dto.reason,
          metadata: { notes: dto.notes ?? null },
        },
      });
      await this.audit(
        tx,
        'FinancialAdjustment',
        adjustment.id,
        'MANUAL_ADJUSTMENT',
        user,
        dto,
      );
      return this.serialize(adjustment);
    });
  }
  async adjustments(q: StatementQueryDto) {
    const where: Prisma.FinancialAdjustmentWhereInput = {
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(q.search
        ? {
            OR: [
              { reason: { contains: q.search, mode: 'insensitive' } },
              { notes: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.financialAdjustment.findMany({
        where,
        include: {
          account: true,
          createdBy: { select: { name: true, email: true } },
          approvedBy: { select: { name: true, email: true } },
        },
        orderBy: this.financeOrder(q.sort),
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.financialAdjustment.count({ where }),
    ]);
    return this.page(data, total, q);
  }
  async adjustmentDetail(id: string) {
    const item = await this.prisma.financialAdjustment.findUnique({
      where: { id },
      include: {
        account: true,
        createdBy: { select: { name: true, email: true } },
        approvedBy: { select: { name: true, email: true } },
      },
    });
    if (!item) throw new NotFoundException('Ajuste não encontrado.');
    const audit = await this.prisma.auditLog.findMany({
      where: { entityType: 'FinancialAdjustment', entityId: id },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.serialize({ ...item, audit });
  }
  async subscriptions(
    q: AdminSubscriptionQueryDto = new AdminSubscriptionQueryDto(),
  ) {
    const where: Prisma.SubscriptionWhereInput = {
      ...(q.subscriptionStatus ? { status: q.subscriptionStatus } : {}),
      ...(q.search
        ? {
            organizer: {
              OR: [
                { name: { contains: q.search, mode: 'insensitive' } },
                { email: { contains: q.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          invoices: true,
          organizer: { select: { id: true, name: true, email: true } },
          selectedPlan: true,
        },
        orderBy: this.financeOrder(q.sort),
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return this.page(data, total, q);
  }
  async subscription(id: string) {
    const item = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        invoices: true,
        organizer: { select: { id: true, name: true, email: true } },
        selectedPlan: true,
      },
    });
    if (!item) throw new NotFoundException('Assinatura não encontrada.');
    const audit = await this.prisma.auditLog.findMany({
      where: { entityType: 'Subscription', entityId: id },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return this.serialize({ ...item, audit });
  }
  async reconciliation(q: StatementQueryDto) {
    const date = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to ? { lte: new Date(q.to) } : {}),
    };
    const [payments, ledger, payouts] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          status: PaymentStatus.APPROVED,
          ...(q.from || q.to ? { approvedAt: date } : {}),
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          type: LedgerEntryType.GROSS_SALE,
          status: LedgerStatus.COMPLETED,
          ...(q.from || q.to ? { createdAt: date } : {}),
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payoutRequest.groupBy({
        by: ['status'],
        _sum: { amount: true },
        _count: { _all: true },
      }),
    ]);
    const paymentTotal = Number(payments._sum.amount ?? 0),
      ledgerTotal = Number(ledger._sum.amount ?? 0);
    return this.serialize({
      paymentTotal,
      ledgerTotal,
      difference: paymentTotal - ledgerTotal,
      balanced: paymentTotal === ledgerTotal,
      paymentsCount: payments._count,
      ledgerCount: ledger._count,
      payouts,
      generatedAt: new Date(),
    });
  }
  async exportAdmin(resource: string, q: StatementQueryDto) {
    let rows: Record<string, unknown>[];
    if (resource === 'ledger')
      rows = (await this.adminLedger({ ...q, limit: 100 })).data;
    else if (resource === 'payouts')
      rows = (
        await this.adminPayouts(
          Object.assign(new AdminPayoutQueryDto(), q, { limit: 100 }),
        )
      ).data;
    else if (resource === 'adjustments')
      rows = (await this.adjustments({ ...q, limit: 100 })).data;
    else throw new BadRequestException('Exportação financeira inválida.');
    if (!rows.length) return '';
    const columns = Object.keys(rows[0]).filter(
      (k) =>
        ![
          'metadata',
          'destinationSnapshot',
          'account',
          'organizer',
          'campaign',
        ].includes(k),
    );
    return [
      columns.join(';'),
      ...rows.map((row) =>
        columns.map((column) => JSON.stringify(row[column] ?? '')).join(';'),
      ),
    ].join('\\n');
  }
  private financeOrder(
    sort: string = 'recent',
  ): Prisma.Enumerable<Prisma.LedgerEntryOrderByWithRelationInput> {
    return sort === 'oldest'
      ? { createdAt: 'asc' }
      : sort === 'amount_asc'
        ? { amount: 'asc' }
        : sort === 'amount_desc'
          ? { amount: 'desc' }
          : { createdAt: 'desc' };
  }
  private page<T>(
    data: T[],
    total: number,
    q: { page: number; limit: number },
  ) {
    return this.serialize({
      data,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        pages: Math.ceil(total / q.limit),
      },
    });
  }
  private campaignSummary(
    s: CampaignFinanceSummary,
    paymentCounts: Array<{
      status: PaymentStatus;
      _count: { _all: number };
    }> = [],
  ) {
    const paid = s.campaign.purchases.filter(
      (purchase) => purchase.status === 'PAID',
    );
    const buyers = new Set(paid.map((purchase) => purchase.buyerId)).size;
    const reservedValue = s.campaign.purchases
      .filter((purchase) =>
        ['RESERVED', 'AWAITING_PAYMENT'].includes(purchase.status),
      )
      .reduce((total, purchase) => total + Number(purchase.total), 0);
    const count = (statuses: PaymentStatus[]) =>
      paymentCounts
        .filter((item) => statuses.includes(item.status))
        .reduce((total, item) => total + item._count._all, 0);
    return this.serialize({
      ...s,
      approvedPayments: count([PaymentStatus.APPROVED]),
      pendingPayments: count([
        PaymentStatus.CREATED,
        PaymentStatus.PENDING,
        PaymentStatus.PROCESSING,
      ]),
      rejectedPayments: count([PaymentStatus.REJECTED]),
      buyers,
      averageTicket: paid.length
        ? paid.reduce((total, purchase) => total + Number(purchase.total), 0) /
          paid.length
        : 0,
      reservedValue,
      confirmedValue: paid.reduce(
        (total, purchase) => total + Number(purchase.total),
        0,
      ),
      estimatedPrizeCost: Number(s.campaign.estimatedPrizeValue ?? 0),
      estimatedProfit:
        Number(s.netRevenue) - Number(s.campaign.estimatedPrizeValue ?? 0),
      soldPercentage: s.campaign.totalNumbers
        ? (100 * s.campaign.soldNumbers) / s.campaign.totalNumbers
        : 0,
    });
  }
  private validateDestination(d: CreatePayoutDto) {
    if (d.destinationType === 'PIX' && (!d.pixKey || !d.pixKeyType))
      throw new BadRequestException('Informe tipo e chave PIX.');
    if (
      d.destinationType === 'BANK_ACCOUNT' &&
      (!d.bank || !d.agency || !d.account || !d.accountType)
    )
      throw new BadRequestException('Informe os dados bancários.');
  }
  private maskDestination(d: CreatePayoutDto) {
    return {
      holderName: d.holderName,
      taxId: this.mask(d.taxId, 4),
      pixKeyType: d.pixKeyType,
      pixKey: d.pixKey ? this.mask(d.pixKey, 4) : undefined,
      bank: d.bank,
      agency: d.agency ? this.mask(d.agency, 2) : undefined,
      account: d.account ? this.mask(d.account, 3) : undefined,
      accountType: d.accountType,
    };
  }
  private mask(v: string, visible: number) {
    const clean = v.trim();
    return `${'*'.repeat(Math.max(0, clean.length - visible))}${clean.slice(-visible)}`;
  }
  private sum(v: {
    _sum: { amount: Prisma.Decimal | null; netAmount: Prisma.Decimal | null };
  }) {
    return {
      gross: Number(v._sum.amount ?? 0),
      net: Number(v._sum.netAmount ?? 0),
    };
  }
  private serialize<T>(value: T): T {
    const json = JSON.stringify(
      value,
      (_key: string, candidate: unknown): unknown =>
        Prisma.Decimal.isDecimal(candidate) ? Number(candidate) : candidate,
    );
    const parsed = JSON.parse(json) as unknown;
    return parsed as T;
  }
  private audit(
    tx: Prisma.TransactionClient,
    entityType: string,
    entityId: string,
    action: string,
    user: AuthenticatedUser,
    data: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        actorUserId: user.id,
        actorRole: user.role,
        newData: data as Prisma.InputJsonValue,
      },
    });
  }
}
