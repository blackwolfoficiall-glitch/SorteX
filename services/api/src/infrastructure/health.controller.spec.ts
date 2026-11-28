import { HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import type { PrismaService } from '../prisma/prisma.service';

describe('HealthController readiness', () => {
  const mockDb = () => ({
    $transaction: jest.fn().mockResolvedValue([null, null, null]),
    user: { findFirst: jest.fn().mockResolvedValue(null) },
    campaign: { findFirst: jest.fn().mockResolvedValue(null) },
    payment: { findFirst: jest.fn().mockResolvedValue(null) },
  });

  it('checks the core schema and does not require seed records', async () => {
    const db = mockDb();
    const previous = process.env.UPLOADS_DISABLED;
    process.env.UPLOADS_DISABLED = 'true';
    try {
      const health = new HealthController(db as unknown as PrismaService);
      await expect(health.ready()).resolves.toEqual({
        status: 'ready',
        database: 'up',
        storage: 'disabled',
      });
      expect(db.user.findFirst).toHaveBeenCalledWith({ select: { id: true } });
      expect(db.campaign.findFirst).toHaveBeenCalledWith({
        select: { id: true, drawTimeZone: true },
      });
      expect(db.payment.findFirst).toHaveBeenCalledWith({
        select: { id: true },
      });
      expect(db.$transaction).toHaveBeenCalledTimes(1);
    } finally {
      if (previous === undefined) delete process.env.UPLOADS_DISABLED;
      else process.env.UPLOADS_DISABLED = previous;
    }
  });

  it.each([
    'relation does not exist',
    'column Campaign.drawTimeZone does not exist',
  ])('returns a generic 503 for %s', async (errorDetail) => {
    const db = mockDb();
    db.$transaction.mockRejectedValue(new Error(errorDetail));
    const health = new HealthController(db as unknown as PrismaService);
    const error: unknown = await health.ready().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect((error as Error).message).toBe('Serviço ainda não está pronto.');
    expect(health.live()).toEqual({ status: 'alive' });
  });
});
