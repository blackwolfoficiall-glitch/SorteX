import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminPermission, LotteryDrawStatus, UserRole } from '@prisma/client';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { DrawsService } from './draws.service';
import {
  ConfirmDrawDto,
  ConfirmReceiptDto,
  CreateInstantPrizeDto,
  CreateLotteryDrawDto,
  ExecuteDrawDto,
  ManualWinnerLookupDto,
  RejectDrawDto,
  SimulateRuleDto,
  UpdateWinnerDto,
  UpdateInstantPrizeDto,
  PrizeTicketQueryDto,
} from './dto/draw.dto';
import { InstantPrizeDetectionService } from './instant-prize-detection.service';
import { RouletteService } from './roulette.service';

@Controller()
export class DrawsController {
  constructor(
    private readonly draws: DrawsService,
    private readonly instant: InstantPrizeDetectionService,
    private readonly roulette: RouletteService,
  ) {}
  @Post('draw-rules/simulate')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  simulateRule(@Body() dto: SimulateRuleDto) {
    return this.draws.simulateRule(dto);
  }
  @Post('campaigns/:id/draw/simulate')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  simulateCampaign(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ExecuteDrawDto,
  ) {
    return this.draws.simulateCampaign(id, user, dto.lotteryDrawId);
  }
  @Post('campaigns/:id/draw/execute')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  execute(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ExecuteDrawDto,
  ) {
    return this.draws.executeCampaign(id, user, dto);
  }
  @Post('campaigns/:id/draw/confirm')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  confirm(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmDrawDto,
  ) {
    return this.draws.confirmCampaign(id, user, dto.notes);
  }
  @Get('campaigns/:id/draw') @Roles(UserRole.ORGANIZER, UserRole.ADMIN) get(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.draws.getCampaignDraw(id, user);
  }
  @Get('campaigns/:id/draw/audit')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  audit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.draws.getAudit(id, user);
  }
  @Post('campaigns/:id/winner-lookup/automatic')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  automaticWinnerLookup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.draws.lookupAutomaticWinner(id, user);
  }
  @Post('campaigns/:id/winner-lookup/manual')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  manualWinnerLookup(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ManualWinnerLookupDto,
  ) {
    return this.draws.lookupManualWinner(id, user, dto.winningNumber);
  }
  @Get('campaigns/:id/winner-lookup/history')
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  winnerLookupHistory(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.draws.winnerLookupHistory(id, user);
  }
  @Get('campaigns/:id/instant-prizes/results')
  @Roles(UserRole.ORGANIZER)
  instantResults(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.instant.organizerResults(id, user.id);
  }
  @Get('organizer/prize-tickets')
  @Roles(UserRole.ORGANIZER)
  organizerPrizeTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PrizeTicketQueryDto,
  ) {
    return this.instant.organizerPrizeTickets(user.id, query);
  }
  @Get('organizer/prize-tickets/summary')
  @Roles(UserRole.ORGANIZER)
  organizerPrizeTicketSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.instant.organizerPrizeTicketSummary(user.id, campaignId);
  }
  @Post('organizer/prize-tickets')
  @Roles(UserRole.ORGANIZER)
  createPrizeTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInstantPrizeDto,
  ) {
    return this.instant.createPrizeTickets(user, dto);
  }
  @Patch('organizer/prize-tickets/:id')
  @Roles(UserRole.ORGANIZER)
  updatePrizeTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInstantPrizeDto,
  ) {
    return this.instant.updatePrizeTicket(user, id, dto);
  }
  @Post('organizer/prize-tickets/:id/:action')
  @Roles(UserRole.ORGANIZER)
  prizeTicketAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('action') action: string,
  ) {
    return this.instant.prizeTicketAction(user, id, action);
  }
  @Get('organizer/prize-tickets/:id/history')
  @Roles(UserRole.ORGANIZER)
  prizeTicketHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.instant.prizeTicketHistory(user, id);
  }
  @Get('winners/organizer') @Roles(UserRole.ORGANIZER) organizerWinners(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.draws.listOrganizerWinners(user);
  }
  @Patch('winners/:id/status') @Roles(UserRole.ORGANIZER) updateWinner(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateWinnerDto,
  ) {
    return this.draws.updateWinner(id, user, dto);
  }
  @Get('winners/my') @Roles(UserRole.BUYER) myWinners(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.draws.listMyWinners(user);
  }
  @Post('winners/:id/confirm-receipt') @Roles(UserRole.BUYER) confirmReceipt(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmReceiptDto,
  ) {
    return this.draws.confirmReceipt(id, user, dto);
  }
  @Get('winners/my-instant-prizes') @Roles(UserRole.BUYER) myInstant(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.instant.myResults(user.id);
  }
  @Get('public/campaigns/:slug/instant-prizes') @Public() publicInstant(
    @Param('slug') slug: string,
  ) {
    return this.instant.publicResults(slug);
  }
  @Get('roulette/campaigns/:id/status') @Roles(UserRole.BUYER) rouletteStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roulette.buyerStatus(id, user.id);
  }
  @Post('roulette/campaigns/:id/spin') @Roles(UserRole.BUYER) spinRoulette(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roulette.spin(id, user.id);
  }
  @Get('roulette/organizer/campaigns/:id')
  @Roles(UserRole.ORGANIZER)
  organizerRoulette(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.roulette.organizerStatus(id, user.id);
  }
  @Get('public/winners/verify/:code') @Public() verify(
    @Param('code') code: string,
  ) {
    return this.draws.publicVerification(code);
  }
}

@Controller('admin/lottery-draws')
@Roles(UserRole.ADMIN)
@AdminPermissions(AdminPermission.LOTTERY_RESULTS_WRITE)
export class AdminLotteryDrawsController {
  constructor(private readonly draws: DrawsService) {}
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLotteryDrawDto,
  ) {
    return this.draws.createLotteryDraw(user, dto);
  }
  @Get() list() {
    return this.draws.listLotteryDraws();
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.draws.getLotteryDraw(id);
  }
  @Patch(':id') update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Partial<CreateLotteryDrawDto>,
  ) {
    return this.draws.updateLotteryDraw(id, user, dto);
  }
  @Post(':id/verify') verify(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectDrawDto,
  ) {
    return this.draws.reviewLotteryDraw(
      id,
      user,
      LotteryDrawStatus.VERIFIED,
      dto.reason,
    );
  }
  @Post(':id/reject') reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectDrawDto,
  ) {
    return this.draws.reviewLotteryDraw(
      id,
      user,
      LotteryDrawStatus.REJECTED,
      dto.reason,
    );
  }
  @Post(':id/lock') lock(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectDrawDto,
  ) {
    return this.draws.reviewLotteryDraw(
      id,
      user,
      LotteryDrawStatus.LOCKED,
      dto.reason,
    );
  }
}

@Controller('admin/campaign-draws')
@Roles(UserRole.ADMIN)
@AdminPermissions(AdminPermission.DRAWS_REVIEW)
export class AdminCampaignDrawsController {
  constructor(private readonly draws: DrawsService) {}
  @Get() list() {
    return this.draws.listCampaignDraws();
  }
  @Get(':id') async get(@Param('id') id: string) {
    const all = await this.draws.listCampaignDraws();
    return all.find((item) => item.id === id);
  }
  @Post(':id/invalidate') invalidate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RejectDrawDto,
  ) {
    return this.draws.invalidateDraw(id, user, dto.reason);
  }
}
