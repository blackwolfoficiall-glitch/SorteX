import type { NextFunction, Request, Response } from 'express';
import { RequestSecurityMiddleware } from './security.middleware';

function request(data: Record<string, unknown>): Request {
  return data as unknown as Request;
}

function response() {
  const value = {
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  return { value, typed: value as unknown as Response };
}

describe('RequestSecurityMiddleware', () => {
  it('aplica headers e request id', () => {
    const middleware = new RequestSecurityMiddleware();
    const headers: Record<string, string> = {};
    const res = response();
    res.value.setHeader.mockImplementation(
      (key: string, value: string) => (headers[key] = value),
    );
    const next = jest.fn();
    middleware.use(
      request({
        headers: {},
        path: '/public/campaigns',
        method: 'GET',
        ip: '127.0.0.1',
      }),
      res.typed,
      next,
    );
    expect(headers['X-Request-Id']).toBeTruthy();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(next).toHaveBeenCalled();
  });

  it('bloqueia após o limite e informa quando repetir', () => {
    process.env.RATE_LIMIT_LOGIN = '1';
    const middleware = new RequestSecurityMiddleware();
    const req = request({
      headers: {},
      // Express's mounted wildcard trims req.path to "/" in real traffic.
      path: '/',
      originalUrl: '/auth/login',
      method: 'POST',
      ip: '10.0.0.1',
    });
    const res = response();
    const next = jest.fn() as unknown as NextFunction;
    middleware.use(req, res.typed, next);
    const normalRead = response();
    middleware.use(
      request({
        headers: {},
        path: '/',
        originalUrl: '/health/live',
        method: 'GET',
        ip: '10.0.0.1',
      }),
      normalRead.typed,
      next,
    );
    expect(normalRead.value.setHeader).toHaveBeenCalledWith(
      'RateLimit-Limit',
      '120',
    );
    expect(normalRead.value.status).not.toHaveBeenCalled();
    middleware.use(
      request({ ...req, originalUrl: '/AUTH/LOGIN/?source=official-web' }),
      res.typed,
      next,
    );
    expect(next).toHaveBeenCalledTimes(2);
    expect(res.value.status).toHaveBeenCalledWith(429);
    expect(res.value.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(String),
    );
    delete process.env.RATE_LIMIT_LOGIN;
  });

  it('separa buckets de leitura por rota, sem separar query strings', () => {
    const previous = process.env.RATE_LIMIT_READ;
    process.env.RATE_LIMIT_READ = '1';
    try {
      const middleware = new RequestSecurityMiddleware();
      const next = jest.fn();
      const get = (originalUrl: string) =>
        request({
          headers: {},
          path: '/',
          originalUrl,
          method: 'GET',
          ip: '10.0.0.2',
        });
      middleware.use(get('/public/campaigns?page=1'), response().typed, next);
      middleware.use(get('/public/winners'), response().typed, next);
      const repeated = response();
      middleware.use(get('/public/campaigns?page=2'), repeated.typed, next);
      expect(next).toHaveBeenCalledTimes(2);
      expect(repeated.value.status).toHaveBeenCalledWith(429);
    } finally {
      if (previous === undefined) delete process.env.RATE_LIMIT_READ;
      else process.env.RATE_LIMIT_READ = previous;
    }
  });

  it('isola o limite de sessões autenticadas atrás do mesmo proxy', () => {
    process.env.RATE_LIMIT_READ = '1';
    const middleware = new RequestSecurityMiddleware();
    const nextMock = jest.fn();
    const next = nextMock as unknown as NextFunction;
    const first = request({
      headers: { authorization: 'Bearer session-a' },
      path: '/campaigns/my',
      method: 'GET',
      ip: '127.0.0.1',
    });
    const second = request({
      headers: { authorization: 'Bearer session-b' },
      path: '/campaigns/my',
      method: 'GET',
      ip: '127.0.0.1',
    });
    middleware.use(first, response().typed, next);
    middleware.use(second, response().typed, next);
    expect(nextMock).toHaveBeenCalledTimes(2);
    delete process.env.RATE_LIMIT_READ;
  });
});
