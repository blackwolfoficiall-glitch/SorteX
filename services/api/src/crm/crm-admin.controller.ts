import { Controller, Get } from '@nestjs/common';
import { AdminPermission, UserRole } from '@prisma/client';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
@Controller('admin/crm')
@Roles(UserRole.ADMIN)
@AdminPermissions(AdminPermission.AUDIT_READ)
export class CrmAdminController {
  constructor(private readonly p: PrismaService) {}
  @Get('overview') async overview() {
    const [contacts, automations, campaigns, queued, failed] =
      await Promise.all([
        this.p.crmContact.count(),
        this.p.automation.count({ where: { status: 'ACTIVE' } }),
        this.p.marketingCampaign.count(),
        this.p.outboundMessage.count({ where: { status: 'QUEUED' } }),
        this.p.outboundMessage.count({ where: { status: 'FAILED' } }),
      ]);
    return { contacts, automations, campaigns, queued, failed };
  }
  @Get('failures') failures() {
    return this.p.outboundMessage.findMany({
      where: { status: { in: ['FAILED', 'SKIPPED'] } },
      select: {
        id: true,
        organizerId: true,
        channel: true,
        status: true,
        failureReason: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
