import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PurchasesService } from './purchases.service';
import { ReservationExpirationService } from './reservation-expiration.service';

@Controller('purchases/organizer')
@Roles(UserRole.ORGANIZER)
export class OrganizerPurchasesController {
  constructor(
    private readonly purchases: PurchasesService,
    private readonly expiration: ReservationExpirationService,
  ) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.purchases.organizerSummary(user);
  }

  @Get('expired-instant-prizes')
  alerts(@CurrentUser() user: AuthenticatedUser) {
    return this.expiration.organizerAlerts(user.id);
  }

  @Post('expired-instant-prizes/:id/viewed')
  viewed(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.expiration.markViewed(user.id, id);
  }

  @Get('instant-prize-summary')
  prizeSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.expiration.prizeSummary(user.id, campaignId);
  }
}
