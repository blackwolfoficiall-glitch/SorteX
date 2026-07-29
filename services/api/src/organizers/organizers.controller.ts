import {
  Body,
  Controller,
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
import { UpdateOrganizerProfileDto } from './dto/update-organizer-profile.dto';
import { UpdateOrganizerAccountDto } from './dto/update-organizer-account.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { OrganizersService } from './organizers.service';
import type { UploadedOrganizerFile } from './types/uploaded-file.type';

const uploadOptions = { limits: { fileSize: 10 * 1024 * 1024, files: 1 } };

@Controller('organizers')
export class OrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  @Get('me/profile')
  @Roles(UserRole.ORGANIZER)
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.organizersService.getMyProfile(user);
  }

  @Patch('me/profile')
  @Roles(UserRole.ORGANIZER)
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: UpdateOrganizerProfileDto,
  ) {
    return this.organizersService.updateMyProfile(user, data);
  }
  @Patch('me/account')
  @Roles(UserRole.ORGANIZER)
  updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: UpdateOrganizerAccountDto,
  ) {
    return this.organizersService.updateMyAccount(user, data);
  }

  @Post('me/logo')
  @Roles(UserRole.ORGANIZER)
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadLogo(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedOrganizerFile,
  ) {
    return this.organizersService.uploadLogo(user, file);
  }

  @Post('me/documents')
  @Roles(UserRole.ORGANIZER)
  @UseInterceptors(FileInterceptor('file', uploadOptions))
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: UploadDocumentDto,
    @UploadedFile() file?: UploadedOrganizerFile,
  ) {
    return this.organizersService.uploadDocument(user, data.type, file);
  }

  @Post('me/submit')
  @Roles(UserRole.ORGANIZER)
  submit(@CurrentUser() user: AuthenticatedUser) {
    return this.organizersService.submit(user);
  }

  @Get('documents/:documentId/file')
  async documentFile(
    @Param('documentId') documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.organizersService.getDocumentFile(documentId, user);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.name)}"`,
    );
    return new StreamableFile(file.stream);
  }

  @Get(':userId/logo')
  @Public()
  async logo(
    @Param('userId') userId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const file = await this.organizersService.getLogoFile(userId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(file.stream);
  }
}
