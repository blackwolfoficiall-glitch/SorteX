import { Body, Controller, Param, Patch } from '@nestjs/common';
import { AdminPermission, UserRole } from '@prisma/client';
import { AdminPermissions } from '../auth/decorators/admin-permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { UpdateCommercialTermsDto } from './dto/update-commercial-terms.dto';
import { OrganizersService } from './organizers.service';

@Controller('admin/organizers')
@Roles(UserRole.ADMIN)
@AdminPermissions(AdminPermission.ORGANIZERS_REVIEW)
export class AdminOrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  @Patch(':userId/commercial-terms')
  @AdminPermissions(AdminPermission.FINANCE_WRITE)
  commercialTerms(
    @Param('userId') userId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() data: UpdateCommercialTermsDto,
  ) {
    return this.organizersService.updateCommercialTerms(userId, data, admin);
  }
}
