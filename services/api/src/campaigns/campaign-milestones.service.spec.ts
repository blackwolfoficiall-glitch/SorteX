import { BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import type { DrawRuleEngineService } from '../draws/draw-rule-engine.service';
import type { PrismaService } from '../prisma/prisma.service';
import { CampaignMilestonesService } from './campaign-milestones.service';

describe('CampaignMilestonesService', () => {
  const organizer: AuthenticatedUser = {
    id: 'organizer-1',
    name: 'Organizador Teste',
    email: 'organizer@sortex.test',
    phone: null,
    cpf: null,
    cnpj: null,
    role: UserRole.ORGANIZER,
    city: null,
    state: null,
    isActive: true,
    status: UserStatus.ACTIVE,
    adminPermissions: [],
    adminTeamRole: null,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    sessionId: 'session-1',
  };

  it('rejeita percentuais duplicados antes de alterar as metas', async () => {
    const campaignFindFirst = jest.fn().mockResolvedValue({ id: 'campaign-1' });
    const transaction = jest.fn();
    const prisma = {
      campaign: { findFirst: campaignFindFirst },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new CampaignMilestonesService(
      prisma,
      {} as DrawRuleEngineService,
    );

    await expect(
      service.save('campaign-1', organizer, {
        winnersRemainEligible: true,
        milestones: [
          { name: 'Moto', percentage: 30 },
          { name: 'Celular', percentage: 30 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('não expõe auditoria nem contagem elegível na consulta pública', async () => {
    const prisma = {
      campaign: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'campaign-1',
          milestoneWinnersRemainEligible: false,
        }),
      },
      campaignMilestonePrize: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'milestone-1',
            name: 'Moto',
            description: null,
            imageUrl: null,
            videoUrl: null,
            estimatedValue: null,
            percentage: 30,
            scheduledAt: null,
            notes: 'interno',
            status: 'WAITING',
            reachedAt: null,
            snapshotAt: null,
            eligibleTicketCount: 42,
            winningNumber: null,
            auditHash: 'segredo',
            winnerTicket: null,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new CampaignMilestonesService(
      prisma,
      {} as DrawRuleEngineService,
    );

    const result = await service.listPublic('campanha-teste');

    expect(result.winnersRemainEligible).toBe(false);
    expect(result.milestones[0]).not.toHaveProperty('notes');
    expect(result.milestones[0]).not.toHaveProperty('auditHash');
    expect(result.milestones[0]).not.toHaveProperty('eligibleTicketCount');
  });

  it('congela somente títulos pagos e vendidos quando a meta é alcançada', async () => {
    const createMany = jest
      .fn<Promise<{ count: number }>, [unknown]>()
      .mockResolvedValue({ count: 2 });
    const update = jest
      .fn<Promise<{ id: string }>, [unknown]>()
      .mockResolvedValue({ id: 'milestone-1' });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const ticketFindMany = jest
      .fn<
        Promise<
          Array<{
            id: string;
            buyerId: string;
            purchaseId: string;
            number: number;
          }>
        >,
        [unknown]
      >()
      .mockResolvedValue([
        {
          id: 'ticket-10',
          buyerId: 'buyer-1',
          purchaseId: 'purchase-1',
          number: 10,
        },
        {
          id: 'ticket-20',
          buyerId: 'buyer-2',
          purchaseId: 'purchase-2',
          number: 20,
        },
      ]);
    const tx = {
      campaign: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'campaign-1',
          totalNumbers: 100,
          soldNumbers: 30,
          milestoneWinnersRemainEligible: true,
          milestonePrizes: [
            {
              id: 'milestone-1',
              percentage: 30,
              scheduledAt: null,
            },
          ],
        }),
      },
      campaignMilestonePrize: {
        findMany: jest.fn(),
        update,
      },
      ticket: { findMany: ticketFindMany },
      campaignMilestoneEligibleTicket: { createMany },
      auditLog: { create: auditCreate },
    };
    const prisma = {
      $transaction: jest.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new CampaignMilestonesService(
      prisma,
      {} as DrawRuleEngineService,
    );

    await expect(service.evaluateReached('campaign-1')).resolves.toEqual([
      'milestone-1',
    ]);
    const ticketQuery = ticketFindMany.mock.calls[0]?.[0] as {
      where: {
        campaignId: string;
        status: string;
        purchase: { status: string };
      };
    };
    expect(ticketQuery.where).toMatchObject({
      campaignId: 'campaign-1',
      status: 'SOLD',
      purchase: { status: 'PAID' },
    });
    const snapshotCommand = createMany.mock.calls[0]?.[0] as {
      data: Array<{ milestoneId: string; ticketId: string; number: number }>;
      skipDuplicates: boolean;
    };
    expect(snapshotCommand.skipDuplicates).toBe(true);
    expect(snapshotCommand.data).toEqual(
      expect.arrayContaining([
        {
          milestoneId: 'milestone-1',
          ticketId: 'ticket-10',
          buyerId: 'buyer-1',
          purchaseId: 'purchase-1',
          number: 10,
          capturedAt: expect.any(Date) as Date,
        },
      ]),
    );
    const releaseCommand = update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: { status: string; eligibleTicketCount: number };
    };
    expect(releaseCommand.where).toEqual({ id: 'milestone-1' });
    expect(releaseCommand.data).toMatchObject({
      status: 'RELEASED',
      eligibleTicketCount: 2,
    });
    expect(auditCreate).toHaveBeenCalled();
  });
});
