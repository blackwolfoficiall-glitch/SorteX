/* Synthetic marketing data. No payment SDK, email, messages or approval of existing users. */
const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('node:crypto');
const bcrypt = require('bcrypt');

function assertTarget(env = process.env) {
  const url = new URL(env.DATABASE_URL || '');
  const direct =
    url.hostname === 'ep-old-dawn-bcrbqzmd.c-16.us-east-1.aws.neon.tech';
  const bridge =
    url.hostname === '127.0.0.1' && env.DEMO_VERIFIED_TLS_BRIDGE === 'true';
  if (
    (!direct && !bridge) ||
    url.pathname !== '/sortex_preview' ||
    env.ALLOW_ORGANIZER_DEMO !== 'isolated-preview-only' ||
    env.APP_ENV !== 'staging' ||
    env.PAYMENT_ENV !== 'sandbox' ||
    env.INTEGRATIONS_MODE !== 'sandbox' ||
    env.EMAIL_DELIVERY_MODE !== 'disabled'
  )
    throw new Error('Refusing a target outside the dedicated sandbox preview.');
}
async function seed() {
  assertTarget();
  if (
    !process.env.DEMO_PRIVATE_OUTPUT ||
    require('node:fs').existsSync(process.env.DEMO_PRIVATE_OUTPUT)
  )
    throw new Error('A new private output path is required.');
  const prisma = new PrismaClient();
  const prefix = 'marketing-demo-v1';
  const password = randomBytes(32).toString('base64url');
  const hash = await bcrypt.hash(password, 12);
  const now = new Date();
  const organizerId = `${prefix}-organizer`;
  try {
    if (await prisma.user.findUnique({ where: { id: organizerId } }))
      throw new Error('Demo already exists; refusing to overwrite it.');
    await prisma.$transaction(
      async (tx) => {
        await tx.user.create({
          data: {
            id: organizerId,
            name: 'Aurora Demonstração',
            email: 'aurora-demo@sortex.example.invalid',
            password: hash,
            role: 'ORGANIZER',
            isActive: true,
            verified: true,
            organizerProfile: {
              create: {
                fullName: 'Responsável Fictício Aurora',
                cpf: '',
                phone: '',
                organizationName: 'Aurora — Demonstração com dados fictícios',
                verificationStatus: 'VERIFIED',
                reviewedAt: now,
                publicReviewMessage:
                  'Fixture exclusiva de demonstração, sem verificação de pessoa real.',
                currentPlan: 'PREMIUM',
                onboardingStatus: 'COMPLETE',
                monthlyFee: 0,
              },
            },
            organizerBrandProfile: {
              create: {
                publicName: 'Aurora Demo',
                slogan: 'Demonstração com dados fictícios',
              },
            },
          },
        });
        const titles = [
          'Jornada Aurora',
          'Experiência Horizonte',
          'Projeto Essência',
        ];
        const counts = [500, 450, 300];
        for (let i = 0; i < 3; i++) {
          await tx.campaign.create({
            data: {
              id: `${prefix}-campaign-${i}`,
              organizerId,
              slug: `${prefix}-${i}`,
              title: titles[i],
              shortDescription: 'Demonstração fictícia. Não efetue pagamentos.',
              status: 'PUBLISHED',
              purchasesBlocked: true,
              totalNumbers: 50000,
              numberPrice: 1,
              soldNumbers: counts[i] * 39,
              grossRevenue: counts[i] * 39,
              reservedNumbers: 0,
              minimumPurchase: 1,
              category: 'OTHER',
              mainPrizeName: 'Experiência fictícia de demonstração',
              publishedAt: new Date(now.getTime() - 30 * 86400000),
              drawDate: new Date(now.getTime() + 30 * 86400000),
              drawBasis: 'LOTERIA_FEDERAL',
              publishedRuleSnapshot: {
                testOnly: true,
                description: 'Demonstração, sem apuração oficial.',
              },
            },
          });
        }
        const users = [],
          purchases = [],
          payments = [],
          contacts = [],
          tickets = [];
        const numbers = [0, 0, 0];
        for (let i = 0; i < 1250; i++) {
          const id = `${prefix}-buyer-${i}`;
          const campaign = i < 500 ? 0 : i < 950 ? 1 : 2;
          const campaignId = `${prefix}-campaign-${campaign}`;
          // Increasing cohorts over the last 30 UTC days. Each buyer buys 39 units at R$1.
          const age = Math.floor(29 * (1 - Math.sqrt((i + 1) / 1250)));
          const at = new Date(now);
          at.setUTCDate(at.getUTCDate() - age);
          at.setUTCHours(10 + (i % 10), i % 60, 0, 0);
          if (at > now) at.setTime(now.getTime() - 60000);
          const order = `${prefix}-order-${i}`;
          users.push({
            id,
            name: `Participante Demo ${String(i + 1).padStart(4, '0')}`,
            email: `participante-${i + 1}@sortex.example.invalid`,
            password: hash,
            role: 'BUYER',
            isActive: false,
            city: 'Feira de Santana',
            state: 'BA',
          });
          purchases.push({
            id: order,
            buyerId: id,
            campaignId,
            status: 'PAID',
            selectionMode: 'RANDOM',
            quantity: 39,
            unitPrice: 1,
            subtotal: 39,
            total: 39,
            expiresAt: at,
            confirmedAt: at,
            createdAt: at,
            idempotencyKey: order,
          });
          payments.push({
            id: `${prefix}-payment-${i}`,
            purchaseId: order,
            buyerId: id,
            campaignId,
            organizerId,
            provider: 'MERCADO_PAGO',
            externalReference: `${prefix}-payment-${i}`,
            status: 'APPROVED',
            method: 'PIX',
            amount: 39,
            netAmount: 39,
            approvedAt: at,
            createdAt: at,
            metadata: {
              testOnly: true,
              simulated: true,
              noProviderRequest: true,
            },
          });
          contacts.push({
            id: `${prefix}-contact-${i}`,
            organizerId,
            userId: id,
            buyerId: id,
            name: users[i].name,
            email: users[i].email,
            source: 'PURCHASE',
            status: i < 125 ? 'VIP' : 'CUSTOMER',
            totalPurchases: 1,
            totalSpent: 39,
            totalTickets: 39,
            city: 'Feira de Santana',
            state: 'BA',
            lastPurchaseAt: at,
            firstSeenAt: at,
          });
          for (let n = 0; n < 39; n++)
            tickets.push({
              id: `${order}-ticket-${n}`,
              buyerId: id,
              purchaseId: order,
              campaignId,
              number: numbers[campaign]++,
              status: 'SOLD',
              createdAt: at,
            });
        }
        for (const [model, data] of [
          ['user', users],
          ['purchase', purchases],
          ['payment', payments],
          ['crmContact', contacts],
          ['ticket', tickets],
        ])
          for (let i = 0; i < data.length; i += 1000)
            await tx[model].createMany({ data: data.slice(i, i + 1000) });
        await tx.crmContact.createMany({
          data: Array.from({ length: 120 }, (_, i) => ({
            id: `${prefix}-lead-${i + 1}`,
            organizerId,
            name: `Contato Fictício ${i + 1}`,
            email: `contato-demo-${i + 1}@sortex.example.invalid`,
            source: 'MANUAL',
            status: i < 100 ? 'LEAD' : 'INACTIVE',
            city: 'Salvador',
            state: 'BA',
          })),
        });
        await tx.segment.create({
          data: {
            organizerId,
            name: 'Clientes VIP — demonstração',
            rules: { status: 'VIP' },
            contactCount: 125,
            lastCalculatedAt: now,
          },
        });
        await tx.crmTask.create({
          data: {
            organizerId,
            title: 'Revisar relacionamento dos clientes VIP',
            description: 'Tarefa fictícia, sem envio externo.',
            status: 'OPEN',
            dueAt: new Date(now.getTime() + 86400000),
          },
        });
        // Open and expired reservations add meaningful CRM/Advisor opportunities; none has a payment.
        for (let i = 0; i < 24; i++)
          await tx.purchase.create({
            data: {
              id: `${prefix}-reservation-${i}`,
              buyerId: users[i].id,
              campaignId: `${prefix}-campaign-${i % 3}`,
              status: i < 12 ? 'EXPIRED' : 'AWAITING_PAYMENT',
              selectionMode: 'RANDOM',
              quantity: 5,
              unitPrice: 1,
              subtotal: 5,
              total: 5,
              expiresAt: new Date(now.getTime() + (i < 12 ? -1 : 1) * 86400000),
            },
          });
      },
      { timeout: 240000, maxWait: 10000 },
    );
    // Private output must be redirected to an untracked, owner-only file by the operator.
    require('node:fs').writeFileSync(
      process.env.DEMO_PRIVATE_OUTPUT,
      JSON.stringify({
        organizerId,
        email: 'aurora-demo@sortex.example.invalid',
        password,
      }),
      { mode: 0o600, flag: 'wx' },
    );
    console.log(
      JSON.stringify({
        created: true,
        participants: 1250,
        confirmedSales: 48750,
        activeCampaigns: 3,
        paidOrders: 1250,
        tickets: 48750,
        pending: 12,
        expired: 12,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}
module.exports = { assertTarget };
if (require.main === module)
  seed().catch((error) => {
    if (process.env.DEMO_PRIVATE_OUTPUT)
      require('node:fs').writeFileSync(
        process.env.DEMO_PRIVATE_OUTPUT + '.error',
        String(error),
        { mode: 0o600 },
      );
    console.error(
      'Demo seed failed; inspect privately. Existing data was not overwritten.',
    );
    process.exitCode = 1;
  });
