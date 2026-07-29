import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  AdminPermission,
  FinancialAccountStatus,
  PayoutStatus,
  UserRole,
} from '@prisma/client';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  CreateAdjustmentDto,
  CreatePayoutDto,
  AdminAccountQueryDto,
  AdminPayoutQueryDto,
  AdminSubscriptionQueryDto,
  RejectPayoutDto,
  ReportQueryDto,
  StatementQueryDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';

@Controller('finance')
@Roles(UserRole.ORGANIZER)
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get('overview') overview(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.overview(user);
  }
  @Get('balance') balance(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.overview(user).then((v) => v.balance);
  }
  @Get('statement') statement(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: StatementQueryDto,
  ) {
    return this.finance.statement(user, q);
  }
  @Get('campaigns') campaigns(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.campaigns(user);
  }
  @Get('campaigns/:campaignId') campaign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId') id: string,
  ) {
    return this.finance.campaign(user, id);
  }
  @Get('fees') fees(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.fees(user);
  }
  @Get('payouts') payouts(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.payouts(user);
  }
  @Get('payouts/:id') payout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.finance.payout(user, id);
  }
  @Post('payouts') request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePayoutDto,
  ) {
    return this.finance.requestPayout(user, dto);
  }
  @Post('payouts/:id/cancel') cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.finance.cancelPayout(user, id);
  }
  @Get('reports') reports(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: ReportQueryDto,
  ) {
    return this.finance.report(user, q);
  }
}

@Controller('admin/finance')
@Roles(UserRole.ADMIN)
@AdminPermissions(AdminPermission.FINANCE_READ)
export class AdminFinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get('overview') overview() {
    return this.finance.adminOverview();
  }
  @Get('revenue') revenue() {
    return this.finance.adminRevenue();
  }
  @Get('organizers') organizers() {
    return this.finance.adminOrganizers();
  }
  @Get('campaigns') campaigns() {
    return this.finance.adminCampaigns();
  }
  @Get('ledger') ledger(@Query() q: StatementQueryDto) {
    return this.finance.adminLedger(q);
  }
  @Get('ledger/:id') ledgerDetail(@Param('id') id: string) {
    return this.finance.adminLedgerDetail(id);
  }
  @Get('accounts') accounts(@Query() q: AdminAccountQueryDto) {
    return this.finance.adminAccounts(q);
  }
  @Get('accounts/:id') account(@Param('id') id: string) {
    return this.finance.adminAccount(id);
  }
  @Post('accounts/:id/block')
  @AdminPermissions(AdminPermission.FINANCE_WRITE)
  blockAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.finance.changeAccountStatus(
      id,
      FinancialAccountStatus.BLOCKED,
      dto.reason,
      user,
    );
  }
  @Post('accounts/:id/unblock')
  @AdminPermissions(AdminPermission.FINANCE_WRITE)
  unblockAccount(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.finance.changeAccountStatus(
      id,
      FinancialAccountStatus.ACTIVE,
      dto.reason,
      user,
    );
  }
  @Get('payouts') payouts(@Query() q: AdminPayoutQueryDto) {
    return this.finance.adminPayouts(q);
  }
  @Get('payouts/:id') payout(@Param('id') id: string) {
    return this.finance.adminPayout(id);
  }
  @Post('payouts/:id/approve')
  @AdminPermissions(AdminPermission.PAYOUTS_REVIEW)
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.finance.transitionPayout(
      id,
      user,
      PayoutStatus.APPROVED,
      dto.reason,
    );
  }
  @Post('payouts/:id/reject')
  @AdminPermissions(AdminPermission.PAYOUTS_REVIEW)
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.finance.transitionPayout(
      id,
      user,
      PayoutStatus.REJECTED,
      dto.reason,
    );
  }
  @Post('payouts/:id/mark-processing')
  @AdminPermissions(AdminPermission.PAYOUTS_REVIEW)
  processing(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.finance.transitionPayout(
      id,
      user,
      PayoutStatus.PROCESSING,
      dto.reason,
    );
  }
  @Post('payouts/:id/mark-completed')
  @AdminPermissions(AdminPermission.PAYOUTS_REVIEW)
  completed(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectPayoutDto,
  ) {
    return this.finance.transitionPayout(
      id,
      user,
      PayoutStatus.COMPLETED,
      dto.reason,
    );
  }
  @Post('adjustments')
  @AdminPermissions(AdminPermission.FINANCE_WRITE)
  adjustment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAdjustmentDto,
  ) {
    return this.finance.adjustment(user, dto);
  }
  @Get('adjustments') adjustments(@Query() q: StatementQueryDto) {
    return this.finance.adjustments(q);
  }
  @Get('adjustments/:id') adjustmentDetail(@Param('id') id: string) {
    return this.finance.adjustmentDetail(id);
  }
  @Get('subscriptions') subscriptions(@Query() q: AdminSubscriptionQueryDto) {
    return this.finance.subscriptions(q);
  }
  @Get('subscriptions/:id') subscription(@Param('id') id: string) {
    return this.finance.subscription(id);
  }
  @Get('reconciliation') reconciliation(@Query() q: StatementQueryDto) {
    return this.finance.reconciliation(q);
  }
  @Get('export/:resource') export(
    @Param('resource') resource: string,
    @Query() q: StatementQueryDto,
  ) {
    return this.finance.exportAdmin(resource, q);
  }
}
