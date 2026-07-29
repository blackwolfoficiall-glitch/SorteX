import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  AffiliateConversionStatus,
  AffiliateProgramStatus,
  AffiliateStatus,
  UserRole,
} from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AffiliatesService } from './affiliates.service';
import {
  AffiliatePayoutDto,
  CreateAffiliateLinkDto,
  CreateAffiliateProgramDto,
  InviteAffiliateDto,
  TrackAffiliateClickDto,
} from './dto/affiliate.dto';

@Controller()
export class AffiliatesController {
  constructor(private readonly service: AffiliatesService) {}
  @Post('affiliate-programs') @Roles(UserRole.ORGANIZER) create(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateAffiliateProgramDto,
  ) {
    return this.service.createProgram(u, d);
  }
  @Get('affiliate-programs/my') @Roles(UserRole.ORGANIZER) programs(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.programs(u);
  }
  @Patch('affiliate-programs/:id') @Roles(UserRole.ORGANIZER) update(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: CreateAffiliateProgramDto,
  ) {
    return this.service.updateProgram(u, id, d);
  }
  @Post('affiliate-programs/:id/activate') @Roles(UserRole.ORGANIZER) activate(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.setProgramStatus(u, id, AffiliateProgramStatus.ACTIVE);
  }
  @Post('affiliate-programs/:id/pause') @Roles(UserRole.ORGANIZER) pause(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.setProgramStatus(u, id, AffiliateProgramStatus.PAUSED);
  }
  @Get('affiliate-programs/:id/ranking') @Roles(UserRole.ORGANIZER) ranking(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.ranking(u, id);
  }
  @Get('affiliates/organizer/dashboard')
  @Roles(UserRole.ORGANIZER)
  organizerDashboard(@CurrentUser() u: AuthenticatedUser) {
    return this.service.organizerDashboard(u);
  }
  @Get('affiliates/organizer/conversions')
  @Roles(UserRole.ORGANIZER)
  organizerConversions(@CurrentUser() u: AuthenticatedUser) {
    return this.service.organizerConversions(u);
  }
  @Get('affiliates/organizer/commissions')
  @Roles(UserRole.ORGANIZER)
  organizerCommissions(@CurrentUser() u: AuthenticatedUser) {
    return this.service.organizerCommissions(u);
  }
  @Post('affiliates/organizer/commissions/:id/release')
  @Roles(UserRole.ORGANIZER)
  releaseCommission(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.setCommissionStatus(
      u,
      id,
      AffiliateConversionStatus.AVAILABLE,
    );
  }
  @Post('affiliates/organizer/commissions/:id/pay')
  @Roles(UserRole.ORGANIZER)
  payCommission(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.service.setCommissionStatus(
      u,
      id,
      AffiliateConversionStatus.PAID,
    );
  }
  @Post('affiliates/invite') @Roles(UserRole.ORGANIZER) invite(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: InviteAffiliateDto,
  ) {
    return this.service.invite(u, d);
  }
  @Get('affiliates/my') @Roles(UserRole.ORGANIZER) list(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.affiliates(u);
  }
  @Post('affiliates/:id/approve') @Roles(UserRole.ORGANIZER) approve(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.setAffiliateStatus(u, id, AffiliateStatus.ACTIVE);
  }
  @Post('affiliates/:id/suspend') @Roles(UserRole.ORGANIZER) suspend(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.setAffiliateStatus(u, id, AffiliateStatus.SUSPENDED);
  }
  @Post('affiliates/:id/cancel') @Roles(UserRole.ORGANIZER) cancel(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.setAffiliateStatus(u, id, AffiliateStatus.INACTIVE);
  }
  @Post('affiliates/:id/resend') @Roles(UserRole.ORGANIZER) resend(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.resendInvite(u, id);
  }
  @Post('affiliates/invite/:code/accept')
  @Roles(UserRole.BUYER, UserRole.ORGANIZER)
  accept(@CurrentUser() u: AuthenticatedUser, @Param('code') code: string) {
    return this.service.acceptInvite(u, code);
  }
  @Post('affiliate-links') @Roles(UserRole.BUYER, UserRole.ORGANIZER) link(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateAffiliateLinkDto,
  ) {
    return this.service.createLink(u, d);
  }
  @Post('affiliate-links/track') @Public() track(
    @Body() d: TrackAffiliateClickDto,
    @Req() req: Request,
    @Headers('user-agent') ua?: string,
  ) {
    return this.service.track(d, req.ip, ua);
  }
  @Get('affiliate/dashboard')
  @Roles(UserRole.BUYER, UserRole.ORGANIZER)
  dashboard(@CurrentUser() u: AuthenticatedUser) {
    return this.service.dashboard(u);
  }
  @Get('affiliate/links') @Roles(UserRole.BUYER, UserRole.ORGANIZER) links(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.links(u);
  }
  @Get('affiliate/conversions')
  @Roles(UserRole.BUYER, UserRole.ORGANIZER)
  conversions(@CurrentUser() u: AuthenticatedUser) {
    return this.service.conversions(u);
  }
  @Get('affiliate/commissions')
  @Roles(UserRole.BUYER, UserRole.ORGANIZER)
  commissions(@CurrentUser() u: AuthenticatedUser) {
    return this.service.commissions(u);
  }
  @Post('affiliate/payouts') @Roles(UserRole.BUYER, UserRole.ORGANIZER) payout(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: AffiliatePayoutDto,
  ) {
    return this.service.payout(u, d);
  }
  @Get('affiliate-materials')
  @Roles(UserRole.BUYER, UserRole.ORGANIZER)
  materials(@CurrentUser() u: AuthenticatedUser) {
    return this.service.materials(u);
  }
  @Post('affiliate-materials') @Roles(UserRole.ORGANIZER) createMaterial(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: any,
  ) {
    return this.service.createMaterial(u, d);
  }
  @Get('affiliate-coupons') @Roles(UserRole.ORGANIZER) coupons(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.service.coupons(u);
  }
  @Post('affiliate-coupons') @Roles(UserRole.ORGANIZER) createCoupon(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: any,
  ) {
    return this.service.createCoupon(u, d);
  }
  @Get('referrals/my-code')
  @Roles(UserRole.BUYER, UserRole.ORGANIZER)
  referralCode(@CurrentUser() u: AuthenticatedUser) {
    return this.service.referralCode(u);
  }
  @Post('referrals/apply/:code')
  @Roles(UserRole.BUYER, UserRole.ORGANIZER)
  applyReferral(
    @CurrentUser() u: AuthenticatedUser,
    @Param('code') code: string,
  ) {
    return this.service.applyReferral(u, code);
  }
}
