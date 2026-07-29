import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PaymentsService } from './payments.service';

@Controller('payments/organizer')
@Roles(UserRole.ORGANIZER)
export class OrganizerPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.payments.organizerSummary(user);
  }
}
