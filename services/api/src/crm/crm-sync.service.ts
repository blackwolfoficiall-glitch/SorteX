import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AutomationActionType,
  AutomationStatus,
  AutomationTriggerType,
  CrmChannel,
  CrmContactSource,
  CrmContactStatus,
  CrmInteractionType,
  OutboundMessageStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class CrmSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async testAutomation(organizerId: string, automationId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizerId, status: { in: ['ACTIVE', 'TRIAL'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription?.sandboxMode)
      throw new BadRequestException(
        'O teste manual está disponível somente no modo sandbox.',
      );
    const automation = await this.prisma.automation.findFirst({
      where: { id: automationId, organizerId },
    });
    if (!automation) throw new NotFoundException('Automação não encontrada.');
    if (automation.status !== AutomationStatus.ACTIVE)
      throw new BadRequestException(
        'Ative a automação antes de executar o teste.',
      );
    const contact = await this.prisma.crmContact.findFirst({
      where: { organizerId },
    });
    if (!contact)
      throw new BadRequestException(
        'Crie um contato de teste antes de executar a automação.',
      );
    await this.prisma.$transaction((tx) =>
      this.executeAutomation(tx, automation, contact.id, {
        sandboxTest: true,
        triggeredAt: new Date().toISOString(),
      }),
    );
    return this.prisma.automation.findUnique({ where: { id: automationId } });
  }
  async syncReservation(
    tx: Prisma.TransactionClient | any,
    purchaseId: string,
  ) {
    try {
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { buyer: true, campaign: true },
      });
      if (!purchase) return { skipped: true };
      const contact = await tx.crmContact.upsert({
        where: {
          organizerId_userId: {
            organizerId: purchase.campaign.organizerId,
            userId: purchase.buyerId,
          },
        },
        create: {
          organizerId: purchase.campaign.organizerId,
          userId: purchase.buyerId,
          buyerId: purchase.buyerId,
          name: purchase.buyer.name,
          email: purchase.buyer.email,
          phone: purchase.buyer.phone,
          city: purchase.buyer.city,
          state: purchase.buyer.state,
          source: CrmContactSource.PURCHASE,
          status: CrmContactStatus.LEAD,
          lastInteractionAt: purchase.createdAt,
        },
        update: {
          name: purchase.buyer.name,
          email: purchase.buyer.email,
          phone: purchase.buyer.phone,
          city: purchase.buyer.city,
          state: purchase.buyer.state,
          lastInteractionAt: purchase.createdAt,
        },
      });
      const existing = await tx.crmInteraction.findFirst({
        where: {
          organizerId: purchase.campaign.organizerId,
          type: CrmInteractionType.PURCHASE,
          purchaseId,
        },
      });
      if (!existing)
        await tx.crmInteraction.create({
          data: {
            organizerId: purchase.campaign.organizerId,
            contactId: contact.id,
            type: CrmInteractionType.PURCHASE,
            channel: CrmChannel.PLATFORM,
            title: 'Reserva criada',
            campaignId: purchase.campaignId,
            purchaseId,
            metadata: { quantity: purchase.quantity, amount: purchase.total },
            occurredAt: purchase.createdAt,
          },
        });
      await this.runAutomations(
        tx,
        purchase.campaign.organizerId,
        AutomationTriggerType.PURCHASE_PENDING,
        contact.id,
        { campaignId: purchase.campaignId, purchaseId },
      );
      return { contactId: contact.id };
    } catch {
      return { failed: true };
    }
  }
  async syncExpiredReservation(
    tx: Prisma.TransactionClient | any,
    purchaseId: string,
  ) {
    try {
      const purchase = await tx.purchase.findUnique({
        where: { id: purchaseId },
        include: { campaign: true },
      });
      if (!purchase) return;
      const contact = await tx.crmContact.findUnique({
        where: {
          organizerId_userId: {
            organizerId: purchase.campaign.organizerId,
            userId: purchase.buyerId,
          },
        },
      });
      if (!contact) return;
      const existing = await tx.crmInteraction.findFirst({
        where: {
          organizerId: purchase.campaign.organizerId,
          type: CrmInteractionType.AUTOMATION,
          purchaseId,
          title: 'Reserva expirada',
        },
      });
      if (!existing)
        await tx.crmInteraction.create({
          data: {
            organizerId: purchase.campaign.organizerId,
            contactId: contact.id,
            type: CrmInteractionType.AUTOMATION,
            title: 'Reserva expirada',
            campaignId: purchase.campaignId,
            purchaseId,
          },
        });
      await this.runAutomations(
        tx,
        purchase.campaign.organizerId,
        AutomationTriggerType.RESERVATION_EXPIRED,
        contact.id,
        { campaignId: purchase.campaignId, purchaseId },
      );
    } catch {}
  }
  async syncApprovedPayment(tx: Prisma.TransactionClient, paymentId: string) {
    try {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { purchase: true, buyer: true, campaign: true },
      });
      if (!payment || payment.status !== PaymentStatus.APPROVED)
        return { skipped: true };
      if (
        await tx.crmInteraction.findFirst({
          where: {
            organizerId: payment.organizerId,
            type: CrmInteractionType.PAYMENT,
            paymentId,
          },
        })
      )
        return { duplicate: true };
      const contact = await tx.crmContact.upsert({
        where: {
          organizerId_userId: {
            organizerId: payment.organizerId,
            userId: payment.buyerId,
          },
        },
        create: {
          organizerId: payment.organizerId,
          userId: payment.buyerId,
          buyerId: payment.buyerId,
          name: payment.buyer.name,
          email: payment.buyer.email,
          phone: payment.buyer.phone,
          city: payment.buyer.city,
          state: payment.buyer.state,
          source: payment.purchase.affiliateCode
            ? CrmContactSource.AFFILIATE
            : CrmContactSource.PURCHASE,
          status: CrmContactStatus.CUSTOMER,
          totalPurchases: 1,
          totalSpent: payment.amount,
          totalTickets: payment.purchase.quantity,
          lastPurchaseAt: payment.approvedAt,
          lastInteractionAt: payment.approvedAt,
        },
        update: {
          name: payment.buyer.name,
          email: payment.buyer.email,
          phone: payment.buyer.phone,
          city: payment.buyer.city,
          state: payment.buyer.state,
          status: CrmContactStatus.CUSTOMER,
          totalPurchases: { increment: 1 },
          totalSpent: { increment: payment.amount },
          totalTickets: { increment: payment.purchase.quantity },
          lastPurchaseAt: payment.approvedAt,
          lastInteractionAt: payment.approvedAt,
        },
      });
      await tx.crmInteraction.create({
        data: {
          organizerId: payment.organizerId,
          contactId: contact.id,
          type: CrmInteractionType.PAYMENT,
          channel: CrmChannel.PLATFORM,
          title: 'Pagamento aprovado',
          campaignId: payment.campaignId,
          purchaseId: payment.purchaseId,
          paymentId: payment.id,
          metadata: {
            amount: payment.amount,
            quantity: payment.purchase.quantity,
          },
          occurredAt: payment.approvedAt ?? new Date(),
        },
      });
      await tx.notification.create({
        data: {
          userId: payment.organizerId,
          type: 'PAYMENT_APPROVED',
          category: 'PAYMENT',
          title: 'Nova venda aprovada',
          message: `${payment.buyer.name} comprou ${payment.purchase.quantity} títulos em ${payment.campaign.title}.`,
          data: {
            campaignId: payment.campaignId,
            purchaseId: payment.purchaseId,
            paymentId: payment.id,
          },
        },
      });
      await this.runAutomations(
        tx,
        payment.organizerId,
        AutomationTriggerType.PURCHASE_APPROVED,
        contact.id,
        {
          campaignId: payment.campaignId,
          purchaseId: payment.purchaseId,
          paymentId: payment.id,
        },
      );
      return { contactId: contact.id };
    } catch (error) {
      try {
        await tx.auditLog.create({
          data: {
            entityType: 'CRM_SYNC',
            entityId: paymentId,
            action: 'CRM_SYNC_FAILED',
            metadata: {
              message: error instanceof Error ? error.message : 'unknown',
            },
          },
        });
      } catch {}
      return { failed: true };
    }
  }
  async syncFavorite(tx: any, userId: string, campaignId: string) {
    try {
      const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
        }),
        user = await tx.user.findUnique({ where: { id: userId } });
      if (!campaign || !user) return;
      const contact = await tx.crmContact.upsert({
        where: {
          organizerId_userId: { organizerId: campaign.organizerId, userId },
        },
        create: {
          organizerId: campaign.organizerId,
          userId,
          buyerId: userId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          city: user.city,
          state: user.state,
          source: CrmContactSource.CAMPAIGN,
          status: CrmContactStatus.LEAD,
          lastInteractionAt: new Date(),
        },
        update: { lastInteractionAt: new Date() },
      });
      if (
        !(await tx.crmInteraction.findFirst({
          where: {
            organizerId: campaign.organizerId,
            contactId: contact.id,
            type: CrmInteractionType.FAVORITE,
            campaignId,
          },
        }))
      )
        await tx.crmInteraction.create({
          data: {
            organizerId: campaign.organizerId,
            contactId: contact.id,
            type: CrmInteractionType.FAVORITE,
            title: 'Campanha favoritada',
            campaignId,
          },
        });
      await this.runAutomations(
        tx,
        campaign.organizerId,
        AutomationTriggerType.CAMPAIGN_FAVORITED,
        contact.id,
        { campaignId },
      );
    } catch {}
  }
  private async runAutomations(
    tx: Prisma.TransactionClient | any,
    organizerId: string,
    triggerType: AutomationTriggerType,
    contactId: string,
    event: Record<string, unknown>,
  ) {
    const rows = await tx.automation.findMany({
      where: {
        organizerId,
        status: AutomationStatus.ACTIVE,
        triggerType,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
        ],
      },
    });
    for (const automation of rows) {
      await this.executeAutomation(tx, automation, contactId, event);
    }
  }

  private async executeAutomation(
    tx: Prisma.TransactionClient | any,
    automation: any,
    contactId: string,
    event: Record<string, unknown>,
  ) {
    const organizerId = automation.organizerId as string;
    const config = automation.actionConfig;
    if (automation.actionType === AutomationActionType.CREATE_NOTIFICATION) {
      const contact = await tx.crmContact.findUnique({
        where: { id: contactId },
      });
      if (contact?.userId)
        await tx.notification.create({
          data: {
            userId: contact.userId,
            type: 'MARKETING_AUTOMATION',
            category: 'MARKETING',
            title: String(config.title || automation.name),
            message: String(config.message || 'Você tem uma novidade.'),
            data: event,
          },
        });
    } else if (
      automation.actionType === AutomationActionType.CHANGE_CRM_STATUS
    ) {
      await tx.crmContact.update({
        where: { id: contactId },
        data: { status: config.status },
      });
    } else if (
      automation.actionType === AutomationActionType.ADD_TAG &&
      config.tagId
    ) {
      await tx.crmContactTag.upsert({
        where: { contactId_tagId: { contactId, tagId: config.tagId } },
        create: { contactId, tagId: config.tagId },
        update: {},
      });
    } else if (
      automation.actionType === AutomationActionType.REMOVE_TAG &&
      config.tagId
    ) {
      await tx.crmContactTag.deleteMany({
        where: { contactId, tagId: config.tagId },
      });
    } else if (automation.actionType === AutomationActionType.CREATE_TASK) {
      await tx.crmTask.create({
        data: {
          organizerId,
          contactId,
          title: String(config.title || automation.name),
          description: config.description,
          automationId: automation.id,
        },
      });
    } else if (
      automation.actionType === AutomationActionType.QUEUE_EXTERNAL_MESSAGE
    ) {
      const c = await tx.crmContact.findUnique({ where: { id: contactId } });
      await tx.outboundMessage.create({
        data: {
          organizerId,
          contactId,
          automationId: automation.id,
          channel: config.channel || CrmChannel.EMAIL,
          destinationMasked: this.mask(c?.email || c?.phone),
          subject: config.subject,
          content: String(config.content || ''),
          status: OutboundMessageStatus.QUEUED,
          scheduledAt: new Date(Date.now() + automation.delayMinutes * 60000),
          metadata: { mode: 'NO_PROVIDER' },
        },
      });
    }
    await tx.automation.update({
      where: { id: automation.id },
      data: { lastRunAt: new Date(), totalRuns: { increment: 1 } },
    });
  }
  private mask(v?: string | null) {
    if (!v) return '***';
    return v.includes('@')
      ? `${v.slice(0, 2)}***@${v.split('@')[1]}`
      : `***${v.slice(-4)}`;
  }
}
