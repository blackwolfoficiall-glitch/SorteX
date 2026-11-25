import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { isLocalUploadStorageReady } from '../organizers/local-upload-storage';
import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { objectStorage, usesObjectStorage } from '../organizers/object-storage';
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
      // A reachable but empty database must not be marked ready. Probe
      // core tables without requiring seeded records or scanning tables.
      await this.p.$transaction([
        this.p.user.findFirst({ select: { id: true } }),
        this.p.campaign.findFirst({ select: { id: true } }),
        this.p.payment.findFirst({ select: { id: true } }),
      ]);
      let storage: 'disabled' | 'up' | 'not-initialized';
      if (process.env.UPLOADS_DISABLED === 'true') {
        storage = 'disabled';
      } else if (usesObjectStorage()) {
        const { client, bucket } = objectStorage();
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        storage = 'up';
      } else {
        storage = (await isLocalUploadStorageReady())
          ? 'up'
          : 'not-initialized';
      }
      return { status: 'ready', database: 'up', storage };
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
