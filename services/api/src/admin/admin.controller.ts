import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminPermission, ReportStatus, UserRole } from '@prisma/client';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AdminService } from './admin.service';
import { PlatformSettingsService } from './platform-settings.service';
import {
  AdminListDto,
  AdminGatewayDto,
  AdminTeamDto,
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
  UpsertSettingDto,
  UserActionDto,
  UserListDto,
  WinnerActionDto,
  WinnerListDto,
} from './dto/admin.dto';

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly settings: PlatformSettingsService,
  ) {}
  @Get('dashboard') dashboard(@Query() q: AdminListDto) {
    return this.admin.dashboard(q);
  }
  @Get('approvals')
  @AdminPermissions(AdminPermission.ORGANIZERS_REVIEW)
  approvals(@Query() q: ApprovalListDto) {
    return this.admin.approvals(q);
  }
  @Get('organizers')
  @AdminPermissions(AdminPermission.ORGANIZERS_REVIEW)
  organizers(@Query() q: ApprovalListDto) {
    return this.admin.organizers(q);
  }
  @Get('organizers/:id/backoffice')
  @AdminPermissions(AdminPermission.ORGANIZERS_REVIEW)
  organizerBackoffice(@Param('id') id: string) {
    return this.admin.organizerBackoffice(id);
  }
  @Post('organizers/:id/decision')
  @AdminPermissions(AdminPermission.ORGANIZERS_REVIEW)
  organizerDecision(
    @Param('id') id: string,
    @Body() dto: OrganizerDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.organizerDecision(id, dto, user);
  }
  @Post('organizers/:id/risk-analysis')
  @AdminPermissions(AdminPermission.ORGANIZERS_REVIEW)
  organizerRisk(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.analyzeOrganizerRisk(id, user);
  }
  @Patch('organizers/:id/checklist')
  @AdminPermissions(AdminPermission.ORGANIZERS_REVIEW)
  organizerChecklist(
    @Param('id') id: string,
    @Body() dto: OrganizerChecklistDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.updateOrganizerChecklist(id, dto, user);
  }
  @Post('organizer-documents/:id/decision')
  @AdminPermissions(AdminPermission.ORGANIZERS_REVIEW)
  documentDecision(
    @Param('id') id: string,
    @Body() dto: DocumentDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.documentDecision(id, dto, user);
  }
  @Post('organizers/:id/internal-notes')
  @AdminPermissions(AdminPermission.ORGANIZERS_REVIEW)
  internalNote(
    @Param('id') id: string,
    @Body() dto: InternalNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.internalNote(id, dto, user);
  }
  @Post('organizers/:id/fee')
  @AdminPermissions(AdminPermission.FINANCE_WRITE)
  organizerFee(
    @Param('id') id: string,
    @Body() dto: OrganizerFeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.organizerFee(id, dto, user);
  }
  @Get('gateways')
  @AdminPermissions(AdminPermission.FINANCE_READ)
  gateways() {
    return this.admin.gateways();
  }
  @Post('gateways')
  @AdminPermissions(AdminPermission.SETTINGS_WRITE)
  gateway(
    @Body() dto: AdminGatewayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.gateway(dto, user);
  }
  @Get('team')
  @AdminPermissions(AdminPermission.USERS_READ)
  team() {
    return this.admin.team();
  }
  @Post('team/invite')
  @AdminPermissions(AdminPermission.USERS_WRITE)
  inviteTeam(
    @Body() dto: AdminTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.inviteTeam(dto, user);
  }
  @Post('team/:id/action')
  @AdminPermissions(AdminPermission.USERS_WRITE)
  teamAction(
    @Param('id') id: string,
    @Body() dto: AdminMemberActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.memberAction(id, dto, user);
  }
  @Post('team/invitations/:id/cancel')
  @AdminPermissions(AdminPermission.USERS_WRITE)
  cancelTeamInvitation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.cancelInvitation(id, user);
  }
  @Post('team/invitations/:id/regenerate')
  @AdminPermissions(AdminPermission.USERS_WRITE)
  regenerateTeamInvitation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.regenerateInvitation(id, user);
  }
  @Get('search')
  @AdminPermissions(AdminPermission.USERS_READ)
  search(@Query('q') q = '') {
    return this.admin.searchGlobal(q);
  }
  @Get('users') @AdminPermissions(AdminPermission.USERS_READ) users(
    @Query() q: UserListDto,
  ) {
    return this.admin.users(q);
  }
  @Get('users/:id') @AdminPermissions(AdminPermission.USERS_READ) user(
    @Param('id') id: string,
  ) {
    return this.admin.user(id);
  }
  @Post('users/:id/action')
  @AdminPermissions(AdminPermission.USERS_WRITE)
  userAction(
    @Param('id') id: string,
    @Body() dto: UserActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.userAction(id, dto, user);
  }
  @Patch('users/:id/permissions')
  @AdminPermissions(AdminPermission.USERS_WRITE)
  permissions(
    @Param('id') id: string,
    @Body() dto: UpdateAdminPermissionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.permissions(id, dto, user);
  }
  @Get('campaigns')
  @AdminPermissions(AdminPermission.CAMPAIGNS_REVIEW)
  campaigns(@Query() q: CampaignListDto) {
    return this.admin.campaigns(q);
  }
  @Get('campaigns/:id')
  @AdminPermissions(AdminPermission.CAMPAIGNS_REVIEW)
  campaign(@Param('id') id: string) {
    return this.admin.campaign(id);
  }
  @Post('campaigns/:id/action')
  @AdminPermissions(AdminPermission.CAMPAIGNS_REVIEW)
  campaignAction(
    @Param('id') id: string,
    @Body() dto: CampaignActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.campaignAction(id, dto, user);
  }
  @Get('reports')
  @AdminPermissions(AdminPermission.SUPPORT_WRITE)
  reports(@Query() q: AdminListDto, @Query('status') status?: ReportStatus) {
    return this.admin.reports(q, status);
  }
  @Get('reports/:id')
  @AdminPermissions(AdminPermission.SUPPORT_WRITE)
  report(@Param('id') id: string) {
    return this.admin.report(id);
  }
  @Post('reports/:id/resolve')
  @AdminPermissions(AdminPermission.SUPPORT_WRITE)
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.resolveReport(id, dto, user);
  }
  @Get('payments')
  @AdminPermissions(AdminPermission.FINANCE_READ)
  payments(@Query() q: PaymentListDto) {
    return this.admin.payments(q);
  }
  @Get('payments/:id')
  @AdminPermissions(AdminPermission.FINANCE_READ)
  payment(@Param('id') id: string) {
    return this.admin.payment(id);
  }
  @Post('payments/:id/review')
  @AdminPermissions(AdminPermission.FINANCE_WRITE)
  paymentNote(
    @Param('id') id: string,
    @Body() dto: AdminNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.paymentNote(id, dto, user);
  }
  @Get('winners')
  @AdminPermissions(AdminPermission.DRAWS_REVIEW)
  winners(@Query() q: WinnerListDto) {
    return this.admin.winners(q);
  }
  @Get('winners/:id')
  @AdminPermissions(AdminPermission.DRAWS_REVIEW)
  winner(@Param('id') id: string) {
    return this.admin.winner(id);
  }
  @Post('winners/:id/action')
  @AdminPermissions(AdminPermission.DRAWS_REVIEW)
  winnerAction(
    @Param('id') id: string,
    @Body() dto: WinnerActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.winnerAction(id, dto, user);
  }
  @Get('content') @AdminPermissions(AdminPermission.CONTENT_WRITE) content() {
    return this.admin.content();
  }
  @Post('content/banners')
  @AdminPermissions(AdminPermission.CONTENT_WRITE)
  banner(@Body() dto: CreateBannerDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.banner(dto, user);
  }
  @Patch('content/banners/:id')
  @AdminPermissions(AdminPermission.CONTENT_WRITE)
  updateBanner(
    @Param('id') id: string,
    @Body() dto: CreateBannerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.updateBanner(id, dto, user);
  }
  @Post('content/notices')
  @AdminPermissions(AdminPermission.CONTENT_WRITE)
  notice(@Body() dto: CreateNoticeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.notice(dto, user);
  }
  @Patch('content/notices/:id')
  @AdminPermissions(AdminPermission.CONTENT_WRITE)
  updateNotice(
    @Param('id') id: string,
    @Body() dto: CreateNoticeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.updateNotice(id, dto, user);
  }
  @Post('content/pages') @AdminPermissions(AdminPermission.CONTENT_WRITE) page(
    @Body() dto: UpsertContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.contentPage(dto, user);
  }
  @Get('settings')
  @AdminPermissions(AdminPermission.SETTINGS_WRITE)
  settingList(@Query('category') category?: string) {
    return this.settings.list(category);
  }
  @Post('settings/:key')
  @AdminPermissions(AdminPermission.SETTINGS_WRITE)
  setting(
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { reason, ...input } = dto;
    return this.settings.set(key, input, user, reason);
  }
  @Get('audit-logs') @AdminPermissions(AdminPermission.AUDIT_READ) audit(
    @Query() q: AdminListDto,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('role') role?: UserRole,
  ) {
    return this.admin.auditLogs(q, { action, entityType, actorUserId, role });
  }
  @Get('health')
  @AdminPermissions(AdminPermission.AUDIT_READ)
  health() {
    return this.admin.health();
  }
  @Get('support') @AdminPermissions(AdminPermission.SUPPORT_WRITE) support(
    @Query() q: SupportListDto,
  ) {
    return this.admin.support(q);
  }
  @Get('support/:id')
  @AdminPermissions(AdminPermission.SUPPORT_WRITE)
  supportTicket(@Param('id') id: string) {
    return this.admin.supportTicket(id);
  }
  @Post('support/:id/action')
  @AdminPermissions(AdminPermission.SUPPORT_WRITE)
  supportAction(
    @Param('id') id: string,
    @Body() dto: SupportActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.supportAction(id, dto, user);
  }
  @Post('support/:id/messages')
  @AdminPermissions(AdminPermission.SUPPORT_WRITE)
  supportMessage(
    @Param('id') id: string,
    @Body() dto: SupportMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.supportMessage(id, dto, user);
  }
  @Get('plans')
  @AdminPermissions(AdminPermission.SETTINGS_WRITE)
  plans() {
    return this.admin.plans();
  }
  @Post('plans') @AdminPermissions(AdminPermission.SETTINGS_WRITE) plan(
    @Body() dto: PlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admin.plan(dto, user);
  }
}
