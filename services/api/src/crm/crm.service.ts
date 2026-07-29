import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AutomationStatus,
  CrmContactSource,
  CrmContactStatus,
  CrmInteractionType,
  CrmChannel,
  CrmTaskStatus,
  MarketingCampaignStatus,
  NotificationCategory,
  OutboundMessageStatus,
  Prisma,
  SegmentType,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ContactQueryDto,
  CreateAutomationDto,
  CreateCommunicationDto,
  CreateNoteDto,
  CreateSegmentDto,
  CreateTagDto,
  CreateTaskDto,
  CreateTemplateDto,
} from './dto/crm.dto';
@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}
  async dashboard(u: AuthenticatedUser) {
    this.org(u);
    const w = { organizerId: u.id, deletedAt: null };
    const [
      total,
      leads,
      customers,
      vip,
      inactive,
      agg,
      approvedPayments,
      pendingPayments,
      abandoned,
      segments,
      automations,
      pausedAutomations,
      tasks,
      tasksInProgress,
      overdueTasks,
      completedToday,
      cities,
      sources,
    ] = await Promise.all([
      this.prisma.crmContact.count({ where: w }),
      this.prisma.crmContact.count({ where: { ...w, status: 'LEAD' } }),
      this.prisma.crmContact.count({ where: { ...w, status: 'CUSTOMER' } }),
      this.prisma.crmContact.count({ where: { ...w, status: 'VIP' } }),
      this.prisma.crmContact.count({ where: { ...w, status: 'INACTIVE' } }),
      this.prisma.crmContact.aggregate({
        _sum: { totalSpent: true },
        _avg: { totalSpent: true },
        where: w,
      }),
      this.prisma.payment.aggregate({
        where: { organizerId: u.id, status: 'APPROVED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.purchase.count({
        where: { campaign: { organizerId: u.id }, status: 'AWAITING_PAYMENT' },
      }),
      this.prisma.purchase.count({
        where: { campaign: { organizerId: u.id }, status: 'EXPIRED' },
      }),
      this.prisma.segment.count({
        where: { organizerId: u.id, isActive: true },
      }),
      this.prisma.automation.count({
        where: { organizerId: u.id, status: 'ACTIVE' },
      }),
      this.prisma.automation.count({
        where: { organizerId: u.id, status: 'PAUSED' },
      }),
      this.prisma.crmTask.count({
        where: { organizerId: u.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.crmTask.count({
        where: { organizerId: u.id, status: 'IN_PROGRESS' },
      }),
      this.prisma.crmTask.count({
        where: {
          organizerId: u.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
          dueAt: { lt: new Date() },
        },
      }),
      this.prisma.crmTask.count({
        where: {
          organizerId: u.id,
          status: 'COMPLETED',
          completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.crmContact.groupBy({
        by: ['city'],
        where: w,
        _count: true,
        _sum: { totalSpent: true },
        _avg: { totalSpent: true },
        orderBy: { _count: { city: 'desc' } },
        take: 8,
      }),
      this.prisma.crmContact.groupBy({
        by: ['source'],
        where: w,
        _count: true,
      }),
    ]);
    return {
      total,
      leads,
      customers,
      vip,
      inactive,
      totalSpent: Number(agg._sum.totalSpent || 0),
      averageSpent: approvedPayments._count
        ? Number(approvedPayments._sum.amount || 0) / approvedPayments._count
        : 0,
      pendingPayments,
      abandoned,
      segments,
      automations,
      pausedAutomations,
      tasks,
      tasksInProgress,
      overdueTasks,
      completedToday,
      cities,
      sources,
    };
  }
  async contacts(u: AuthenticatedUser, q: ContactQueryDto) {
    this.org(u);
    const where: Prisma.CrmContactWhereInput = {
      organizerId: u.id,
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.city ? { city: q.city } : {}),
      ...(q.cityMissing ? { OR: [{ city: null }, { city: '' }] } : {}),
      ...(q.state ? { state: q.state } : {}),
      ...(q.source ? { source: q.source as CrmContactSource } : {}),
      ...(q.tagId ? { tags: { some: { tagId: q.tagId } } } : {}),
      ...(q.campaignId
        ? {
            user: {
              purchases: {
                some: { campaignId: q.campaignId },
              },
            },
          }
        : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
            ],
          }
        : {}),
      ...(q.minSpent != null || q.maxSpent != null
        ? { totalSpent: { gte: q.minSpent, lte: q.maxSpent } }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.crmContact.findMany({
        where,
        include: { tags: { include: { tag: true } } },
        orderBy:
          q.order === 'spent'
            ? { totalSpent: 'desc' }
            : { lastInteractionAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.crmContact.count({ where }),
    ]);
    return {
      items: items.map((x) => this.safe(x)),
      total,
      page: q.page,
      limit: q.limit,
      pages: Math.ceil(total / q.limit),
    };
  }
  async contact(u: AuthenticatedUser, id: string) {
    this.org(u);
    const c = await this.prisma.crmContact.findFirst({
      where: { id, organizerId: u.id, deletedAt: null },
      include: {
        tags: { include: { tag: true } },
        notes: { orderBy: { createdAt: 'desc' } },
        interactions: { orderBy: { occurredAt: 'desc' }, take: 100 },
        tasks: { orderBy: { createdAt: 'desc' } },
        user: {
          select: {
            id: true,
            purchases: {
              where: { campaign: { organizerId: u.id } },
              include: {
                campaign: { select: { title: true, slug: true } },
                tickets: {
                  select: { id: true, number: true, status: true },
                  orderBy: { number: 'asc' },
                },
                payments: {
                  select: {
                    id: true,
                    status: true,
                    method: true,
                    amount: true,
                    approvedAt: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
            winners: {
              where: { campaign: { organizerId: u.id } },
              select: {
                id: true,
                prizeName: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Contato não encontrado.');
    const outboundMessages = await this.prisma.outboundMessage.findMany({
      where: { organizerId: u.id, contactId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return this.safe({ ...c, outboundMessages });
  }
  tags(u: AuthenticatedUser) {
    this.org(u);
    return this.prisma.crmTag.findMany({
      where: { organizerId: u.id },
      include: { _count: { select: { contacts: true } } },
      orderBy: { name: 'asc' },
    });
  }
  createTag(u: AuthenticatedUser, d: CreateTagDto) {
    this.org(u);
    return this.prisma.crmTag.create({ data: { organizerId: u.id, ...d } });
  }
  async updateTag(u: AuthenticatedUser, id: string, d: CreateTagDto) {
    this.org(u);
    const result = await this.prisma.crmTag.updateMany({
      where: { id, organizerId: u.id },
      data: { name: d.name, color: d.color, description: d.description },
    });
    if (!result.count) throw new NotFoundException('Etiqueta não encontrada.');
    return this.prisma.crmTag.findUnique({ where: { id } });
  }
  async deleteTag(u: AuthenticatedUser, id: string) {
    this.org(u);
    const tag = await this.prisma.crmTag.findFirst({
      where: { id, organizerId: u.id },
    });
    if (!tag) throw new NotFoundException('Etiqueta não encontrada.');
    await this.prisma.crmTag.delete({ where: { id } });
    return { message: 'Etiqueta excluída.' };
  }
  async addTag(u: AuthenticatedUser, contactId: string, tagId: string) {
    await this.owned(u, contactId);
    if (
      !(await this.prisma.crmTag.findFirst({
        where: { id: tagId, organizerId: u.id },
      }))
    )
      throw new ForbiddenException();
    return this.prisma.crmContactTag.upsert({
      where: { contactId_tagId: { contactId, tagId } },
      create: { contactId, tagId },
      update: {},
    });
  }
  async removeTag(u: AuthenticatedUser, contactId: string, tagId: string) {
    await this.owned(u, contactId);
    await this.prisma.crmContactTag.deleteMany({ where: { contactId, tagId } });
    return { message: 'Tag removida.' };
  }
  async note(u: AuthenticatedUser, id: string, d: CreateNoteDto) {
    await this.owned(u, id);
    return this.prisma.$transaction(async (tx) => {
      const n = await tx.crmNote.create({
        data: {
          organizerId: u.id,
          contactId: id,
          authorUserId: u.id,
          content: this.clean(d.content),
        },
      });
      await tx.crmInteraction.create({
        data: {
          organizerId: u.id,
          contactId: id,
          type: CrmInteractionType.MANUAL_NOTE,
          channel: CrmChannel.MANUAL,
          title: 'Nota adicionada',
          description: n.content,
        },
      });
      return n;
    });
  }
  async status(u: AuthenticatedUser, id: string, status: CrmContactStatus) {
    await this.owned(u, id);
    return this.prisma.crmContact.update({ where: { id }, data: { status } });
  }
  segments(u: AuthenticatedUser) {
    this.org(u);
    return this.prisma.segment.findMany({
      where: { organizerId: u.id },
      orderBy: { createdAt: 'desc' },
    });
  }
  async createSegment(u: AuthenticatedUser, d: CreateSegmentDto) {
    this.org(u);
    this.validateRules(d.rules);
    return this.prisma.segment.create({
      data: {
        organizerId: u.id,
        name: d.name,
        description: d.description,
        type: d.type,
        rules: d.rules as Prisma.InputJsonValue,
        isDynamic: d.isDynamic ?? d.type === SegmentType.DYNAMIC,
      },
    });
  }
  async previewSegment(u: AuthenticatedUser, rules: Record<string, unknown>) {
    this.org(u);
    const where = this.rulesWhere(u.id, rules);
    return { count: await this.prisma.crmContact.count({ where }) };
  }
  async updateSegment(u: AuthenticatedUser, id: string, d: CreateSegmentDto) {
    this.org(u);
    this.validateRules(d.rules);
    const result = await this.prisma.segment.updateMany({
      where: { id, organizerId: u.id },
      data: {
        name: d.name,
        description: d.description,
        type: d.type,
        rules: d.rules as Prisma.InputJsonValue,
        isDynamic: d.isDynamic ?? d.type === SegmentType.DYNAMIC,
      },
    });
    if (!result.count) throw new NotFoundException('Segmento não encontrado.');
    await this.calculateSegment(u, id);
    return this.prisma.segment.findFirst({ where: { id, organizerId: u.id } });
  }
  async calculateSegment(u: AuthenticatedUser, id: string) {
    this.org(u);
    const s = await this.prisma.segment.findFirst({
      where: { id, organizerId: u.id },
    });
    if (!s) throw new NotFoundException();
    const where = this.rulesWhere(u.id, s.rules as Record<string, unknown>);
    const count = await this.prisma.crmContact.count({ where });
    return this.prisma.segment.update({
      where: { id },
      data: { contactCount: count, lastCalculatedAt: new Date() },
    });
  }
  async deleteSegment(u: AuthenticatedUser, id: string) {
    this.org(u);
    const result = await this.prisma.segment.deleteMany({
      where: { id, organizerId: u.id },
    });
    if (!result.count) throw new NotFoundException('Segmento não encontrado.');
    return { message: 'Segmento excluído.' };
  }
  async abandonedReservations(u: AuthenticatedUser, q: ContactQueryDto) {
    this.org(u);
    const where: Prisma.PurchaseWhereInput = {
      campaign: { organizerId: u.id },
      OR: [
        { status: 'EXPIRED' },
        {
          status: 'AWAITING_PAYMENT',
          expiresAt: { lte: new Date() },
          payments: { none: { status: 'APPROVED' } },
        },
      ],
      ...(q.campaignId ? { campaignId: q.campaignId } : {}),
      ...(q.city
        ? { buyer: { city: { contains: q.city, mode: 'insensitive' } } }
        : {}),
      ...(q.minSpent !== undefined ? { total: { gte: q.minSpent } } : {}),
      ...(q.maxSpent !== undefined ? { total: { lte: q.maxSpent } } : {}),
    };
    const [items, total, totals, buyers] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        where,
        include: {
          buyer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              city: true,
              state: true,
              crmContacts: {
                where: { organizerId: u.id },
                select: { id: true },
                take: 1,
              },
            },
          },
          campaign: { select: { id: true, title: true, slug: true } },
          payments: {
            select: { method: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { expiresAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.purchase.count({ where }),
      this.prisma.purchase.aggregate({
        where,
        _sum: { total: true, quantity: true },
      }),
      this.prisma.purchase.groupBy({
        by: ['buyerId'],
        where,
        orderBy: { buyerId: 'asc' },
      }),
    ]);
    return {
      items: items.map((purchase) => ({
        id: purchase.id,
        buyerId: purchase.buyerId,
        contactId: purchase.buyer.crmContacts[0]?.id ?? null,
        buyer: maskPersonName(purchase.buyer.name),
        phone: purchase.buyer.phone
          ? `***${purchase.buyer.phone.slice(-4)}`
          : null,
        email: purchase.buyer.email
          ? `${purchase.buyer.email.slice(0, 2)}***@${purchase.buyer.email.split('@')[1]}`
          : null,
        city: purchase.buyer.city,
        state: purchase.buyer.state,
        campaign: purchase.campaign,
        quantity: purchase.quantity,
        amount: Number(purchase.total),
        reservedAt: purchase.createdAt,
        expiresAt: purchase.expiresAt,
        abandonedAt: purchase.expiresAt,
        paymentMethod: purchase.payments[0]?.method ?? null,
        recoveryAttempts: 0,
        lastCommunication: null,
        contactStatus: 'Não contatada',
        failureReason: null,
      })),
      total,
      page: q.page,
      pages: Math.ceil(total / q.limit),
      summary: {
        total,
        uniqueBuyers: buyers.length,
        potentialValue: Number(totals._sum.total ?? 0),
        totalTickets: totals._sum.quantity ?? 0,
        recoveryRate: null,
      },
    };
  }
  tasks(u: AuthenticatedUser) {
    this.org(u);
    return this.prisma.crmTask.findMany({
      where: { organizerId: u.id },
      include: { contact: { select: { name: true } } },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    });
  }
  createTask(u: AuthenticatedUser, d: CreateTaskDto) {
    this.org(u);
    return this.prisma.crmTask.create({
      data: {
        organizerId: u.id,
        title: d.title,
        description: d.description,
        contactId: d.contactId,
        priority: d.priority,
        dueAt: d.dueAt ? new Date(d.dueAt) : undefined,
      },
    });
  }
  async completeTask(u: AuthenticatedUser, id: string) {
    this.org(u);
    const r = await this.prisma.crmTask.updateMany({
      where: { id, organizerId: u.id },
      data: { status: CrmTaskStatus.COMPLETED, completedAt: new Date() },
    });
    if (!r.count) throw new NotFoundException();
    return { message: 'Tarefa concluída.' };
  }
  async taskStatus(u: AuthenticatedUser, id: string, status: CrmTaskStatus) {
    this.org(u);
    const r = await this.prisma.crmTask.updateMany({
      where: { id, organizerId: u.id },
      data: {
        status,
        completedAt: status === CrmTaskStatus.COMPLETED ? new Date() : null,
      },
    });
    if (!r.count) throw new NotFoundException('Tarefa não encontrada.');
    return { message: 'Status da tarefa atualizado.' };
  }
  automations(u: AuthenticatedUser) {
    this.org(u);
    return this.prisma.automation.findMany({
      where: { organizerId: u.id },
      orderBy: { createdAt: 'desc' },
    });
  }
  createAutomation(u: AuthenticatedUser, d: CreateAutomationDto) {
    this.org(u);
    return this.prisma.automation.create({
      data: {
        organizerId: u.id,
        ...d,
        triggerConfig: d.triggerConfig as Prisma.InputJsonValue,
        audienceConfig: d.audienceConfig as Prisma.InputJsonValue,
        actionConfig: d.actionConfig as Prisma.InputJsonValue,
      },
    });
  }
  async automationStatus(
    u: AuthenticatedUser,
    id: string,
    status: AutomationStatus,
  ) {
    this.org(u);
    const r = await this.prisma.automation.updateMany({
      where: { id, organizerId: u.id },
      data: { status },
    });
    if (!r.count) throw new NotFoundException();
    return { message: 'Automação atualizada.' };
  }
  async templates(u: AuthenticatedUser) {
    this.org(u);
    await this.ensureDefaultTemplates(u.id);
    return this.prisma.messageTemplate.findMany({
      where: {
        OR: [
          { organizerId: u.id },
          { organizerId: null, isSystemTemplate: true },
        ],
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }
  createTemplate(u: AuthenticatedUser, d: CreateTemplateDto) {
    this.org(u);
    return this.prisma.messageTemplate.create({
      data: {
        organizerId: u.id,
        ...d,
        content: this.clean(d.content),
        subject: d.subject ? this.clean(d.subject) : undefined,
        variables: (d.variables || {}) as Prisma.InputJsonValue,
      },
    });
  }
  async updateTemplate(u: AuthenticatedUser, id: string, d: CreateTemplateDto) {
    this.org(u);
    const result = await this.prisma.messageTemplate.updateMany({
      where: { id, organizerId: u.id, isSystemTemplate: false },
      data: {
        name: d.name,
        channel: d.channel,
        category: d.category,
        subject: d.subject ? this.clean(d.subject) : null,
        content: this.clean(d.content),
        variables: (d.variables || {}) as Prisma.InputJsonValue,
      },
    });
    if (!result.count) throw new NotFoundException('Template não encontrado.');
    return this.prisma.messageTemplate.findUnique({ where: { id } });
  }
  async duplicateTemplate(u: AuthenticatedUser, id: string) {
    this.org(u);
    const source = await this.prisma.messageTemplate.findFirst({
      where: {
        id,
        OR: [
          { organizerId: u.id },
          { organizerId: null, isSystemTemplate: true },
        ],
      },
    });
    if (!source) throw new NotFoundException('Template não encontrado.');
    return this.prisma.messageTemplate.create({
      data: {
        organizerId: u.id,
        name: `${source.name} - Cópia`,
        channel: source.channel,
        category: source.category,
        subject: source.subject,
        content: source.content,
        variables: source.variables as Prisma.InputJsonValue,
      },
    });
  }
  async deleteTemplate(u: AuthenticatedUser, id: string) {
    this.org(u);
    const result = await this.prisma.messageTemplate.updateMany({
      where: { id, organizerId: u.id, isSystemTemplate: false },
      data: { isActive: false },
    });
    if (!result.count) throw new NotFoundException('Template não encontrado.');
    return { message: 'Template excluído.' };
  }
  preview(u: AuthenticatedUser, id: string, variables: Record<string, string>) {
    this.org(u);
    return this.prisma.messageTemplate
      .findFirst({
        where: {
          id,
          OR: [
            { organizerId: u.id },
            { organizerId: null, isSystemTemplate: true },
          ],
        },
      })
      .then((t) => {
        if (!t) throw new NotFoundException();
        return {
          subject: this.render(t.subject || '', variables),
          content: this.render(t.content, variables),
        };
      });
  }
  outbound(u: AuthenticatedUser) {
    this.org(u);
    return this.prisma.outboundMessage.findMany({
      where: { organizerId: u.id },
      include: { contact: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  async simulateOutbound(u: AuthenticatedUser, id: string) {
    this.org(u);
    const r = await this.prisma.outboundMessage.updateMany({
      where: {
        id,
        organizerId: u.id,
        status: {
          in: [OutboundMessageStatus.QUEUED, OutboundMessageStatus.DRAFT],
        },
      },
      data: {
        status: OutboundMessageStatus.SKIPPED,
        failureReason:
          'Processada em modo sandbox. Nenhuma mensagem externa foi enviada.',
      },
    });
    if (!r.count)
      throw new BadRequestException('Mensagem não pode ser simulada.');
    return {
      message:
        'Envio registrado em modo de teste. Nenhuma mensagem externa foi enviada.',
    };
  }
  async cancelOutbound(u: AuthenticatedUser, id: string) {
    this.org(u);
    const result = await this.prisma.outboundMessage.updateMany({
      where: { id, organizerId: u.id, status: 'QUEUED' },
      data: { status: 'CANCELLED' },
    });
    if (!result.count)
      throw new BadRequestException('Agendamento não pode ser cancelado.');
    return { message: 'Agendamento cancelado.' };
  }
  async communicationPreview(u: AuthenticatedUser, d: CreateCommunicationDto) {
    const recipients = await this.communicationRecipients(u, d);
    const first = recipients[0];
    const variables = await this.communicationVariables(first, d.campaignId);
    return {
      recipients: recipients.length,
      subject: this.render(d.subject || '', variables),
      content: this.render(d.content, variables),
      variables,
    };
  }
  async createCommunication(u: AuthenticatedUser, d: CreateCommunicationDto) {
    const recipients = await this.communicationRecipients(u, d);
    if (!recipients.length)
      throw new BadRequestException('O público selecionado está vazio.');
    const scheduledAt = d.scheduledAt ? new Date(d.scheduledAt) : new Date();
    const scheduled = scheduledAt.getTime() > Date.now() + 30000;
    let createdCount = 0;
    for (const contact of recipients) {
      const variables = await this.communicationVariables(
        contact,
        d.campaignId,
      );
      await this.prisma.outboundMessage.create({
        data: {
          organizerId: u.id,
          contactId: contact.id,
          channel: d.channel,
          destinationMasked: this.mask(
            d.channel === CrmChannel.EMAIL ? contact.email : contact.phone,
          ),
          templateId: d.templateId,
          subject: d.subject ? this.render(d.subject, variables) : undefined,
          content: this.render(d.content, variables),
          status: d.draft
            ? OutboundMessageStatus.DRAFT
            : scheduled
              ? OutboundMessageStatus.QUEUED
              : OutboundMessageStatus.SKIPPED,
          scheduledAt,
          failureReason: d.draft
            ? undefined
            : scheduled
              ? undefined
              : 'Processada em modo sandbox. Nenhuma mensagem externa foi enviada.',
          metadata: {
            mode: 'SANDBOX',
            audienceType: d.audienceType,
            segmentId: d.segmentId,
            campaignId: d.campaignId,
            variables,
          },
        },
      });
      createdCount += 1;
    }
    return {
      message: d.draft
        ? 'Comunicação salva como rascunho.'
        : scheduled
          ? 'Comunicação agendada em modo sandbox.'
          : 'Envio registrado em modo de teste. Nenhuma mensagem externa foi enviada.',
      recipients: createdCount,
      status: d.draft ? 'RASCUNHO' : scheduled ? 'AGENDADA' : 'SIMULADA',
    };
  }
  marketing(u: AuthenticatedUser) {
    this.org(u);
    return this.prisma.marketingCampaign.findMany({
      where: { organizerId: u.id },
      include: { segment: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  async createMarketing(u: AuthenticatedUser, d: any) {
    this.org(u);
    const content = this.clean(String(d.content || ''));
    return this.prisma.marketingCampaign.create({
      data: {
        organizerId: u.id,
        name: d.name,
        channel: d.channel,
        segmentId: d.segmentId,
        subject: d.subject ? this.clean(d.subject) : undefined,
        content,
        scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : undefined,
      },
    });
  }
  async simulateMarketing(u: AuthenticatedUser, id: string) {
    this.org(u);
    const campaign = await this.prisma.marketingCampaign.findFirst({
      where: { id, organizerId: u.id },
      include: { segment: true },
    });
    if (!campaign) throw new NotFoundException();
    const where = campaign.segment
      ? this.rulesWhere(u.id, campaign.segment.rules as Record<string, unknown>)
      : {
          organizerId: u.id,
          deletedAt: null,
          status: { not: CrmContactStatus.BLOCKED },
        };
    const contacts = await this.prisma.crmContact.findMany({
      where,
      select: { id: true, userId: true, name: true },
    });
    let queued = 0;
    for (const c of contacts) {
      if (c.userId && campaign.channel === CrmChannel.PLATFORM) {
        await this.prisma.notification.create({
          data: {
            userId: c.userId,
            type: 'INTERNAL_MARKETING',
            category: NotificationCategory.MARKETING,
            title: campaign.subject || campaign.name,
            message: this.render(campaign.content, { nome: c.name }),
            data: { marketingCampaignId: id },
          },
        });
        queued++;
      }
    }
    return this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        status: MarketingCampaignStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
        totalRecipients: contacts.length,
        totalQueued: queued,
        totalSent: queued,
        totalFailed: 0,
      },
    });
  }
  async notifications(u: AuthenticatedUser, category?: NotificationCategory) {
    return this.prisma.notification.findMany({
      where: {
        userId: u.id,
        deletedAt: null,
        ...(category ? { category } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
  async readNotification(u: AuthenticatedUser, id: string) {
    const r = await this.prisma.notification.updateMany({
      where: { id, userId: u.id, deletedAt: null },
      data: { readAt: new Date() },
    });
    if (!r.count) throw new NotFoundException();
    return { message: 'Notificação lida.' };
  }
  async readAll(u: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: { userId: u.id, readAt: null, deletedAt: null },
      data: { readAt: new Date() },
    });
    return { message: 'Notificações lidas.' };
  }
  async deleteNotification(u: AuthenticatedUser, id: string) {
    const r = await this.prisma.notification.updateMany({
      where: { id, userId: u.id },
      data: { deletedAt: new Date() },
    });
    if (!r.count) throw new NotFoundException();
    return { message: 'Notificação removida.' };
  }
  preferences(u: AuthenticatedUser) {
    return this.prisma.notificationPreference.findMany({
      where: { userId: u.id },
      orderBy: { category: 'asc' },
    });
  }
  preference(u: AuthenticatedUser, category: NotificationCategory, d: any) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_category: { userId: u.id, category } },
      create: {
        userId: u.id,
        category,
        inAppEnabled: d.inAppEnabled ?? true,
        emailEnabled: d.emailEnabled ?? false,
        whatsappEnabled: d.whatsappEnabled ?? false,
        smsEnabled: d.smsEnabled ?? false,
      },
      update: {
        inAppEnabled: d.inAppEnabled,
        emailEnabled: d.emailEnabled,
        whatsappEnabled: d.whatsappEnabled,
        smsEnabled: d.smsEnabled,
      },
    });
  }
  async export(u: AuthenticatedUser, format: 'json' | 'csv') {
    this.org(u);
    const rows = await this.prisma.crmContact.findMany({
      where: { organizerId: u.id, deletedAt: null },
    });
    if (format === 'json') return rows.map((x) => this.safe(x));
    const fields = [
      'name',
      'email',
      'phone',
      'city',
      'state',
      'status',
      'source',
      'totalPurchases',
      'totalSpent',
      'totalTickets',
    ];
    return [
      fields.join(','),
      ...rows.map((r) =>
        fields
          .map((f) => `"${String((r as any)[f] ?? '').replaceAll('"', '""')}"`)
          .join(','),
      ),
    ].join('\n');
  }
  private async communicationRecipients(
    u: AuthenticatedUser,
    d: CreateCommunicationDto,
  ) {
    this.org(u);
    let where: Prisma.CrmContactWhereInput = {
      organizerId: u.id,
      deletedAt: null,
      status: { not: CrmContactStatus.BLOCKED },
      externalOptOut: false,
    };
    if (d.audienceType === 'CONTACT') {
      if (!d.contactId) throw new BadRequestException('Selecione um contato.');
      where.id = d.contactId;
    } else if (d.audienceType === 'MANUAL') {
      if (!d.contactIds?.length)
        throw new BadRequestException('Selecione ao menos um contato.');
      where.id = { in: d.contactIds };
    } else if (d.audienceType === 'SEGMENT') {
      if (!d.segmentId) throw new BadRequestException('Selecione um segmento.');
      const segment = await this.prisma.segment.findFirst({
        where: { id: d.segmentId, organizerId: u.id, isActive: true },
      });
      if (!segment) throw new NotFoundException('Segmento não encontrado.');
      where = this.rulesWhere(u.id, segment.rules as Record<string, unknown>);
      where.externalOptOut = false;
    } else if (d.audienceType === 'CAMPAIGN') {
      if (!d.campaignId)
        throw new BadRequestException('Selecione uma campanha.');
      const campaign = await this.prisma.campaign.findFirst({
        where: { id: d.campaignId, organizerId: u.id },
        select: { id: true },
      });
      if (!campaign) throw new NotFoundException('Campanha não encontrada.');
      where.user = { purchases: { some: { campaignId: campaign.id } } };
    } else if (d.audienceType === 'ABANDONED') {
      if (d.campaignId) {
        const campaign = await this.prisma.campaign.findFirst({
          where: { id: d.campaignId, organizerId: u.id },
          select: { id: true },
        });
        if (!campaign) throw new NotFoundException('Campanha não encontrada.');
      }
      const purchases = await this.prisma.purchase.findMany({
        where: {
          campaign: { organizerId: u.id },
          ...(d.campaignId ? { campaignId: d.campaignId } : {}),
          OR: [
            { status: 'EXPIRED' },
            {
              status: 'AWAITING_PAYMENT',
              expiresAt: { lte: new Date() },
              payments: { none: { status: 'APPROVED' } },
            },
          ],
        },
        select: { buyerId: true },
        distinct: ['buyerId'],
      });
      where.userId = { in: purchases.map((purchase) => purchase.buyerId) };
    }
    return this.prisma.crmContact.findMany({
      where,
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        phone: true,
        city: true,
      },
      take: 500,
    });
  }
  private async communicationVariables(
    contact:
      { name: string; city?: string | null; phone?: string | null } | undefined,
    campaignId?: string,
  ) {
    const campaign = campaignId
      ? await this.prisma.campaign.findUnique({
          where: { id: campaignId },
          select: {
            title: true,
            slug: true,
            drawDate: true,
            mainPrizeName: true,
          },
        })
      : null;
    return {
      nome: contact?.name || 'Contato',
      cidade: contact?.city || '',
      telefone: contact?.phone || '',
      campanha: campaign?.title || '',
      premio: campaign?.mainPrizeName || '',
      quantidade: '',
      valor: '',
      data_sorteio: campaign?.drawDate
        ? campaign.drawDate.toLocaleDateString('pt-BR')
        : '',
      link_campanha: campaign?.slug ? `/campanha/${campaign.slug}` : '',
      link: campaign?.slug ? `/campanha/${campaign.slug}` : '',
      prazo_pagamento: '',
      prazo: '',
    };
  }
  private async ensureDefaultTemplates(organizerId: string) {
    const defaults = [
      [
        'Reserva expirando',
        'Sua reserva na campanha {{campanha}} está expirando. Prazo: {{prazo_pagamento}}.',
      ],
      [
        'Pagamento pendente',
        'Olá, {{nome}}. Seu pagamento de {{valor}} ainda está pendente.',
      ],
      [
        'Últimas cotas',
        'Últimas cotas disponíveis em {{campanha}}. Acesse {{link_campanha}}.',
      ],
      ['Sorteio hoje', 'O sorteio da campanha {{campanha}} acontece hoje.'],
      [
        'Nova promoção',
        'Olá, {{nome}}. Há uma nova promoção na campanha {{campanha}}.',
      ],
      [
        'Cota premiada encontrada',
        'Parabéns, {{nome}}! Uma cota premiada foi encontrada.',
      ],
      [
        'Compra aprovada',
        'Compra aprovada, {{nome}}! Quantidade: {{quantidade}}.',
      ],
      [
        'Ganhador anunciado',
        'O ganhador da campanha {{campanha}} foi anunciado.',
      ],
      ['Boas-vindas', 'Olá, {{nome}}. Boas-vindas à SorteX!'],
      [
        'Recuperação de cliente',
        'Olá, {{nome}}. Temos novidades na campanha {{campanha}}.',
      ],
    ] as const;
    await this.prisma.messageTemplate.createMany({
      data: defaults.map(([name, content]) => ({
        organizerId,
        name,
        channel: CrmChannel.WHATSAPP,
        category: NotificationCategory.MARKETING,
        content,
        variables: {
          nome: true,
          campanha: true,
          quantidade: true,
          valor: true,
          data_sorteio: true,
          link_campanha: true,
          prazo_pagamento: true,
        },
      })),
      skipDuplicates: true,
    });
  }
  private rulesWhere(
    organizerId: string,
    r: Record<string, unknown>,
  ): Prisma.CrmContactWhereInput {
    this.validateRules(r);
    const w: Prisma.CrmContactWhereInput = {
      organizerId,
      deletedAt: null,
      status: { not: CrmContactStatus.BLOCKED },
    };
    if (r.status) w.status = r.status;
    if (r.city) w.city = String(r.city);
    if (r.state) w.state = String(r.state);
    if (r.source) w.source = r.source;
    if (r.minSpent != null) w.totalSpent = { gte: Number(r.minSpent) };
    if (r.minPurchases != null)
      w.totalPurchases = { gte: Number(r.minPurchases) };
    if (r.inactiveDays)
      w.lastPurchaseAt = {
        lt: new Date(Date.now() - Number(r.inactiveDays) * 86400000),
      };
    if (Array.isArray(r.contactIds))
      w.id = { in: r.contactIds.map(String).slice(0, 500) };
    return w;
  }
  private validateRules(r: Record<string, unknown>) {
    const allowed = [
      'status',
      'city',
      'state',
      'source',
      'minSpent',
      'minPurchases',
      'inactiveDays',
      'hasPrize',
      'affiliate',
      'pendingPayment',
      'abandonedReservation',
      'contactIds',
    ];
    for (const k of Object.keys(r))
      if (!allowed.includes(k))
        throw new BadRequestException(`Regra não permitida: ${k}`);
  }
  private render(v: string, vars: Record<string, string>) {
    return this.clean(v).replace(/{{([a-z_]+)}}/g, (_, k) =>
      this.clean(vars[k] || ''),
    );
  }
  private clean(v: string) {
    return v
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  private mask(value?: string | null) {
    if (!value) return 'Não informado';
    if (value.includes('@')) {
      const [name, domain] = value.split('@');
      return `${name.slice(0, 2)}***@${domain}`;
    }
    return `***${value.replace(/\D/g, '').slice(-4)}`;
  }
  private safe<T extends Record<string, any>>(x: T) {
    return {
      ...x,
      phone: x.phone ? `***${x.phone.slice(-4)}` : null,
      email: x.email
        ? `${x.email.slice(0, 2)}***@${x.email.split('@')[1]}`
        : null,
      totalSpent: Number(x.totalSpent || 0),
    };
  }
  private org(u: AuthenticatedUser) {
    if (u.role !== UserRole.ORGANIZER)
      throw new ForbiddenException('Acesso exclusivo do organizador.');
  }
  private async owned(u: AuthenticatedUser, id: string) {
    this.org(u);
    const c = await this.prisma.crmContact.findFirst({
      where: { id, organizerId: u.id, deletedAt: null },
    });
    if (!c) throw new NotFoundException('Contato não encontrado.');
    return c;
  }
}

function maskPersonName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || 'Comprador';
  return `${parts[0]} ${parts.at(-1)?.charAt(0)}.`;
}
