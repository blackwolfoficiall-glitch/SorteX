import { AdminTeamRole, UserRole, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import type { PrismaService } from '../prisma/prisma.service';
import { LegalService } from './legal.service';

type LegalPrismaMock = {
  legalDocument: {
    create: jest.Mock;
    findUnique: jest.Mock;
  };
  auditLog: { create: jest.Mock };
};

describe('LegalService', () => {
  let prisma: LegalPrismaMock;
  let service: LegalService;
  const admin: AuthenticatedUser = {
    id: 'admin-1',
    name: 'Administrador',
    email: 'admin@sortex.test',
    phone: null,
    cpf: null,
    cnpj: null,
    role: UserRole.ADMIN,
    city: null,
    state: null,
    isActive: true,
    status: UserStatus.ACTIVE,
    adminPermissions: [],
    adminTeamRole: AdminTeamRole.SUPERADMIN,
    verified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    sessionId: 'session-1',
  };

  beforeEach(() => {
    prisma = {
      legalDocument: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    service = new LegalService(prisma as unknown as PrismaService);
  });

  it('remove scripts, eventos e URLs javascript antes de persistir', async () => {
    prisma.legalDocument.create.mockImplementation(
      (args: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'legal-1', ...args.data }),
    );
    await service.create(admin, {
      title: 'Documento',
      slug: 'documento',
      category: 'GERAL',
      content: {
        html: '<p onclick="alert(1)">Seguro</p><script>alert(1)</script><a href="javascript:alert(1)">link</a>',
      },
    });
    const call = prisma.legalDocument.create.mock.calls[0] as [
      { data: { content: { html: string } } },
    ];
    expect(call[0].data.content.html).toContain('<p>Seguro</p>');
    expect(call[0].data.content.html).not.toContain('script');
    expect(call[0].data.content.html).not.toContain('onclick');
    expect(call[0].data.content.html).not.toContain('javascript:');
  });

  it('gera um arquivo PDF válido para o documento', async () => {
    prisma.legalDocument.findUnique.mockResolvedValue({
      id: 'legal-1',
      title: 'Termos',
      subtitle: 'SorteX',
      version: 2,
      status: 'PUBLISHED',
      content: { html: '<p>Conteúdo jurídico</p>' },
      createdBy: { name: 'Admin' },
      updatedBy: { name: 'Admin' },
      _count: { versions: 2, acceptances: 1 },
    });
    const result = await service.pdf('legal-1');
    expect(result.subarray(0, 5).toString()).toBe('%PDF-');
    expect(result.length).toBeGreaterThan(500);
  });
});
