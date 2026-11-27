import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AiSortexController,
  PromotionQuoteController,
  PromotionsController,
  SortexAdsController,
  SortexAdTrackController,
} from './growth.controller';
import { GrowthService } from './growth.service';
import { AiAdvisorService } from './ai-advisor.service';
import { AdvisorModelService } from './advisor-model.service';
import { MetaAdsService } from './meta-ads.service';
@Module({
  imports: [PrismaModule],
  controllers: [
    PromotionsController,
    PromotionQuoteController,
    SortexAdsController,
    SortexAdTrackController,
    AiSortexController,
  ],
  providers: [
    GrowthService,
    AiAdvisorService,
    AdvisorModelService,
    MetaAdsService,
  ],
})
export class GrowthModule {}
