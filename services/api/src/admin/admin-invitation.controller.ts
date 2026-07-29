import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AdminService } from './admin.service';
import { AcceptAdminInvitationDto } from './dto/admin.dto';

@Controller('admin/invitations')
export class AdminInvitationController {
  constructor(private readonly admin: AdminService) {}

  @Get(':token')
  @Public()
  invitation(@Param('token') token: string) {
    return this.admin.invitation(token);
  }

  @Post(':token/accept')
  @Public()
  accept(@Param('token') token: string, @Body() dto: AcceptAdminInvitationDto) {
    return this.admin.acceptInvitation(token, dto);
  }
}
