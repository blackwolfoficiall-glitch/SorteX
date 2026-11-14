import { generateKeyPairSync, sign } from 'node:crypto';
import {
  appleClientSecret,
  verifyIdentityToken,
  type SocialProvider,
} from './oidc-client';
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'fixture-key',
  use: 'sig',
  alg: 'RS256',
};
const base = {
  iss: 'https://accounts.google.com',
  aud: 'synthetic-client',
  sub: 'synthetic-subject',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 300,
  nonce: 'expected-nonce',
  email: 'synthetic@example.test',
  email_verified: true,
};
function token(
  changes: Record<string, unknown> = {},
  header: Record<string, unknown> = { alg: 'RS256', kid: 'fixture-key' },
) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const data = `${encode(header)}.${encode({ ...base, ...changes })}`;
  return `${data}.${sign('RSA-SHA256', Buffer.from(data), privateKey).toString('base64url')}`;
}
describe('OIDC verification against signed provider-shaped fixtures', () => {
  it.each(['google', 'apple'] as SocialProvider[])(
    'verifies %s issuer, signature, audience, nonce and verified email',
    (provider) => {
      const result = verifyIdentityToken(
        token(
          provider === 'apple'
            ? {
                iss: 'https://appleid.apple.com',
                email: 'synthetic@privaterelay.appleid.com',
                email_verified: 'true',
                is_private_email: 'true',
              }
            : {},
        ),
        [jwk],
        provider,
        base.aud,
        base.nonce,
      );
      expect(result.subject).toBe(base.sub);
      expect(result.email).toContain('@');
    },
  );
  it.each([
    { iss: 'https://attacker.example' },
    { aud: 'another-client' },
    { azp: 'another-client' },
    { nonce: 'wrong-nonce' },
    { exp: 1 },
    { iat: base.exp + 100 },
    { nbf: base.exp + 100 },
    { sub: '' },
    { aud: [base.aud, 'another-client'] },
  ])('rejects invalid claims %j', (changes) =>
    expect(() =>
      verifyIdentityToken(
        token(changes),
        [jwk],
        'google',
        base.aud,
        base.nonce,
      ),
    ).toThrow(),
  );
  it('rejects alg substitution, unsupported critical headers and unknown signing keys', () => {
    expect(() =>
      verifyIdentityToken(
        token(
          {},
          { alg: 'RS256', kid: 'fixture-key', crit: ['unknown-extension'] },
        ),
        [jwk],
        'google',
        base.aud,
        base.nonce,
      ),
    ).toThrow();
    expect(() =>
      verifyIdentityToken(
        token({}, { alg: 'none', kid: 'fixture-key' }),
        [jwk],
        'google',
        base.aud,
        base.nonce,
      ),
    ).toThrow();
    expect(() =>
      verifyIdentityToken(token(), [], 'google', base.aud, base.nonce),
    ).toThrow();
    const data = token().split('.');
    data[1] = Buffer.from(
      JSON.stringify({ ...base, email: 'tampered@example.test' }),
    ).toString('base64url');
    expect(() =>
      verifyIdentityToken(
        data.join('.'),
        [jwk],
        'google',
        base.aud,
        base.nonce,
      ),
    ).toThrow();
  });
  it('does not trust an unverified email', () =>
    expect(
      verifyIdentityToken(
        token({ email_verified: false }),
        [jwk],
        'google',
        base.aud,
        base.nonce,
      ).email,
    ).toBeNull());
  it('creates a short-lived Apple ES256 client secret with the correct audience', () => {
    const old = process.env.APPLE_PRIVATE_KEY;
    const key = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    process.env.APPLE_PRIVATE_KEY = key.privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
    try {
      const secret = appleClientSecret('synthetic-service');
      const payload = JSON.parse(
        Buffer.from(secret.split('.')[1], 'base64url').toString(),
      );
      expect(payload.aud).toBe('https://appleid.apple.com');
      expect(payload.sub).toBe('synthetic-service');
      expect(payload.exp - payload.iat).toBe(300);
    } finally {
      if (old === undefined) delete process.env.APPLE_PRIVATE_KEY;
      else process.env.APPLE_PRIVATE_KEY = old;
    }
  });
});
