import { Module } from '@nestjs/common';
import { AuditHashService } from './audit-hash.service';
import { DrawRuleEngineService } from './draw-rule-engine.service';
import {
  AdminCampaignDrawsController,
  AdminLotteryDrawsController,
  DrawsController,
} from './draws.controller';
import { DrawsService } from './draws.service';
import { InstantPrizeDetectionService } from './instant-prize-detection.service';
import { RouletteService } from './roulette.service';
import {
  LOTTERY_RESULTS_PROVIDER,
  ManualLotteryResultsProvider,
} from './lottery-results.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    DrawsController,
    AdminLotteryDrawsController,
    AdminCampaignDrawsController,
  ],
  providers: [
    DrawRuleEngineService,
    AuditHashService,
    DrawsService,
    InstantPrizeDetectionService,
    RouletteService,
    {
      provide: LOTTERY_RESULTS_PROVIDER,
      useClass: ManualLotteryResultsProvider,
    },
  ],
  exports: [InstantPrizeDetectionService, DrawRuleEngineService],
})
export class DrawsModule {}
