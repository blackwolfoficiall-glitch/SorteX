import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import type { UploadedOrganizerFile } from '../organizers/types/uploaded-file.type';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListMyCampaignsDto } from './dto/list-my-campaigns.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { UploadCampaignMediaDto } from './dto/upload-campaign-media.dto';
import { UpdateCampaignImageDto } from './dto/update-campaign-image.dto';
import { SaveCampaignMilestonesDto } from './dto/campaign-milestone.dto';
import { CampaignMilestonesService } from './campaign-milestones.service';

@Controller('campaigns')
@Roles(UserRole.ORGANIZER)
export class CampaignsController {
  constructor(
    private readonly campaignsService: CampaignsService,
    private readonly milestonesService: CampaignMilestonesService,
  ) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: CreateCampaignDto,
  ) {
    return this.campaignsService.create(user, data);
  }

  @Get('my')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyCampaignsDto,
  ) {
    return this.campaignsService.listMine(user, query.status);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.getOwned(id, user);
  }

  @Get(':id/media/:kind/:mediaId')
  mediaWithId(
    @Param('id') id: string,
    @Param('kind') kind: 'gallery' | 'instant' | 'milestone',
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.streamOwnedMedia(id, kind, mediaId, user, response);
  }

  @Get(':id/media/:kind')
  media(
    @Param('id') id: string,
    @Param('kind') kind: 'cover' | 'video' | 'main-prize',
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.streamOwnedMedia(id, kind, undefined, user, response);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: UpdateCampaignDto,
  ) {
    return this.campaignsService.update(id, user, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.remove(id, user);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.publish(id, user);
  }

  @Post(':id/pause')
  pause(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.pause(id, user);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.finish(id, user);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.duplicate(id, user);
  }

  @Get(':id/milestones')
  milestones(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.milestonesService.listOwned(id, user);
  }

  @Patch(':id/milestones')
  saveMilestones(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: SaveCampaignMilestonesDto,
  ) {
    return this.milestonesService.save(id, user, data);
  }

  @Post(':id/milestones/evaluate')
  evaluateMilestones(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.milestonesService
      .listOwned(id, user)
      .then(() => this.milestonesService.evaluateReached(id));
  }

  @Post(':campaignId/milestones/:milestoneId/draw')
  drawMilestone(
    @Param('campaignId') campaignId: string,
    @Param('milestoneId') milestoneId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.milestonesService
      .listOwned(campaignId, user)
      .then(() => this.milestonesService.draw(milestoneId, user));
  }

  @Post(':id/images')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: 100 * 1024 * 1024, files: 10 },
    }),
  )
  uploadImages(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: UploadCampaignMediaDto,
    @UploadedFiles() files: UploadedOrganizerFile[] = [],
  ) {
    return this.campaignsService.uploadMedia(
      id,
      user,
      data.target,
      files,
      data.instantPrizeId,
    );
  }

  @Delete(':id/images/:imageId')
  deleteImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.campaignsService.deleteImage(id, imageId, user);
  }

  @Patch(':id/images/:imageId')
  updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: UpdateCampaignImageDto,
  ) {
    return this.campaignsService.updateImage(id, imageId, user, data);
  }

  private async streamOwnedMedia(
    campaignId: string,
    kind:
      'cover' | 'video' | 'main-prize' | 'gallery' | 'instant' | 'milestone',
    mediaId: string | undefined,
    user: AuthenticatedUser,
    response: Response,
  ) {
    const file = await this.campaignsService.getMediaFile(
      campaignId,
      kind,
      mediaId,
      user,
    );
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(file.stream);
  }
}
