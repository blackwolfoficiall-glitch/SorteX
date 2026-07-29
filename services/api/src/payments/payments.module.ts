import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MercadoPagoGatewayProvider } from './gateways/mercado-pago.provider';
import { PaymentGatewayService } from './gateways/payment-gateway.service';
import { OrganizerPaymentsController } from './organizer-payments.controller';
import { PaymentFeeService } from './payment-fee.service';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { DrawsModule } from '../draws/draws.module';
import { FinanceModule } from '../finance/finance.module';
import { AffiliatesModule } from '../affiliates/affiliates.module';
import { CrmModule } from '../crm/crm.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [
    PrismaModule,
    DrawsModule,
    FinanceModule,
    AffiliatesModule,
    CrmModule,
    CampaignsModule,
  ],
  controllers: [
    PaymentsController,
    OrganizerPaymentsController,
    PaymentWebhooksController,
  ],
  providers: [
    PaymentsService,
    PaymentFeeService,
    PaymentGatewayService,
    MercadoPagoGatewayProvider,
  ],
  exports: [PaymentsService, PaymentGatewayService, PaymentFeeService],
})
export class PaymentsModule {}
