import { NotFoundException } from '@nestjs/common';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { CampaignStatus, InstantPrizeStatus } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { DrawsController } from './draws.controller';
import { InstantPrizeDetectionService } from './instant-prize-detection.service';

const campaignId = 'synthetic-campaign';
const slug = 'synthetic-campaign';
const moment = new Date('2026-11-27T17:00:00.000Z');
const visibility = [
  CampaignStatus.PUBLISHED,
  CampaignStatus.SOLD_OUT,
  CampaignStatus.DRAWN,
  CampaignStatus.FINISHED,
];

function fixture(
  before: CampaignStatus | null,
  after = before,
  prizeStatus: InstantPrizeStatus = InstantPrizeStatus.FOUND,
  winningNumber = '00127',
) {
  const campaign = {
    findFirst: jest.fn(
      async ({
        where,
      }: {
        where: { slug: string; status: { in: CampaignStatus[] } };
      }) =>
        before && where.slug === slug && where.status.in.includes(before)
          ? { id: campaignId }
          : null,
    ),
  };
  type ResultsWhere = {
    campaignId: string;
    campaign: { slug: string; status: { in: CampaignStatus[] } };
    instantPrize: { status: { in: InstantPrizeStatus[] } };
  };
  const instantPrizeResult = {
    findMany: jest.fn(async ({ where }: { where: ResultsWhere }) =>
      after &&
      where.campaignId === campaignId &&
      where.campaign.slug === slug &&
      where.campaign.status.in.includes(after) &&
      where.instantPrize.status.in.includes(prizeStatus)
        ? [
            {
              winningNumber,
              status: 'IDENTIFIED',
              identifiedAt: moment,
              instantPrize: {
                description: 'Prêmio sintético anunciado',
                value: '12.34',
                type: 'PRODUCT',
              },
            },
          ]
        : [],
    ),
  };
  return {
    service: new InstantPrizeDetectionService({
      campaign,
      instantPrizeResult,
    } as unknown as PrismaService),
    campaign,
    instantPrizeResult,
  };
}

describe('anonymous instant-prize disclosure policy', () => {
  it.each([
    null,
    CampaignStatus.DRAFT,
    CampaignStatus.PENDING_REVIEW,
    CampaignStatus.PAUSED,
    CampaignStatus.CANCELLED,
  ])(
    'returns the same 404 without querying prize rows when %s',
    async (status) => {
      const { service, campaign, instantPrizeResult } = fixture(status);
      await expect(service.publicResults(slug)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.publicResults(slug)).rejects.toMatchObject({
        message: 'Campanha não encontrada.',
        status: 404,
      });
      expect(campaign.findFirst).toHaveBeenCalledWith({
        where: { slug, status: { in: visibility } },
        select: { id: true },
      });
      expect(instantPrizeResult.findMany).not.toHaveBeenCalled();
    },
  );

  it.each(visibility)(
    'preserves masked prize results for public history %s',
    async (status) => {
      const { service, instantPrizeResult } = fixture(
        status,
        status,
        InstantPrizeStatus.DELIVERED,
      );
      await expect(service.publicResults(slug)).resolves.toEqual([
        {
          winningNumber: '0***7',
          status: 'IDENTIFIED',
          identifiedAt: moment,
          buyer: { name: 'Identidade preservada', city: null, state: null },
          instantPrize: {
            description: 'Prêmio sintético anunciado',
            value: 12.34,
            type: 'PRODUCT',
          },
        },
      ]);
      expect(instantPrizeResult.findMany).toHaveBeenCalledWith({
        where: {
          campaignId,
          campaign: { slug, status: { in: visibility } },
          instantPrize: { status: { in: ['FOUND', 'DELIVERED'] } },
        },
        // No buyer relationship, ID, contact, location or unannounced prize data.
        select: {
          winningNumber: true,
          status: true,
          identifiedAt: true,
          instantPrize: {
            select: { description: true, value: true, type: true },
          },
        },
        orderBy: { identifiedAt: 'desc' },
      });
    },
  );

  it('continues to return an empty public list when no prize is announced', async () => {
    const { service } = fixture(
      CampaignStatus.PUBLISHED,
      CampaignStatus.PUBLISHED,
      InstantPrizeStatus.AVAILABLE,
    );
    await expect(service.publicResults(slug)).resolves.toEqual([]);
  });

  it('shows no rows if a publicly visible campaign is withdrawn during the read', async () => {
    const { service } = fixture(
      CampaignStatus.PUBLISHED,
      CampaignStatus.PAUSED,
    );
    await expect(service.publicResults(slug)).resolves.toEqual([]);
  });

  it('fully masks one- and two-digit tickets with the same display shape', async () => {
    for (const [original, masked] of [
      ['7', '*'],
      ['07', '**'],
    ]) {
      const { service } = fixture(
        CampaignStatus.PUBLISHED,
        CampaignStatus.PUBLISHED,
        InstantPrizeStatus.FOUND,
        original,
      );
      await expect(service.publicResults(slug)).resolves.toEqual([
        expect.objectContaining({ winningNumber: masked }),
      ]);
    }
  });

  it('keeps the narrow route public and prevents clients from caching it', () => {
    const handler = DrawsController.prototype.publicInstant;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toContainEqual({
      name: 'Cache-Control',
      value: 'no-store',
    });
  });
});
