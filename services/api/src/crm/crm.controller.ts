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
import {
  AutomationStatus,
  CrmContactStatus,
  CrmTaskStatus,
  NotificationCategory,
  UserRole,
} from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CrmService } from './crm.service';
import { CrmSyncService } from './crm-sync.service';
import {
  ContactQueryDto,
  CreateAutomationDto,
  CreateCommunicationDto,
  CreateNoteDto,
  CreateSegmentDto,
  CreateTagDto,
  CreateTaskDto,
  CreateTemplateDto,
} from './dto/crm.dto';
@Controller()
export class CrmController {
  constructor(
    private readonly crm: CrmService,
    private readonly crmSync: CrmSyncService,
  ) {}
  @Get('crm/dashboard') @Roles(UserRole.ORGANIZER) dashboard(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.dashboard(u);
  }
  @Get('crm/contacts') @Roles(UserRole.ORGANIZER) contacts(
    @CurrentUser() u: AuthenticatedUser,
    @Query() q: ContactQueryDto,
  ) {
    return this.crm.contacts(u, q);
  }
  @Get('crm/contacts/:id') @Roles(UserRole.ORGANIZER) contact(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.contact(u, id);
  }
  @Patch('crm/contacts/:id/status') @Roles(UserRole.ORGANIZER) status(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: { status: CrmContactStatus },
  ) {
    return this.crm.status(u, id, d.status);
  }
  @Post('crm/contacts/:id/tags/:tagId') @Roles(UserRole.ORGANIZER) addTag(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.crm.addTag(u, id, tagId);
  }
  @Delete('crm/contacts/:id/tags/:tagId') @Roles(UserRole.ORGANIZER) removeTag(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Param('tagId') tagId: string,
  ) {
    return this.crm.removeTag(u, id, tagId);
  }
  @Post('crm/contacts/:id/notes') @Roles(UserRole.ORGANIZER) note(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: CreateNoteDto,
  ) {
    return this.crm.note(u, id, d);
  }
  @Get('crm/tags') @Roles(UserRole.ORGANIZER) tags(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.tags(u);
  }
  @Post('crm/tags') @Roles(UserRole.ORGANIZER) createTag(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateTagDto,
  ) {
    return this.crm.createTag(u, d);
  }
  @Patch('crm/tags/:id') @Roles(UserRole.ORGANIZER) updateTag(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: CreateTagDto,
  ) {
    return this.crm.updateTag(u, id, d);
  }
  @Delete('crm/tags/:id') @Roles(UserRole.ORGANIZER) deleteTag(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.deleteTag(u, id);
  }
  @Get('crm/segments') @Roles(UserRole.ORGANIZER) segments(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.segments(u);
  }
  @Post('crm/segments') @Roles(UserRole.ORGANIZER) segment(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateSegmentDto,
  ) {
    return this.crm.createSegment(u, d);
  }
  @Post('crm/segments/preview') @Roles(UserRole.ORGANIZER) previewSegment(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateSegmentDto,
  ) {
    return this.crm.previewSegment(u, d.rules);
  }
  @Post('crm/segments/:id/calculate') @Roles(UserRole.ORGANIZER) calculate(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.calculateSegment(u, id);
  }
  @Patch('crm/segments/:id') @Roles(UserRole.ORGANIZER) updateSegment(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: CreateSegmentDto,
  ) {
    return this.crm.updateSegment(u, id, d);
  }
  @Delete('crm/segments/:id') @Roles(UserRole.ORGANIZER) deleteSegment(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.deleteSegment(u, id);
  }
  @Get('crm/abandoned-reservations') @Roles(UserRole.ORGANIZER) abandoned(
    @CurrentUser() u: AuthenticatedUser,
    @Query() q: ContactQueryDto,
  ) {
    return this.crm.abandonedReservations(u, q);
  }
  @Get('crm/tasks') @Roles(UserRole.ORGANIZER) tasks(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.tasks(u);
  }
  @Post('crm/tasks') @Roles(UserRole.ORGANIZER) task(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateTaskDto,
  ) {
    return this.crm.createTask(u, d);
  }
  @Post('crm/tasks/:id/complete') @Roles(UserRole.ORGANIZER) complete(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.completeTask(u, id);
  }
  @Patch('crm/tasks/:id/status') @Roles(UserRole.ORGANIZER) taskStatus(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: { status: CrmTaskStatus },
  ) {
    return this.crm.taskStatus(u, id, d.status);
  }
  @Get('automations') @Roles(UserRole.ORGANIZER) automations(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.automations(u);
  }
  @Post('automations') @Roles(UserRole.ORGANIZER) automation(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateAutomationDto,
  ) {
    return this.crm.createAutomation(u, d);
  }
  @Post('automations/:id/test') @Roles(UserRole.ORGANIZER) testAutomation(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crmSync.testAutomation(u.id, id);
  }
  @Post('automations/:id/:status') @Roles(UserRole.ORGANIZER) automationStatus(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Param('status') status: AutomationStatus,
  ) {
    return this.crm.automationStatus(u, id, status);
  }
  @Get('message-templates') @Roles(UserRole.ORGANIZER) templates(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.templates(u);
  }
  @Post('message-templates') @Roles(UserRole.ORGANIZER) template(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateTemplateDto,
  ) {
    return this.crm.createTemplate(u, d);
  }
  @Patch('message-templates/:id') @Roles(UserRole.ORGANIZER) updateTemplate(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: CreateTemplateDto,
  ) {
    return this.crm.updateTemplate(u, id, d);
  }
  @Post('message-templates/:id/duplicate')
  @Roles(UserRole.ORGANIZER)
  duplicateTemplate(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.duplicateTemplate(u, id);
  }
  @Delete('message-templates/:id') @Roles(UserRole.ORGANIZER) deleteTemplate(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.deleteTemplate(u, id);
  }
  @Post('message-templates/:id/preview') @Roles(UserRole.ORGANIZER) preview(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
    @Body() d: { variables: Record<string, string> },
  ) {
    return this.crm.preview(u, id, d.variables || {});
  }
  @Get('outbound-messages') @Roles(UserRole.ORGANIZER) outbound(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.outbound(u);
  }
  @Post('outbound-messages/:id/simulate') @Roles(UserRole.ORGANIZER) simulate(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.simulateOutbound(u, id);
  }
  @Get('communications') @Roles(UserRole.ORGANIZER) communications(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.outbound(u);
  }
  @Post('communications/preview')
  @Roles(UserRole.ORGANIZER)
  communicationPreview(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateCommunicationDto,
  ) {
    return this.crm.communicationPreview(u, d);
  }
  @Post('communications') @Roles(UserRole.ORGANIZER) communication(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: CreateCommunicationDto,
  ) {
    return this.crm.createCommunication(u, d);
  }
  @Post('communications/:id/execute')
  @Roles(UserRole.ORGANIZER)
  executeCommunication(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.simulateOutbound(u, id);
  }
  @Post('communications/:id/cancel')
  @Roles(UserRole.ORGANIZER)
  cancelCommunication(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.cancelOutbound(u, id);
  }
  @Get('marketing-campaigns') @Roles(UserRole.ORGANIZER) marketing(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.marketing(u);
  }
  @Post('marketing-campaigns') @Roles(UserRole.ORGANIZER) createMarketing(
    @CurrentUser() u: AuthenticatedUser,
    @Body() d: any,
  ) {
    return this.crm.createMarketing(u, d);
  }
  @Post('marketing-campaigns/:id/simulate')
  @Roles(UserRole.ORGANIZER)
  simulateMarketing(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.simulateMarketing(u, id);
  }
  @Get('notifications') notifications(
    @CurrentUser() u: AuthenticatedUser,
    @Query('category') c?: NotificationCategory,
  ) {
    return this.crm.notifications(u, c);
  }
  @Post('notifications/read-all') readAll(@CurrentUser() u: AuthenticatedUser) {
    return this.crm.readAll(u);
  }
  @Post('notifications/:id/read') read(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.readNotification(u, id);
  }
  @Delete('notifications/:id') deleteNotification(
    @CurrentUser() u: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.crm.deleteNotification(u, id);
  }
  @Get('notification-preferences') preferences(
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.crm.preferences(u);
  }
  @Patch('notification-preferences/:category') preference(
    @CurrentUser() u: AuthenticatedUser,
    @Param('category') c: NotificationCategory,
    @Body() d: any,
  ) {
    return this.crm.preference(u, c, d);
  }
  @Get('crm/export/:format')
  @Roles(UserRole.ORGANIZER)
  @Header('Content-Type', 'text/plain; charset=utf-8')
  export(
    @CurrentUser() u: AuthenticatedUser,
    @Param('format') f: 'json' | 'csv',
  ) {
    return this.crm.export(u, f);
  }
}
