import { RouletteService } from './roulette.service';

const configuration = {
  roulette: {
    enabled: true,
    name: 'Roleta de teste',
    rules: [{ id: 'r1', minQuantity: 100, rounds: 2 }],
    items: [
      {
        id: 'i1',
        name: 'Pix',
        type: 'PIX',
        quantity: 3,
        probability: 100,
        isActive: true,
      },
    ],
  },
};

describe('RouletteService', () => {
  it('calcula rodadas apenas a partir de compras pagas', async () => {
    const prisma = {
      campaign: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'c1',
          title: 'Campanha',
          slug: 'campanha',
          organizerId: 'o1',
          customization: { configuration },
        }),
      },
      purchase: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', quantity: 100 }]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            metadata: { itemName: 'Pix', isPrize: true },
            createdAt: new Date(),
          },
        ]),
      },
    };
    const result = await new RouletteService(prisma as never).buyerStatus(
      'c1',
      'b1',
    );
    expect(result.totalRounds).toBe(2);
    expect(result.usedRounds).toBe(1);
    expect(result.availableRounds).toBe(1);
  });

  it('decide e registra o resultado no backend', async () => {
    const tx = {
      campaign: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'c1', customization: { configuration } }),
      },
      purchase: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', quantity: 100 }]),
      },
      auditLog: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...data, createdAt: new Date() }),
          ),
      },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const result = await new RouletteService(prisma as never).spin('c1', 'b1');
    expect(result.result.itemName).toBe('Pix');
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ROULETTE_SPIN',
          actorUserId: 'b1',
        }),
      }),
    );
  });
});
