import { Controller, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReservationExpirationService } from './reservation-expiration.service';

@Controller('purchases/internal')
@Roles(UserRole.ADMIN)
export class InternalPurchasesController {
  constructor(private readonly expiration: ReservationExpirationService) {}

  @Post('expire')
  expire() {
    return this.expiration.expireDue();
  }
}
