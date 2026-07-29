/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/require-await */
import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  OrganizerDocumentType,
  OrganizerOnboardingStatus,
  OrganizerPlan,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizerStorageService } from './organizer-storage.service';
import { OrganizersService } from './organizers.service';

const authenticatedOrganizer = {
  id: 'user-1',
  name: 'Ana Organizadora',
  email: 'ana@sortex.test',
  phone: '71999999999',
  cpf: '12345678900',
  cnpj: null,
  role: UserRole.ORGANIZER,
  city: 'Salvador',
  state: 'BA',
  isActive: true,
  verified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  sessionId: 'session-1',
};

function profile(overrides: Record<string, unknown> = {}) {
  return {
    id: 'profile-1',
    userId: authenticatedOrganizer.id,
    fullName: authenticatedOrganizer.name,
    cpf: authenticatedOrganizer.cpf,
    phone: authenticatedOrganizer.phone,
    birthDate: new Date('1990-01-01'),
    organizationName: 'Ana Prêmios',
    cnpj: null,
    instagram: null,
    postalCode: '40000000',
    address: 'Rua Principal',
    addressNumber: '10',
    addressComplement: null,
    city: 'Salvador',
    state: 'BA',
    logoStorageKey: 'profile-1/logo.png',
    logoOriginalName: 'logo.png',
    logoMimeType: 'image/png',
    verificationStatus: VerificationStatus.PENDING,
    rejectionReason: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedById: null,
    currentPlan: OrganizerPlan.BASIC,
    onboardingStatus: OrganizerOnboardingStatus.COMPLETE,
    planSelectedAt: new Date(),
    identitySetupCompletedAt: new Date(),
    platformFee: 2.9,
    monthlyFee: 29.9,
    firstCampaignFree: true,
    platformFeeWaived: false,
    monthlyFeeWaived: false,
    customPlatformFee: null,
    founder: false,
    vip: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: authenticatedOrganizer,
    documents: [
      {
        id: 'document-1',
        organizerProfileId: 'profile-1',
        type: OrganizerDocumentType.IDENTITY,
        originalName: 'rg.pdf',
        storageKey: 'profile-1/rg.pdf',
        mimeType: 'application/pdf',
        size: 100,
        createdAt: new Date(),
      },
      {
        id: 'document-2',
        organizerProfileId: 'profile-1',
        type: OrganizerDocumentType.ADDRESS_PROOF,
        originalName: 'endereco.pdf',
        storageKey: 'profile-1/endereco.pdf',
        mimeType: 'application/pdf',
        size: 100,
        createdAt: new Date(),
      },
    ],
    ...overrides,
  };
}

describe('OrganizersService', () => {
  let service: OrganizersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      organizerProfile: {
        upsert: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      organizerDocument: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      user: { update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn() },
      notification: { create: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn(async (callback: (transaction: any) => unknown) =>
        callback(prisma),
      ),
    };
    const module = await Test.createTestingModule({
      providers: [
        OrganizersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: OrganizerStorageService,
          useValue: { save: jest.fn(), resolve: jest.fn() },
        },
      ],
    }).compile();
    service = module.get(OrganizersService);
  });

  it('cria o perfil inicial a partir do usuário autenticado', async () => {
    prisma.organizerProfile.upsert.mockResolvedValue(profile());

    const result = await service.getMyProfile(authenticatedOrganizer);

    expect(prisma.organizerProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: authenticatedOrganizer.id },
        create: expect.objectContaining({
          cpf: authenticatedOrganizer.cpf,
          fullName: authenticatedOrganizer.name,
        }),
      }),
    );
    expect(result).not.toHaveProperty('logoStorageKey');
    expect(result.logoUrl).toContain(authenticatedOrganizer.id);
  });

  it('envia cadastro completo para análise', async () => {
    prisma.organizerProfile.upsert.mockResolvedValue(profile());
    prisma.organizerProfile.update.mockResolvedValue(
      profile({ verificationStatus: VerificationStatus.PENDING }),
    );

    const result = await service.submit(authenticatedOrganizer);

    expect(prisma.organizerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verificationStatus: VerificationStatus.PENDING,
        }),
      }),
    );
    expect(result.verificationStatus).toBe(VerificationStatus.PENDING);
  });

  it('bloqueia envio quando faltam documentos obrigatórios', async () => {
    prisma.organizerProfile.upsert.mockResolvedValue(
      profile({ documents: [] }),
    );
    await expect(service.submit(authenticatedOrganizer)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('bloqueia envio quando o organizador ainda não escolheu um plano', async () => {
    prisma.organizerProfile.upsert.mockResolvedValue(
      profile({ planSelectedAt: null }),
    );

    await expect(service.submit(authenticatedOrganizer)).rejects.toThrow(
      'Escolha um plano para continuar.',
    );
    expect(prisma.organizerProfile.update).not.toHaveBeenCalled();
  });

  it('aprova cadastro em análise e concede selo verificado', async () => {
    prisma.organizerProfile.findUnique.mockResolvedValue({
      verificationStatus: VerificationStatus.UNDER_REVIEW,
    });
    prisma.organizerProfile.update.mockResolvedValue(
      profile({ verificationStatus: VerificationStatus.VERIFIED }),
    );

    const result = await service.review(
      authenticatedOrganizer.id,
      'admin-1',
      VerificationStatus.VERIFIED,
      'Documentos revisados e válidos',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: authenticatedOrganizer.id },
      data: { verified: true },
    });
    expect(result.verificationStatus).toBe(VerificationStatus.VERIFIED);
  });
});
