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
      path: '/auth/login',
      method: 'POST',
      ip: '10.0.0.1',
    });
    const res = response();
    const next = jest.fn() as unknown as NextFunction;
    middleware.use(req, res.typed, next);
    middleware.use(req, res.typed, next);
    expect(res.value.status).toHaveBeenCalledWith(429);
    expect(res.value.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(String),
    );
    delete process.env.RATE_LIMIT_LOGIN;
  });

  it('isola o limite de sessões autenticadas atrás do mesmo proxy', () => {
    process.env.RATE_LIMIT_DEFAULT = '1';
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
    delete process.env.RATE_LIMIT_DEFAULT;
  });
});
