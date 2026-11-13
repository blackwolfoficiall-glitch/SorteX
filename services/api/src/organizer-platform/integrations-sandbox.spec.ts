import {
  OrganizerIntegrationStatus,
  OrganizerIntegrationType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { MetaAdsService } from '../growth/meta-ads.service';
import { IntegrationsService } from './integrations.service';

describe('Free staging never calls paid integrations', () => {
  const previousMode = process.env.INTEGRATIONS_MODE;
  const user = {
    id: 'organizer-test',
    role: UserRole.ORGANIZER,
  } as AuthenticatedUser;
  beforeEach(() => {
    process.env.INTEGRATIONS_MODE = 'sandbox';
  });
  afterEach(() => {
    if (previousMode === undefined) delete process.env.INTEGRATIONS_MODE;
    else process.env.INTEGRATIONS_MODE = previousMode;
    jest.restoreAllMocks();
  });

  it('blocks Meta OAuth even if the caller requests an external connection', async () => {
    const service = new IntegrationsService({} as PrismaService);
    await expect(service.metaOAuthUrl(user, 'WHATSAPP')).rejects.toThrow(
      'desativadas',
    );
    await expect(service.metaOAuthCallback('code', 'state')).rejects.toThrow(
      'desativadas',
    );
  });

  it('simulates WhatsApp even if restored integration data says connected', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    const prisma = {
      organizerIntegration: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'integration-test',
          type: OrganizerIntegrationType.WHATSAPP,
          sandbox: false,
          status: OrganizerIntegrationStatus.CONNECTED,
        }),
      },
      organizerIntegrationLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const result = await new IntegrationsService(
      prisma as unknown as PrismaService,
    ).sendWhatsAppTemplate(user, 'integration-test', '000000000', 'test');
    expect(result).toMatchObject({ sandbox: true, sent: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('simulates advertising even if restored integration data says connected', async () => {
    const fetch = jest.spyOn(globalThis, 'fetch');
    const prisma = {
      sortexAdCampaign: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ad-test' }),
        update: jest.fn().mockResolvedValue({ id: 'ad-test' }),
      },
      organizerIntegration: {
        findUnique: jest.fn().mockResolvedValue({
          sandbox: false,
          status: OrganizerIntegrationStatus.CONNECTED,
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const result = await new MetaAdsService(
      prisma as unknown as PrismaService,
    ).publish(user, 'ad-test');
    expect(result).toMatchObject({ sandbox: true });
    expect(fetch).not.toHaveBeenCalled();
  });
});
