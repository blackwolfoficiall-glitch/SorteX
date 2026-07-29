import { Injectable, NotImplementedException } from '@nestjs/common';
import { GatewayProvider } from '@prisma/client';
import { MercadoPagoGatewayProvider } from './mercado-pago.provider';

@Injectable()
export class PaymentGatewayService {
  constructor(private readonly mercadoPago: MercadoPagoGatewayProvider) {}

  get(provider: GatewayProvider = GatewayProvider.MERCADO_PAGO) {
    if (provider === GatewayProvider.MERCADO_PAGO) return this.mercadoPago;
    throw new NotImplementedException(
      `O provider ${provider} ainda não foi implementado.`,
    );
  }
}
