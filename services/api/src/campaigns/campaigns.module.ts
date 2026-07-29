import { Module } from '@nestjs/common';
import { OrganizersModule } from '../organizers/organizers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { DrawRuleTemplatesController } from './draw-rule-templates.controller';
import { PublicCampaignsController } from './public-campaigns.controller';
import { CampaignMilestonesService } from './campaign-milestones.service';
import { DrawsModule } from '../draws/draws.module';

@Module({
  imports: [PrismaModule, OrganizersModule, DrawsModule],
  controllers: [
    CampaignsController,
    PublicCampaignsController,
    DrawRuleTemplatesController,
  ],
  providers: [CampaignsService, CampaignMilestonesService],
  exports: [CampaignMilestonesService],
})
export class CampaignsModule {}
