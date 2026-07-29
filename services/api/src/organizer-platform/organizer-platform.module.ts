import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizersModule } from '../organizers/organizers.module';
import {
  MiniCampaignsController,
  PublicMiniCampaignsController,
} from './mini-campaigns.controller';
import { OrdersController } from './orders.controller';
import { OrganizerPlatformService } from './organizer-platform.service';
import {
  PersonalizationController,
  PublicOrganizerBrandController,
} from './personalization.controller';
import { PlansController } from './plans.controller';
import {
  IntegrationsController,
  MetaIntegrationCallbackController,
} from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [PrismaModule, OrganizersModule],
  controllers: [
    DashboardController,
    PlansController,
    PersonalizationController,
    PublicOrganizerBrandController,
    OrdersController,
    MiniCampaignsController,
    PublicMiniCampaignsController,
    IntegrationsController,
    MetaIntegrationCallbackController,
  ],
  providers: [OrganizerPlatformService, IntegrationsService],
})
export class OrganizerPlatformModule {}
