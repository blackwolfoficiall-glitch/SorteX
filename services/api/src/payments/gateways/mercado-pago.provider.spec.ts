import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { MercadoPagoGatewayProvider } from './mercado-pago.provider';

describe('MercadoPagoGatewayProvider', () => {
  const provider = new MercadoPagoGatewayProvider();
  const secret = 'sandbox-webhook-secret';

  beforeEach(() => {
    process.env.MERCADO_PAGO_WEBHOOK_SECRET = secret;
  });

  it('valida assinatura oficial HMAC do webhook', () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const dataId = 'ORDERTST-123';
    const requestId = 'request-123';
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const hash = createHmac('sha256', secret).update(manifest).digest('hex');
    expect(() =>
      provider.validateWebhook({
        xSignature: `ts=${ts},v1=${hash}`,
        xRequestId: requestId,
        dataId,
        body: {},
      }),
    ).not.toThrow();
  });

  it('mantém compatibilidade com timestamp em milissegundos', () => {
    const ts = String(Date.now());
    const dataId = 'ORDERTST-123';
    const requestId = 'request-123';
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const hash = createHmac('sha256', secret).update(manifest).digest('hex');
    expect(() =>
      provider.validateWebhook({
        xSignature: `ts=${ts},v1=${hash}`,
        xRequestId: requestId,
        dataId,
        body: {},
      }),
    ).not.toThrow();
  });

  it('rejeita assinatura válida fora da janela contra replay', () => {
    const ts = String(Math.floor(Date.now() / 1000) - 301);
    const dataId = 'ORDERTST-123';
    const requestId = 'request-123';
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const hash = createHmac('sha256', secret).update(manifest).digest('hex');
    expect(() =>
      provider.validateWebhook({
        xSignature: `ts=${ts},v1=${hash}`,
        xRequestId: requestId,
        dataId,
        body: {},
      }),
    ).toThrow(UnauthorizedException);
  });

  it('rejeita assinatura adulterada', () => {
    expect(() =>
      provider.validateWebhook({
        xSignature: 'ts=1,v1=invalid',
        xRequestId: 'request-1',
        dataId: 'order-1',
        body: {},
      }),
    ).toThrow(UnauthorizedException);
  });

  it('falha claramente quando o segredo não está configurado', () => {
    delete process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    expect(() => provider.validateWebhook({ body: {} })).toThrow(
      ServiceUnavailableException,
    );
  });

  it('normaliza o evento sem expor ou inventar credenciais', () => {
    expect(
      provider.parseWebhookEvent({
        xRequestId: 'request-1',
        dataId: 'order-1',
        body: { action: 'order.updated', data: { id: 'order-1' } },
      }),
    ).toEqual({
      providerEventId: 'request-1',
      eventType: 'order.updated',
      resourceId: 'order-1',
      payload: { action: 'order.updated', data: { id: 'order-1' } },
    });
  });

  it.each([
    ['processed', 'accredited', 'APPROVED'],
    ['action_required', 'waiting_transfer', 'PENDING'],
    ['processing', 'in_process', 'PROCESSING'],
    ['expired', 'expired', 'EXPIRED'],
    ['failed', 'failed', 'REJECTED'],
    ['canceled', 'canceled', 'CANCELLED'],
    ['refunded', 'refunded', 'REFUNDED'],
  ])('normaliza %s/%s como %s', (status, detail, expected) => {
    expect(provider.normalizeStatus(status, detail)).toBe(expected);
  });
});
