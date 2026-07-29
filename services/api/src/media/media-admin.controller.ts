import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AdminPermission, MediaTemplateStatus, UserRole } from '@prisma/client';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/media.dto';
import { MediaService } from './media.service';
@Controller('admin/media')
@Roles(UserRole.ADMIN)
@AdminPermissions(AdminPermission.CONTENT_WRITE)
export class MediaAdminController {
  constructor(
    private readonly p: PrismaService,
    private readonly m: MediaService,
  ) {}
  @Get('overview') async overview() {
    const [templates, generated, failed, jobs, links] = await Promise.all([
      this.p.mediaTemplate.count(),
      this.p.generatedMedia.count(),
      this.p.generatedMedia.count({ where: { status: 'FAILED' } }),
      this.p.mediaRenderJob.count({
        where: { status: { in: ['QUEUED', 'PROCESSING'] } },
      }),
      this.p.shareLink.count(),
    ]);
    return { templates, generated, failed, jobs, links };
  }
  @Post('templates') template(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateTemplateDto,
  ) {
    return this.m.createTemplate(u, d, true);
  }
  @Post('templates/:id/deactivate') templateOff(@Param('id') id: string) {
    return this.p.mediaTemplate.update({
      where: { id },
      data: { status: MediaTemplateStatus.INACTIVE },
    });
  }
  @Get('failures') failures() {
    return this.p.generatedMedia.findMany({
      where: { status: 'FAILED' },
      select: {
        id: true,
        organizerId: true,
        type: true,
        errorMessage: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
