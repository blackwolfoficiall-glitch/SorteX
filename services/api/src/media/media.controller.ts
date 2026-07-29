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
} from '@nestjs/common';
import { GeneratedMediaStatus, UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  BrandProfileDto,
  CreateGeneratedMediaDto,
  CreateTemplateDto,
  ShareLinkDto,
  UpdateGeneratedMediaDto,
} from './dto/media.dto';
import { MediaService } from './media.service';
@Controller('media')
@Roles(UserRole.ORGANIZER)
export class MediaController {
  constructor(private readonly m: MediaService) {}
  @Get('templates') templates(@CurrentUser() u: AuthenticatedUser) {
    return this.m.templates(u);
  }
  @Post('templates') template(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateTemplateDto,
  ) {
    return this.m.createTemplate(u, d);
  }
  @Get('brand-profile') brand(@CurrentUser() u: AuthenticatedUser) {
    return this.m.brand(u);
  }
  @Patch('brand-profile') brandUpdate(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: BrandProfileDto,
  ) {
    return this.m.brandUpdate(u, d);
  }
  @Post('generated') create(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateGeneratedMediaDto,
  ) {
    return this.m.create(u, d);
  }
  @Get('generated/my') list(
    @CurrentUser() u: AuthenticatedUser,
    @Query('status') s?: GeneratedMediaStatus,
  ) {
    return this.m.list(u, s);
  }
  @Get('generated/:id') get(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.m.get(u, id);
  }
  @Patch('generated/:id') update(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: UpdateGeneratedMediaDto,
  ) {
    return this.m.update(u, id, d);
  }
  @Post('generated/:id/preview') preview(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.m.preview(u, id);
  }
  @Post('generated/:id/render') render(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.m.render(u, id);
  }
  @Post('generated/:id/duplicate') duplicate(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.m.duplicate(u, id);
  }
  @Post('generated/:id/share-link') share(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: ShareLinkDto,
  ) {
    return this.m.share(u, id, d);
  }
  @Delete('generated/:id') archive(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.m.archive(u, id);
  }
  @Post('render-jobs/:id/process') process(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.m.processJob(u, id);
  }
  @Get('generated/:id/file/:kind') async file(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const f = await this.m.file(u, id);
    res.setHeader('Content-Type', f.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${f.name}"`);
    f.stream.pipe(res);
  }
  @Post('winner-content/:winnerId') winner(
    @CurrentUser() u: AuthenticatedUser,
    @Param('winnerId') id: string,
  ) {
    return this.m.winnerContent(u, id);
  }
  @Post('campaign-content/:campaignId') campaign(
    @CurrentUser() u: AuthenticatedUser,
    @Param('campaignId') id: string,
  ) {
    return this.m.campaignContent(u, id);
  }
}
@Controller('share')
export class ShareController {
  constructor(private readonly m: MediaService) {}
  @Get(':code') @Public() click(
    @Param('code') code: string,
    @Query('visitor') v?: string,
  ) {
    return this.m.click(code, v);
  }
}
