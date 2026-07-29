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
  providers: [GrowthService, AiAdvisorService, MetaAdsService],
})
export class GrowthModule {}
