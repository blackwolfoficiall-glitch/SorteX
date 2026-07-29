import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MemoryCacheService } from './cache.service';
import { EnvironmentService } from './environment.service';
import { FeatureFlagsService } from './feature-flags.service';
import { HealthController } from './health.controller';
import { LocalJobService } from './local-job.service';
import { RequestSecurityMiddleware } from './security.middleware';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    EnvironmentService,
    MemoryCacheService,
    LocalJobService,
    FeatureFlagsService,
  ],
  exports: [
    EnvironmentService,
    MemoryCacheService,
    LocalJobService,
    FeatureFlagsService,
  ],
})
export class InfrastructureModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestSecurityMiddleware).forRoutes('*');
  }
}
