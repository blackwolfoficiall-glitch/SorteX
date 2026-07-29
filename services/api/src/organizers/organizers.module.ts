import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminOrganizersController } from './admin-organizers.controller';
import { OrganizerStorageService } from './organizer-storage.service';
import { OrganizersController } from './organizers.controller';
import { OrganizersService } from './organizers.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizersController, AdminOrganizersController],
  providers: [OrganizersService, OrganizerStorageService],
  exports: [OrganizerStorageService],
})
export class OrganizersModule {}
