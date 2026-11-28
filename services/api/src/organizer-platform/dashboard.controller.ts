import { Controller, Get, Header, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { DashboardPeriodQuery } from './dashboard-period';
import { OrganizerPlatformService } from './organizer-platform.service';

@Controller('dashboard')
@Roles(UserRole.ORGANIZER)
export class DashboardController {
  constructor(private readonly service: OrganizerPlatformService) {}

  @Get('period')
  @Header('Cache-Control', 'private, no-store')
  getPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DashboardPeriodQuery,
  ) {
    return this.service.dashboardPeriod(user, query);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.service.dashboard(user);
  }
}
