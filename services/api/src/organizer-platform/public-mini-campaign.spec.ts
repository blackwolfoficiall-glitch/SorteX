import {
  CampaignStatus,
  MiniCampaignPrizeType,
  MiniCampaignStatus,
  Prisma,
  UserRole,
  VerificationStatus,
} from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import type { OrganizerStorageService } from '../organizers/organizer-storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import { OrganizerPlatformService } from './organizer-platform.service';

const slug = 'mini-campanha-qa';
const date = new Date('2026-11-22T00:00:00.000Z');

function setup(row: unknown) {
  const findFirst = jest.fn().mockResolvedValue(row);
  const prisma = { miniCampaign: { findFirst } };
  const service = new OrganizerPlatformService(
    prisma as unknown as PrismaService,
    {} as OrganizerStorageService,
  );
  return { service, findFirst };
}

// A synthetic typed read row, with deliberate extra properties to prove the
// projection stays closed even if a future caller mistakenly supplies more.
function fixture() {
  return {
    id: 'mini-public-qa',
    organizerId: 'organizer-qa',
    name: 'Mini Campanha sintética',
    slug,
    description: null,
    imageUrl: null,
    prizeType: MiniCampaignPrizeType.PRODUCT,
    prizeDescription: 'Prêmio fictício',
    maxTickets: 20,
    soldTickets: 2,
    ticketPrice: new Prisma.Decimal('0.75'),
    purchaseLimitPerBuyer: 4,
    startsAt: date,
    endsAt: null,
    drawAt: null,
    rules: 'Regra fictícia',
    mainCampaign: {
      id: 'main-public-qa',
      title: 'Campanha principal sintética',
      slug: 'principal-qa',
      organizerId: 'organizer-qa',
      internalFixture: true,
    },
    organizer: {
      privateFixture: true,
      organizerBrandProfile: {
        publicName: 'Marca fictícia',
        primaryLogoUrl: null,
        primaryColor: '#6633ff',
        internalFixture: true,
      },
    },
    privateFixture: true,
  };
}

describe('Public Mini Campaign read policy', () => {
  it('queries only guest-visible Mini records under a public parent and eligible seller', async () => {
    const { service, findFirst } = setup(fixture());
    await service.publicMiniCampaign(slug);
    const [query] = findFirst.mock.calls[0] as [
      Prisma.MiniCampaignFindFirstArgs,
    ];
    expect(query.where).toStrictEqual({
      slug,
      status: MiniCampaignStatus.PUBLISHED,
      deletedAt: null,
      result: { is: null },
      mainCampaign: {
        is: { status: CampaignStatus.PUBLISHED, publicationBlocked: false },
      },
      organizer: {
        is: {
          role: UserRole.ORGANIZER,
          isActive: true,
          organizerProfile: {
            is: {
              verificationStatus: VerificationStatus.VERIFIED,
              campaignsBlocked: false,
            },
          },
        },
      },
    });
    expect(query.include).toBeUndefined();
    expect(query.select).not.toHaveProperty('orders');
    expect(query.select).not.toHaveProperty('tickets');
    expect(query.select).not.toHaveProperty('result');
    expect(query.select?.mainCampaign).toStrictEqual({
      select: { id: true, title: true, slug: true, organizerId: true },
    });
    expect(query.select?.organizer).toStrictEqual({
      select: {
        organizerBrandProfile: {
          select: {
            publicName: true,
            primaryLogoUrl: true,
            primaryColor: true,
          },
        },
      },
    });
  });

  it('keeps the visible page contract without serializing internal or nested identity data', async () => {
    const { service } = setup(fixture());
    await expect(service.publicMiniCampaign(slug)).resolves.toStrictEqual({
      id: 'mini-public-qa',
      name: 'Mini Campanha sintética',
      slug,
      description: null,
      imageUrl: null,
      prizeType: MiniCampaignPrizeType.PRODUCT,
      prizeDescription: 'Prêmio fictício',
      maxTickets: 20,
      soldTickets: 2,
      availableTickets: 18,
      ticketPrice: 0.75,
      purchaseLimitPerBuyer: 4,
      startsAt: date,
      endsAt: null,
      drawAt: null,
      rules: 'Regra fictícia',
      mainCampaign: {
        id: 'main-public-qa',
        title: 'Campanha principal sintética',
        slug: 'principal-qa',
      },
      organizer: {
        publicName: 'Marca fictícia',
        primaryLogoUrl: null,
        primaryColor: '#6633ff',
      },
      result: null,
    });
  });

  it('preserves null branding and does not report negative availability', async () => {
    const { service } = setup({
      ...fixture(),
      soldTickets: 21,
      organizer: { organizerBrandProfile: null },
    });
    await expect(service.publicMiniCampaign(slug)).resolves.toMatchObject({
      organizer: null,
      availableTickets: 0,
      result: null,
    });
  });

  it('uses the same not-found error for filtered rows and invalid parent ownership', async () => {
    const mismatched = fixture();
    mismatched.mainCampaign.organizerId = 'other-organizer-qa';
    for (const row of [null, mismatched]) {
      const { service } = setup(row);
      await expect(service.publicMiniCampaign(slug)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.publicMiniCampaign(slug)).rejects.toThrow(
        'Mini Campanha não encontrada ou indisponível.',
      );
    }
  });
});
