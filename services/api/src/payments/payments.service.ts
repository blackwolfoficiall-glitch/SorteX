import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GatewayProvider,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  PurchaseStatus,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCardPaymentDto } from './dto/create-card-payment.dto';
import type { CreatePixPaymentDto } from './dto/create-pix-payment.dto';
import type {
  GatewayPaymentResult,
  GatewayWebhookContext,
} from './gateways/payment-gateway.provider';
import { PaymentGatewayService } from './gateways/payment-gateway.service';
import { PaymentFeeService } from './payment-fee.service';
import { InstantPrizeDetectionService } from '../draws/instant-prize-detection.service';
import { FinancialLedgerService } from '../finance/financial-ledger.service';
import { AffiliateCommissionService } from '../affiliates/affiliate-commission.service';
import { CrmSyncService } from '../crm/crm-sync.service';
import { CampaignMilestonesService } from '../campaigns/campaign-milestones.service';

const paymentInclude = {
  purchase: {
    include: {
      tickets: { orderBy: { number: 'asc' as const } },
      buyer: { select: { email: true } },
      campaign: {
        select: {
          id: true,
          slug: true,
          title: true,
          coverImage: true,
          organizerId: true,
        },
      },
    },
  },
} as const satisfies Prisma.PaymentInclude;

type PaymentPayload = Prisma.PaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateways: PaymentGatewayService,
    private readonly fees: PaymentFeeService,
    private readonly instantPrizes: InstantPrizeDetectionService,
    private readonly ledger: FinancialLedgerService,
    private readonly affiliateCommissions: AffiliateCommissionService,
    private readonly crmSync: CrmSyncService,
    private readonly campaignMilestones: CampaignMilestonesService,
  ) {}

  createPix(user: AuthenticatedUser, data: CreatePixPaymentDto) {
    return this.create(user, data.purchaseId, PaymentMethod.PIX);
  }

  createCard(user: AuthenticatedUser, data: CreateCardPaymentDto) {
    return this.create(user, data.purchaseId, PaymentMethod.CREDIT_CARD, {
      cardToken: data.cardToken,
      paymentMethodId: data.paymentMethodId,
      installments: data.installments,
    });
  }

  async get(id: string, user: AuthenticatedUser) {
    this.ensureBuyer(user);
    return this.sanitize(await this.findOwned(id, user.id));
  }

  async getByPurchase(purchaseId: string, user: AuthenticatedUser) {
    this.ensureBuyer(user);
    const payment = await this.prisma.payment.findFirst({
      where: { purchaseId, buyerId: user.id },
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    return this.sanitize(payment);
  }

  async refreshStatus(id: string, user: AuthenticatedUser) {
    this.ensureBuyer(user);
    const payment = await this.findOwned(id, user.id);
    const terminalStatuses: PaymentStatus[] = [
      PaymentStatus.APPROVED,
      PaymentStatus.REJECTED,
      PaymentStatus.CANCELLED,
      PaymentStatus.EXPIRED,
      PaymentStatus.REFUNDED,
      PaymentStatus.CHARGEBACK,
    ];
    if (terminalStatuses.includes(payment.status))
      return this.sanitize(payment);
    if (!payment.providerPaymentId) {
      throw new ConflictException(
        'O PIX ainda não foi gerado. Tente gerar o pagamento novamente.',
      );
    }

    const gatewayPayment = await this.gateways
      .get(payment.provider)
      .getPaymentStatus(payment.providerPaymentId);
    const fingerprint = createHash('sha256')
      .update(
        `${payment.id}:${gatewayPayment.status}:${gatewayPayment.rawStatus || ''}`,
      )
      .digest('hex')
      .slice(0, 24);
    const providerEventId = `poll:${payment.id}:${fingerprint}`;
    const existingEvent = await this.prisma.paymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: payment.provider,
          providerEventId,
        },
      },
    });
    if (existingEvent?.processed) {
      return this.sanitize(await this.findOwned(id, user.id));
    }
    const event =
      existingEvent ||
      (await this.prisma.paymentEvent.create({
        data: {
          paymentId: payment.id,
          provider: payment.provider,
          providerEventId,
          eventType: 'PAYMENT_STATUS_POLLED',
          payload: {
            source: 'POLLING',
            status: gatewayPayment.status,
          },
        },
      }));
    try {
      const updated = await this.processGatewayUpdate(event.id, gatewayPayment);
      if (updated.status === PaymentStatus.APPROVED) {
        await this.instantPrizes.detectForPurchase(updated.purchaseId);
      }
      await this.auditPayment(
        payment.id,
        user,
        'PAYMENT_STATUS_REFRESHED',
        payment.status,
        updated.status,
      );
      return this.sanitize(await this.findOwned(id, user.id));
    } catch (error) {
      await this.prisma.paymentEvent.update({
        where: { id: event.id },
        data: { errorMessage: this.safeError(error) },
      });
      throw error;
    }
  }

  async listMine(user: AuthenticatedUser, status?: PaymentStatus) {
    this.ensureBuyer(user);
    const payments = await this.prisma.payment.findMany({
      where: { buyerId: user.id, ...(status ? { status } : {}) },
      include: paymentInclude,
      orderBy: { createdAt: 'desc' },
    });
    return payments.map((payment) => this.sanitize(payment));
  }

  async cancel(id: string, user: AuthenticatedUser) {
    this.ensureBuyer(user);
    const current = await this.findOwned(id, user.id);
    const cancellableStatuses: PaymentStatus[] = [
      PaymentStatus.CREATED,
      PaymentStatus.PENDING,
      PaymentStatus.PROCESSING,
    ];
    if (!cancellableStatuses.includes(current.status)) {
      throw new BadRequestException('Este pagamento não pode ser cancelado.');
    }
    if (current.providerPaymentId) {
      await this.gateways
        .get(current.provider)
        .cancelPayment(current.providerPaymentId);
    }
    return this.prisma.$transaction(async (transaction) => {
      const payment = await transaction.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.CANCELLED,
          cancelledAt: new Date(),
          activePurchaseKey: null,
        },
        include: paymentInclude,
      });
      await this.releasePurchase(
        transaction,
        current.purchaseId,
        PurchaseStatus.CANCELLED,
      );
      return this.sanitize(payment);
    });
  }

  async requestRefund(id: string, user: AuthenticatedUser) {
    this.ensureBuyer(user);
    const payment = await this.findOwned(id, user.id);
    if (payment.status !== PaymentStatus.APPROVED) {
      throw new BadRequestException(
        'Somente pagamentos aprovados podem solicitar análise de estorno.',
      );
    }
    const currentMetadata = this.jsonObject(payment.metadata);
    await this.prisma.payment.update({
      where: { id },
      data: {
        metadata: {
          ...currentMetadata,
          refundRequest: {
            status: 'REQUESTED',
            requestedAt: new Date().toISOString(),
          },
        },
      },
    });
    return {
      message: 'Solicitação registrada para análise manual.',
      status: 'REQUESTED',
    };
  }

  publicConfig() {
    return {
      provider: GatewayProvider.MERCADO_PAGO,
      environment: process.env.PAYMENT_ENV || 'sandbox',
      publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY || null,
      maxInstallments: Math.min(
        12,
        Math.max(1, Number(process.env.MAX_CARD_INSTALLMENTS || 12)),
      ),
      estimatedFeePercent: Math.max(
        0,
        Number(process.env.MERCADO_PAGO_ESTIMATED_FEE_PERCENT || 0),
      ),
    };
  }

  async handleMercadoPagoWebhook(context: GatewayWebhookContext) {
    const provider = this.gateways.get(GatewayProvider.MERCADO_PAGO);
    provider.validateWebhook(context);
    const event = provider.parseWebhookEvent(context);
    let storedEvent = await this.prisma.paymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: GatewayProvider.MERCADO_PAGO,
          providerEventId: event.providerEventId,
        },
      },
    });
    if (storedEvent?.processed) return { received: true, duplicate: true };
    if (!storedEvent) {
      storedEvent = await this.prisma.paymentEvent.create({
        data: {
          provider: GatewayProvider.MERCADO_PAGO,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          payload: event.payload as Prisma.InputJsonValue,
        },
      });
    }

    try {
      const gatewayPayment = await provider.getPaymentStatus(event.resourceId);
      const result = await this.processGatewayUpdate(
        storedEvent.id,
        gatewayPayment,
      );
      if (result.status === PaymentStatus.APPROVED) {
        await this.instantPrizes.detectForPurchase(result.purchaseId);
      }
      return { received: true, duplicate: false, status: result.status };
    } catch (error) {
      await this.prisma.paymentEvent.update({
        where: { id: storedEvent.id },
        data: {
          errorMessage: this.safeError(error),
        },
      });
      throw error;
    }
  }

  async organizerSummary(user: AuthenticatedUser) {
    if (user.role !== UserRole.ORGANIZER) {
      throw new ForbiddenException('Acesso exclusivo do organizador.');
    }
    const where = { organizerId: user.id };
    const [approved, pending, rejected, sums, latest] = await Promise.all([
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.APPROVED },
      }),
      this.prisma.payment.count({
        where: {
          ...where,
          status: {
            in: [
              PaymentStatus.CREATED,
              PaymentStatus.PENDING,
              PaymentStatus.PROCESSING,
            ],
          },
        },
      }),
      this.prisma.payment.count({
        where: { ...where, status: PaymentStatus.REJECTED },
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.APPROVED },
        _sum: {
          amount: true,
          platformFee: true,
          gatewayFee: true,
          netAmount: true,
        },
      }),
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          method: true,
          status: true,
          amount: true,
          platformFee: true,
          gatewayFee: true,
          netAmount: true,
          createdAt: true,
          purchase: {
            select: {
              quantity: true,
              buyer: { select: { name: true } },
              campaign: { select: { title: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    return {
      approved,
      pending,
      rejected,
      grossRevenue: Number(sums._sum.amount || 0),
      platformFee: Number(sums._sum.platformFee || 0),
      gatewayFee: Number(sums._sum.gatewayFee || 0),
      estimatedNetAmount: Number(sums._sum.netAmount || 0),
      latest: latest.map((payment) => ({
        ...payment,
        amount: Number(payment.amount),
        platformFee: Number(payment.platformFee),
        gatewayFee: Number(payment.gatewayFee),
        netAmount: Number(payment.netAmount),
      })),
    };
  }

  private async create(
    user: AuthenticatedUser,
    purchaseId: string,
    method: PaymentMethod,
    card?: {
      cardToken: string;
      paymentMethodId: string;
      installments: number;
    },
  ) {
    this.ensureBuyer(user);
    const prepared = await this.preparePayment(
      user,
      purchaseId,
      method,
      card?.installments,
    );
    if (prepared.existing && prepared.payment.providerPaymentId) {
      return this.sanitize(prepared.payment);
    }
    const provider = this.gateways.get(prepared.payment.provider);
    const names = user.name.trim().split(/\s+/);
    const input = {
      amount: prepared.payment.amount.toFixed(2),
      externalReference: prepared.payment.externalReference,
      description: `SorteX - ${prepared.payment.purchase.campaign.title}`,
      payer: {
        email: user.email,
        firstName: names[0],
        lastName: names.slice(1).join(' ') || undefined,
        identificationType: user.cpf ? 'CPF' : undefined,
        identificationNumber: user.cpf || undefined,
      },
      expiresAt:
        prepared.payment.expiresAt || prepared.payment.purchase.expiresAt,
      idempotencyKey: prepared.payment.id,
    };

    try {
      const gatewayResult =
        method === PaymentMethod.PIX
          ? await provider.createPixPayment(input)
          : await provider.createCardPayment({
              ...input,
              cardToken: card!.cardToken,
              paymentMethodId: card!.paymentMethodId,
              installments: card!.installments,
            });
      const storedStatus =
        gatewayResult.status === PaymentStatus.APPROVED
          ? PaymentStatus.PROCESSING
          : gatewayResult.status;
      const updated = await this.prisma.payment.update({
        where: { id: prepared.payment.id },
        data: {
          providerPaymentId: gatewayResult.providerPaymentId,
          status: storedStatus,
          pixQrCode: gatewayResult.pixQrCode,
          pixQrCodeBase64: gatewayResult.pixQrCodeBase64,
          pixCopyPaste: gatewayResult.pixCopyPaste,
          boletoUrl: gatewayResult.boletoUrl,
          cardBrand: gatewayResult.cardBrand,
          cardLastFour: gatewayResult.cardLastFour,
          installments: gatewayResult.installments ?? card?.installments,
          failureReason: gatewayResult.failureReason,
          metadata: { providerStatus: gatewayResult.rawStatus || '' },
          ...(storedStatus === PaymentStatus.REJECTED
            ? {
                rejectedAt: new Date(),
                activePurchaseKey: null,
              }
            : {}),
        },
        include: paymentInclude,
      });
      await this.auditPayment(
        updated.id,
        user,
        'PAYMENT_PIX_CREATED',
        prepared.payment.status,
        updated.status,
      );
      return this.sanitize(updated);
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: prepared.payment.id },
        data: {
          failureReason: this.safeError(error),
        },
      });
      await this.auditPayment(
        prepared.payment.id,
        user,
        'PAYMENT_PROVIDER_ERROR',
        prepared.payment.status,
        prepared.payment.status,
      );
      throw error;
    }
  }

  private async preparePayment(
    user: AuthenticatedUser,
    purchaseId: string,
    method: PaymentMethod,
    installments?: number,
  ) {
    return this.prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.payment.findUnique({
          where: { activePurchaseKey: purchaseId },
          include: paymentInclude,
        });
        if (existing) {
          if (existing.buyerId !== user.id)
            throw new ForbiddenException('Compra pertence a outro usuário.');
          if (existing.method !== method)
            throw new ConflictException(
              'Já existe um pagamento ativo com outro método.',
            );
          return { payment: existing, existing: true };
        }

        const purchase = await transaction.purchase.findFirst({
          where: { id: purchaseId, buyerId: user.id },
          include: {
            promotion: true,
            buyer: true,
            tickets: true,
            campaign: {
              include: {
                organizer: { include: { organizerProfile: true } },
              },
            },
          },
        });
        if (!purchase) throw new NotFoundException('Compra não encontrada.');
        if (purchase.status !== PurchaseStatus.AWAITING_PAYMENT) {
          throw new BadRequestException(
            'A compra não está aguardando pagamento.',
          );
        }
        if (purchase.expiresAt <= new Date()) {
          throw new BadRequestException('A reserva expirou. Faça uma nova.');
        }
        if (
          purchase.tickets.length !== purchase.quantity ||
          purchase.tickets.some(
            (ticket) => ticket.status !== TicketStatus.RESERVED,
          )
        ) {
          throw new ConflictException('Os títulos não estão mais reservados.');
        }
        const amount = this.recalculateAmount(purchase);
        const fee = await this.fees.calculate(transaction, {
          amount,
          campaignId: purchase.campaignId,
          campaignCreatedAt: purchase.campaign.createdAt,
          campaignFeeWaived: purchase.campaign.platformFeeWaived,
          campaignCustomRate: purchase.campaign.customPlatformFee,
          organizerId: purchase.campaign.organizerId,
          profile: purchase.campaign.organizer.organizerProfile,
        });
        const minimumWindowSeconds = Math.max(
          1800,
          Number(process.env.PAYMENT_RESERVATION_TTL_SECONDS || 1800),
        );
        const expiresAt = new Date(
          Math.max(
            purchase.expiresAt.getTime(),
            Date.now() + minimumWindowSeconds * 1000,
          ),
        );
        await transaction.purchase.update({
          where: { id: purchase.id },
          data: { expiresAt },
        });
        await transaction.ticket.updateMany({
          where: {
            purchaseId: purchase.id,
            status: TicketStatus.RESERVED,
          },
          data: { reservedUntil: expiresAt },
        });
        const id = randomUUID();
        const payment = await transaction.payment.create({
          data: {
            id,
            purchaseId: purchase.id,
            buyerId: purchase.buyerId,
            campaignId: purchase.campaignId,
            organizerId: purchase.campaign.organizerId,
            provider: GatewayProvider.MERCADO_PAGO,
            externalReference: `sortex-${purchase.id}-${id}`,
            activePurchaseKey: purchase.id,
            method,
            status: PaymentStatus.CREATED,
            amount,
            platformFee: fee.platformFee,
            platformFeeRate: fee.platformFeeRate,
            gatewayFee: fee.gatewayFee,
            gatewayFeeRate: fee.gatewayFeeRate,
            netAmount: fee.netAmount,
            installments,
            expiresAt,
            metadata: {
              firstCampaignFreeApplied: fee.firstCampaignFreeApplied,
              campaignFeeWaived: fee.campaignFeeWaived,
              founder: fee.founder,
              vip: fee.vip,
              platformFeeRule: fee.reason,
              platformFeeSource: fee.source,
              paymentEnvironment: process.env.PAYMENT_ENV || 'sandbox',
            },
          },
          include: paymentInclude,
        });
        return { payment, existing: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private recalculateAmount(purchase: {
    quantity: number;
    unitPrice: Prisma.Decimal;
    promotion: { numberQuantity: number; packagePrice: Prisma.Decimal } | null;
  }) {
    const subtotal = new Prisma.Decimal(purchase.unitPrice).mul(
      purchase.quantity,
    );
    if (purchase.promotion) {
      if (purchase.promotion.numberQuantity !== purchase.quantity) {
        throw new ConflictException('Promoção incompatível com a compra.');
      }
      return new Prisma.Decimal(purchase.promotion.packagePrice);
    }
    return subtotal;
  }

  private async processGatewayUpdate(
    eventId: string,
    gateway: GatewayPaymentResult,
  ) {
    const result = await this.prisma.$transaction(
      async (transaction) => {
        const payment = await transaction.payment.findFirst({
          where: {
            provider: GatewayProvider.MERCADO_PAGO,
            OR: [
              { providerPaymentId: gateway.providerPaymentId },
              { externalReference: gateway.externalReference },
            ],
          },
          include: {
            purchase: { include: { tickets: true } },
            campaign: true,
          },
        });
        if (!payment)
          throw new NotFoundException('Referência externa inválida.');
        if (gateway.externalReference !== payment.externalReference) {
          throw new ConflictException('Referência externa divergente.');
        }
        if (!new Prisma.Decimal(gateway.amount).equals(payment.amount)) {
          throw new ConflictException('Valor do webhook divergente.');
        }
        if (
          payment.status === PaymentStatus.APPROVED &&
          payment.purchase.status === PurchaseStatus.PAID
        ) {
          await transaction.paymentEvent.update({
            where: { id: eventId },
            data: {
              processed: true,
              processedAt: new Date(),
              paymentId: payment.id,
            },
          });
          return payment;
        }

        if (gateway.status === PaymentStatus.APPROVED) {
          const closedPurchases: PurchaseStatus[] = [
            PurchaseStatus.CANCELLED,
            PurchaseStatus.EXPIRED,
          ];
          if (closedPurchases.includes(payment.purchase.status)) {
            throw new ConflictException(
              'Pagamento confirmado após encerramento da reserva; requer análise manual.',
            );
          }
          const sold = await transaction.ticket.updateMany({
            where: {
              purchaseId: payment.purchaseId,
              status: TicketStatus.RESERVED,
            },
            data: { status: TicketStatus.SOLD, reservedUntil: null },
          });
          if (sold.count !== payment.purchase.quantity) {
            throw new ConflictException(
              'Quantidade de títulos reservados divergente.',
            );
          }
          const now = new Date();
          await transaction.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.APPROVED,
              approvedAt: now,
              failureReason: null,
            },
          });
          await transaction.purchase.update({
            where: { id: payment.purchaseId },
            data: { status: PurchaseStatus.PAID, confirmedAt: now },
          });
          await transaction.campaign.update({
            where: { id: payment.campaignId },
            data: {
              reservedNumbers: Math.max(
                0,
                payment.campaign.reservedNumbers - sold.count,
              ),
              soldNumbers: { increment: sold.count },
              grossRevenue: { increment: payment.amount },
            },
          });
          await this.ledger.recordApprovedPayment(transaction, payment.id);
          await this.affiliateCommissions.recordApprovedPayment(
            transaction,
            payment.id,
          );
          await this.crmSync.syncApprovedPayment(transaction, payment.id);
        } else {
          await this.applyNonApprovedStatus(transaction, payment, gateway);
          if (
            gateway.status === PaymentStatus.REFUNDED ||
            gateway.status === PaymentStatus.CHARGEBACK
          ) {
            await this.ledger.recordReversal(
              transaction,
              payment.id,
              gateway.status,
            );
            await this.affiliateCommissions.reversePayment(
              transaction,
              payment.id,
              gateway.status,
            );
          }
        }
        await transaction.paymentEvent.update({
          where: { id: eventId },
          data: {
            paymentId: payment.id,
            processed: true,
            processedAt: new Date(),
            errorMessage: null,
          },
        });
        return transaction.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (result.status === PaymentStatus.APPROVED) {
      await this.campaignMilestones.evaluateReached(result.campaignId);
    }
    return result;
  }

  private async applyNonApprovedStatus(
    transaction: Prisma.TransactionClient,
    payment: Prisma.PaymentGetPayload<{
      include: { purchase: { include: { tickets: true } }; campaign: true };
    }>,
    gateway: GatewayPaymentResult,
  ) {
    const terminalStatuses: PaymentStatus[] = [
      PaymentStatus.REJECTED,
      PaymentStatus.CANCELLED,
      PaymentStatus.EXPIRED,
    ];
    const terminal = terminalStatuses.includes(gateway.status);
    await transaction.payment.update({
      where: { id: payment.id },
      data: {
        status: gateway.status,
        failureReason: gateway.failureReason,
        activePurchaseKey: terminal ? null : payment.purchaseId,
        rejectedAt:
          gateway.status === PaymentStatus.REJECTED ? new Date() : undefined,
        cancelledAt:
          gateway.status === PaymentStatus.CANCELLED ? new Date() : undefined,
      },
    });
    const releasableStatuses: PaymentStatus[] = [
      PaymentStatus.CANCELLED,
      PaymentStatus.EXPIRED,
    ];
    if (releasableStatuses.includes(gateway.status)) {
      await this.releasePurchase(
        transaction,
        payment.purchaseId,
        gateway.status === PaymentStatus.EXPIRED
          ? PurchaseStatus.EXPIRED
          : PurchaseStatus.CANCELLED,
      );
    }
  }

  private async releasePurchase(
    transaction: Prisma.TransactionClient,
    purchaseId: string,
    status: PurchaseStatus,
  ) {
    const purchase = await transaction.purchase.findUnique({
      where: { id: purchaseId },
      include: { campaign: true },
    });
    if (!purchase || purchase.status === PurchaseStatus.PAID) return;
    const released = await transaction.ticket.deleteMany({
      where: { purchaseId, status: TicketStatus.RESERVED },
    });
    await transaction.purchase.update({
      where: { id: purchaseId },
      data: {
        status,
        cancelledAt:
          status === PurchaseStatus.CANCELLED ? new Date() : undefined,
      },
    });
    await transaction.campaign.update({
      where: { id: purchase.campaignId },
      data: {
        reservedNumbers: Math.max(
          0,
          purchase.campaign.reservedNumbers - released.count,
        ),
      },
    });
  }

  private async findOwned(id: string, buyerId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, buyerId },
      include: paymentInclude,
    });
    if (!payment) throw new NotFoundException('Pagamento não encontrado.');
    return payment;
  }

  private ensureBuyer(user: AuthenticatedUser) {
    if (user.role !== UserRole.BUYER) {
      throw new ForbiddenException('Acesso exclusivo do comprador.');
    }
  }

  private sanitize(payment: PaymentPayload) {
    const profileComplete = !payment.purchase.buyer?.email?.endsWith(
      '@temporary.sortex.local',
    );
    return {
      id: payment.id,
      purchaseId: payment.purchaseId,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      method: payment.method,
      status: payment.status,
      amount: Number(payment.amount),
      platformFee: Number(payment.platformFee),
      gatewayFee: Number(payment.gatewayFee),
      netAmount: Number(payment.netAmount),
      currency: payment.currency,
      pixQrCode: payment.pixQrCode,
      pixQrCodeBase64: payment.pixQrCodeBase64,
      pixCopyPaste: payment.pixCopyPaste,
      boletoUrl: payment.boletoUrl,
      cardLastFour: payment.cardLastFour,
      cardBrand: payment.cardBrand,
      installments: payment.installments,
      expiresAt: payment.expiresAt,
      approvedAt: payment.approvedAt,
      rejectedAt: payment.rejectedAt,
      failureReason: payment.failureReason,
      createdAt: payment.createdAt,
      profileComplete,
      purchase: {
        id: payment.purchase.id,
        status: payment.purchase.status,
        quantity: payment.purchase.quantity,
        subtotal: Number(payment.purchase.subtotal),
        discount: Number(payment.purchase.discount),
        total: Number(payment.purchase.total),
        confirmedAt: payment.purchase.confirmedAt,
        expiresAt: payment.purchase.expiresAt,
        tickets:
          payment.status === PaymentStatus.APPROVED && profileComplete
            ? payment.purchase.tickets.map((ticket) => ({
                number: ticket.number,
                status: ticket.status,
              }))
            : [],
        campaign: payment.purchase.campaign,
      },
    };
  }

  private jsonObject(value: Prisma.JsonValue | null) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value
      : {};
  }

  private safeError(error: unknown) {
    if (error instanceof Error) return error.message.slice(0, 500);
    if (
      error &&
      typeof error === 'object' &&
      'errors' in error &&
      Array.isArray(error.errors)
    ) {
      const providerErrors = error.errors as unknown[];
      const codes = providerErrors
        .map((item) => {
          if (!item || typeof item !== 'object' || !('code' in item)) return '';
          const code = (item as { code?: unknown }).code;
          return typeof code === 'string' ? code : '';
        })
        .filter(Boolean)
        .slice(0, 5);
      if (codes.length)
        return `Mercado Pago: ${codes.join(', ')}`.slice(0, 500);
    }
    return 'Erro não identificado no provider.';
  }

  private auditPayment(
    paymentId: string,
    user: AuthenticatedUser,
    action: string,
    previousStatus: PaymentStatus,
    newStatus: PaymentStatus,
  ) {
    return this.prisma.auditLog.create({
      data: {
        entityType: 'PAYMENT',
        entityId: paymentId,
        action,
        actorUserId: user.id,
        actorRole: user.role,
        previousData: { status: previousStatus },
        newData: { status: newStatus },
        metadata: { source: 'BUYER_API' },
      },
    });
  }
}
