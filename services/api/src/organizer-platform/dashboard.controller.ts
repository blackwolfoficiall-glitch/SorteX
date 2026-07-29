import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { OrganizerPlatformService } from './organizer-platform.service';

@Controller('dashboard')
@Roles(UserRole.ORGANIZER)
export class DashboardController {
  constructor(private readonly service: OrganizerPlatformService) {}

  @Get()
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.service.dashboard(user);
  }
}
