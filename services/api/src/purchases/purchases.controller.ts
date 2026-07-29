import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { ListPurchasesDto } from './dto/list-purchases.dto';
import { ReserveManualDto } from './dto/reserve-manual.dto';
import { ReserveRandomDto } from './dto/reserve-random.dto';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@Roles(UserRole.BUYER, UserRole.ADMIN)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post('reserve-random')
  reserveRandom(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReserveRandomDto,
  ) {
    return this.purchases.reserveRandom(user, body);
  }

  @Post('reserve-manual')
  reserveManual(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReserveManualDto,
  ) {
    return this.purchases.reserveManual(user, body);
  }

  @Get('current')
  current(@CurrentUser() user: AuthenticatedUser) {
    return this.purchases.current(user);
  }

  @Get('my')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPurchasesDto,
  ) {
    return this.purchases.listMine(user, query.status);
  }

  @Get(':id/tickets')
  tickets(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchases.tickets(id, user);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchases.cancel(id, user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.purchases.get(id, user);
  }
}
