import { HEADERS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import {
  AdminInvitationStatus,
  AdminPermission,
  AdminTeamRole,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { ADMIN_PERMISSIONS_KEY } from '../auth/decorators/admin-permissions.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

describe('admin team directory response', () => {
  it('keeps existing permissions and disables caching without changing the route', () => {
    const handler: unknown = Object.getOwnPropertyDescriptor(
      AdminController.prototype,
      'team',
    )?.value;
    if (typeof handler !== 'function') throw new Error('Missing team handler');
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('team');
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual([
      UserRole.ADMIN,
    ]);
    expect(Reflect.getMetadata(ADMIN_PERMISSIONS_KEY, handler)).toEqual([
      AdminPermission.USERS_READ,
    ]);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBeUndefined();
    expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({
      name: 'Cache-Control',
      value: 'private, no-store',
    });
  });

  it('retains directory fields and expiry/summary without selecting or echoing invitation internals', async () => {
    const expiresAt = new Date('2026-11-30T18:00:00.000Z');
    const display = {
      id: 'synthetic-invite',
      name: 'Convidado fictício',
      email: 'invite@example.test',
      role: AdminTeamRole.SUPPORT,
      status: AdminInvitationStatus.PENDING,
      expiresAt,
      invitedBy: { name: 'Responsável fictício' },
    };
    const record = {
      ...display,
      tokenHash: 'synthetic-not-a-real-hash',
      permissions: [AdminPermission.USERS_READ],
      message: 'synthetic internal note',
      invitedById: 'synthetic-actor',
      acceptedUserId: 'synthetic-user',
      acceptedAt: null,
      cancelledAt: null,
      createdAt: expiresAt,
      updatedAt: expiresAt,
      invitedBy: { ...display.invitedBy, id: 'synthetic-actor' },
    };
    const expiredDisplay = {
      ...display,
      id: 'synthetic-expired',
      status: AdminInvitationStatus.EXPIRED,
    };
    const member = {
      id: 'synthetic-member',
      name: 'Membro fictício',
      email: 'member@example.test',
      adminTeamRole: AdminTeamRole.SUPPORT,
      adminPermissions: [AdminPermission.USERS_READ],
      status: UserStatus.ACTIVE,
      isActive: true,
      lastAccessAt: null,
      createdAt: expiresAt,
    };
    const secondMember = {
      ...member,
      id: 'synthetic-inactive',
      status: UserStatus.INACTIVE,
      isActive: false,
    };
    let maintenanceCompleted = false;
    const updateMany = jest.fn(() =>
      Promise.resolve().then(() => {
        maintenanceCompleted = true;
        return { count: 1 };
      }),
    );
    const findInvitations = jest.fn(() => {
      expect(maintenanceCompleted).toBe(true);
      return Promise.resolve([record, { ...record, ...expiredDisplay }]);
    });
    const findMembers = jest.fn().mockResolvedValue([member, secondMember]);
    const service = new AdminService({
      user: { findMany: findMembers },
      adminTeamInvitation: { updateMany, findMany: findInvitations },
    } as unknown as PrismaService);

    await expect(service.team()).resolves.toEqual({
      members: [member, secondMember],
      invitations: [display, expiredDisplay],
      summary: { total: 2, active: 1, pending: 1, inactive: 1 },
    });
    expect(updateMany).toHaveBeenCalledTimes(1);
    const expiryCutoff: unknown = expect.any(Date);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        status: AdminInvitationStatus.PENDING,
        expiresAt: { lte: expiryCutoff },
      },
      data: { status: AdminInvitationStatus.EXPIRED },
    });
    expect(findInvitations).toHaveBeenCalledWith({
      where: {
        status: {
          in: [AdminInvitationStatus.PENDING, AdminInvitationStatus.EXPIRED],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
});
