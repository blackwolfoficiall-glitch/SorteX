import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
@Injectable()
export class PlatformSettingsService {
  constructor(private readonly prisma: PrismaService) {}
  async get<T>(key: string, fallback: T): Promise<T> {
    const item = await this.prisma.platformSetting.findUnique({
      where: { key },
    });
    return item ? (item.value as T) : fallback;
  }
  list(category?: string) {
    return this.prisma.platformSetting.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }
  publicSettings() {
    return this.prisma.platformSetting.findMany({
      where: { isPublic: true },
      select: { key: true, value: true, category: true, updatedAt: true },
    });
  }
  async set(
    key: string,
    input: {
      value: Record<string, unknown>;
      category: string;
      description?: string;
      isPublic?: boolean;
    },
    user: AuthenticatedUser,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await tx.platformSetting.findUnique({ where: { key } });
      const setting = await tx.platformSetting.upsert({
        where: { key },
        create: {
          key,
          ...input,
          value: input.value as Prisma.InputJsonValue,
          updatedByUserId: user.id,
        },
        update: {
          ...input,
          value: input.value as Prisma.InputJsonValue,
          updatedByUserId: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'PlatformSetting',
          entityId: key,
          action: 'SETTING_UPDATED',
          actorUserId: user.id,
          actorRole: UserRole.ADMIN,
          previousData: previous as unknown as Prisma.InputJsonValue,
          newData: setting,
          metadata: { reason },
        },
      });
      return setting;
    });
  }
}
