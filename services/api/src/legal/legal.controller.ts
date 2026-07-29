import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Ip,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdminPermission, UserRole } from '@prisma/client';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { OrganizerStorageService } from '../organizers/organizer-storage.service';
import type { UploadedOrganizerFile } from '../organizers/types/uploaded-file.type';
import {
  DataSubjectRequestDto,
  LegalStatusDto,
  ListLegalDocumentsDto,
  RestoreLegalVersionDto,
  SaveLegalDocumentDto,
} from './legal.dto';
import { LegalService } from './legal.service';

@Controller('legal/public')
@Public()
export class LegalPublicController {
  constructor(private readonly legal: LegalService) {}
  @Get() list() {
    return this.legal.published();
  }
  @Get(':slug') get(@Param('slug') slug: string) {
    return this.legal.publishedBySlug(slug);
  }
}

@Controller('legal')
export class LegalController {
  constructor(private readonly legal: LegalService) {}
  @Get('acceptances/me') mine(@CurrentUser() user: AuthenticatedUser) {
    return this.legal.myAcceptances(user);
  }
  @Get('pending') pending(@CurrentUser() user: AuthenticatedUser) {
    return this.legal.pending(user);
  }
  @Post(':slug/accept') accept(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') agent?: string,
  ) {
    return this.legal.accept(slug, user, { ip, userAgent: agent });
  }
  @Get('data-requests/me') requests(@CurrentUser() user: AuthenticatedUser) {
    return this.legal.myDataRequests(user);
  }
  @Post('data-requests') request(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DataSubjectRequestDto,
  ) {
    return this.legal.dataRequest(user, dto);
  }
}

@Controller('admin/legal')
@Roles(UserRole.ADMIN)
@AdminPermissions(AdminPermission.SETTINGS_WRITE)
export class LegalAdminController {
  constructor(
    private readonly legal: LegalService,
    private readonly storage: OrganizerStorageService,
  ) {}
  @Get() list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListLegalDocumentsDto,
  ) {
    return this.legal.adminList(user, query);
  }
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveLegalDocumentDto,
  ) {
    return this.legal.create(user, dto);
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.legal.get(id);
  }
  @Put(':id') update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveLegalDocumentDto,
  ) {
    return this.legal.update(id, user, dto);
  }
  @Delete(':id') remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.legal.remove(id, user);
  }
  @Post(':id/duplicate') duplicate(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.legal.duplicate(id, user);
  }
  @Post(':id/publish') publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LegalStatusDto,
  ) {
    return this.legal.publish(id, user, dto.changeSummary);
  }
  @Post(':id/archive') archive(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.legal.archive(id, user);
  }
  @Get(':id/history') history(@Param('id') id: string) {
    return this.legal.history(id);
  }
  @Post(':id/restore') restore(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RestoreLegalVersionDto,
  ) {
    return this.legal.restore(id, dto.version, user);
  }
  @Get(':id/acceptances') acceptances(@Param('id') id: string) {
    return this.legal.acceptances(id);
  }
  @Get(':id/pending-users') pending(@Param('id') id: string) {
    return this.legal.pendingUsers(id);
  }
  @Get(':id/pdf')
  @Header('Content-Type', 'application/pdf')
  @Header(
    'Content-Disposition',
    'attachment; filename="documento-juridico.pdf"',
  )
  async pdf(@Param('id') id: string) {
    return new StreamableFile(await this.legal.pdf(id));
  }
  @Post('assets')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedOrganizerFile,
  ) {
    const saved = await this.storage.save(`legal-${user.id}`, file, {
      maxSize: 5 * 1024 * 1024,
      allowedMimeTypes: {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      },
    });
    return {
      url: `/api/legal/admin/assets/file/${Buffer.from(saved.storageKey).toString('base64url')}`,
    };
  }
  @Get('assets/file/:token')
  asset(
    @Param('token') token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const key = Buffer.from(token, 'base64url').toString('utf8');
    response.type(this.storage.mimeType(key));
    return new StreamableFile(this.legal.asset(this.storage.resolve(key)));
  }
}
