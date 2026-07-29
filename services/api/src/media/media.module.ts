import { Module } from '@nestjs/common';
import { OrganizersModule } from '../organizers/organizers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaAdminController } from './media-admin.controller';
import { MediaController, ShareController } from './media.controller';
import { MediaService } from './media.service';
@Module({
  imports: [PrismaModule, OrganizersModule],
  controllers: [MediaController, ShareController, MediaAdminController],
  providers: [MediaService],
})
export class MediaModule {}
