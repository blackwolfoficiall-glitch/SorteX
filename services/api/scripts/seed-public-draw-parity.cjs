// Synthetic scenario 6 fixture for the local parity job. No provider access.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { writeFile } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { hash } = require('bcrypt');
const {
  parseCaixaFederalResponse,
} = require('../dist/src/draws/caixa-federal-results.service');

async function main() {
  assert.equal(process.env.SORTEX_FEDERAL_PARITY_MODE, 'local-synthetic-only');
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(
    url.protocol === 'postgresql:' &&
      url.hostname === '127.0.0.1' &&
      url.username === 'sortex_ci' &&
      url.pathname === '/sortex_homologacao_local' &&
      !url.search &&
      !url.hash,
    'Use somente o banco PostgreSQL descartável local.',
  );
  const output = process.env.SORTEX_FEDERAL_PARITY_FIXTURE;
  assert.ok(output, 'Informe o caminho temporário para a fixture.');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url.href }),
  });
  const run = randomBytes(8).toString('hex');
  const email = `sortex-federal-${run}@example.test`;
  const password = randomBytes(24).toString('hex');
  const passwordHash = await hash(password, 10);
  const caixa = parseCaixaFederalResponse(
    Buffer.from(
      JSON.stringify({
        tipoJogo: 'LOTERIA_FEDERAL',
        numero: 6091,
        dataApuracao: '12/08/2026',
        listaDezenas: ['086997', '004852', '000091', '082438', '039210'],
      }),
    ),
    '6091',
  );
  const rule = {
    version: 1,
    outputLength: 5,
    normalization: { mode: 'REJECT_OUT_OF_RANGE' },
    steps: ['TEN_THOUSAND', 'THOUSAND', 'HUNDRED', 'TEN', 'UNIT'].map(
      (digitPosition, index) => ({
        order: index + 1,
        sourcePrize: 3,
        digitPosition,
        direction: 'REVERSE',
      }),
    ),
  };
  try {
    const result = await prisma.$transaction(async (tx) => {
      const organizer = await tx.user.create({
        data: {
          email,
          password: passwordHash,
          name: 'Organizador Federal sintético',
          role: 'ORGANIZER',
        },
      });
      const buyer = await tx.user.create({
        data: {
          email: `sortex-federal-buyer-${run}@example.test`,
          password: passwordHash,
          name: 'Comprador Federal sintético',
          role: 'BUYER',
        },
      });
      const campaign = await tx.campaign.create({
        data: {
          organizerId: organizer.id,
          title: 'Paridade Federal sintética',
          slug: `synthetic-federal-${run}`,
          status: 'PUBLISHED',
          drawBasis: 'LOTERIA_FEDERAL',
          totalNumbers: 100000,
          publishedRuleSnapshot: rule,
          salesEndAt: caixa.drawDate,
          drawDate: caixa.drawDate,
        },
      });
      const [firstPrize, secondPrize, thirdPrize, fourthPrize, fifthPrize] =
        caixa.prizes;
      const draw = await tx.lotteryDraw.create({
        data: {
          extractionNumber: caixa.extractionNumber,
          drawDate: caixa.drawDate,
          firstPrize,
          secondPrize,
          thirdPrize,
          fourthPrize,
          fifthPrize,
          sourcePrizes: caixa.sourcePrizes,
          status: 'VERIFIED',
          sourceType: 'IMPORTED',
          notes:
            'Fixture local sintética derivada de uma extração histórica. Nenhuma consulta ao provedor.',
        },
      });
      const purchase = await tx.purchase.create({
        data: {
          campaignId: campaign.id,
          buyerId: buyer.id,
          status: 'PAID',
          selectionMode: 'MANUAL',
          quantity: 1,
          unitPrice: 1,
          subtotal: 1,
          total: 1,
          expiresAt: caixa.drawDate,
          confirmedAt: caixa.drawDate,
        },
      });
      await tx.ticket.create({
        data: {
          campaignId: campaign.id,
          buyerId: buyer.id,
          purchaseId: purchase.id,
          number: 19000,
          status: 'SOLD',
        },
      });
      return {
        campaignId: campaign.id,
        lotteryDrawId: draw.id,
        campaignSlug: campaign.slug,
      };
    });
    await writeFile(output, JSON.stringify({ email, password, ...result }), {
      mode: 0o600,
      flag: 'wx',
    });
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Falhou a fixture Federal.',
  );
  process.exitCode = 1;
});
