import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BalanceAvailabilityService } from './balance-availability.service';
import { CommercialTermsService } from './commercial-terms.service';
import {
  AdminFinanceController,
  FinanceController,
} from './finance.controller';
import { FinanceService } from './finance.service';
import { FinancialLedgerService } from './financial-ledger.service';

@Module({
  imports: [PrismaModule],
  controllers: [FinanceController, AdminFinanceController],
  providers: [
    CommercialTermsService,
    FinancialLedgerService,
    BalanceAvailabilityService,
    FinanceService,
  ],
  exports: [
    FinanceService,
    CommercialTermsService,
    FinancialLedgerService,
    BalanceAvailabilityService,
  ],
})
export class FinanceModule {}
