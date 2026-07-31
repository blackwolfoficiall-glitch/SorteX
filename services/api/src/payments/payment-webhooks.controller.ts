import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@Controller('webhooks/payments')
@Public()
export class PaymentWebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('mercado-pago')
  @HttpCode(HttpStatus.OK)
  mercadoPago(
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Query('data.id') dataId: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.payments.handleMercadoPagoWebhook({
      xSignature,
      xRequestId,
      dataId,
      body,
    });
  }
}
