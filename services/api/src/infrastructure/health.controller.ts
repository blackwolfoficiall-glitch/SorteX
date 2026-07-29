import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
@Controller('health')
export class HealthController {
  constructor(private readonly p: PrismaService) {}
  @Get() @Public() health() {
    return {
      status: 'ok',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }
  @Get('live') @Public() live() {
    return { status: 'alive' };
  }
  @Get('ready') @Public() async ready() {
    try {
      await this.p.$queryRaw`SELECT 1`;
      const storage = resolve(
        process.env.ORGANIZER_UPLOAD_DIR ?? './storage/organizers',
      );
      return {
        status: 'ready',
        database: 'up',
        storage: existsSync(storage) ? 'up' : 'not-initialized',
      };
    } catch {
      throw new ServiceUnavailableException('Serviço ainda não está pronto.');
    }
  }
  @Get('metrics') metrics() {
    return this.p
      .$transaction([
        this.p.user.count(),
        this.p.campaign.count(),
        this.p.payment.count({ where: { status: 'APPROVED' } }),
        this.p.technicalJob.count({
          where: { status: { in: ['QUEUED', 'PROCESSING'] } },
        }),
      ])
      .then(([users, campaigns, approvedPayments, pendingJobs]) => ({
        users,
        campaigns,
        approvedPayments,
        pendingJobs,
      }));
  }
}
