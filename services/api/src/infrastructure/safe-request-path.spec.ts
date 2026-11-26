import { BadRequestException } from '@nestjs/common';
import type { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { SafeExceptionFilter } from './http-exception.filter';
import { RequestLoggingInterceptor } from './request-logging.interceptor';
import { safeRequestPath } from './safe-request-path';

describe('safe request path', () => {
  it.each([
    ['/admin/invitations/placeholder', '/admin/invitations/[redacted]'],
    [
      '/admin/invitations/placeholder/accept',
      '/admin/invitations/[redacted]/accept',
    ],
    [
      '/ADMIN/invitations/placeholder/?ref=placeholder',
      '/ADMIN/invitations/[redacted]',
    ],
    [
      '/affiliates/invite/synthetic-credential/accept?ref=excluded',
      '/affiliates/invite/[redacted]/accept',
    ],
    ['/affiliates/invite/accept', '/affiliates/invite/accept'],
  ])('redacts invitation credentials in %s', (input, expected) => {
    expect(safeRequestPath(input)).toBe(expected);
  });

  it('preserves ordinary paths and their diagnostics', () => {
    const path = '/admin/team/invitations/item/cancel?view=team';
    expect(safeRequestPath(path)).toBe(path);
  });
});

describe('invitation request diagnostics', () => {
  const input = '/admin/invitations/synthetic-credential/accept?ref=excluded';
  const expected = '/admin/invitations/[redacted]/accept';

  it('redacts the real request logger sink', async () => {
    const request = { originalUrl: input, method: 'POST' };
    const response = { statusCode: 201 };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const write = jest.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      await lastValueFrom(
        new RequestLoggingInterceptor().intercept(context, {
          handle: () => of(null),
        }),
      );
      const line = String(write.mock.calls[0]?.[0]);
      const logged = JSON.parse(line) as { path: string };
      expect(logged.path).toBe(expected);
    } finally {
      write.mockRestore();
    }
  });

  it('redacts the path returned by the real HTTP exception filter', () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ originalUrl: input }),
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;
    new SafeExceptionFilter().catch(
      new BadRequestException('Synthetic test'),
      host,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ path: expected }),
    );
  });
});
