import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super(
      process.env.PRISMA_USE_PG_ADAPTER === 'true'
        ? {
            adapter: new PrismaPg({
              connectionString: process.env.DATABASE_URL,
              max: 5,
              connectionTimeoutMillis: 15000,
              idleTimeoutMillis: 10000,
            }),
          }
        : undefined,
    );
  }
  async onModuleInit() {
    await this.$connect();
  }
}
