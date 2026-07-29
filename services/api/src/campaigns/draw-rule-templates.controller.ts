import { Body, Controller, Get, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CampaignsService } from './campaigns.service';
import { CreateDrawRuleTemplateDto } from './dto/create-draw-rule-template.dto';
import { SimulateDrawRuleDto } from './dto/simulate-draw-rule.dto';

@Controller('draw-rule-templates')
@Roles(UserRole.ORGANIZER)
export class DrawRuleTemplatesController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.campaignsService.listRuleTemplates(user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() data: CreateDrawRuleTemplateDto,
  ) {
    return this.campaignsService.createRuleTemplate(user, data);
  }

  @Post('simulate')
  simulate(@Body() data: SimulateDrawRuleDto) {
    return this.campaignsService.simulateRule(data.ruleDefinition);
  }
}
