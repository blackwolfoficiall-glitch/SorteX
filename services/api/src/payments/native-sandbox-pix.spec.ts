import { createHash } from 'node:crypto';
import {
  nativeSandboxPixEnabled,
  sandboxPixTicketUrl,
} from './native-sandbox-pix';

describe('Pix nativo exige prova de configuração sandbox', () => {
  const token = 'APP_USR-fixture-not-a-credential';
  const verified = {
    ENABLE_NATIVE_SANDBOX_PIX: '1',
    APP_ENV: 'staging',
    PAYMENT_ENV: 'sandbox',
    FEATURE_REAL_PAYMENTS: 'false',
    FEATURE_PAYOUTS: 'false',
    MERCADO_PAGO_WEBHOOK_SECRET_TEST: 'local-test-signature',
    MERCADO_PAGO_ACCESS_TOKEN: token,
    MERCADO_PAGO_VERIFIED_TEST_TOKEN_SHA256: createHash('sha256')
      .update(token)
      .digest('hex'),
  };

  it('não infere origem de teste pelo prefixo nem por rótulo de ambiente', () => {
    expect(nativeSandboxPixEnabled({})).toBe(false);
    for (const without of Object.keys(verified).filter(
      (key) => !key.startsWith('FEATURE_'),
    )) {
      expect(
        nativeSandboxPixEnabled({ ...verified, [without]: undefined }),
      ).toBe(false);
    }
  });

  it('recusa token trocado, ambiente divergente e segredo de produção', () => {
    for (const changed of [
      { MERCADO_PAGO_ACCESS_TOKEN: 'APP_USR-another-fixture' },
      { PAYMENT_ENV: 'production' },
      { APP_ENV: 'production' },
      { FEATURE_REAL_PAYMENTS: 'true' },
      { FEATURE_PAYOUTS: 'true' },
      { MERCADO_PAGO_WEBHOOK_SECRET: 'ambiguous' },
      { MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION: 'not-allowed' },
    ]) {
      expect(nativeSandboxPixEnabled({ ...verified, ...changed })).toBe(false);
    }
    expect(nativeSandboxPixEnabled(verified)).toBe(true);
  });

  it('reconhece apenas ticket sandbox documentado do provedor', () => {
    expect(
      sandboxPixTicketUrl(
        'https://www.mercadopago.com.br/sandbox/payments/12345/ticket?caller_id=1',
      ),
    ).toBe(true);
    for (const input of [
      undefined,
      'https://www.mercadopago.com.br/payments/12345/ticket',
      'https://www.mercadopago.com.br.example.test/sandbox/payments/12345/ticket',
      'http://www.mercadopago.com.br/sandbox/payments/12345/ticket',
      'https://user@www.mercadopago.com.br/sandbox/payments/12345/ticket',
    ]) {
      expect(sandboxPixTicketUrl(input)).toBe(false);
    }
  });
});
