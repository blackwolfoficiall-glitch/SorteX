import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user.type';

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;

    if (!user || !roles.includes(user.role)) {
      throw new ForbiddenException('Você não possui permissão para esta ação.');
    }

    if (
      roles.includes(UserRole.ADMIN) &&
      user.role === UserRole.ADMIN &&
      !user.adminTeamRole
    ) {
      throw new ForbiddenException(
        'Esta conta não possui acesso administrativo.',
      );
    }

    return true;
  }
}
