import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminController } from './admin.controller';
import { AdminInvitationController } from './admin-invitation.controller';
import { AdminService } from './admin.service';
import { PlatformSettingsService } from './platform-settings.service';
@Module({
  imports: [PrismaModule],
  controllers: [AdminController, AdminInvitationController],
  providers: [AdminService, PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class AdminModule {}
