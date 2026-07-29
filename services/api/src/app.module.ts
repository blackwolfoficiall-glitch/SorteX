import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { OrganizersModule } from './organizers/organizers.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { PurchasesModule } from './purchases/purchases.module';
import { PaymentsModule } from './payments/payments.module';
import { DrawsModule } from './draws/draws.module';
import { FinanceModule } from './finance/finance.module';
import { AdminModule } from './admin/admin.module';
import { BuyerModule } from './buyer/buyer.module';
import { AffiliatesModule } from './affiliates/affiliates.module';
import { CrmModule } from './crm/crm.module';
import { MediaModule } from './media/media.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { OrganizerPlatformModule } from './organizer-platform/organizer-platform.module';
import { GrowthModule } from './growth/growth.module';
import { LegalModule } from './legal/legal.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    OrganizersModule,
    CampaignsModule,
    PurchasesModule,
    PaymentsModule,
    DrawsModule,
    FinanceModule,
    AdminModule,
    BuyerModule,
    AffiliatesModule,
    CrmModule,
    MediaModule,
    InfrastructureModule,
    OrganizerPlatformModule,
    GrowthModule,
    LegalModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
