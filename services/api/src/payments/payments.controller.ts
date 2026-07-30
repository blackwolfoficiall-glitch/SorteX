import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateCardPaymentDto } from './dto/create-card-payment.dto';
import { CreatePixPaymentDto } from './dto/create-pix-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@Roles(UserRole.BUYER)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('pix')
  pix(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreatePixPaymentDto,
  ) {
    return this.payments.createPix(user, body);
  }

  @Post('card')
  card(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCardPaymentDto,
  ) {
    return this.payments.createCard(user, body);
  }

  @Get('config')
  config() {
    return this.payments.publicConfig();
  }

  @Get('my')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPaymentsDto,
  ) {
    return this.payments.listMine(user, query.status);
  }

  @Get('purchase/:purchaseId')
  byPurchase(
    @Param('purchaseId') purchaseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.getByPurchase(purchaseId, user);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.cancel(id, user);
  }

  @Post(':id/refresh')
  refresh(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.refreshStatus(id, user);
  }

  @Post(':id/refund-request')
  refundRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.requestRefund(id, user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.get(id, user);
  }
}
