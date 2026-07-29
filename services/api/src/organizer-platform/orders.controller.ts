import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ListOrdersDto } from './dto/organizer-platform.dto';
import { OrganizerPlatformService } from './organizer-platform.service';

@Controller('organizer/orders')
@Roles(UserRole.ORGANIZER)
export class OrdersController {
  constructor(private readonly service: OrganizerPlatformService) {}
  @Get() list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersDto,
  ) {
    return this.service.listOrders(user, query);
  }
  @Get(':id') get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.order(user, id);
  }
}
