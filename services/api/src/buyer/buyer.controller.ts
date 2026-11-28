import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { BuyerService } from './buyer.service';
import { BuyerCampaignQueryDto } from './dto/buyer-query.dto';
import {
  BuyerProfileDto,
  CreateSupportTicketDto,
  SupportMessageDto,
} from './dto/buyer-profile.dto';

@Controller('buyer')
@Roles(UserRole.BUYER)
export class BuyerController {
  constructor(private readonly buyer: BuyerService) {}
  @Get('home') home(@CurrentUser() user: AuthenticatedUser) {
    return this.buyer.home(user);
  }
  @Get('campaigns') campaigns(@Query() query: BuyerCampaignQueryDto) {
    return this.buyer.campaigns(query);
  }
  @Get('profile') profile(@CurrentUser() user: AuthenticatedUser) {
    return this.buyer.profile(user.id);
  }
  @Patch('profile') updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: BuyerProfileDto,
  ) {
    return this.buyer.updateProfile(user.id, body);
  }
  // The /private paths fail closed if the Web/App are ahead of the backend:
  // an older API must never turn a private save into a CRM lead.
  @Get(['favorites/private', 'favorites'])
  @Header('Cache-Control', 'private, no-store')
  favorites(@CurrentUser() user: AuthenticatedUser) {
    return this.buyer.favorites(user.id);
  }
  @Post(['favorites/private/:campaignId', 'favorites/:campaignId'])
  @Header('Cache-Control', 'private, no-store')
  favorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId') id: string,
  ) {
    return this.buyer.favorite(user.id, id);
  }
  @Delete(['favorites/private/:campaignId', 'favorites/:campaignId'])
  @Header('Cache-Control', 'private, no-store')
  unfavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('campaignId') id: string,
  ) {
    return this.buyer.unfavorite(user.id, id);
  }
  @Get('notifications')
  @Header('Cache-Control', 'private, no-store')
  notifications(@CurrentUser() user: AuthenticatedUser) {
    return this.buyer.notifications(user.id);
  }
  @Post('notifications/read-all') readAll(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.buyer.readAll(user.id);
  }
  @Post('notifications/:id/read') read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.buyer.read(user.id, id);
  }
  @Get('support') support(@CurrentUser() user: AuthenticatedUser) {
    return this.buyer.support(user.id);
  }
  @Post('support') createSupport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateSupportTicketDto,
  ) {
    return this.buyer.createSupport(user.id, body);
  }
  @Get('support/:id') supportDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.buyer.supportDetail(user.id, id);
  }
  @Post('support/:id/messages') reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SupportMessageDto,
  ) {
    return this.buyer.reply(user.id, id, body);
  }
  @Post('support/:id/close') close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.buyer.close(user.id, id);
  }
}
