/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CampaignStatus,
  NumberSelectionMode,
  Prisma,
  PurchaseStatus,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PurchasesService } from './purchases.service';
import { ReservationExpirationService } from './reservation-expiration.service';
import { CrmSyncService } from '../crm/crm-sync.service';

const buyer = {
  id: 'buyer-1',
  name: 'Comprador',
  email: 'buyer@sortex.test',
  phone: null,
  cpf: '12345678900',
  cnpj: null,
  role: UserRole.BUYER,
  city: null,
  state: null,
  isActive: true,
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  sessionId: 'session-1',
};
const admin = {
  ...buyer,
  id: 'admin-1',
  email: 'admin@sortex.test',
  role: UserRole.ADMIN,
};
const organizer = {
  ...buyer,
  id: 'organizer-1',
  email: 'organizer@sortex.test',
  role: UserRole.ORGANIZER,
};
const campaign = (overrides: Record<string, unknown> = {}) => ({
  id: 'campaign-1',
  organizerId: 'organizer-1',
  title: 'Corolla',
  slug: 'corolla',
  status: CampaignStatus.PUBLISHED,
  totalNumbers: 10000,
  numberPrice: new Prisma.Decimal(0.1),
  minimumPurchase: 2,
  maximumPurchasePerBuyer: 1000,
  numberSelectionMode: NumberSelectionMode.RANDOM,
  salesStartAt: new Date('2026-01-01'),
  salesEndAt: new Date('2027-12-01'),
  drawDate: new Date('2027-12-20'),
  reservedNumbers: 0,
  soldNumbers: 0,
  promotions: [],
  purchasesBlocked: false,
  organizer: {
    organizerProfile: {
      paymentsBlocked: false,
      verificationStatus: 'VERIFIED',
    },
  },
  ...overrides,
});
const purchase = (overrides: Record<string, unknown> = {}) => ({
  id: 'purchase-1',
  buyerId: buyer.id,
  campaignId: 'campaign-1',
  promotionId: null,
  status: PurchaseStatus.AWAITING_PAYMENT,
  selectionMode: NumberSelectionMode.RANDOM,
  quantity: 2,
  unitPrice: new Prisma.Decimal(0.1),
  subtotal: new Prisma.Decimal(0.2),
  discount: new Prisma.Decimal(0),
  total: new Prisma.Decimal(0.2),
  expiresAt: new Date(Date.now() + 900000),
  confirmedAt: null,
  cancelledAt: null,
  idempotencyKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  campaign: {
    id: 'campaign-1',
    slug: 'corolla',
    title: 'Corolla',
    coverImage: null,
    organizerId: 'organizer-1',
  },
  promotion: null,
  tickets: [
    {
      id: 'ticket-1',
      purchaseId: 'purchase-1',
      campaignId: 'campaign-1',
      buyerId: buyer.id,
      number: 10,
      status: TicketStatus.RESERVED,
      reservedUntil: new Date(Date.now() + 900000),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  ...overrides,
});

describe('PurchasesService', () => {
  let service: PurchasesService;
  let prisma: any;
  let expiration: any;

  beforeEach(async () => {
    prisma = {
      campaign: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      campaignPromotion: { findMany: jest.fn(), update: jest.fn() },
      promotionUsage: { create: jest.fn(), count: jest.fn() },
      promotionCoupon: { findFirst: jest.fn(), update: jest.fn() },
      purchase: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      ticket: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) =>
        Array.isArray(callback) ? Promise.all(callback) : callback(prisma),
      ),
    };
    expiration = {
      expireDue: jest.fn().mockResolvedValue({}),
      expireDueInTransaction: jest.fn().mockResolvedValue({}),
    };
    const module = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReservationExpirationService, useValue: expiration },
        {
          provide: CrmSyncService,
          useValue: { syncReservation: jest.fn().mockResolvedValue({}) },
        },
      ],
    }).compile();
    service = module.get(PurchasesService);
  });

  it('reserva números aleatórios e calcula valores no backend', async () => {
    prisma.campaign.findUnique.mockResolvedValue(campaign());
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.purchase.create.mockResolvedValue(purchase());
    prisma.purchase.findUniqueOrThrow.mockResolvedValue(
      purchase({
        tickets: [
          { ...purchase().tickets[0], number: 10 },
          { ...purchase().tickets[0], id: 'ticket-2', number: 20 },
        ],
      }),
    );
    prisma.campaign.update.mockResolvedValue(campaign({ reservedNumbers: 2 }));
    const result = await service.reserveRandom(buyer, {
      campaignId: 'campaign-1',
      quantity: 2,
    });
    expect(result.status).toBe(PurchaseStatus.AWAITING_PAYMENT);
    expect(prisma.ticket.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ status: TicketStatus.RESERVED }),
        ]),
      }),
    );
    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reservedNumbers: { increment: 2 } } }),
    );
  });

  it('permite que um administrador autenticado reserve títulos', async () => {
    prisma.campaign.findUnique.mockResolvedValue(campaign());
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.purchase.create.mockResolvedValue(purchase({ buyerId: admin.id }));
    prisma.purchase.findUniqueOrThrow.mockResolvedValue(
      purchase({ buyerId: admin.id }),
    );
    prisma.campaign.update.mockResolvedValue(campaign({ reservedNumbers: 2 }));

    await expect(
      service.reserveRandom(admin, {
        campaignId: 'campaign-1',
        quantity: 2,
      }),
    ).resolves.toMatchObject({ status: PurchaseStatus.AWAITING_PAYMENT });
  });

  it('impede que organizador use a compra pública', async () => {
    await expect(
      service.reserveRandom(organizer, {
        campaignId: 'campaign-1',
        quantity: 2,
      }),
    ).rejects.toThrow('Apenas compradores podem reservar títulos.');
    expect(prisma.campaign.findUnique).not.toHaveBeenCalled();
  });

  it('reserva seleção manual somente após revalidar os números', async () => {
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({ numberSelectionMode: NumberSelectionMode.MANUAL }),
    );
    prisma.purchase.create.mockResolvedValue(purchase());
    prisma.purchase.findUniqueOrThrow.mockResolvedValue(
      purchase({ selectionMode: NumberSelectionMode.MANUAL }),
    );
    prisma.campaign.update.mockResolvedValue(campaign());
    await service.reserveManual(buyer, {
      campaignId: 'campaign-1',
      numbers: [10, 20],
    });
    expect(prisma.ticket.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ number: 10 }),
          expect.objectContaining({ number: 20 }),
        ]),
      }),
    );
  });

  it('rejeita número manual duplicado', () => {
    expect(() =>
      service.reserveManual(buyer, {
        campaignId: 'campaign-1',
        numbers: [10, 10],
      }),
    ).toThrow(BadRequestException);
  });

  it.each([
    [CampaignStatus.PAUSED, 'pausada'],
    [CampaignStatus.CANCELLED, 'cancelada'],
  ])('rejeita campanha %s', async (status) => {
    prisma.campaign.findUnique.mockResolvedValue(campaign({ status }));
    await expect(
      service.reserveRandom(buyer, { campaignId: 'campaign-1', quantity: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aplica promoção ativa e calcula desconto', async () => {
    const promotion = {
      id: 'promo-1',
      numberQuantity: 10,
      packagePrice: new Prisma.Decimal(0.7),
      isActive: true,
      startsAt: null,
      endsAt: null,
    };
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({ minimumPurchase: 1, promotions: [promotion] }),
    );
    prisma.ticket.findMany.mockResolvedValue([]);
    prisma.purchase.create.mockResolvedValue(purchase());
    prisma.purchase.findUniqueOrThrow.mockResolvedValue(
      purchase({
        quantity: 10,
        subtotal: new Prisma.Decimal(1),
        discount: new Prisma.Decimal(0.3),
        total: new Prisma.Decimal(0.7),
        promotionId: 'promo-1',
      }),
    );
    prisma.campaign.update.mockResolvedValue(campaign());
    const result = await service.reserveRandom(buyer, {
      campaignId: 'campaign-1',
      quantity: 10,
      promotionId: 'promo-1',
    });
    expect(result.discount).toBe(0.3);
    expect(result.total).toBe(0.7);
  });

  it('rejeita promoção inativa', async () => {
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({
        promotions: [
          {
            id: 'promo-1',
            numberQuantity: 2,
            packagePrice: new Prisma.Decimal(0.1),
            isActive: false,
            startsAt: null,
            endsAt: null,
          },
        ],
      }),
    );
    await expect(
      service.reserveRandom(buyer, {
        campaignId: 'campaign-1',
        quantity: 2,
        promotionId: 'promo-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('valida compra mínima e máxima', async () => {
    prisma.campaign.findUnique.mockResolvedValue(campaign());
    await expect(
      service.reserveRandom(buyer, { campaignId: 'campaign-1', quantity: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.reserveRandom(buyer, {
        campaignId: 'campaign-1',
        quantity: 1001,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancela e libera os títulos reservados', async () => {
    prisma.purchase.findFirst.mockResolvedValue(purchase());
    prisma.ticket.deleteMany.mockResolvedValue({ count: 1 });
    prisma.campaign.findUnique.mockResolvedValue({ reservedNumbers: 1 });
    prisma.campaign.update.mockResolvedValue({});
    prisma.purchase.update.mockResolvedValue(
      purchase({ status: PurchaseStatus.CANCELLED, tickets: [] }),
    );
    const result = await service.cancel('purchase-1', buyer);
    expect(result.status).toBe(PurchaseStatus.CANCELLED);
    expect(prisma.ticket.deleteMany).toHaveBeenCalled();
  });

  it('lista somente compras do comprador autenticado', async () => {
    prisma.purchase.findMany.mockResolvedValue([purchase()]);
    const result = await service.listMine(buyer);
    expect(prisma.purchase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { buyerId: buyer.id } }),
    );
    expect(result).toHaveLength(1);
  });

  it('bloqueia perfil que não seja BUYER', async () => {
    await expect(
      service.reserveRandom(
        { ...buyer, role: UserRole.ORGANIZER },
        { campaignId: 'campaign-1', quantity: 2 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reconhece conflito de índice único e serialização concorrente', () => {
    const error = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    expect((service as any).isConcurrencyError(error)).toBe(true);
  });

  it('pagina disponibilidade sem materializar todos os números', async () => {
    prisma.campaign.findFirst.mockResolvedValue(
      campaign({ numberSelectionMode: NumberSelectionMode.MANUAL }),
    );
    prisma.ticket.findMany.mockResolvedValue([
      { number: 101, status: TicketStatus.RESERVED },
    ]);
    const result = await service.listNumbers('corolla', {
      page: 2,
      limit: 100,
    });
    expect(result.items).toHaveLength(100);
    expect(result.items.find((item) => item.number === 101)?.status).toBe(
      TicketStatus.RESERVED,
    );
    expect(result.total).toBe(10000);
  });

  it('traduz conflito final em ConflictException', async () => {
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );
    await expect(
      service.reserveManual(buyer, {
        campaignId: 'campaign-1',
        numbers: [1, 2],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
