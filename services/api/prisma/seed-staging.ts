import {
  CampaignCategory,
  CampaignDrawStatus,
  CampaignStatus,
  DrawBasis,
  GatewayProvider,
  LotteryDrawStatus,
  LotterySourceType,
  NumberSelectionMode,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PrismaClient,
  PurchaseStatus,
  TicketStatus,
  UserRole,
  VerificationStatus,
  WinnerStatus,
  PrizeType,
  AffiliateCommissionType,
  AffiliateAttributionModel,
  AffiliateProgramStatus,
  AffiliateStatus,
  CrmContactSource,
  CrmContactStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

function assertSafeTarget() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Seed proibido em produção.');
  if (process.env.ALLOW_TEST_SEED !== 'true')
    throw new Error('Defina ALLOW_TEST_SEED=true.');
  const url = new URL(process.env.DATABASE_URL ?? '');
  const database = url.pathname.toLowerCase();
  if (!/(staging|test|dev)/.test(database)) {
    throw new Error('O banco deve conter staging, test ou dev no nome.');
  }
  const password = process.env.TEST_SEED_PASSWORD ?? '';
  if (password.length < 12)
    throw new Error('TEST_SEED_PASSWORD deve ter 12+ caracteres.');
  return password;
}

async function main() {
  const password = await bcrypt.hash(assertSafeTarget(), 12);
  const users: ReadonlyArray<readonly [string, string, UserRole]> = [
    ['admin@sortex.example.invalid', 'Admin Homologação', UserRole.ADMIN],
    [
      'organizer1@sortex.example.invalid',
      'Organizador Alfa',
      UserRole.ORGANIZER,
    ],
    [
      'organizer2@sortex.example.invalid',
      'Organizador Beta',
      UserRole.ORGANIZER,
    ],
    ['buyer1@sortex.example.invalid', 'Comprador Teste 1', UserRole.BUYER],
    ['buyer2@sortex.example.invalid', 'Comprador Teste 2', UserRole.BUYER],
    ['buyer3@sortex.example.invalid', 'Comprador Teste 3', UserRole.BUYER],
    ['buyer4@sortex.example.invalid', 'Comprador Teste 4', UserRole.BUYER],
    ['buyer5@sortex.example.invalid', 'Comprador Teste 5', UserRole.BUYER],
  ];

  const created = new Map<string, { id: string }>();
  for (const [email, name, role] of users) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, role, password, isActive: true },
      create: { name, email, role, password, isActive: true, verified: true },
      select: { id: true },
    });
    created.set(email, user);
  }

  const admin = created.get('admin@sortex.example.invalid')!;
  const organizer = created.get('organizer1@sortex.example.invalid')!;
  const organizer2 = created.get('organizer2@sortex.example.invalid')!;
  const buyer = created.get('buyer1@sortex.example.invalid')!;

  for (const [index, user] of [organizer, organizer2].entries()) {
    await prisma.organizerProfile.upsert({
      where: { userId: user.id },
      update: { verificationStatus: VerificationStatus.VERIFIED },
      create: {
        userId: user.id,
        fullName: `Responsável Teste ${index + 1}`,
        cpf: `0000000000${index + 1}`,
        phone: `55000000000${index + 1}`,
        organizationName: `Organização Teste ${index + 1}`,
        verificationStatus: VerificationStatus.VERIFIED,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
  }

  const campaign = await prisma.campaign.upsert({
    where: { slug: 'campanha-piloto-homologacao' },
    update: {},
    create: {
      organizerId: organizer.id,
      title: 'Campanha Piloto de Homologação',
      slug: 'campanha-piloto-homologacao',
      shortDescription: 'Dados exclusivamente fictícios para teste.',
      status: CampaignStatus.PUBLISHED,
      category: CampaignCategory.CASH,
      mainPrizeName: 'Prêmio fictício de R$ 10.000',
      estimatedPrizeValue: new Prisma.Decimal(10000),
      totalNumbers: 10000,
      numberPrice: new Prisma.Decimal('0.10'),
      minimumPurchase: 10,
      maximumPurchasePerBuyer: 1000,
      numberSelectionMode: NumberSelectionMode.RANDOM,
      drawBasis: DrawBasis.LOTERIA_FEDERAL,
      salesStartAt: new Date(Date.now() - 86400000),
      drawDate: new Date(Date.now() + 7 * 86400000),
      publishedAt: new Date(),
      publishedRuleSnapshot: { version: 1, testOnly: true },
      promotions: {
        create: {
          name: 'Pacote teste 100',
          numberQuantity: 100,
          packagePrice: 8,
          discountRate: 20,
        },
      },
      instantPrizes: {
        create: {
          exactNumber: '00042',
          value: 50,
          description: 'PIX fictício',
          type: 'PIX',
        },
      },
    },
  });

  await prisma.campaign.upsert({
    where: { slug: 'rascunho-homologacao' },
    update: {},
    create: {
      organizerId: organizer2.id,
      title: 'Rascunho Homologação',
      slug: 'rascunho-homologacao',
    },
  });

  const purchase = await prisma.purchase.upsert({
    where: { idempotencyKey: 'seed-paid-purchase-v1' },
    update: {},
    create: {
      buyerId: buyer.id,
      campaignId: campaign.id,
      status: PurchaseStatus.PAID,
      selectionMode: NumberSelectionMode.RANDOM,
      quantity: 2,
      unitPrice: '0.10',
      subtotal: '0.20',
      total: '0.20',
      expiresAt: new Date(Date.now() + 86400000),
      confirmedAt: new Date(),
      idempotencyKey: 'seed-paid-purchase-v1',
    },
  });

  const ticket = await prisma.ticket.upsert({
    where: { campaignId_number: { campaignId: campaign.id, number: 42 } },
    update: { status: TicketStatus.SOLD },
    create: {
      purchaseId: purchase.id,
      campaignId: campaign.id,
      buyerId: buyer.id,
      number: 42,
      status: TicketStatus.SOLD,
    },
  });
  await prisma.ticket.upsert({
    where: { campaignId_number: { campaignId: campaign.id, number: 314 } },
    update: { status: TicketStatus.SOLD },
    create: {
      purchaseId: purchase.id,
      campaignId: campaign.id,
      buyerId: buyer.id,
      number: 314,
      status: TicketStatus.SOLD,
    },
  });

  await prisma.payment.upsert({
    where: { externalReference: 'seed-payment-approved-v1' },
    update: {},
    create: {
      purchaseId: purchase.id,
      buyerId: buyer.id,
      campaignId: campaign.id,
      organizerId: organizer.id,
      provider: GatewayProvider.MERCADO_PAGO,
      providerPaymentId: 'TEST-SEED-APPROVED-1',
      externalReference: 'seed-payment-approved-v1',
      method: PaymentMethod.PIX,
      status: PaymentStatus.APPROVED,
      amount: '0.20',
      platformFee: '0.01',
      platformFeeRate: '2.9',
      gatewayFee: '0.01',
      netAmount: '0.18',
      approvedAt: new Date(),
      metadata: { testOnly: true },
    },
  });

  const lottery = await prisma.lotteryDraw.upsert({
    where: {
      lotteryName_extractionNumber: {
        lotteryName: 'Loteria Federal',
        extractionNumber: 'TEST-0001',
      },
    },
    update: {},
    create: {
      extractionNumber: 'TEST-0001',
      drawDate: new Date(),
      firstPrize: '00314',
      secondPrize: '12345',
      thirdPrize: '00042',
      fourthPrize: '54321',
      fifthPrize: '99999',
      sourceType: LotterySourceType.MANUAL,
      status: LotteryDrawStatus.VERIFIED,
      enteredByUserId: admin.id,
      reviewedByUserId: admin.id,
      reviewedAt: new Date(),
      notes: 'Resultado fictício de homologação.',
    },
  });
  const auditHash = createHash('sha256')
    .update(`${campaign.id}:${lottery.id}:314:test-v1`)
    .digest('hex');
  const draw = await prisma.campaignDraw.upsert({
    where: { campaignId: campaign.id },
    update: {},
    create: {
      campaignId: campaign.id,
      lotteryDrawId: lottery.id,
      ruleSnapshot: { version: 1, testOnly: true },
      resultSnapshot: { raw: '00314', normalized: '00314' },
      winningNumber: '00314',
      normalizedWinningNumber: '00314',
      status: CampaignDrawStatus.CONFIRMED,
      executedByUserId: admin.id,
      confirmedByUserId: admin.id,
      confirmedAt: new Date(),
      auditHash,
      notes: 'Sorteio fictício de homologação.',
    },
  });
  await prisma.winner.upsert({
    where: { publicVerificationCode: 'TEST-WINNER-0001' },
    update: {},
    create: {
      campaignId: campaign.id,
      campaignDrawId: draw.id,
      ticketId: ticket.id,
      purchaseId: purchase.id,
      buyerId: buyer.id,
      prizeType: PrizeType.MAIN_PRIZE,
      prizeName: 'Prêmio fictício',
      prizeValue: 10000,
      winningNumber: '00314',
      status: WinnerStatus.IDENTIFIED,
      publicVerificationCode: 'TEST-WINNER-0001',
      publicDisplayName: 'Comprador T.',
      publicCity: 'Cidade Teste',
    },
  });

  const program = await prisma.affiliateProgram.upsert({
    where: { id: 'seed-affiliate-program' },
    update: {},
    create: {
      id: 'seed-affiliate-program',
      organizerId: organizer.id,
      campaignId: campaign.id,
      name: 'Programa Teste',
      status: AffiliateProgramStatus.ACTIVE,
      commissionType: AffiliateCommissionType.PERCENTAGE,
      commissionPercentage: 10,
      attributionModel: AffiliateAttributionModel.LAST_CLICK,
    },
  });
  await prisma.affiliate.upsert({
    where: { referralCode: 'TESTAFF1' },
    update: {},
    create: {
      organizerId: organizer.id,
      programId: program.id,
      name: 'Afiliado Teste',
      email: 'affiliate@sortex.example.invalid',
      status: AffiliateStatus.ACTIVE,
      referralCode: 'TESTAFF1',
      slug: 'afiliado-teste',
      approvedAt: new Date(),
    },
  });
  await prisma.crmContact.upsert({
    where: {
      organizerId_userId: { organizerId: organizer.id, userId: buyer.id },
    },
    update: {},
    create: {
      organizerId: organizer.id,
      userId: buyer.id,
      buyerId: buyer.id,
      name: 'Comprador Teste 1',
      email: 'buyer1@sortex.example.invalid',
      source: CrmContactSource.PURCHASE,
      status: CrmContactStatus.CUSTOMER,
      totalPurchases: 1,
      totalSpent: '0.20',
      totalTickets: 2,
    },
  });
  await prisma.notification.upsert({
    where: { id: 'seed-notification-1' },
    update: {},
    create: {
      id: 'seed-notification-1',
      userId: buyer.id,
      type: 'PAYMENT_APPROVED',
      title: 'Pagamento fictício aprovado',
      message: 'Notificação exclusiva de homologação.',
    },
  });
  console.info('Seed de homologação concluído para contas example.invalid.');
}

main().finally(() => prisma.$disconnect());
