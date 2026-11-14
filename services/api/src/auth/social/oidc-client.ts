import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
  type JsonWebKey,
} from 'node:crypto';
import { isEmail } from 'class-validator';

export type SocialProvider = 'google' | 'apple';
export const providerDefinition = {
  google: {
    authorization: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
  },
  apple: {
    authorization: 'https://appleid.apple.com/auth/authorize',
    token: 'https://appleid.apple.com/auth/token',
    jwks: 'https://appleid.apple.com/auth/keys',
    issuers: ['https://appleid.apple.com'],
  },
};
export const digest = (s: string) =>
  createHash('sha256').update(s).digest('hex');
const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export function providerConfig(provider: SocialProvider) {
  const origin = process.env.OAUTH_WEB_ORIGIN || process.env.WEB_URL || '';
  const clientId =
    process.env[
      provider === 'google' ? 'GOOGLE_OAUTH_CLIENT_ID' : 'APPLE_OAUTH_CLIENT_ID'
    ];
  const required =
    provider === 'google'
      ? ['GOOGLE_OAUTH_CLIENT_SECRET']
      : ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_PRIVATE_KEY'];
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new ServiceUnavailableException(
      'Acesso social aguardando configuração.',
    );
  }
  if (
    url.origin !== origin ||
    (url.protocol !== 'https:' &&
      !(
        process.env.NODE_ENV !== 'production' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )) ||
    !clientId ||
    required.some((key) => !process.env[key])
  ) {
    throw new ServiceUnavailableException(
      'Acesso social aguardando configuração.',
    );
  }
  return {
    clientId,
    redirectUri: `${origin}/api/auth/social/${provider}/callback`,
  };
}

export function appleClientSecret(clientId: string) {
  const head = b64({ alg: 'ES256', kid: process.env.APPLE_KEY_ID });
  const now = Math.floor(Date.now() / 1000);
  const body = b64({
    iss: process.env.APPLE_TEAM_ID,
    iat: now,
    exp: now + 300,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  });
  const data = `${head}.${body}`;
  return `${data}.${sign('sha256', Buffer.from(data), { key: createPrivateKey(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n')), dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

export function verifyIdentityToken(
  token: string,
  keys: JsonWebKey[],
  provider: SocialProvider,
  clientId: string,
  nonce: string,
  now = Date.now(),
) {
  try {
    if (typeof token !== 'string' || token.length > 16384) throw new Error();
    const pieces = token.split('.');
    if (pieces.length !== 3) throw new Error();
    const header = JSON.parse(Buffer.from(pieces[0], 'base64url').toString());
    const claims = JSON.parse(Buffer.from(pieces[1], 'base64url').toString());
    if ('crit' in header || header.b64 === false) throw new Error();
    if (
      header.alg !== 'RS256' ||
      typeof header.kid !== 'string' ||
      header.kid.length > 128
    )
      throw new Error();
    const jwk = keys.find(
      (key) =>
        (key as JsonWebKey & { kid?: string }).kid === header.kid &&
        key.kty === 'RSA',
    );
    if (
      !jwk ||
      (jwk.alg && jwk.alg !== 'RS256') ||
      (jwk.use && jwk.use !== 'sig')
    )
      throw new Error();
    if (
      !verify(
        'RSA-SHA256',
        Buffer.from(`${pieces[0]}.${pieces[1]}`),
        createPublicKey({ key: jwk, format: 'jwk' }),
        Buffer.from(pieces[2], 'base64url'),
      )
    )
      throw new Error();
    const time = Math.floor(now / 1000);
    if (
      !providerDefinition[provider].issuers.includes(claims.iss) ||
      claims.aud !== clientId ||
      (claims.azp && claims.azp !== clientId) ||
      typeof claims.exp !== 'number' ||
      claims.exp <= time ||
      typeof claims.iat !== 'number' ||
      claims.iat > time + 30 ||
      (claims.nbf !== undefined &&
        (typeof claims.nbf !== 'number' || claims.nbf > time + 30)) ||
      typeof claims.nonce !== 'string' ||
      digest(claims.nonce) !== digest(nonce) ||
      typeof claims.sub !== 'string' ||
      !claims.sub ||
      claims.sub.length > 255
    )
      throw new Error();
    const verifiedEmail =
      claims.email_verified === true || claims.email_verified === 'true';
    const email =
      typeof claims.email === 'string' && isEmail(claims.email) && verifiedEmail
        ? claims.email.toLowerCase()
        : null;
    return {
      subject: claims.sub as string,
      email,
      name: typeof claims.name === 'string' ? claims.name.slice(0, 120) : null,
    };
  } catch {
    throw new UnauthorizedException(
      'Não foi possível validar a identidade do provedor. Inicie o acesso novamente.',
    );
  }
}

@Injectable()
export class OidcClient {
  private cache = new Map<string, { expires: number; keys: JsonWebKey[] }>();
  async exchange(
    provider: SocialProvider,
    code: string,
    nonce: string,
    verifier: string,
  ) {
    const config = providerConfig(provider);
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      client_secret:
        provider === 'google'
          ? process.env.GOOGLE_OAUTH_CLIENT_SECRET!
          : appleClientSecret(config.clientId),
    });
    if (provider === 'google') body.set('code_verifier', verifier);
    let token: string;
    try {
      const r = await fetch(providerDefinition[provider].token, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      token = data.id_token;
    } catch {
      throw new UnauthorizedException(
        'O provedor não concluiu o acesso. Inicie novamente.',
      );
    }
    let keys = this.cache.get(provider);
    // Refresh on a new kid as well as expiration (provider key rotation).
    let kid: string | undefined;
    try {
      kid = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString(),
      ).kid;
    } catch {
      /* verifier rejects malformed tokens */
    }
    if (
      !keys ||
      keys.expires < Date.now() ||
      !keys.keys.some((k) => (k as JsonWebKey & { kid?: string }).kid === kid)
    ) {
      try {
        const r = await fetch(providerDefinition[provider].jwks, {
          signal: AbortSignal.timeout(10000),
          redirect: 'error',
        });
        if (!r.ok) throw new Error();
        const text = await r.text();
        if (text.length > 100000) throw new Error();
        const jwks = JSON.parse(text);
        if (!Array.isArray(jwks.keys) || jwks.keys.length > 30)
          throw new Error();
        keys = { expires: Date.now() + 3600000, keys: jwks.keys };
        this.cache.set(provider, keys);
      } catch {
        throw new ServiceUnavailableException(
          'O provedor está indisponível. Tente novamente.',
        );
      }
    }
    return verifyIdentityToken(
      token!,
      keys.keys,
      provider,
      config.clientId,
      nonce,
    );
  }
}
