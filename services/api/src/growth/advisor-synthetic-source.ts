import type { CampaignStatus, Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

const scope = 'sortex-review-v1';
const fixtures = [
  {
    id: `${scope}-c1`,
    slug: 'qa-avaliacao-pedal-urbano',
    title: '[FICTÍCIO] Pedal de Montanha',
    status: 'DRAFT',
    paidQuantity: 28,
    unitPrice: '2.50',
    total: '70.00',
  },
  {
    id: `${scope}-c2`,
    slug: 'qa-avaliacao-estudio-criativo',
    title: '[FICTÍCIO] Estúdio Criativo',
    status: 'PAUSED',
    paidQuantity: 64,
    unitPrice: '3.75',
    total: '240.00',
  },
  {
    id: `${scope}-c3`,
    slug: 'qa-avaliacao-fim-de-semana',
    title: '[FICTÍCIO] Refúgio de Fim de Semana',
    status: 'CANCELLED',
    paidQuantity: 100,
    unitPrice: '1.25',
    total: '125.00',
  },
] as const satisfies readonly {
  id: string;
  slug: string;
  title: string;
  status: CampaignStatus;
  paidQuantity: number;
  unitPrice: string;
  total: string;
}[];
const campaignIds = fixtures.map(({ id }) => id);

function campaignIdentity(organizerId: string): Prisma.CampaignWhereInput {
  return {
    organizerId,
    publishedAt: null,
    purchasesBlocked: true,
    drawBasis: 'MANUAL_RESULT',
    regulation: { startsWith: 'DADOS FICTÍCIOS · AVALIAÇÃO SORTEX ·' },
    publishedRuleSnapshot: { path: ['syntheticReview'], equals: true },
    OR: fixtures.map(({ id, title, slug, status }) => ({
      id,
      title,
      slug,
      status,
    })),
  };
}

async function verifiedCampaigns(
  tx: Prisma.TransactionClient,
  organizerId: string,
) {
  const audited = await tx.auditLog.findFirst({
    where: {
      id: `${scope}-seed-audit`,
      entityType: 'QaSyntheticFixture',
      entityId: scope,
      action: 'QA_FIXTURE_CREATED',
      actorUserId: organizerId,
      actorRole: 'ORGANIZER',
      AND: [
        { metadata: { path: ['fictitious'], equals: true } },
        { metadata: { path: ['paymentProviderInvoked'], equals: false } },
        { metadata: { path: ['officialDraw'], equals: false } },
        { metadata: { path: ['campaigns'], equals: fixtures.length } },
      ],
    },
    select: { id: true },
  });
  if (!audited) return false;

  return (
    (await tx.campaign.count({ where: campaignIdentity(organizerId) })) ===
    fixtures.length
  );
}

export async function readAdvisorSyntheticSummary(
  prisma: PrismaService,
  organizerId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      if (!(await verifiedCampaigns(tx, organizerId))) return null;
      // Read only tagged, exact synthetic rows. Other purchases/promotions on
      // these same campaigns do not become eligible merely by association.
      const [paid, abandonedReservations, promotions] = await Promise.all([
        tx.purchase.aggregate({
          where: {
            campaignId: { in: campaignIds },
            campaign: campaignIdentity(organizerId),
            status: 'PAID',
            selectionMode: 'MANUAL',
            confirmedAt: { not: null },
            buyer: {
              role: 'BUYER',
              email: { endsWith: '@example.test', mode: 'insensitive' },
            },
            payments: { none: {} },
            OR: fixtures.map(({ id, paidQuantity, unitPrice, total }) => ({
              id: `${id}-paid`,
              campaignId: id,
              idempotencyKey: `${id}-historical-test-only`,
              quantity: paidQuantity,
              unitPrice,
              subtotal: total,
              total,
            })),
          },
          _count: { _all: true },
          _sum: { total: true, quantity: true },
        }),
        tx.purchase.count({
          where: {
            id: `${scope}-c1-expired`,
            campaignId: `${scope}-c1`,
            campaign: campaignIdentity(organizerId),
            idempotencyKey: `${scope}-c1-expired`,
            status: 'EXPIRED',
            selectionMode: 'MANUAL',
            quantity: 2,
            unitPrice: '2.50',
            total: '5.00',
            confirmedAt: null,
            buyer: {
              role: 'BUYER',
              email: { endsWith: '@example.test', mode: 'insensitive' },
            },
            payments: { none: {} },
          },
        }),
        tx.campaignPromotion.count({
          where: {
            OR: fixtures
              .slice(0, 2)
              .map(({ id }) => ({ id: `${id}-promo`, campaignId: id })),
            campaign: campaignIdentity(organizerId),
            description: { startsWith: 'DADOS FICTÍCIOS · AVALIAÇÃO SORTEX ·' },
            name: 'Pacote fictício de 10 cotas',
            numberQuantity: 10,
            isActive: true,
            status: 'ACTIVE',
            deletedAt: null,
          },
        }),
      ]);
      if (paid._count._all !== fixtures.length || abandonedReservations !== 1)
        return null;
      return {
        campaigns: fixtures.length,
        publishedCampaigns: 0,
        approvedSales: paid._count._all,
        revenue: Number(paid._sum.total),
        ticketsSold: Number(paid._sum.quantity),
        abandonedReservations,
        pendingPayments: 0,
        promotions,
      };
    },
    { isolationLevel: 'RepeatableRead' },
  );
}
