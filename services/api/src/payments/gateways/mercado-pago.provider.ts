import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { GatewayProvider, PaymentMethod, PaymentStatus } from '@prisma/client';
import {
  MercadoPagoConfig,
  Order,
  WebhookSignatureValidator,
} from 'mercadopago';
import type {
  CreateCardGatewayPaymentInput,
  CreateGatewayPaymentInput,
  GatewayPaymentResult,
  GatewayWebhookContext,
  GatewayWebhookEvent,
  PaymentGatewayProvider,
} from './payment-gateway.provider';

@Injectable()
export class MercadoPagoGatewayProvider implements PaymentGatewayProvider {
  readonly provider = GatewayProvider.MERCADO_PAGO;

  async createPixPayment(input: CreateGatewayPaymentInput) {
    const order = await this.order().create({
      body: {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: input.amount,
        external_reference: input.externalReference,
        description: input.description,
        currency: 'BRL',
        payer: this.payer(input),
        transactions: {
          payments: [
            {
              amount: input.amount,
              date_of_expiration: input.expiresAt.toISOString(),
              payment_method: { id: 'pix', type: 'bank_transfer' },
            },
          ],
        },
      },
      requestOptions: { idempotencyKey: input.idempotencyKey },
    });
    return this.normalize(order, PaymentMethod.PIX);
  }

  async createCardPayment(input: CreateCardGatewayPaymentInput) {
    const order = await this.order().create({
      body: {
        type: 'online',
        processing_mode: 'automatic',
        total_amount: input.amount,
        external_reference: input.externalReference,
        description: input.description,
        currency: 'BRL',
        payer: this.payer(input),
        transactions: {
          payments: [
            {
              amount: input.amount,
              payment_method: {
                id: input.paymentMethodId,
                type: 'credit_card',
                token: input.cardToken,
                installments: input.installments,
              },
            },
          ],
        },
      },
      requestOptions: { idempotencyKey: input.idempotencyKey },
    });
    return this.normalize(order, PaymentMethod.CREDIT_CARD);
  }

  async getPaymentStatus(providerPaymentId: string) {
    return this.normalize(await this.order().get({ id: providerPaymentId }));
  }

  async cancelPayment(providerPaymentId: string) {
    return this.normalize(
      await this.order().cancel({
        id: providerPaymentId,
        requestOptions: { idempotencyKey: `cancel-${providerPaymentId}` },
      }),
    );
  }

  async refundPayment(providerPaymentId: string) {
    return this.normalize(
      await this.order().refund({
        id: providerPaymentId,
        requestOptions: { idempotencyKey: `refund-${providerPaymentId}` },
      }),
    );
  }

  validateWebhook(context: GatewayWebhookContext) {
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException(
        'MERCADO_PAGO_WEBHOOK_SECRET não configurado.',
      );
    }
    try {
      WebhookSignatureValidator.validate({
        xSignature: context.xSignature,
        xRequestId: context.xRequestId,
        dataId: context.dataId,
        secret,
        toleranceSeconds: 300,
      });
    } catch {
      throw new UnauthorizedException('Assinatura de webhook inválida.');
    }
  }

  parseWebhookEvent(context: GatewayWebhookContext): GatewayWebhookEvent {
    const data = context.body.data;
    const bodyData =
      data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const resourceId = this.scalar(context.dataId || bodyData.id);
    if (!resourceId) throw new UnauthorizedException('Evento sem recurso.');
    const eventType = this.scalar(
      context.body.action || context.body.type,
      'payment.updated',
    );
    const eventId = this.scalar(
      context.body.id || context.xRequestId,
      `${eventType}:${resourceId}`,
    );
    return {
      providerEventId: eventId,
      eventType,
      resourceId,
      payload: context.body,
    };
  }

  private order() {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
    if (!accessToken) {
      throw new ServiceUnavailableException(
        'MERCADO_PAGO_ACCESS_TOKEN não configurado.',
      );
    }
    if ((process.env.PAYMENT_ENV || 'sandbox') !== 'sandbox') {
      throw new ServiceUnavailableException(
        'Pagamentos fora do sandbox estão bloqueados nesta versão.',
      );
    }
    return new Order(
      new MercadoPagoConfig({
        accessToken,
        options: { timeout: 10000 },
      }),
    );
  }

  private payer(input: CreateGatewayPaymentInput) {
    return {
      email: input.payer.email,
      first_name: input.payer.firstName,
      last_name: input.payer.lastName,
      identification:
        input.payer.identificationType && input.payer.identificationNumber
          ? {
              type: input.payer.identificationType,
              number: input.payer.identificationNumber,
            }
          : undefined,
    };
  }

  private normalize(
    response: Awaited<ReturnType<Order['get']>>,
    requestedMethod?: PaymentMethod,
  ): GatewayPaymentResult {
    if (!response.id) {
      throw new BadGatewayException('Mercado Pago retornou uma ordem sem ID.');
    }
    const payment = response.transactions?.payments?.[0];
    const method =
      requestedMethod || this.mapMethod(payment?.payment_method?.type);
    return {
      providerPaymentId: response.id,
      externalReference: response.external_reference || '',
      status: this.normalizeStatus(
        payment?.status || response.status,
        payment?.status_detail || response.status_detail,
      ),
      method,
      amount: String(payment?.amount || response.total_amount || '0'),
      expiresAt: payment?.date_of_expiration
        ? new Date(payment.date_of_expiration)
        : undefined,
      pixQrCode: payment?.payment_method?.qr_code,
      pixQrCodeBase64: payment?.payment_method?.qr_code_base64,
      pixCopyPaste: payment?.payment_method?.qr_code,
      boletoUrl: payment?.payment_method?.ticket_url,
      cardBrand:
        method === PaymentMethod.CREDIT_CARD
          ? payment?.payment_method?.id
          : undefined,
      installments: payment?.payment_method?.installments,
      failureReason:
        this.normalizeStatus(payment?.status || response.status) ===
        PaymentStatus.REJECTED
          ? payment?.status_detail || response.status_detail
          : undefined,
      rawStatus: `${payment?.status || response.status || ''}:${payment?.status_detail || response.status_detail || ''}`,
    };
  }

  private mapMethod(type?: string) {
    if (type === 'credit_card') return PaymentMethod.CREDIT_CARD;
    if (type === 'debit_card') return PaymentMethod.DEBIT_CARD;
    return PaymentMethod.PIX;
  }

  normalizeStatus(status?: string, detail?: string) {
    const value = `${status || ''}:${detail || ''}`.toLowerCase();
    if (
      value.includes('accredited') ||
      value.includes('approved') ||
      value.startsWith('processed')
    )
      return PaymentStatus.APPROVED;
    if (value.includes('chargeback')) return PaymentStatus.CHARGEBACK;
    if (value.includes('refund')) return PaymentStatus.REFUNDED;
    if (value.includes('cancel')) return PaymentStatus.CANCELLED;
    if (value.includes('expir')) return PaymentStatus.EXPIRED;
    if (value.includes('reject') || value.includes('failed'))
      return PaymentStatus.REJECTED;
    if (value.includes('processing')) return PaymentStatus.PROCESSING;
    return PaymentStatus.PENDING;
  }

  private scalar(value: unknown, fallback = '') {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : fallback;
  }
}
