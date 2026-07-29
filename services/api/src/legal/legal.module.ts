import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizersModule } from '../organizers/organizers.module';
import {
  LegalAdminController,
  LegalController,
  LegalPublicController,
} from './legal.controller';
import { LegalService } from './legal.service';
@Module({
  imports: [PrismaModule, OrganizersModule],
  controllers: [LegalPublicController, LegalController, LegalAdminController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}
