import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CampaignsService } from './campaigns.service';
import { ListPublicCampaignsDto } from './dto/list-public-campaigns.dto';
import { CampaignMilestonesService } from './campaign-milestones.service';

@Controller('public/campaigns')
@Public()
export class PublicCampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly milestonesService: CampaignMilestonesService,
  ) {}

  @Get()
  list(@Query() query: ListPublicCampaignsDto) {
    return this.campaignsService.listPublic(query.category);
  }

  @Get('organizers/:organizerId/profile')
  organizerProfile(@Param('organizerId') organizerId: string) {
    return this.campaignsService.getPublicOrganizerProfile(organizerId);
  }

  @Get('media/:campaignId/:kind/:mediaId')
  @Public()
  mediaWithId(
    @Param('campaignId') campaignId: string,
    @Param('kind') kind: 'gallery' | 'instant' | 'milestone',
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.streamMedia(campaignId, kind, mediaId, response, user);
  }

  @Get('media/:campaignId/:kind')
  @Public()
  media(
    @Param('campaignId') campaignId: string,
    @Param('kind') kind: 'cover' | 'video' | 'main-prize',
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.streamMedia(campaignId, kind, undefined, response, user);
  }

  @Get(':slug/milestones')
  milestones(@Param('slug') slug: string) {
    return this.milestonesService.listPublic(slug);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.campaignsService.getPublic(slug);
  }

  private async streamMedia(
    campaignId: string,
    kind:
      'cover' | 'video' | 'main-prize' | 'gallery' | 'instant' | 'milestone',
    mediaId: string | undefined,
    response: Response,
    user?: AuthenticatedUser,
  ) {
    const file = await this.campaignsService.getMediaFile(
      campaignId,
      kind,
      mediaId,
      user,
    );
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(file.stream);
  }
}
