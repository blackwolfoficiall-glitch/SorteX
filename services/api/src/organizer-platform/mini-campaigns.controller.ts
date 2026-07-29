import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { Public } from '../auth/decorators/public.decorator';
import {
  MiniCampaignDto,
  MiniCampaignResultDto,
  ReserveMiniCampaignDto,
} from './dto/organizer-platform.dto';
import { OrganizerPlatformService } from './organizer-platform.service';

@Controller('mini-campaigns')
@Roles(UserRole.ORGANIZER)
export class MiniCampaignsController {
  constructor(private readonly service: OrganizerPlatformService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listMiniCampaigns(user);
  }
  @Get(':id') get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.miniCampaign(user, id);
  }
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: MiniCampaignDto,
  ) {
    return this.service.createMiniCampaign(user, data);
  }
  @Patch(':id') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() data: MiniCampaignDto,
  ) {
    return this.service.updateMiniCampaign(user, id, data);
  }
  @Post(':id/publish') publish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.miniAction(user, id, 'publish');
  }
  @Post(':id/pause') pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.miniAction(user, id, 'pause');
  }
  @Post(':id/finish') finish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.miniAction(user, id, 'finish');
  }
  @Post(':id/duplicate') duplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.duplicateMiniCampaign(user, id);
  }
  @Post(':id/result') result(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() data: MiniCampaignResultDto,
  ) {
    return this.service.recordMiniCampaignResult(user, id, data);
  }
  @Delete(':id') remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deleteMiniCampaign(user, id);
  }
}

@Controller('public/mini-campaigns')
export class PublicMiniCampaignsController {
  constructor(private readonly service: OrganizerPlatformService) {}
  @Public()
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.service.publicMiniCampaign(slug);
  }
  @Roles(UserRole.BUYER)
  @Post(':slug/reserve')
  reserve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() data: ReserveMiniCampaignDto,
  ) {
    return this.service.reserveMiniCampaign(user, slug, data);
  }
}
