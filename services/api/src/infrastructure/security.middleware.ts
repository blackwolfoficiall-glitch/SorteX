import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import {
  bucketSweepIntervalMs,
  RequestRateBuckets,
} from './request-rate-buckets';
type RequestWithId = Request & { requestId?: string };
const buckets = new RequestRateBuckets(10_000);
@Injectable()
export class RequestSecurityMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = this.cleanId(req.headers['x-request-id']) || randomUUID();
    (req as RequestWithId).requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=()',
    );
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    if (process.env.NODE_ENV === 'production')
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains',
      );
    // Express temporarily trims the matched path for mounted middleware.
    // Nest mounts this middleware on a wildcard, so req.path can be "/" on
    // every endpoint. originalUrl preserves the route as received by Express.
    const path =
      (req.originalUrl?.split('?', 1)[0] || req.path)
        .replace(/\/+$/, '')
        .toLowerCase() || '/';
    const limit = this.limit(req.method, path),
      windowMs = Math.max(
        1000,
        Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
      );
    if (limit > 0) {
      const authorization = req.headers.authorization;
      const forwardedFor = req.headers['x-forwarded-for'];
      const clientIp = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor?.split(',')[0]?.trim();
      const identity = authorization?.startsWith('Bearer ')
        ? `session:${authorization.slice(7)}`
        : `ip:${clientIp || req.ip || 'unknown'}`;
      const key = `${req.method}:${this.hash(path)}:${this.hash(identity)}`;
      const now = Date.now();
      const bucket = buckets.increment(key, now, windowMs);
      const resetAt = bucket?.resetAt ?? now + bucketSweepIntervalMs;
      res.setHeader('RateLimit-Limit', String(limit));
      res.setHeader(
        'RateLimit-Remaining',
        String(bucket ? Math.max(0, limit - bucket.count) : 0),
      );
      res.setHeader('RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
      if (!bucket || bucket.count > limit) {
        res.setHeader(
          'Retry-After',
          String(Math.max(1, Math.ceil((resetAt - now) / 1000))),
        );
        return void res.status(HttpStatus.TOO_MANY_REQUESTS).json({
          statusCode: 429,
          code: 'RATE_LIMITED',
          message: 'Muitas solicitações. Tente novamente em instantes.',
          requestId,
          timestamp: new Date().toISOString(),
        });
      }
    }
    next();
  }
  private limit(method: string, path: string) {
    if (path.includes('/webhooks/'))
      return Number(process.env.RATE_LIMIT_WEBHOOK || 300);
    if (path.endsWith('/auth/login'))
      return Number(process.env.RATE_LIMIT_LOGIN || 10);
    if (path.includes('/auth/forgot-password'))
      return Number(process.env.RATE_LIMIT_PASSWORD_RESET || 5);
    if (path.includes('/auth/register'))
      return Number(process.env.RATE_LIMIT_REGISTER || 5);
    if (path.includes('/payments') || path.includes('/purchases/reserve'))
      return Number(process.env.RATE_LIMIT_PAYMENT || 30);
    if (path.includes('/media/'))
      return Number(process.env.RATE_LIMIT_MEDIA || 20);
    if (path.includes('/support'))
      return Number(process.env.RATE_LIMIT_SUPPORT || 30);
    if (path.startsWith('/health')) return 120;
    // A navegação do dashboard combina Server Components, prefetch e hidratação.
    // Leituras autenticadas precisam de uma janela própria para não bloquear uma
    // sessão legítima enquanto mutações continuam com o limite mais restritivo.
    if (method === 'GET' || method === 'HEAD')
      return Number(process.env.RATE_LIMIT_READ || 600);
    return Number(process.env.RATE_LIMIT_DEFAULT || 120);
  }
  private hash(v: string) {
    return createHash('sha256').update(v).digest('hex').slice(0, 20);
  }
  private cleanId(v: unknown) {
    return typeof v === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(v)
      ? v
      : undefined;
  }
}
