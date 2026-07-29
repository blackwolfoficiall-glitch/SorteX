import { PaymentStatus, Prisma } from '@prisma/client';
import { CrmSyncService } from './crm-sync.service';
describe('CrmSyncService', () => {
  const service = new CrmSyncService();
  const payment = {
    id: 'pay1',
    status: PaymentStatus.APPROVED,
    organizerId: 'org1',
    buyerId: 'buyer1',
    campaignId: 'camp1',
    purchaseId: 'purchase1',
    amount: new Prisma.Decimal(100),
    approvedAt: new Date(),
    purchase: { quantity: 10, affiliateCode: null },
    buyer: {
      name: 'Maria',
      email: 'maria@example.com',
      phone: '71999999999',
      city: 'Salvador',
      state: 'BA',
    },
    campaign: { title: 'Campanha' },
  };
  function tx() {
    return {
      payment: { findUnique: jest.fn().mockResolvedValue(payment) },
      crmInteraction: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      crmContact: { upsert: jest.fn().mockResolvedValue({ id: 'contact1' }) },
      notification: { create: jest.fn() },
      automation: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn() },
    } as any;
  }
  it('sincroniza contato e interação de pagamento', async () => {
    const db = tx();
    expect(await service.syncApprovedPayment(db, 'pay1')).toEqual({
      contactId: 'contact1',
    });
    expect(db.crmContact.upsert).toHaveBeenCalled();
    expect(db.crmInteraction.create).toHaveBeenCalled();
    expect(db.notification.create).toHaveBeenCalled();
  });
  it('é idempotente por pagamento', async () => {
    const db = tx();
    db.crmInteraction.findFirst.mockResolvedValue({ id: 'existing' });
    expect(await service.syncApprovedPayment(db, 'pay1')).toEqual({
      duplicate: true,
    });
    expect(db.crmContact.upsert).not.toHaveBeenCalled();
  });
  it('não bloqueia pagamento quando CRM falha', async () => {
    const db = tx();
    db.crmContact.upsert.mockRejectedValue(new Error('crm offline'));
    expect(await service.syncApprovedPayment(db, 'pay1')).toEqual({
      failed: true,
    });
    expect(db.auditLog.create).toHaveBeenCalled();
  });
});
