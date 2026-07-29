import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CampaignStatus,
  UserRole,
  UserStatus,
  VerificationStatus,
} from '@prisma/client';
import { AdminService } from './admin.service';
const admin: any = { id: 'admin', role: UserRole.ADMIN };
describe('AdminService', () => {
  let prisma: any;
  let service: AdminService;
  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      authSession: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
      campaign: { findUnique: jest.fn(), update: jest.fn() },
      notification: { create: jest.fn() },
      organizerProfile: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      organizerReviewDecision: {
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };
    service = new AdminService(prisma);
  });
  it('bloqueia auto suspensão do administrador', async () => {
    await expect(
      service.userAction(
        'admin',
        { action: 'SUSPEND', reason: 'motivo operacional' },
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it('suspende usuário sem exclusão física e registra auditoria', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'buyer',
      status: UserStatus.ACTIVE,
    });
    await service.userAction(
      'buyer',
      { action: 'SUSPEND', reason: 'violação confirmada' },
      admin,
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'buyer' },
        data: { status: UserStatus.SUSPENDED, isActive: false },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
  it('revoga todas as sessões ativas', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'buyer' });
    await service.userAction(
      'buyer',
      { action: 'REVOKE_SESSIONS', reason: 'segurança da conta' },
      admin,
    );
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'buyer', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
  it('aprova campanha pendente com auditoria e notificação', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'c',
      status: CampaignStatus.PENDING_REVIEW,
      organizerId: 'o',
      title: 'Rifa',
      publishedAt: null,
    });
    prisma.campaign.update.mockResolvedValue({
      id: 'c',
      status: CampaignStatus.PUBLISHED,
    });
    await service.campaignAction(
      'c',
      { action: 'APPROVE', reason: 'documentação revisada' },
      admin,
    );
    expect(prisma.campaign.update).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
  it('não aprova campanha fora da revisão', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'c',
      status: CampaignStatus.DRAFT,
    });
    await expect(
      service.campaignAction(
        'c',
        { action: 'APPROVE', reason: 'tentativa inválida' },
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
  });
  it('rejeita recurso inexistente', async () => {
    prisma.campaign.findUnique.mockResolvedValue(null);
    await expect(
      service.campaignAction(
        'missing',
        { action: 'PAUSE', reason: 'ação administrativa' },
        admin,
      ),
    ).rejects.toThrow(NotFoundException);
  });
  it('limita a fila aos estados operacionais quando nenhum status é informado', async () => {
    await service.approvals({ page: 1, limit: 25 });
    expect(prisma.organizerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationStatus: {
            in: [
              VerificationStatus.PENDING,
              VerificationStatus.UNDER_REVIEW,
              VerificationStatus.CORRECTION_REQUESTED,
              VerificationStatus.DOCUMENT_REQUESTED,
            ],
          },
        }),
      }),
    );
  });
  it('lista todos os estados na central e pesquisa telefone', async () => {
    await service.organizers({
      page: 1,
      limit: 25,
      search: '71999999999',
    });
    const query = prisma.organizerProfile.findMany.mock.calls[0][0];
    expect(query.where.verificationStatus).toBeUndefined();
    expect(query.where.OR).toEqual(
      expect.arrayContaining([
        { phone: { contains: '71999999999' } },
        { user: { phone: { contains: '71999999999' } } },
      ]),
    );
  });
  it('aplica período e prioridade na fila', async () => {
    await service.approvals({
      page: 1,
      limit: 25,
      from: '2026-07-01T00:00:00.000Z',
      to: '2026-07-31T23:59:59.000Z',
      sort: 'priority',
    });
    expect(prisma.organizerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date('2026-07-01T00:00:00.000Z'),
            lte: new Date('2026-07-31T23:59:59.000Z'),
          },
        }),
        orderBy: [{ riskScore: 'desc' }, { createdAt: 'asc' }],
      }),
    );
  });
});
