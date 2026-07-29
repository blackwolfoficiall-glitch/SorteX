import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AffiliateConversionStatus,
  AffiliatePayoutStatus,
  AffiliateProgramStatus,
  AffiliateStatus,
  Prisma,
  ReferralTargetType,
  UserRole,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AffiliatePayoutDto,
  CreateAffiliateLinkDto,
  CreateAffiliateProgramDto,
  InviteAffiliateDto,
  TrackAffiliateClickDto,
} from './dto/affiliate.dto';
import { AffiliateCommissionService } from './affiliate-commission.service';

@Injectable()
export class AffiliatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionService: AffiliateCommissionService,
  ) {}
  async createProgram(user: AuthenticatedUser, dto: CreateAffiliateProgramDto) {
    this.organizer(user);
    if (
      dto.campaignId &&
      !(await this.prisma.campaign.findFirst({
        where: { id: dto.campaignId, organizerId: user.id },
      }))
    )
      throw new ForbiddenException('Campanha inválida.');
    this.validateCommission(dto);
    return this.prisma.affiliateProgram.create({
      data: {
        ...dto,
        organizerId: user.id,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
      },
    });
  }
  programs(user: AuthenticatedUser) {
    this.organizer(user);
    return this.prisma.affiliateProgram.findMany({
      where: { organizerId: user.id },
      include: {
        _count: {
          select: { affiliates: true, conversions: true, links: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async updateProgram(
    user: AuthenticatedUser,
    id: string,
    dto: CreateAffiliateProgramDto,
  ) {
    await this.ownedProgram(user, id);
    this.validateCommission(dto);
    return this.prisma.affiliateProgram.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }
  setProgramStatus(
    user: AuthenticatedUser,
    id: string,
    status: AffiliateProgramStatus,
  ) {
    return this.ownedProgram(user, id).then(() =>
      this.prisma.affiliateProgram.update({ where: { id }, data: { status } }),
    );
  }
  async invite(user: AuthenticatedUser, dto: InviteAffiliateDto) {
    const program = await this.ownedProgram(user, dto.programId);
    if (program.affiliateLimit) {
      const count = await this.prisma.affiliate.count({
        where: {
          programId: program.id,
          status: { not: AffiliateStatus.INACTIVE },
        },
      });
      if (count >= program.affiliateLimit)
        throw new BadRequestException(
          'O limite de afiliados deste programa foi atingido.',
        );
    }
    const code = this.code();
    const affiliate = await this.prisma.affiliate.create({
      data: {
        organizerId: user.id,
        programId: program.id,
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        inviteMessage: dto.message,
        inviteExpiresAt: new Date(
          Date.now() + (dto.validityDays ?? 7) * 86400000,
        ),
        invitationLastSentAt: new Date(),
        status: AffiliateStatus.INVITED,
        referralCode: code,
        slug: `${this.slug(dto.name)}-${code.toLowerCase()}`,
      },
    });
    return {
      ...affiliate,
      inviteUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/afiliado/convite/${code}`,
    };
  }
  async affiliates(user: AuthenticatedUser) {
    this.organizer(user);
    return this.prisma.affiliate.findMany({
      where: { organizerId: user.id },
      include: {
        program: { select: { name: true } },
        _count: { select: { links: true, conversions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async organizerDashboard(user: AuthenticatedUser) {
    this.organizer(user);
    await this.commissionService.releaseDue(this.prisma);
    const [programs, affiliates, links, conversions, commissions] =
      await Promise.all([
        this.prisma.affiliateProgram.findMany({
          where: { organizerId: user.id },
        }),
        this.prisma.affiliate.findMany({ where: { organizerId: user.id } }),
        this.prisma.affiliateLink.findMany({
          where: { affiliate: { organizerId: user.id } },
        }),
        this.prisma.affiliateConversion.findMany({
          where: { affiliate: { organizerId: user.id } },
        }),
        this.prisma.affiliateCommission.findMany({
          where: { affiliate: { organizerId: user.id } },
        }),
      ]);
    const sum = (rows: Array<{ amount: Prisma.Decimal }>) =>
      rows.reduce((total, row) => total + Number(row.amount), 0);
    return {
      activePrograms: programs.filter(
        (item) => item.status === AffiliateProgramStatus.ACTIVE,
      ).length,
      activeAffiliates: affiliates.filter(
        (item) => item.status === AffiliateStatus.ACTIVE,
      ).length,
      pendingInvites: affiliates.filter(
        (item) =>
          item.status === AffiliateStatus.INVITED &&
          (!item.inviteExpiresAt || item.inviteExpiresAt > new Date()),
      ).length,
      clicks: links.reduce((total, item) => total + item.clicks, 0),
      attributedReservations: conversions.filter(
        (item) => item.status === AffiliateConversionStatus.PENDING,
      ).length,
      approvedSales: conversions.filter(
        (item) =>
          item.status === AffiliateConversionStatus.APPROVED ||
          item.status === AffiliateConversionStatus.AVAILABLE ||
          item.status === AffiliateConversionStatus.PAID,
      ).length,
      generatedRevenue: conversions.reduce(
        (total, item) => total + Number(item.grossAmount),
        0,
      ),
      estimatedCommissions: sum(
        commissions.filter(
          (item) => item.status === AffiliateConversionStatus.APPROVED,
        ),
      ),
      availableCommissions: sum(
        commissions.filter(
          (item) => item.status === AffiliateConversionStatus.AVAILABLE,
        ),
      ),
      paidCommissions: sum(
        commissions.filter(
          (item) => item.status === AffiliateConversionStatus.PAID,
        ),
      ),
    };
  }
  organizerConversions(user: AuthenticatedUser) {
    this.organizer(user);
    return this.prisma.affiliateConversion.findMany({
      where: { affiliate: { organizerId: user.id } },
      include: {
        affiliate: { select: { id: true, name: true, email: true } },
        campaign: { select: { title: true } },
        commission: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  organizerCommissions(user: AuthenticatedUser) {
    this.organizer(user);
    return this.prisma.affiliateCommission.findMany({
      where: { affiliate: { organizerId: user.id } },
      include: {
        affiliate: { select: { id: true, name: true } },
        conversion: { include: { campaign: { select: { title: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  async setCommissionStatus(
    user: AuthenticatedUser,
    id: string,
    status: AffiliateConversionStatus,
  ) {
    this.organizer(user);
    if (
      status !== AffiliateConversionStatus.AVAILABLE &&
      status !== AffiliateConversionStatus.PAID
    )
      throw new BadRequestException('Status de comissão inválido.');
    const commission = await this.prisma.affiliateCommission.findFirst({
      where: { id, affiliate: { organizerId: user.id } },
    });
    if (!commission) throw new NotFoundException('Comissão não encontrada.');
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.affiliateCommission.update({
        where: { id },
        data: {
          status,
          paidAt: status === AffiliateConversionStatus.PAID ? new Date() : null,
        },
      });
      await tx.affiliateConversion.update({
        where: { id: commission.conversionId },
        data: { status },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'AffiliateCommission',
          entityId: id,
          action: `AFFILIATE_COMMISSION_${status}`,
          actorUserId: user.id,
          actorRole: user.role,
        },
      });
      return row;
    });
  }
  async setAffiliateStatus(
    user: AuthenticatedUser,
    id: string,
    status: AffiliateStatus,
  ) {
    const row = await this.prisma.affiliate.findFirst({
      where: { id, organizerId: user.id },
      include: { program: true },
    });
    if (!row) throw new NotFoundException('Afiliado não encontrado.');
    const updated = await this.prisma.affiliate.update({
      where: { id },
      data: {
        status,
        approvedAt: status === AffiliateStatus.ACTIVE ? new Date() : undefined,
        suspendedAt:
          status === AffiliateStatus.SUSPENDED ? new Date() : undefined,
      },
    });
    if (status === AffiliateStatus.ACTIVE && row.program.campaignId) {
      const existingLink = await this.prisma.affiliateLink.findFirst({
        where: { affiliateId: row.id, campaignId: row.program.campaignId },
      });
      if (!existingLink) {
        const campaign = await this.prisma.campaign.findFirst({
          where: {
            id: row.program.campaignId,
            organizerId: user.id,
          },
          select: { slug: true },
        });
        if (campaign) {
          await this.prisma.affiliateLink.create({
            data: {
              affiliateId: row.id,
              programId: row.programId,
              campaignId: row.program.campaignId,
              code: this.code(),
              slug: `${campaign.slug}-${row.slug}`,
              url: `${process.env.APP_URL ?? 'http://localhost:3000'}/campanha/${campaign.slug}?ref=${row.referralCode}`,
            },
          });
        }
      }
    }
    return updated;
  }
  async acceptInvite(user: AuthenticatedUser, code: string) {
    const affiliate = await this.prisma.affiliate.findUnique({
      where: { referralCode: code.toUpperCase() },
      include: { program: true },
    });
    if (!affiliate) throw new NotFoundException('Convite não encontrado.');
    if (affiliate.inviteExpiresAt && affiliate.inviteExpiresAt <= new Date())
      throw new BadRequestException('Este convite expirou.');
    if (affiliate.email.toLowerCase() !== user.email.toLowerCase())
      throw new ForbiddenException('Este convite pertence a outro e-mail.');
    if (affiliate.userId && affiliate.userId !== user.id)
      throw new ForbiddenException('Convite já utilizado.');
    return this.prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        userId: user.id,
        status: affiliate.program.allowSelfSignup
          ? AffiliateStatus.ACTIVE
          : AffiliateStatus.PENDING,
        joinedAt: new Date(),
        approvedAt: affiliate.program.allowSelfSignup ? new Date() : undefined,
      },
    });
  }
  async resendInvite(user: AuthenticatedUser, id: string) {
    const row = await this.prisma.affiliate.findFirst({
      where: {
        id,
        organizerId: user.id,
        status: { in: [AffiliateStatus.INVITED, AffiliateStatus.INACTIVE] },
      },
    });
    if (!row) throw new NotFoundException('Convite não encontrado.');
    const code = this.code();
    const updated = await this.prisma.affiliate.update({
      where: { id },
      data: {
        referralCode: code,
        slug: `${this.slug(row.name)}-${code.toLowerCase()}`,
        status: AffiliateStatus.INVITED,
        invitationLastSentAt: new Date(),
        inviteExpiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return {
      ...updated,
      inviteUrl: `${process.env.APP_URL ?? 'http://localhost:3000'}/afiliado/convite/${code}`,
    };
  }
  async createLink(user: AuthenticatedUser, dto: CreateAffiliateLinkDto) {
    const affiliate = await this.prisma.affiliate.findFirst({
      where: {
        id: dto.affiliateId,
        OR: [{ userId: user.id }, { organizerId: user.id }],
        status: AffiliateStatus.ACTIVE,
      },
      include: { program: true },
    });
    if (!affiliate) throw new ForbiddenException('Afiliado inválido.');
    const campaignId = dto.campaignId ?? affiliate.program.campaignId;
    if (!campaignId) throw new BadRequestException('Selecione uma campanha.');
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, organizerId: affiliate.organizerId },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    const code = this.code();
    return this.prisma.affiliateLink.create({
      data: {
        affiliateId: affiliate.id,
        programId: affiliate.programId,
        campaignId,
        code,
        slug: `${campaign.slug}-${affiliate.slug}`,
        url: `${process.env.APP_URL ?? 'http://localhost:3000'}/campanha/${campaign.slug}?ref=${affiliate.referralCode}`,
      },
    });
  }
  async track(
    dto: TrackAffiliateClickDto,
    ip?: string,
    userAgent?: string,
    userId?: string,
  ) {
    const link = await this.prisma.affiliateLink.findFirst({
      where: {
        OR: [{ code: dto.code }, { affiliate: { referralCode: dto.code } }],
        affiliate: { status: AffiliateStatus.ACTIVE },
        program: { status: AffiliateProgramStatus.ACTIVE },
      },
      include: { program: true },
    });
    if (!link) throw new NotFoundException('Link inválido.');
    const expiresAt = new Date(
      Date.now() + link.program.cookieDurationDays * 86400000,
    );
    const existing = await this.prisma.affiliateClick.findFirst({
      where: {
        affiliateLinkId: link.id,
        visitorId: dto.visitorId,
        clickedAt: { gte: new Date(Date.now() - 86400000) },
      },
    });
    const click = await this.prisma.affiliateClick.create({
      data: {
        affiliateLinkId: link.id,
        visitorId: dto.visitorId,
        userId,
        ipHash: this.hash(ip),
        userAgentHash: this.hash(userAgent),
        referrer: dto.referrer,
        landingPage: dto.landingPage,
        expiresAt,
      },
    });
    await this.prisma.affiliateLink.update({
      where: { id: link.id },
      data: {
        clicks: { increment: 1 },
        uniqueClicks: existing ? undefined : { increment: 1 },
      },
    });
    return {
      clickId: click.id,
      affiliateCode: link.affiliateId,
      referralCode: (
        await this.prisma.affiliate.findUniqueOrThrow({
          where: { id: link.affiliateId },
        })
      ).referralCode,
      expiresAt,
    };
  }
  async dashboard(user: AuthenticatedUser) {
    await this.commissionService.releaseDue(this.prisma);
    const memberships = await this.prisma.affiliate.findMany({
      where: { userId: user.id },
      include: {
        links: true,
        conversions: true,
        commissions: true,
        payoutRequests: true,
      },
    });
    const commissions = memberships.flatMap((x) => x.commissions);
    const sum = (status?: AffiliateConversionStatus) =>
      commissions
        .filter((x) => !status || x.status === status)
        .reduce((a, x) => a + Number(x.amount), 0);
    return {
      memberships: memberships.length,
      clicks: memberships
        .flatMap((x) => x.links)
        .reduce((a, x) => a + x.clicks, 0),
      conversions: memberships.flatMap((x) => x.conversions).length,
      pending: sum(AffiliateConversionStatus.APPROVED),
      available: sum(AffiliateConversionStatus.AVAILABLE),
      paid: sum(AffiliateConversionStatus.PAID),
      links: memberships.flatMap((x) => x.links),
      recentConversions: memberships.flatMap((x) => x.conversions).slice(-20),
    };
  }
  links(user: AuthenticatedUser) {
    return this.prisma.affiliateLink.findMany({
      where: { affiliate: { userId: user.id } },
      include: { campaign: { select: { title: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  conversions(user: AuthenticatedUser) {
    return this.prisma.affiliateConversion.findMany({
      where: { affiliate: { userId: user.id } },
      include: { campaign: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  commissions(user: AuthenticatedUser) {
    return this.prisma.affiliateCommission.findMany({
      where: { affiliate: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
    });
  }
  async payout(user: AuthenticatedUser, dto: AffiliatePayoutDto) {
    const affiliate = await this.prisma.affiliate.findFirst({
      where: { userId: user.id, status: AffiliateStatus.ACTIVE },
      include: { program: true },
    });
    if (!affiliate)
      throw new ForbiddenException('Afiliado ativo não encontrado.');
    const available = await this.prisma.affiliateCommission.aggregate({
      _sum: { amount: true },
      where: {
        affiliateId: affiliate.id,
        status: AffiliateConversionStatus.AVAILABLE,
      },
    });
    const amount = new Prisma.Decimal(dto.amount);
    if (
      amount.lt(affiliate.program.minimumPayoutAmount) ||
      amount.gt(available._sum.amount ?? 0)
    )
      throw new BadRequestException('Saldo disponível ou mínimo insuficiente.');
    return this.prisma.affiliatePayoutRequest.create({
      data: {
        affiliateId: affiliate.id,
        amount,
        status: AffiliatePayoutStatus.REQUESTED,
        destinationSnapshot: dto.destinationSnapshot as
          Prisma.InputJsonValue | undefined,
      },
    });
  }
  async ranking(user: AuthenticatedUser, programId: string) {
    await this.ownedProgram(user, programId);
    return this.prisma.affiliate.findMany({
      where: { programId },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { conversions: true } },
        conversions: { select: { grossAmount: true, commissionAmount: true } },
      },
    });
  }
  async createCoupon(user: AuthenticatedUser, d: any) {
    const affiliate = await this.prisma.affiliate.findFirst({
      where: { id: d.affiliateId, organizerId: user.id },
      include: { program: true },
    });
    if (!affiliate) throw new NotFoundException('Afiliado não encontrado.');
    if (Number(d.discountValue) < 0)
      throw new BadRequestException('Desconto inválido.');
    return this.prisma.affiliateCoupon.create({
      data: {
        affiliateId: affiliate.id,
        programId: affiliate.programId,
        campaignId: d.campaignId,
        code: String(d.code).toUpperCase(),
        discountType: d.discountType,
        discountValue: d.discountValue,
        usageLimit: d.usageLimit,
      },
    });
  }
  coupons(user: AuthenticatedUser) {
    this.organizer(user);
    return this.prisma.affiliateCoupon.findMany({
      where: { affiliate: { organizerId: user.id } },
      include: {
        affiliate: { select: { name: true } },
        program: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async createMaterial(user: AuthenticatedUser, d: any) {
    const program = await this.ownedProgram(user, d.programId);
    return this.prisma.affiliateMaterial.create({
      data: {
        programId: program.id,
        campaignId: d.campaignId,
        title: d.title,
        description: d.description,
        type: d.type,
        fileUrl: d.fileUrl,
        textContent: d.textContent,
        instructions: d.instructions,
      },
    });
  }
  materials(user: AuthenticatedUser) {
    return this.prisma.affiliateMaterial.findMany({
      where: {
        isActive: true,
        program: {
          affiliates: {
            some: { userId: user.id, status: AffiliateStatus.ACTIVE },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async referralCode(user: AuthenticatedUser) {
    const target =
      user.role === UserRole.ORGANIZER
        ? ReferralTargetType.ORGANIZER
        : ReferralTargetType.BUYER;
    const active = await this.prisma.referralProgram.findFirst({
      where: { status: 'ACTIVE', targetType: target },
      orderBy: { createdAt: 'desc' },
    });
    return { code: `SX-${user.id.slice(-8).toUpperCase()}`, program: active };
  }
  async applyReferral(user: AuthenticatedUser, code: string) {
    const referrerId = code.toUpperCase().startsWith('SX-')
      ? await this.prisma.user
          .findFirst({
            where: { id: { endsWith: code.slice(3).toLowerCase() } },
          })
          .then((x) => x?.id)
      : undefined;
    if (!referrerId || referrerId === user.id)
      throw new BadRequestException('Indicação inválida.');
    const target =
      user.role === UserRole.ORGANIZER
        ? ReferralTargetType.ORGANIZER
        : ReferralTargetType.BUYER;
    const program = await this.prisma.referralProgram.findFirst({
      where: { status: 'ACTIVE', targetType: target },
    });
    if (!program)
      throw new BadRequestException('Programa de indicação indisponível.');
    return this.prisma.referral.create({
      data: {
        programId: program.id,
        referrerUserId: referrerId,
        referredUserId: user.id,
        code: code.toUpperCase(),
      },
    });
  }
  private organizer(user: AuthenticatedUser) {
    if (user.role !== UserRole.ORGANIZER)
      throw new ForbiddenException('Acesso exclusivo do organizador.');
  }
  private async ownedProgram(user: AuthenticatedUser, id: string) {
    this.organizer(user);
    const p = await this.prisma.affiliateProgram.findFirst({
      where: { id, organizerId: user.id },
    });
    if (!p) throw new NotFoundException('Programa não encontrado.');
    return p;
  }
  private validateCommission(d: CreateAffiliateProgramDto) {
    if (d.commissionType === 'PERCENTAGE' && d.commissionPercentage == null)
      throw new BadRequestException('Informe o percentual.');
    if (d.commissionType === 'FIXED' && d.commissionFixedAmount == null)
      throw new BadRequestException('Informe o valor fixo.');
    if (
      d.commissionType === 'MIXED' &&
      (d.commissionMixedPercentage == null ||
        d.commissionMixedFixedAmount == null)
    )
      throw new BadRequestException('Informe percentual e valor fixo.');
  }
  private code() {
    return randomBytes(5).toString('hex').toUpperCase();
  }
  private slug(v: string) {
    return v
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  private hash(v?: string) {
    return v
      ? createHash('sha256').update(v).digest('hex').slice(0, 24)
      : undefined;
  }
}
