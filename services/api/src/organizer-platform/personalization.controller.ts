import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import type { UploadedOrganizerFile } from '../organizers/types/uploaded-file.type';
import {
  CampaignTemplateDto,
  CommunityLinkDto,
  DomainDto,
  SocialLinkDto,
  UpdateBrandDto,
} from './dto/organizer-platform.dto';
import { OrganizerPlatformService } from './organizer-platform.service';

@Controller('organizer/personalization')
@Roles(UserRole.ORGANIZER)
export class PersonalizationController {
  constructor(private readonly service: OrganizerPlatformService) {}
  @Get() get(@CurrentUser() user: AuthenticatedUser) {
    return this.service.personalization(user);
  }
  @Patch('brand') brand(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: UpdateBrandDto,
  ) {
    return this.service.updateBrand(user, data);
  }
  @Post('assets/:kind')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: 'logo' | 'profile' | 'banner',
    @UploadedFile() file?: UploadedOrganizerFile,
  ) {
    return this.service.uploadBrandAsset(user, kind, file);
  }
  @Delete('assets/:kind') removeAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('kind') kind: 'logo' | 'profile' | 'banner',
  ) {
    return this.service.removeBrandAsset(user, kind);
  }
  @Post('reset') reset(@CurrentUser() user: AuthenticatedUser) {
    return this.service.resetBrand(user);
  }
  @Post('social-links') addSocial(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: SocialLinkDto,
  ) {
    return this.service.addSocial(user, data);
  }
  @Patch('social-links/:id') updateSocial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() data: SocialLinkDto,
  ) {
    return this.service.updateSocial(user, id, data);
  }
  @Delete('social-links/:id') deleteSocial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deleteSocial(user, id);
  }
  @Post('communities') addCommunity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: CommunityLinkDto,
  ) {
    return this.service.addCommunity(user, data);
  }
  @Patch('communities/:id') updateCommunity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() data: CommunityLinkDto,
  ) {
    return this.service.updateCommunity(user, id, data);
  }
  @Delete('communities/:id') deleteCommunity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deleteCommunity(user, id);
  }
  @Post('domains') addDomain(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: DomainDto,
  ) {
    return this.service.addDomain(user, data);
  }
  @Post('domains/:id/verify') verifyDomain(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.verifyDomain(user, id);
  }
  @Delete('domains/:id') deleteDomain(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deleteDomain(user, id);
  }
  @Post('templates') createTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: CampaignTemplateDto,
  ) {
    return this.service.createTemplate(user, data);
  }
  @Delete('templates/:id') deleteTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deleteTemplate(user, id);
  }
}

@Controller('organizers')
export class PublicOrganizerBrandController {
  constructor(private readonly service: OrganizerPlatformService) {}
  @Get(':organizerId/brand-assets/:kind')
  @Public()
  async asset(
    @Param('organizerId') organizerId: string,
    @Param('kind') kind: 'logo' | 'profile' | 'banner',
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.service.brandAsset(organizerId, kind);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(file.stream);
  }
}
