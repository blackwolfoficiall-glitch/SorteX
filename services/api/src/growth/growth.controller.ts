import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  AdTrackDto,
  PromotionDto,
  PromotionListDto,
  PromotionQuoteDto,
  RecommendationFeedbackDto,
  AdvisorChatDto,
  AdvisorSimulationDto,
  AdvisorMessageDto,
  AdvisorAdStrategyDto,
  SortexAdDto,
  SortexAdListDto,
  SortexAdsDashboardQueryDto,
} from './dto/growth.dto';
import { GrowthService } from './growth.service';
import { AiAdvisorService } from './ai-advisor.service';
import { MetaAdsService } from './meta-ads.service';

@Controller('promotions')
@Roles(UserRole.ORGANIZER)
export class PromotionsController {
  constructor(private readonly growthService: GrowthService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.growthService.promotionDashboard(user);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PromotionListDto,
  ) {
    return this.growthService.promotions(user, query);
  }

  @Get(':id/report')
  report(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.growthService.promotionReport(user, id);
  }

  @Get(':id/history')
  history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.growthService.promotionHistory(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: PromotionDto) {
    return this.growthService.createPromotion(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PromotionDto,
  ) {
    return this.growthService.updatePromotion(user, id, dto);
  }

  @Post(':id/activate')
  activate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.growthService.promotionAction(user, id, 'activate');
  }

  @Post(':id/pause')
  pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.growthService.promotionAction(user, id, 'pause');
  }

  @Post(':id/end')
  end(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.growthService.promotionAction(user, id, 'end');
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.growthService.duplicatePromotion(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.growthService.deletePromotion(user, id);
  }
}

@Controller('promotion-quote')
export class PromotionQuoteController {
  constructor(private readonly growthService: GrowthService) {}

  @Public()
  @Post()
  quote(@Body() dto: PromotionQuoteDto) {
    return this.growthService.quote(dto);
  }
}

@Controller('sortex-ads')
@Roles(UserRole.ORGANIZER)
export class SortexAdsController {
  constructor(
    private readonly growthService: GrowthService,
    private readonly metaAds: MetaAdsService,
  ) {}

  @Get('integration/status') integrationStatus(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.metaAds.status(user);
  }
  @Post('integration/assets') selectAssets(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { adAccountId: string; pageId: string },
  ) {
    return this.metaAds.selectAssets(user, body.adAccountId, body.pageId);
  }

  @Get('dashboard')
  dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SortexAdsDashboardQueryDto,
  ) {
    return this.growthService.adsDashboard(user, query);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SortexAdListDto,
  ) {
    return this.growthService.ads(user, query);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: SortexAdDto) {
    return this.growthService.createAd(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SortexAdDto,
  ) {
    return this.growthService.updateAd(user, id, dto);
  }

  @Post(':id/activate')
  async activate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return (
      (await this.metaAds.changeStatus(user, id, 'activate')) ??
      this.growthService.adAction(user, id, 'activate')
    );
  }

  @Post(':id/pause')
  async pause(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return (
      (await this.metaAds.changeStatus(user, id, 'pause')) ??
      this.growthService.adAction(user, id, 'pause')
    );
  }

  @Post(':id/end')
  async end(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return (
      (await this.metaAds.changeStatus(user, id, 'end')) ??
      this.growthService.adAction(user, id, 'end')
    );
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.growthService.duplicateAd(user, id);
  }

  @Post(':id/publish') publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.metaAds.publish(user, id);
  }
  @Post(':id/sync') sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.metaAds.sync(user, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.growthService.deleteAd(user, id);
  }
}

@Controller('track/ads')
export class SortexAdTrackController {
  constructor(private readonly growthService: GrowthService) {}

  @Public()
  @Post(':code')
  track(@Param('code') code: string, @Body() dto: AdTrackDto) {
    return this.growthService.trackAd(code, dto);
  }
}

@Controller('ai-sortex')
@Roles(UserRole.ORGANIZER)
export class AiSortexController {
  constructor(
    private readonly growthService: GrowthService,
    private readonly advisor: AiAdvisorService,
  ) {}

  @Get('advisor') advisorSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.advisor.snapshot(user);
  }
  @Post('advisor/chat') advisorChat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdvisorChatDto,
  ) {
    return this.advisor.chat(user, dto.question);
  }
  @Post('advisor/simulate') advisorSimulation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdvisorSimulationDto,
  ) {
    return this.advisor.simulate(user, dto);
  }
  @Post('advisor/message') advisorMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdvisorMessageDto,
  ) {
    return this.advisor.message(user, dto);
  }
  @Post('advisor/ad-strategy') advisorAdStrategy(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdvisorAdStrategyDto,
  ) {
    return this.advisor.adStrategy(user, dto.campaignId, dto.objective);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.growthService.recommendations(user);
  }

  @Post('generate')
  generate(@CurrentUser() user: AuthenticatedUser) {
    return this.growthService.generateRecommendations(user);
  }

  @Patch(':id/feedback')
  feedback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RecommendationFeedbackDto,
  ) {
    return this.growthService.feedback(user, id, dto);
  }
}
