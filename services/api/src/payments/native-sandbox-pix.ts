import { createHash, timingSafeEqual } from 'node:crypto';

const qaBranch = 'br-weathered-forest-bccwn49d';
const qaApi = `https://${qaBranch}-sortexqa.compute.c-16.us-east-1.aws.neon.tech`;

export function nativeSandboxPixEnabled(env = process.env) {
  const token = env.MERCADO_PAGO_ACCESS_TOKEN;
  // This fingerprint must come from independently verified provider Test
  // credentials. Test and live Orders credentials share the APP_USR prefix.
  const fingerprint = env.MERCADO_PAGO_VERIFIED_TEST_TOKEN_SHA256;
  if (
    env.ENABLE_NATIVE_SANDBOX_PIX !== '1' ||
    env.APP_ENV !== 'staging' ||
    env.NEON_BRANCH_ID !== qaBranch ||
    env.API_URL?.replace(/\/$/, '') !== qaApi ||
    env.PAYMENT_ENV !== 'sandbox' ||
    ![undefined, '', 'false'].includes(env.FEATURE_REAL_PAYMENTS) ||
    ![undefined, '', 'false'].includes(env.FEATURE_PAYOUTS) ||
    !env.MERCADO_PAGO_WEBHOOK_SECRET_TEST?.trim() ||
    env.MERCADO_PAGO_WEBHOOK_SECRET_PRODUCTION ||
    env.MERCADO_PAGO_WEBHOOK_SECRET ||
    !token?.trim() ||
    !fingerprint ||
    !/^[0-9a-f]{64}$/.test(fingerprint)
  ) {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(fingerprint, 'hex'),
    createHash('sha256').update(token).digest(),
  );
}

export function sandboxPixTicketUrl(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.origin === 'https://www.mercadopago.com.br' &&
      !url.username &&
      !url.password &&
      /^\/sandbox\/payments\/\d+\/ticket\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}
