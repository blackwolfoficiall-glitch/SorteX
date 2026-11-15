import { OrganizerPlatformService } from './organizer-platform.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizerStorageService } from '../organizers/organizer-storage.service';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

describe('Organizer dashboard recorded sales', () => {
  const user = { id: 'owner', role: UserRole.ORGANIZER } as AuthenticatedUser;
  function setup(history: unknown[]) {
    const prisma = {
      campaign: { findMany: jest.fn().mockResolvedValue([]) },
      purchase: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { total: 117, quantity: 117 },
          _count: { id: 3 },
        }),
        groupBy: jest
          .fn()
          .mockImplementation((args: { by: string[] }) =>
            Promise.resolve(
              args.by[0] === 'buyerId' ? [{ buyerId: 'buyer' }] : history,
            ),
          ),
      },
    };
    return {
      prisma,
      service: new OrganizerPlatformService(
        prisma as unknown as PrismaService,
        {} as OrganizerStorageService,
      ),
    };
  }
  it('combines confirmed timestamps into sorted daily UTC revenue and keeps participant uniqueness', async () => {
    const { service, prisma } = setup([
      { confirmedAt: new Date('2026-11-14T15:00:00Z'), _sum: { total: 39 } },
      { confirmedAt: new Date('2026-11-13T15:00:00Z'), _sum: { total: 39 } },
      { confirmedAt: new Date('2026-11-14T18:00:00Z'), _sum: { total: 39 } },
    ]);
    const result = await service.dashboard(user);
    expect(result.revenueHistory).toEqual([
      { date: '2026-11-13', revenue: 39 },
      { date: '2026-11-14', revenue: 78 },
    ]);
    expect(result.summary.participants).toBe(1);
    expect(result.summary.averageTicket).toBe(39);
    expect(prisma.purchase.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['confirmedAt'],
        where: expect.objectContaining({
          status: 'PAID',
          campaign: { organizerId: 'owner' },
          confirmedAt: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });
  it('does not create an illustrative curve when no sales exist', async () => {
    const { service } = setup([]);
    expect((await service.dashboard(user)).revenueHistory).toEqual([]);
  });
  it('rejects a buyer without querying organizer data', async () => {
    const { service, prisma } = setup([]);
    await expect(
      service.dashboard({ ...user, role: UserRole.BUYER }),
    ).rejects.toThrow('Acesso exclusivo');
    expect(prisma.campaign.findMany).not.toHaveBeenCalled();
  });
});
