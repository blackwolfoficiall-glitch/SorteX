import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmController } from './crm.controller';
import { CrmAdminController } from './crm-admin.controller';
import { CrmService } from './crm.service';
import { CrmSyncService } from './crm-sync.service';
@Module({
  imports: [PrismaModule],
  controllers: [CrmController, CrmAdminController],
  providers: [CrmService, CrmSyncService],
  exports: [CrmSyncService],
})
export class CrmModule {}
