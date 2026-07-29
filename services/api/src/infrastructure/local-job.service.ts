import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export type JobHandler = (payload: Prisma.JsonObject) => Promise<void>;
@Injectable()
export class LocalJobService {
  private readonly handlers = new Map<string, JobHandler>();
  constructor(private readonly p: PrismaService) {}
  register(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
  }
  enqueue(
    type: string,
    idempotencyKey: string,
    payload: Prisma.InputJsonObject,
    maxAttempts = 3,
  ) {
    return this.p.technicalJob.upsert({
      where: { idempotencyKey },
      create: { type, idempotencyKey, payload, maxAttempts },
      update: {},
    });
  }
  async processDue(limit = 20) {
    const jobs = await this.p.technicalJob.findMany({
      where: { status: 'QUEUED', scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: 'asc' },
      take: Math.min(limit, 100),
    });
    const results: Array<{ id: string; status: string }> = [];
    for (const job of jobs) {
      const claimed = await this.p.technicalJob.updateMany({
        where: { id: job.id, status: 'QUEUED' },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
      if (!claimed.count) continue;
      const handler = this.handlers.get(job.type);
      try {
        if (!handler) throw new Error(`Handler não registrado: ${job.type}`);
        await handler(job.payload as Prisma.JsonObject);
        await this.p.technicalJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            errorMessage: null,
          },
        });
        results.push({ id: job.id, status: 'COMPLETED' });
      } catch (e) {
        const exhausted = job.attempts + 1 >= job.maxAttempts;
        await this.p.technicalJob.update({
          where: { id: job.id },
          data: {
            status: exhausted ? 'FAILED' : 'QUEUED',
            failedAt: exhausted ? new Date() : undefined,
            scheduledAt: exhausted
              ? job.scheduledAt
              : new Date(
                  Date.now() + Math.min(300000, 1000 * 2 ** job.attempts),
                ),
            errorMessage: e instanceof Error ? e.message : 'Falha',
          },
        });
        results.push({ id: job.id, status: exhausted ? 'FAILED' : 'RETRY' });
      }
    }
    return results;
  }
}
