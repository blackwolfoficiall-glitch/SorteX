import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { GatewayProvider, PaymentMethod, PaymentStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
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
  private readonly logger = new Logger(MercadoPagoGatewayProvider.name);

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
              expiration_time: this.expirationDuration(input.expiresAt),
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
    const secrets = [
      process.env.MERCADO_PAGO_WEBHOOK_SECRET_TEST,
      process.env.MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION,
      process.env.MERCADO_PAGO_WEBHOOK_SECRET,
    ].filter(
      (secret, index, values): secret is string =>
        Boolean(secret) && values.indexOf(secret) === index,
    );
    if (!secrets.length) {
      throw new ServiceUnavailableException(
        'Assinatura do webhook do Mercado Pago não configurada.',
      );
    }
    let validationStage = 'signature';
    try {
      const signatureValid = secrets.some((secret) => {
        try {
          WebhookSignatureValidator.validate({
            xSignature: context.xSignature,
            xRequestId: context.xRequestId,
            dataId: context.dataId?.toLowerCase(),
            secret,
          });
          return true;
        } catch {
          return false;
        }
      });
      if (!signatureValid) throw new Error('WEBHOOK_SIGNATURE_MISMATCH');
      validationStage = 'timestamp';
      this.validateWebhookTimestamp(context.xSignature);
    } catch (error) {
      const reason = this.webhookValidationFailure(
        context,
        validationStage,
        error,
      );
      this.logger.warn({
        event: 'MERCADO_PAGO_WEBHOOK_REJECTED',
        reason,
        hasSignature: Boolean(context.xSignature),
        hasRequestId: Boolean(context.xRequestId),
        hasDataId: Boolean(context.dataId),
        paymentEnvironment: process.env.PAYMENT_ENV || 'sandbox',
        signatureDiagnostics:
          reason === 'SIGNATURE_OR_SECRET_MISMATCH'
            ? this.signatureDiagnostics(context, secrets)
            : undefined,
      });
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
    const sandbox = (process.env.PAYMENT_ENV || 'sandbox') === 'sandbox';
    return {
      email: sandbox ? 'test_user_br@testuser.com' : input.payer.email,
      first_name: sandbox ? 'APRO' : input.payer.firstName,
      last_name: sandbox ? undefined : input.payer.lastName,
      identification:
        !sandbox &&
        input.payer.identificationType &&
        input.payer.identificationNumber
          ? {
              type: input.payer.identificationType,
              number: input.payer.identificationNumber,
            }
          : undefined,
    };
  }

  private validateWebhookTimestamp(xSignature?: string) {
    const timestamp = xSignature
      ?.split(',')
      .map((part) => part.trim().split('=', 2))
      .find(([key]) => key.toLowerCase() === 'ts')?.[1];
    if (!timestamp || !/^\d+$/.test(timestamp)) {
      throw new Error('WEBHOOK_TIMESTAMP_MISSING');
    }
    const numericTimestamp = Number(timestamp);
    const timestampMs =
      numericTimestamp < 1_000_000_000_000
        ? numericTimestamp * 1000
        : numericTimestamp;
    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > 300_000
    ) {
      throw new Error('WEBHOOK_TIMESTAMP_OUT_OF_TOLERANCE');
    }
  }

  private webhookValidationFailure(
    context: GatewayWebhookContext,
    stage: string,
    error: unknown,
  ) {
    if (!context.xSignature) return 'SIGNATURE_HEADER_MISSING';
    if (!context.xRequestId) return 'REQUEST_ID_MISSING';
    if (!context.dataId) return 'DATA_ID_MISSING';
    if (error instanceof Error) {
      if (error.message === 'WEBHOOK_TIMESTAMP_MISSING') {
        return 'TIMESTAMP_MISSING';
      }
      if (error.message === 'WEBHOOK_TIMESTAMP_OUT_OF_TOLERANCE') {
        return 'TIMESTAMP_OUT_OF_TOLERANCE';
      }
    }
    return stage === 'signature'
      ? 'SIGNATURE_OR_SECRET_MISMATCH'
      : 'SIGNATURE_INVALID';
  }

  private signatureDiagnostics(
    context: GatewayWebhookContext,
    secrets: string[],
  ) {
    const signatureParts = Object.fromEntries(
      (context.xSignature || '').split(',').map((part) => {
        const [key, value] = part.trim().split('=', 2);
        return [key?.toLowerCase(), value];
      }),
    );
    const timestamp = signatureParts.ts;
    const received = signatureParts.v1;
    if (
      !timestamp ||
      !received ||
      !/^[a-fA-F0-9]{64}$/.test(received) ||
      !context.dataId ||
      !context.xRequestId
    ) {
      return {
        comparable: false,
        signatureKeys: Object.keys(signatureParts).filter(Boolean).sort(),
        timestampDigits: Boolean(timestamp && /^\d+$/.test(timestamp)),
        signatureLength: received?.length || 0,
        signatureHex: Boolean(received && /^[a-fA-F0-9]+$/.test(received)),
      };
    }
    const candidates = {
      lowerId: `id:${context.dataId.toLowerCase()};request-id:${context.xRequestId};ts:${timestamp};`,
      originalId: `id:${context.dataId};request-id:${context.xRequestId};ts:${timestamp};`,
      lowerIdAndRequest: `id:${context.dataId.toLowerCase()};request-id:${context.xRequestId.toLowerCase()};ts:${timestamp};`,
    };
    const matches = Object.fromEntries(
      Object.entries(candidates).map(([name, manifest]) => [
        name,
        secrets.some((secret) => {
          const expected = createHmac('sha256', secret)
            .update(manifest)
            .digest();
          const actual = Buffer.from(received, 'hex');
          return (
            expected.length === actual.length &&
            timingSafeEqual(expected, actual)
          );
        }),
      ]),
    );
    return { comparable: true, ...matches };
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

  private expirationDuration(expiresAt: Date) {
    const seconds = Math.max(
      1800,
      Math.min(
        30 * 24 * 60 * 60,
        Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
      ),
    );
    return `PT${seconds}S`;
  }
}
