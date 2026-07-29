import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import {
  AffiliateConversionStatus,
  AffiliatePayoutStatus,
  AffiliateStatus,
  AdminPermission,
  UserRole,
} from '@prisma/client';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
@Controller('admin')
@Roles(UserRole.ADMIN)
@AdminPermissions(AdminPermission.FINANCE_READ)
export class AffiliateAdminController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('affiliates') affiliates() {
    return this.prisma.affiliate.findMany({
      include: { program: true, _count: { select: { conversions: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get('affiliate-conversions') conversions() {
    return this.prisma.affiliateConversion.findMany({
      include: {
        affiliate: { select: { name: true, email: true } },
        campaign: { select: { title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Get('affiliate-payouts') payouts() {
    return this.prisma.affiliatePayoutRequest.findMany({
      include: { affiliate: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Post('affiliates/:id/suspend')
  @AdminPermissions(AdminPermission.FINANCE_WRITE)
  async suspend(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() b: { reason: string },
  ) {
    const old = await this.prisma.affiliate.findUniqueOrThrow({
      where: { id },
    });
    const row = await this.prisma.affiliate.update({
      where: { id },
      data: { status: AffiliateStatus.SUSPENDED, suspendedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: {
        entityType: 'Affiliate',
        entityId: id,
        action: 'ADMIN_AFFILIATE_SUSPENDED',
        actorUserId: u.id,
        actorRole: u.role,
        previousData: { status: old.status },
        newData: { status: row.status },
        metadata: { reason: b.reason },
      },
    });
    return row;
  }
  @Post('affiliate-conversions/:id/cancel')
  @AdminPermissions(AdminPermission.FINANCE_WRITE)
  async cancel(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() b: { reason: string },
  ) {
    const row = await this.prisma.affiliateConversion.update({
      where: { id },
      data: {
        status: AffiliateConversionStatus.CANCELLED,
        cancelledAt: new Date(),
        commission: { update: { status: AffiliateConversionStatus.CANCELLED } },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        entityType: 'AffiliateConversion',
        entityId: id,
        action: 'ADMIN_AFFILIATE_CONVERSION_CANCELLED',
        actorUserId: u.id,
        actorRole: u.role,
        metadata: { reason: b.reason },
      },
    });
    return row;
  }
  @Post('affiliate-payouts/:id/review')
  @AdminPermissions(AdminPermission.PAYOUTS_REVIEW)
  async review(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() b: { status: AffiliatePayoutStatus; reason: string },
  ) {
    if (b.status === AffiliatePayoutStatus.COMPLETED)
      throw new Error('Pagamento real fora do escopo.');
    const row = await this.prisma.affiliatePayoutRequest.update({
      where: { id },
      data: {
        status: b.status,
        reviewedAt: new Date(),
        rejectedAt:
          b.status === AffiliatePayoutStatus.REJECTED ? new Date() : undefined,
        rejectionReason: b.reason,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        entityType: 'AffiliatePayoutRequest',
        entityId: id,
        action: 'ADMIN_AFFILIATE_PAYOUT_REVIEWED',
        actorUserId: u.id,
        actorRole: u.role,
        newData: { status: b.status },
        metadata: { reason: b.reason },
      },
    });
    return row;
  }
}
