import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';
import { DrawsService } from './draws.service';

const user = {
  id: 'organizer-1',
  role: UserRole.ORGANIZER,
} as never;

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'campaign-1',
    organizerId: 'organizer-1',
    title: 'Campanha de homologação',
    totalNumbers: 100000,
    mainPrizeName: 'Prêmio principal',
    estimatedPrizeValue: 50000,
    unsoldNumberPolicy: 'NO_WINNER_MANUAL_REVIEW',
    drawDate: new Date('2026-07-20T12:00:00.000Z'),
    publishedRuleSnapshot: { version: 1 },
    drawRuleTemplate: null,
    customDrawRule: null,
    ...overrides,
  };
}

function soldTicket(number = 54873) {
  return {
    id: 'ticket-1',
    number,
    status: TicketStatus.SOLD,
    buyer: {
      id: 'buyer-1',
      name: 'Comprador Teste',
      email: 'buyer@example.invalid',
      phone: '75999990000',
      city: 'Feira de Santana',
      state: 'BA',
    },
    purchase: {
      id: 'purchase-1',
      status: 'PAID',
      createdAt: new Date('2026-07-19T12:00:00.000Z'),
      total: 100,
      payments: [
        {
          id: 'payment-1',
          status: 'APPROVED',
          method: 'PIX',
          approvedAt: new Date('2026-07-19T12:01:00.000Z'),
        },
      ],
    },
  };
}

describe('DrawsService winner lookup', () => {
  function setup() {
    const prisma = {
      campaign: { findUnique: jest.fn() },
      campaignDraw: { findUnique: jest.fn() },
      lotteryDraw: { findFirst: jest.fn() },
      ticket: { findFirst: jest.fn() },
      auditLog: { create: jest.fn(), findMany: jest.fn() },
    };
    const engine = { evaluate: jest.fn() };
    const service = new DrawsService(
      prisma as never,
      engine as never,
      {} as never,
    );
    return { prisma, engine, service };
  }

  it('consulta manualmente um título vendido sem criar resultado oficial', async () => {
    const { prisma, service } = setup();
    prisma.campaign.findUnique.mockResolvedValue(campaign());
    prisma.ticket.findFirst.mockResolvedValue(soldTicket());
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await service.lookupManualWinner(
      'campaign-1',
      user,
      '54873',
    );

    expect(result.winningNumber).toBe('54873');
    expect(result.buyer.name).toBe('Comprador Teste');
    expect(prisma.ticket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          campaignId: 'campaign-1',
          number: 54873,
          status: TicketStatus.SOLD,
        },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'WINNER_LOOKUP_MANUAL',
        actorUserId: 'organizer-1',
        newData: expect.objectContaining({ found: true }),
      }),
    });
    expect(prisma.campaignDraw.findUnique).not.toHaveBeenCalled();
  });

  it('audita consulta manual sem participante', async () => {
    const { prisma, service } = setup();
    prisma.campaign.findUnique.mockResolvedValue(campaign());
    prisma.ticket.findFirst.mockResolvedValue(null);
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    await expect(
      service.lookupManualWinner('campaign-1', user, '12345'),
    ).rejects.toThrow(
      new NotFoundException('Nenhum participante encontrado para este número.'),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'WINNER_LOOKUP_MANUAL',
        newData: expect.objectContaining({ found: false }),
      }),
    });
  });

  it('bloqueia organizador de outra campanha', async () => {
    const { prisma, service } = setup();
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({ organizerId: 'organizer-2' }),
    );

    await expect(
      service.lookupManualWinner('campaign-1', user, '54873'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.ticket.findFirst).not.toHaveBeenCalled();
  });

  it('calcula automaticamente com o motor publicado sem persistir sorteio', async () => {
    const { prisma, engine, service } = setup();
    prisma.campaign.findUnique.mockResolvedValue(campaign());
    prisma.campaignDraw.findUnique.mockResolvedValue(null);
    prisma.lotteryDraw.findFirst.mockResolvedValue({
      id: 'lottery-1',
      firstPrize: '12345',
      secondPrize: '23456',
      thirdPrize: '34567',
      fourthPrize: '45678',
      fifthPrize: '56789',
    });
    engine.evaluate.mockReturnValue({ normalizedResult: '54873' });
    prisma.ticket.findFirst.mockResolvedValue(soldTicket());
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

    const result = await service.lookupAutomaticWinner('campaign-1', user);

    expect(result.mode).toBe('AUTOMATIC');
    expect(result.winningNumber).toBe('54873');
    expect(engine.evaluate).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'WINNER_LOOKUP_AUTOMATIC',
        newData: expect.objectContaining({
          found: true,
          lotteryDrawId: 'lottery-1',
        }),
      }),
    });
  });
});
