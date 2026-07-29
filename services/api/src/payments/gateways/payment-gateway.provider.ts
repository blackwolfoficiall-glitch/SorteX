import { GatewayProvider, PaymentMethod, PaymentStatus } from '@prisma/client';

export type GatewayPayer = {
  email: string;
  firstName?: string;
  lastName?: string;
  identificationType?: string;
  identificationNumber?: string;
};

export type CreateGatewayPaymentInput = {
  amount: string;
  externalReference: string;
  description: string;
  payer: GatewayPayer;
  expiresAt: Date;
  idempotencyKey: string;
};

export type CreateCardGatewayPaymentInput = CreateGatewayPaymentInput & {
  cardToken: string;
  paymentMethodId: string;
  installments: number;
};

export type GatewayPaymentResult = {
  providerPaymentId: string;
  externalReference: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: string;
  expiresAt?: Date;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixCopyPaste?: string;
  boletoUrl?: string;
  cardLastFour?: string;
  cardBrand?: string;
  installments?: number;
  failureReason?: string;
  rawStatus?: string;
};

export type GatewayWebhookContext = {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
  body: Record<string, unknown>;
};

export type GatewayWebhookEvent = {
  providerEventId: string;
  eventType: string;
  resourceId: string;
  payload: Record<string, unknown>;
};

export interface PaymentGatewayProvider {
  readonly provider: GatewayProvider;
  createPixPayment(
    input: CreateGatewayPaymentInput,
  ): Promise<GatewayPaymentResult>;
  createCardPayment(
    input: CreateCardGatewayPaymentInput,
  ): Promise<GatewayPaymentResult>;
  getPaymentStatus(providerPaymentId: string): Promise<GatewayPaymentResult>;
  cancelPayment(providerPaymentId: string): Promise<GatewayPaymentResult>;
  refundPayment(providerPaymentId: string): Promise<GatewayPaymentResult>;
  validateWebhook(context: GatewayWebhookContext): void;
  parseWebhookEvent(context: GatewayWebhookContext): GatewayWebhookEvent;
}
