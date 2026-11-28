// Synthetic fixture only. No charges, gateway calls, broadcasts or real accounts.
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcrypt');

const url = new URL(process.env.SORTEX_PRIZE_TEST_DATABASE_URL ?? '');
assert.ok(
  url.protocol === 'postgresql:' && url.hostname === '127.0.0.1' &&
  /^\/sortex_prizes_local_[a-f0-9]+$/.test(url.pathname) &&
  url.port && !url.search && !url.hash,
  'Use exclusivamente o banco descartável sortex_prizes_local_* em loopback.',
);
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });

async function main() {
  const accounts = await Promise.all(['OWNER', 'OTHER', 'ORGANIZER'].map(async (label) => {
    const email = process.env[`SORTEX_PRIZE_TEST_${label}_EMAIL`] ?? '';
    const password = process.env[`SORTEX_PRIZE_TEST_${label}_PASSWORD`] ?? '';
    assert.ok(/^sortex-prize-[a-f0-9]+@example\.test$/.test(email) && password.length >= 12);
    return {
      email, password: await bcrypt.hash(password, 10), name: 'Ator sintético',
      role: label === 'ORGANIZER' ? 'ORGANIZER' : 'BUYER',
    };
  }));
  assert.equal(new Set(accounts.map(({ email }) => email)).size, 3);
  await db.$transaction(async (tx) => {
    assert.equal(await tx.user.count(), 0, 'Use um banco recém-migrado e vazio.');
    const owner = await tx.user.create({ data: accounts[0] });
    await tx.user.create({ data: accounts[1] });
    const organizer = await tx.user.create({ data: accounts[2] });
    const run = randomUUID();
    const date = new Date('2026-07-10T21:00:00.000Z');
    const campaign = await tx.campaign.create({ data: {
      organizerId: organizer.id, title: 'Campanha sintética de prêmios', slug: `synthetic-prizes-${run}`,
      status: 'DRAWN', totalNumbers: 100000,
    }});
    // Records for a historical synthetic purchase only; never invoke checkout/payment.
    const purchase = await tx.purchase.create({ data: {
      campaignId: campaign.id, buyerId: owner.id, status: 'PAID', selectionMode: 'MANUAL',
      quantity: 2, unitPrice: 1, subtotal: 2, total: 2, expiresAt: date, confirmedAt: date,
    }});
    const ticket = (number) => tx.ticket.create({ data: {
      campaignId: campaign.id, buyerId: owner.id, purchaseId: purchase.id, status: 'SOLD', number,
    }});
    const [mainTicket, instantTicket] = await Promise.all([ticket(91), ticket(32)]);
    const draw = await tx.campaignDraw.create({ data: {
      campaignId: campaign.id, status: 'CONFIRMED', executedByUserId: organizer.id,
      confirmedByUserId: organizer.id, confirmedAt: date, winningNumber: '00091',
      normalizedWinningNumber: '00091', ruleSnapshot: {}, resultSnapshot: {}, auditHash: `synthetic-prizes-${run}`,
    }});
    await tx.winner.create({ data: {
      campaignId: campaign.id, campaignDrawId: draw.id, ticketId: mainTicket.id,
      purchaseId: purchase.id, buyerId: owner.id, winningNumber: '00091', prizeType: 'MAIN_PRIZE',
      prizeName: 'Sorteio sintético', publicVerificationCode: `synthetic-${run}`, status: 'PENDING_CONTACT',
    }});
    const instant = await tx.campaignInstantPrize.create({ data: {
      campaignId: campaign.id, type: 'PRODUCT', description: 'Cota sintética',
      exactNumber: '00032', value: 1, status: 'FOUND',
    }});
    await tx.instantPrizeResult.create({ data: {
      campaignId: campaign.id, instantPrizeId: instant.id, ticketId: instantTicket.id,
      purchaseId: purchase.id, buyerId: owner.id, winningNumber: '00032', status: 'IDENTIFIED',
    }});
  });
  console.log('Dados de prêmio exclusivamente sintéticos preparados no banco descartável.');
}
main().catch(() => {
  console.error('Não foi possível preparar os prêmios sintéticos.');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
