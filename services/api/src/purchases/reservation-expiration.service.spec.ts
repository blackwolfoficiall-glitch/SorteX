/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Test } from '@nestjs/testing';
import { PurchaseStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationExpirationService } from './reservation-expiration.service';
import { CrmSyncService } from '../crm/crm-sync.service';

describe('ReservationExpirationService', () => {
  it('expira compras, remove reservas e corrige o contador da campanha', async () => {
    const prisma: any = {
      purchase: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            campaignId: 'c1',
            buyerId: 'b1',
            quantity: 2,
            total: 10,
            createdAt: new Date(),
            expiresAt: new Date(),
            tickets: [],
            buyer: {
              name: 'Comprador',
              email: 'c@teste.com',
              phone: null,
              city: null,
              state: null,
            },
            campaign: {
              title: 'Campanha',
              slug: 'campanha',
              organizerId: 'o1',
              instantPrizes: [],
            },
          },
        ]),
        updateMany: jest.fn(),
      },
      ticket: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      campaign: {
        findUnique: jest.fn().mockResolvedValue({ reservedNumbers: 2 }),
        update: jest.fn(),
      },
      campaignInstantPrize: { updateMany: jest.fn() },
      auditLog: { upsert: jest.fn(), findMany: jest.fn() },
      notification: { upsert: jest.fn(), updateMany: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        ReservationExpirationService,
        {
          provide: CrmSyncService,
          useValue: { syncExpiredReservation: jest.fn().mockResolvedValue({}) },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const service = module.get(ReservationExpirationService);
    const result = await service.expireDueInTransaction(prisma, 'c1');
    expect(prisma.purchase.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: PurchaseStatus.EXPIRED } }),
    );
    expect(prisma.ticket.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: TicketStatus.RESERVED }),
      }),
    );
    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { reservedNumbers: 0 },
    });
    expect(result).toEqual({
      expiredPurchases: 1,
      releasedTickets: 2,
      returnedInstantPrizes: 0,
    });
  });

  it('notifica uma única vez quando a reserva expirada continha cota premiada', async () => {
    const prisma: any = {
      purchase: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p2',
            campaignId: 'c1',
            buyerId: 'b1',
            quantity: 1000,
            total: 20,
            createdAt: new Date('2026-07-19T12:00:00Z'),
            expiresAt: new Date('2026-07-19T12:15:00Z'),
            tickets: [{ number: 386228 }],
            buyer: {
              name: 'Herlen Ferreira',
              email: 'herlen@gmail.com',
              phone: '5575999992308',
              city: 'Feira de Santana',
              state: 'BA',
            },
            campaign: {
              title: 'Corolla ou 90 mil',
              slug: 'corolla-ou-90-mil',
              organizerId: 'o1',
              instantPrizes: [
                {
                  id: 'prize1',
                  exactNumber: '386228',
                  description: 'Vale Pix',
                  value: 100,
                },
              ],
            },
          },
        ]),
        updateMany: jest.fn(),
      },
      ticket: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      campaign: {
        findUnique: jest.fn().mockResolvedValue({ reservedNumbers: 1000 }),
        update: jest.fn(),
      },
      campaignInstantPrize: { updateMany: jest.fn() },
      auditLog: { upsert: jest.fn(), findMany: jest.fn() },
      notification: { upsert: jest.fn(), updateMany: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [
        ReservationExpirationService,
        {
          provide: CrmSyncService,
          useValue: { syncExpiredReservation: jest.fn() },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    const result = await module
      .get(ReservationExpirationService)
      .expireDueInTransaction(prisma, 'c1');
    expect(result.returnedInstantPrizes).toBe(1);
    expect(prisma.auditLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'expired-prize:p2:prize1' } }),
    );
    expect(prisma.notification.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.notification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'o1',
          title: '⚠️ Reserva expirada continha uma cota premiada',
        }),
      }),
    );
  });
});
