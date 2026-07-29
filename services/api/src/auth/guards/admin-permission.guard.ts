import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminPermission, AdminTeamRole, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ADMIN_PERMISSIONS_KEY } from '../decorators/admin-permissions.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';
import { effectiveAdminPermissions } from '../policies/admin-authorization.policy';
@Injectable()
export class AdminPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride<AdminPermission[]>(
      ADMIN_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (!user || user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Acesso administrativo obrigatório.');
    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { adminPermissions: true, adminTeamRole: true },
    });
    if (!record) throw new ForbiddenException();
    if (record.adminTeamRole === AdminTeamRole.SUPERADMIN) return true;
    const effective = effectiveAdminPermissions(
      record.adminTeamRole,
      record.adminPermissions,
    );
    if (effective.length === 0)
      throw new ForbiddenException(
        'Nenhuma permissão administrativa atribuída.',
      );
    if (!required.every((permission) => effective.includes(permission)))
      throw new ForbiddenException('Permissão administrativa insuficiente.');
    return true;
  }
}
