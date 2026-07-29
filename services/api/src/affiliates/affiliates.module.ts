import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AffiliatesController } from './affiliates.controller';
import { AffiliateAdminController } from './affiliate-admin.controller';
import { AffiliatesService } from './affiliates.service';
import { AffiliateCommissionService } from './affiliate-commission.service';
@Module({
  imports: [PrismaModule],
  controllers: [AffiliatesController, AffiliateAdminController],
  providers: [AffiliatesService, AffiliateCommissionService],
  exports: [AffiliateCommissionService],
})
export class AffiliatesModule {}
