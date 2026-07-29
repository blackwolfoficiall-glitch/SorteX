import { Module } from '@nestjs/common';
import { InternalPurchasesController } from './internal-purchases.controller';
import { OrganizerPurchasesController } from './organizer-purchases.controller';
import { PublicAvailabilityController } from './public-availability.controller';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { ReservationExpirationService } from './reservation-expiration.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [PrismaModule, CrmModule],
  controllers: [
    PurchasesController,
    PublicAvailabilityController,
    OrganizerPurchasesController,
    InternalPurchasesController,
  ],
  providers: [PurchasesService, ReservationExpirationService],
  exports: [PurchasesService, ReservationExpirationService],
})
export class PurchasesModule {}
