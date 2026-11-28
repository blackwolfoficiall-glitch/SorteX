import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CrmChannel, UserRole } from '@prisma/client';
import { CrmService } from './crm.service';
describe('CrmService security', () => {
  const service = new CrmService({} as any);
  it('rejeita chave arbitrária em regra de segmento', () => {
    expect(() =>
      (service as any).validateRules({ javascript: 'alert(1)' }),
    ).toThrow(BadRequestException);
  });
  it('sanitiza scripts e handlers', () => {
    const clean = (service as any).clean(
      '<script>alert(1)</script><b onclick=x>Olá</b>',
    );
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick=');
  });
  it('mascara telefone e email', () => {
    const safe = (service as any).safe({
      email: 'maria@example.com',
      phone: '71999999999',
      totalSpent: 10,
    });
    expect(safe.email).toBe('ma***@example.com');
    expect(safe.phone).toBe('***9999');
  });
});

describe('CrmService: escopo da campanha na comunicação', () => {
  const user = { id: 'organizadora', role: UserRole.ORGANIZER };
  const payload = {
    audienceType: 'CONTACT' as const,
    contactId: 'contato',
    campaignId: 'campanha',
    channel: CrmChannel.EMAIL,
    content: 'Olá {{nome}}: {{campanha}}',
    draft: true,
  };

  function fixture() {
    const prisma = {
      campaign: { findFirst: jest.fn(), findUnique: jest.fn() },
      crmContact: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'contato', name: 'Ana' },
          { id: 'segundo', name: 'Bia' },
        ]),
      },
      outboundMessage: { create: jest.fn() },
    };
    return { prisma, service: new CrmService(prisma as any) };
  }

  it('não renderiza nem cria comunicações para campanha indisponível no escopo', async () => {
    const { prisma, service } = fixture();
    prisma.campaign.findFirst.mockResolvedValue(null);
    await expect(
      service.communicationPreview(user as any, payload),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.createCommunication(user as any, payload),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.campaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'campanha', organizerId: 'organizadora' },
      }),
    );
    expect(prisma.campaign.findUnique).not.toHaveBeenCalled();
    expect(prisma.crmContact.findMany).not.toHaveBeenCalled();
    expect(prisma.outboundMessage.create).not.toHaveBeenCalled();
  });

  it('resolve a campanha autorizada uma vez e personaliza cada rascunho', async () => {
    const { prisma, service } = fixture();
    prisma.campaign.findFirst.mockResolvedValue({
      id: 'campanha',
      title: 'Campanha de teste',
      slug: 'campanha-teste',
    });
    await expect(
      service.createCommunication(user as any, {
        ...payload,
        audienceType: 'MANUAL',
        contactIds: ['contato', 'segundo'],
      }),
    ).resolves.toMatchObject({ recipients: 2, status: 'RASCUNHO' });
    expect(prisma.campaign.findFirst).toHaveBeenCalledTimes(1);
    expect(
      prisma.outboundMessage.create.mock.calls.map(
        ([entry]) => entry.data.content,
      ),
    ).toEqual(['Olá Ana: Campanha de teste', 'Olá Bia: Campanha de teste']);
  });
});
