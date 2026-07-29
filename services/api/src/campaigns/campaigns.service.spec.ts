/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CampaignCategory,
  CampaignPrizeType,
  CampaignStatus,
  DrawBasis,
  NumberSelectionMode,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { OrganizerStorageService } from '../organizers/organizer-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignsService } from './campaigns.service';

const organizer = {
  id: 'organizer-1',
  name: 'Organizador',
  email: 'organizer@sortex.test',
  phone: null,
  cpf: '12345678900',
  cnpj: null,
  role: UserRole.ORGANIZER,
  city: null,
  state: null,
  isActive: true,
  verified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  sessionId: 'session-1',
};

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    id: 'campaign-1',
    organizerId: organizer.id,
    title: 'Corolla ou 90 mil',
    slug: 'corolla-ou-90-mil',
    shortDescription: 'Concorra a um Corolla.',
    description: 'Campanha completa.',
    regulation: 'Regulamento da campanha.',
    status: CampaignStatus.DRAFT,
    category: CampaignCategory.AUTOMOBILE,
    mainPrizeName: 'Corolla',
    mainPrizeDescription: 'Corolla zero quilômetro.',
    mainPrizeImage: 'campaigns/1/prize.jpg',
    mainPrizeQuantity: 1,
    cashAlternative: 90000,
    estimatedPrizeValue: 120000,
    coverImage: 'campaigns/1/cover.jpg',
    promotionalVideo: null,
    totalNumbers: 1_000_000,
    numberPrice: 0.2,
    minimumPurchase: 10,
    maximumPurchasePerBuyer: 50000,
    numberSelectionMode: NumberSelectionMode.RANDOM,
    drawDate: new Date('2026-12-20'),
    drawTime: '20:00',
    drawBasis: DrawBasis.LOTERIA_FEDERAL,
    drawRuleTemplateId: 'system-last-5-first',
    customDrawRule: null,
    salesStartAt: new Date('2026-10-01'),
    salesEndAt: null,
    soldNumbers: 0,
    reservedNumbers: 0,
    grossRevenue: 0,
    publishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    organizer: {
      id: organizer.id,
      name: organizer.name,
      verified: true,
      organizerProfile: {
        organizationName: 'Sorte Premiada',
        logoStorageKey: 'logo.png',
        verificationStatus: VerificationStatus.VERIFIED,
        platformFee: 2.9,
        customPlatformFee: null,
        platformFeeWaived: false,
      },
    },
    galleryImages: [],
    instantPrizes: [],
    promotions: [],
    drawRuleTemplate: {
      id: 'system-last-5-first',
      organizerId: null,
      name: 'Últimos 5 dígitos',
      description: 'Modelo oficial',
      isSystemTemplate: true,
      ruleDefinition: { digits: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ...overrides,
  };
}

describe('CampaignsService', () => {
  let service: CampaignsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      campaign: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organizerProfile: {
        findUnique: jest.fn().mockResolvedValue({
          verificationStatus: 'VERIFIED',
          campaignsBlocked: false,
        }),
      },
      campaignPromotion: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      campaignInstantPrize: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      campaignImage: {
        count: jest.fn(),
        createMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      campaignCustomization: {
        upsert: jest.fn(),
      },
      drawRuleTemplate: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      platformSetting: {
        upsert: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback: (transaction: any) => unknown) =>
        callback(prisma),
      ),
    };
    const module = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: OrganizerStorageService,
          useValue: {
            save: jest.fn(),
            resolve: jest.fn(),
            mimeType: jest.fn(),
          },
        },
      ],
    }).compile();
    service = module.get(CampaignsService);
  });

  it('cria campanha em rascunho com slug único', async () => {
    prisma.campaign.findFirst.mockResolvedValue(null);
    prisma.campaign.create.mockResolvedValue(campaign());

    const result = await service.create(organizer, {
      title: 'Corolla ou 90 mil',
    });

    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizerId: organizer.id,
          slug: 'corolla-ou-90-mil',
        }),
      }),
    );
    expect(result.status).toBe(CampaignStatus.DRAFT);
  });

  it('permite criar rascunho antes da aprovação do organizador', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      verificationStatus: 'PENDING',
      campaignsBlocked: true,
    });
    prisma.campaign.findFirst.mockResolvedValue(null);
    prisma.campaign.create.mockResolvedValue(
      campaign({ title: 'Campanha em preparação' }),
    );
    await expect(
      service.create(organizer, { title: 'Campanha em preparação' }),
    ).resolves.toEqual(
      expect.objectContaining({ status: CampaignStatus.DRAFT }),
    );
    expect(prisma.campaign.create).toHaveBeenCalled();
  });

  it('adiciona sufixo quando o slug já existe', async () => {
    prisma.campaign.findFirst
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null);
    prisma.campaign.create.mockResolvedValue(
      campaign({ slug: 'corolla-ou-90-mil-2' }),
    );

    await service.create(organizer, { title: 'Corolla ou 90 mil' });

    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'corolla-ou-90-mil-2' }),
      }),
    );
  });

  it('impede um organizador de acessar campanha de outro', async () => {
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({ organizerId: 'outro-organizador' }),
    );
    await expect(
      service.getOwned('campaign-1', organizer),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('atualiza campanha própria e suas promoções', async () => {
    prisma.campaign.findUnique.mockResolvedValue(campaign());
    prisma.campaign.update.mockResolvedValue(
      campaign({ title: 'Título atualizado' }),
    );

    const result = await service.update('campaign-1', organizer, {
      title: 'Título atualizado',
      promotions: [
        {
          name: 'Pacote 400',
          numberQuantity: 400,
          packagePrice: 70,
        },
      ],
    });

    expect(prisma.campaignPromotion.createMany).toHaveBeenCalled();
    expect(result.title).toBe('Título atualizado');
  });

  it('persiste início das vendas, nome do prêmio e personalização na resposta', async () => {
    prisma.campaign.findUnique.mockResolvedValue(campaign());
    prisma.campaign.update.mockResolvedValue(
      campaign({
        mainPrizeName: 'Moto Ibex 450',
        salesStartAt: new Date('2026-11-05T12:30:00.000Z'),
      }),
    );

    const result = await service.update('campaign-1', organizer, {
      mainPrizeName: 'Moto Ibex 450',
      salesStartAt: '2026-11-05T12:30:00.000Z',
      customization: {
        useOrganizerDefaults: false,
        primaryColor: '#2563EB',
      },
    });

    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mainPrizeName: 'Moto Ibex 450',
          salesStartAt: new Date('2026-11-05T12:30:00.000Z'),
        }),
      }),
    );
    expect(result.mainPrizeName).toBe('Moto Ibex 450');
    expect(result.customization).toEqual(
      expect.objectContaining({
        useOrganizerDefaults: false,
        configuration: expect.objectContaining({
          primaryColor: '#2563EB',
        }),
      }),
    );
  });

  it('permite reduzir o preço de campanha publicada sem recriar promoções ou cotas', async () => {
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({ status: CampaignStatus.PUBLISHED, numberPrice: 0.25 }),
    );
    prisma.campaign.update.mockResolvedValue(
      campaign({ status: CampaignStatus.PUBLISHED, numberPrice: 0.15 }),
    );
    const result = await service.update('campaign-1', organizer, {
      numberPrice: 0.15,
      promotions: [
        { name: 'Existente', numberQuantity: 100, packagePrice: 15 },
      ],
      instantPrizes: [
        {
          exactNumber: '00001',
          value: 100,
          description: 'PIX',
          type: CampaignPrizeType.PIX,
          quantity: 1,
        },
      ],
    });
    expect(result.numberPrice).toBe(0.15);
    expect(prisma.campaignPromotion.deleteMany).not.toHaveBeenCalled();
    expect(prisma.campaignInstantPrize.deleteMany).not.toHaveBeenCalled();
  });

  it('protege quantidade emitida e regra de campanha publicada', async () => {
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({ status: CampaignStatus.PUBLISHED }),
    );
    await expect(
      service.update('campaign-1', organizer, { totalNumbers: 2_000_000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('permite atualizar legenda e ordem de foto em campanha publicada', async () => {
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({ status: CampaignStatus.PUBLISHED }),
    );
    prisma.campaignImage.findFirst.mockResolvedValue({ id: 'image-1' });
    await service.updateImage('campaign-1', 'image-1', organizer, {
      caption: 'Vista lateral do prêmio',
      sortOrder: 2,
    });
    expect(prisma.campaignImage.update).toHaveBeenCalledWith({
      where: { id: 'image-1' },
      data: { originalName: 'Vista lateral do prêmio', sortOrder: 2 },
    });
  });

  it('publica campanha completa de organizador verificado', async () => {
    prisma.campaign.findUnique.mockResolvedValue(campaign());
    prisma.campaign.update.mockResolvedValue(
      campaign({ status: CampaignStatus.PUBLISHED }),
    );

    const result = await service.publish('campaign-1', organizer);

    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CampaignStatus.PUBLISHED }),
      }),
    );
    expect(result.status).toBe(CampaignStatus.PUBLISHED);
  });

  it('impede publicação antes da aprovação administrativa', async () => {
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({
        organizer: {
          ...campaign().organizer,
          verified: false,
          organizerProfile: {
            ...campaign().organizer.organizerProfile,
            verificationStatus: VerificationStatus.PENDING,
          },
        },
      }),
    );
    prisma.campaign.update.mockResolvedValue(
      campaign({ status: CampaignStatus.PUBLISHED }),
    );

    await expect(service.publish('campaign-1', organizer)).rejects.toThrow(
      'Seu cadastro precisa estar aprovado para publicar campanhas.',
    );
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it('pausa uma campanha publicada do próprio organizador', async () => {
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({ status: CampaignStatus.PUBLISHED }),
    );
    prisma.campaign.update.mockResolvedValue(
      campaign({ status: CampaignStatus.PAUSED }),
    );

    const result = await service.pause('campaign-1', organizer);

    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: CampaignStatus.PAUSED },
      }),
    );
    expect(result.status).toBe(CampaignStatus.PAUSED);
  });

  it('finaliza uma campanha publicada do próprio organizador', async () => {
    prisma.campaign.findUnique.mockResolvedValue(
      campaign({ status: CampaignStatus.PUBLISHED }),
    );
    prisma.campaign.update.mockResolvedValue(
      campaign({ status: CampaignStatus.FINISHED }),
    );

    const result = await service.finish('campaign-1', organizer);

    expect(prisma.campaign.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: CampaignStatus.FINISHED },
      }),
    );
    expect(result.status).toBe(CampaignStatus.FINISHED);
  });

  it('rejeita cotas manuais repetidas', async () => {
    prisma.campaign.findFirst.mockResolvedValue(null);
    await expect(
      service.create(organizer, {
        totalNumbers: 1_000_000,
        instantPrizes: [
          {
            exactNumber: '111111',
            value: 100,
            description: 'PIX 1',
            type: CampaignPrizeType.PIX,
            quantity: 1,
          },
          {
            exactNumber: '111111',
            value: 500,
            description: 'PIX 2',
            type: CampaignPrizeType.PIX,
            quantity: 1,
          },
        ],
      }),
    ).rejects.toThrow('A cota 111111 está repetida.');
  });

  it('preserva zeros e valida o tamanho da cota manual', async () => {
    prisma.campaign.findFirst.mockResolvedValue(null);
    await expect(
      service.create(organizer, {
        totalNumbers: 1_000_000,
        instantPrizes: [
          {
            exactNumber: '00123',
            value: 100,
            description: 'PIX',
            type: CampaignPrizeType.PIX,
            quantity: 1,
          },
        ],
      }),
    ).rejects.toThrow('deve possuir 6 dígitos');
  });

  it('rejeita pacote promocional mais caro que títulos avulsos', async () => {
    prisma.campaign.findFirst.mockResolvedValue(null);
    await expect(
      service.create(organizer, {
        numberPrice: 0.1,
        promotions: [
          { name: 'Pacote inválido', numberQuantity: 10, packagePrice: 2 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('converte o antigo Mais popular em destaque sem exigir preço de pacote', async () => {
    prisma.campaign.findFirst.mockResolvedValue(null);
    prisma.campaign.create.mockResolvedValue(campaign());

    await service.create(organizer, {
      numberPrice: 0.02,
      promotions: [
        { name: 'Mais popular', numberQuantity: 1000, isPopular: true },
      ],
    });

    expect(prisma.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ promotions: { create: [] } }),
      }),
    );
  });

  it('continua exigindo preço nos pacotes promocionais reais', async () => {
    prisma.campaign.findFirst.mockResolvedValue(null);
    await expect(
      service.create(organizer, {
        promotions: [{ name: 'Pacote 500', numberQuantity: 500 }],
      }),
    ).rejects.toThrow('Informe o preço do pacote Pacote 500.');
  });

  it('rejeita cota premiada sem número ou regra de geração', async () => {
    prisma.campaign.findFirst.mockResolvedValue(null);
    await expect(
      service.create(organizer, {
        instantPrizes: [
          {
            value: 100,
            description: 'PIX premiado',
            type: CampaignPrizeType.PIX,
            quantity: 1,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('simula template de regra com cinco prêmios fictícios', () => {
    const simulation = service.simulateRule({
      digits: [
        { prize: 1, position: 4, order: 0 },
        { prize: 2, position: 4, order: 1 },
      ],
    });
    expect(simulation.prizes).toHaveLength(5);
    expect(simulation.finalNumber).toBe('16');
  });

  it('salva template personalizado reutilizável do organizador', async () => {
    prisma.drawRuleTemplate.create.mockResolvedValue({
      id: 'custom-template',
      organizerId: organizer.id,
      name: 'Minha regra',
      description: 'Regra própria',
      isSystemTemplate: false,
      ruleDefinition: {
        digits: [{ prize: 1, position: 4, order: 0 }],
      },
    });

    await service.createRuleTemplate(organizer, {
      name: 'Minha regra',
      description: 'Regra própria',
      ruleDefinition: {
        digits: [{ prize: 1, position: 4, order: 0 }],
      },
    });

    expect(prisma.drawRuleTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizerId: organizer.id }),
    });
  });

  it('endpoint público consulta somente campanhas publicadas', async () => {
    prisma.campaign.findMany.mockResolvedValue([
      campaign({
        status: CampaignStatus.PUBLISHED,
        customization: {
          useOrganizerDefaults: true,
          configuration: {
            roulette: {
              enabled: true,
              rules: [{ id: 'rule-1', minQuantity: 100, rounds: 5 }],
              items: [
                {
                  id: 'secret-prize',
                  name: 'Celular secreto',
                  quantity: 3,
                  probability: 10,
                },
              ],
            },
          },
        },
      }),
    ]);
    const result = await service.listPublic(CampaignCategory.AUTOMOBILE);
    expect(prisma.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: CampaignStatus.PUBLISHED,
          category: CampaignCategory.AUTOMOBILE,
        },
      }),
    );
    expect(result).toHaveLength(1);
    const roulette = result[0].customization?.configuration?.roulette as Record<
      string,
      unknown
    >;
    expect(roulette).toEqual({
      enabled: true,
      name: undefined,
      startsAt: undefined,
      endsAt: undefined,
      rules: [{ id: 'rule-1', minQuantity: 100, rounds: 5 }],
    });
    expect(JSON.stringify(result)).not.toContain('Celular secreto');
    expect(JSON.stringify(result)).not.toContain('probability');
  });

  it('retorna a logo global da Personalização na propriedade pública canônica', async () => {
    const brandUpdatedAt = new Date('2026-07-23T20:00:00.000Z');
    prisma.campaign.findMany.mockResolvedValue([
      campaign({
        status: CampaignStatus.PUBLISHED,
        customization: null,
        milestonePrizes: [],
        organizer: {
          id: organizer.id,
          name: organizer.name,
          verified: true,
          organizerProfile: {
            organizationName: 'Sorte Premiada',
            logoStorageKey: null,
            verificationStatus: VerificationStatus.VERIFIED,
            platformFee: 2.9,
            customPlatformFee: null,
            platformFeeWaived: false,
          },
          organizerBrandProfile: {
            publicName: 'Sorte Premiada',
            slogan: null,
            primaryLogoUrl: 'brand-organizer/logo.png',
            primaryColor: '#6D28D9',
            secondaryColor: '#111827',
            accentColor: '#22C55E',
            buttonColor: '#2563EB',
            progressColor: '#22C55E',
            backgroundColor: '#FFFFFF',
            cardColor: '#FFFFFF',
            themeMode: 'LIGHT',
            layoutStyle: 'MODERN',
            appearanceConfig: { logoPosition: 'CENTER' },
            updatedAt: brandUpdatedAt,
          },
          organizerSocialLinks: [],
          organizerCommunities: [],
        },
      }),
    ]);

    const [result] = await service.listPublic();

    expect(result.organizer.logoUrl).toBe(
      `/organizers/${organizer.id}/brand-assets/logo?v=${brandUpdatedAt.getTime()}`,
    );
    expect(result.organizer.brand?.appearanceConfig).toEqual({
      logoPosition: 'CENTER',
    });
  });
});
