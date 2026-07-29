import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { SelectPlanDto, UpdateBrandDto } from './dto/organizer-platform.dto';
import { OrganizerPlatformService } from './organizer-platform.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly service: OrganizerPlatformService) {}
  @Get() @Public() list() {
    return this.service.listPlans();
  }
  @Get('me') @Roles(UserRole.ORGANIZER) current(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.currentPlan(user);
  }
  @Post('select') @Roles(UserRole.ORGANIZER) select(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: SelectPlanDto,
  ) {
    return this.service.selectPlan(user, data);
  }
  @Post('cancel') @Roles(UserRole.ORGANIZER) cancel(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancelPlan(user);
  }
  @Post('reactivate') @Roles(UserRole.ORGANIZER) reactivate(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.reactivatePlan(user);
  }
  @Post('onboarding/complete')
  @Roles(UserRole.ORGANIZER)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: UpdateBrandDto,
  ) {
    return this.service.completeOnboarding(user, data);
  }
}
