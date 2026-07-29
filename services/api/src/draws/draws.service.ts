import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignDrawStatus,
  CampaignStatus,
  LotteryDrawStatus,
  Prisma,
  TicketStatus,
  UserRole,
  WinnerStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AuditHashService } from './audit-hash.service';
import {
  DrawRuleDefinition,
  DrawRuleEngineService,
} from './draw-rule-engine.service';
import {
  ConfirmReceiptDto,
  CreateLotteryDrawDto,
  ExecuteDrawDto,
  SimulateRuleDto,
  UpdateWinnerDto,
} from './dto/draw.dto';

@Injectable()
export class DrawsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: DrawRuleEngineService,
    private readonly hashes: AuditHashService,
  ) {}

  simulateRule(dto: SimulateRuleDto) {
    return this.engine.evaluate(dto.ruleDefinition, {
      prizes: dto.prizes,
      totalNumbers: dto.totalNumbers,
    });
  }

  async createLotteryDraw(user: AuthenticatedUser, dto: CreateLotteryDrawDto) {
    this.assertFivePrizes(dto);
    const draw = await this.prisma.lotteryDraw.create({
      data: {
        ...dto,
        drawDate: new Date(dto.drawDate),
        enteredByUserId: user.id,
        status: LotteryDrawStatus.PENDING_REVIEW,
      },
    });
    await this.audit('LotteryDraw', draw.id, 'CREATED', user, undefined, draw);
    return draw;
  }
  listLotteryDraws() {
    return this.prisma.lotteryDraw.findMany({ orderBy: { drawDate: 'desc' } });
  }
  async getLotteryDraw(id: string) {
    const item = await this.prisma.lotteryDraw.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Extração não encontrada.');
    return item;
  }
  async updateLotteryDraw(
    id: string,
    user: AuthenticatedUser,
    dto: Partial<CreateLotteryDrawDto>,
  ) {
    const current = await this.getLotteryDraw(id);
    if (current.status === LotteryDrawStatus.LOCKED)
      throw new ConflictException('Resultado bloqueado não pode ser alterado.');
    const next = await this.prisma.lotteryDraw.update({
      where: { id },
      data: {
        ...dto,
        drawDate: dto.drawDate ? new Date(dto.drawDate) : undefined,
        status: LotteryDrawStatus.PENDING_REVIEW,
      },
    });
    await this.audit('LotteryDraw', id, 'UPDATED', user, current, next);
    return next;
  }
  async reviewLotteryDraw(
    id: string,
    user: AuthenticatedUser,
    status: LotteryDrawStatus,
    reason?: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException('Justificativa obrigatória.');
    const current = await this.getLotteryDraw(id);
    if (current.status === LotteryDrawStatus.LOCKED)
      throw new ConflictException('Resultado já está bloqueado.');
    const next = await this.prisma.lotteryDraw.update({
      where: { id },
      data: {
        status,
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
        notes: reason,
      },
    });
    await this.audit('LotteryDraw', id, status, user, current, next);
    return next;
  }

  async simulateCampaign(
    id: string,
    user: AuthenticatedUser,
    lotteryDrawId: string,
  ) {
    const { campaign, lottery, rule } = await this.loadExecution(
      id,
      user,
      lotteryDrawId,
      false,
    );
    const result = this.engine.evaluate(rule, {
      prizes: this.prizes(lottery),
      totalNumbers: campaign.totalNumbers,
    });
    const ticket = await this.prisma.ticket.findUnique({
      where: {
        campaignId_number: {
          campaignId: id,
          number: Number(result.normalizedResult),
        },
      },
    });
    return {
      ...result,
      lotteryDrawId,
      ticketSold: ticket?.status === TicketStatus.SOLD,
      createsWinner: false,
    };
  }

  async executeCampaign(
    id: string,
    user: AuthenticatedUser,
    dto: ExecuteDrawDto,
  ) {
    const existing = await this.prisma.campaignDraw.findUnique({
      where: { campaignId: id },
    });
    if (existing)
      throw new ConflictException(
        'Esta campanha já possui uma execução registrada.',
      );
    const { campaign, lottery, rule } = await this.loadExecution(
      id,
      user,
      dto.lotteryDrawId,
      true,
    );
    const result = this.engine.evaluate(rule, {
      prizes: this.prizes(lottery),
      totalNumbers: campaign.totalNumbers,
    });
    const ticket = await this.resolveTicket(
      id,
      Number(result.normalizedResult),
      campaign.unsoldNumberPolicy,
    );
    const snapshot = {
      ...result,
      lottery: {
        id: lottery.id,
        extractionNumber: lottery.extractionNumber,
        drawDate: lottery.drawDate,
        prizes: this.prizes(lottery),
      },
      ticketId: ticket?.id ?? null,
      policy: campaign.unsoldNumberPolicy,
    };
    const auditHash = this.hashes.create({
      campaignId: id,
      lotteryDrawId: lottery.id,
      rule,
      result: snapshot,
      ticketId: ticket?.id ?? null,
      executedAt: new Date().toISOString(),
    });
    const draw = await this.prisma.campaignDraw.create({
      data: {
        campaignId: id,
        lotteryDrawId: lottery.id,
        ruleTemplateId: campaign.drawRuleTemplateId,
        ruleSnapshot: rule as unknown as Prisma.InputJsonValue,
        resultSnapshot: snapshot,
        winningNumber: result.rawResult,
        normalizedWinningNumber: result.normalizedResult,
        status: CampaignDrawStatus.PENDING_CONFIRMATION,
        executedByUserId: user.id,
        auditHash,
        notes: dto.notes,
      },
    });
    await this.audit(
      'CampaignDraw',
      draw.id,
      'EXECUTED',
      user,
      undefined,
      draw,
    );
    return { ...draw, preview: snapshot, requiresManualReview: !ticket };
  }

  async confirmCampaign(id: string, user: AuthenticatedUser, notes?: string) {
    const draw = await this.prisma.campaignDraw.findUnique({
      where: { campaignId: id },
      include: { campaign: true },
    });
    if (!draw) throw new NotFoundException('Execução não encontrada.');
    this.assertOwner(draw.campaign.organizerId, user);
    if (draw.status === CampaignDrawStatus.CONFIRMED)
      throw new ConflictException('Sorteio já confirmado.');
    if (draw.status !== CampaignDrawStatus.PENDING_CONFIRMATION)
      throw new BadRequestException('Execução não pode ser confirmada.');
    const snapshot = draw.resultSnapshot as Record<string, unknown>;
    const ticketId =
      typeof snapshot.ticketId === 'string' ? snapshot.ticketId : null;
    if (!ticketId)
      throw new BadRequestException(
        'A política publicada exige revisão manual porque não há título vendido para o número calculado.',
      );
    const token = randomBytes(32).toString('hex');
    const verification = randomBytes(8).toString('hex').toUpperCase();
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findFirst({
        where: { id: ticketId, campaignId: id, status: TicketStatus.SOLD },
        include: { buyer: true, purchase: true },
      });
      if (!ticket)
        throw new ConflictException('Título vencedor não está vendido.');
      const winner = await tx.winner.create({
        data: {
          campaignId: id,
          campaignDrawId: draw.id,
          ticketId: ticket.id,
          purchaseId: ticket.purchaseId,
          buyerId: ticket.buyerId,
          prizeType: 'MAIN_PRIZE',
          prizeName: draw.campaign.mainPrizeName ?? 'Prêmio principal',
          prizeDescription: draw.campaign.mainPrizeDescription,
          prizeValue: draw.campaign.estimatedPrizeValue,
          winningNumber: String(ticket.number).padStart(
            String(draw.campaign.totalNumbers - 1).length,
            '0',
          ),
          confirmationToken: token,
          confirmationTokenExpiresAt: new Date(Date.now() + 30 * 86400000),
          publicVerificationCode: verification,
          publicDisplayName: this.maskName(ticket.buyer.name),
          publicCity: ticket.buyer.city,
        },
      });
      const confirmed = await tx.campaignDraw.update({
        where: { id: draw.id },
        data: {
          status: CampaignDrawStatus.CONFIRMED,
          confirmedByUserId: user.id,
          confirmedAt: new Date(),
          notes: notes ?? draw.notes,
        },
      });
      await tx.campaign.update({
        where: { id },
        data: { status: CampaignStatus.DRAWN },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'CampaignDraw',
          entityId: draw.id,
          action: 'CONFIRMED',
          actorUserId: user.id,
          actorRole: user.role,
          newData: { winnerId: winner.id, auditHash: draw.auditHash },
        },
      });
      return { draw: confirmed, winner };
    });
  }

  async getCampaignDraw(id: string, user: AuthenticatedUser) {
    const draw = await this.prisma.campaignDraw.findUnique({
      where: { campaignId: id },
      include: { campaign: true, winners: true, lotteryDraw: true },
    });
    if (!draw) throw new NotFoundException('Sorteio não encontrado.');
    this.assertOwner(draw.campaign.organizerId, user);
    return draw;
  }
  async getAudit(id: string, user: AuthenticatedUser) {
    const draw = await this.getCampaignDraw(id, user);
    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: 'CampaignDraw', entityId: draw.id },
          { entityType: 'Campaign', entityId: id },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
  }
  async lookupManualWinner(
    campaignId: string,
    user: AuthenticatedUser,
    rawNumber: string,
  ) {
    const campaign = await this.authorizedCampaign(campaignId, user);
    let normalized: number;
    try {
      normalized = this.normalizeLookupNumber(rawNumber, campaign.totalNumbers);
    } catch (cause) {
      await this.recordWinnerLookup(
        campaignId,
        user,
        'MANUAL',
        rawNumber,
        null,
        false,
      );
      throw cause;
    }
    const ticket = await this.winnerTicket(campaignId, normalized);
    await this.recordWinnerLookup(
      campaignId,
      user,
      'MANUAL',
      rawNumber,
      normalized,
      Boolean(ticket),
    );
    if (!ticket)
      throw new NotFoundException(
        'Nenhum participante encontrado para este número.',
      );
    return this.winnerLookupPayload(campaign, ticket, 'MANUAL', normalized);
  }

  async lookupAutomaticWinner(campaignId: string, user: AuthenticatedUser) {
    const campaign = await this.authorizedCampaign(campaignId, user);
    const existing = await this.prisma.campaignDraw.findUnique({
      where: { campaignId },
      include: { lotteryDraw: true },
    });
    let calculatedNumber: number;
    let lotteryDrawId: string | null = existing?.lotteryDrawId ?? null;
    if (existing) {
      calculatedNumber = Number(existing.normalizedWinningNumber);
    } else {
      const endOfDrawDay = campaign.drawDate
        ? new Date(campaign.drawDate.getTime() + 86_399_999)
        : new Date();
      const lottery = await this.prisma.lotteryDraw.findFirst({
        where: {
          status: {
            in: [LotteryDrawStatus.VERIFIED, LotteryDrawStatus.LOCKED],
          },
          drawDate: { lte: endOfDrawDay },
        },
        orderBy: { drawDate: 'desc' },
      });
      if (!lottery) {
        await this.recordWinnerLookup(
          campaignId,
          user,
          'AUTOMATIC',
          '',
          null,
          false,
        );
        throw new NotFoundException(
          'Ainda não existe resultado verificado para calcular esta campanha.',
        );
      }
      const rule = (campaign.publishedRuleSnapshot ??
        campaign.drawRuleTemplate?.ruleDefinition ??
        campaign.customDrawRule) as unknown as DrawRuleDefinition;
      if (!rule) {
        await this.recordWinnerLookup(
          campaignId,
          user,
          'AUTOMATIC',
          '',
          null,
          false,
          lottery.id,
        );
        throw new BadRequestException('Campanha sem regra publicada.');
      }
      const result = this.engine.evaluate(rule, {
        prizes: this.prizes(lottery),
        totalNumbers: campaign.totalNumbers,
      });
      calculatedNumber = Number(result.normalizedResult);
      lotteryDrawId = lottery.id;
    }
    const ticket = await this.resolveTicket(
      campaignId,
      calculatedNumber,
      campaign.unsoldNumberPolicy,
    );
    await this.recordWinnerLookup(
      campaignId,
      user,
      'AUTOMATIC',
      String(calculatedNumber),
      ticket?.number ?? calculatedNumber,
      Boolean(ticket),
      lotteryDrawId,
    );
    if (!ticket)
      throw new NotFoundException(
        'Nenhum participante encontrado para o número calculado.',
      );
    const completeTicket = await this.winnerTicket(campaignId, ticket.number);
    if (!completeTicket)
      throw new NotFoundException(
        'Nenhum participante encontrado para o número calculado.',
      );
    return this.winnerLookupPayload(
      campaign,
      completeTicket,
      'AUTOMATIC',
      calculatedNumber,
      lotteryDrawId,
    );
  }

  async winnerLookupHistory(campaignId: string, user: AuthenticatedUser) {
    await this.authorizedCampaign(campaignId, user);
    return this.prisma.auditLog.findMany({
      where: {
        entityType: 'Campaign',
        entityId: campaignId,
        action: { in: ['WINNER_LOOKUP_AUTOMATIC', 'WINNER_LOOKUP_MANUAL'] },
      },
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  listCampaignDraws() {
    return this.prisma.campaignDraw.findMany({
      include: { campaign: true, lotteryDraw: true, winners: true },
      orderBy: { executedAt: 'desc' },
    });
  }
  async invalidateDraw(id: string, user: AuthenticatedUser, reason: string) {
    const current = await this.prisma.campaignDraw.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException();
    const next = await this.prisma.campaignDraw.update({
      where: { id },
      data: { status: CampaignDrawStatus.INVALIDATED, notes: reason },
    });
    await this.audit('CampaignDraw', id, 'INVALIDATED', user, current, next);
    return next;
  }

  listOrganizerWinners(user: AuthenticatedUser) {
    return this.prisma.winner.findMany({
      where: { campaign: { organizerId: user.id } },
      include: {
        campaign: true,
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
          },
        },
        ticket: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  listMyWinners(user: AuthenticatedUser) {
    return this.prisma.winner.findMany({
      where: { buyerId: user.id },
      include: { campaign: true, ticket: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  async updateWinner(
    id: string,
    user: AuthenticatedUser,
    dto: UpdateWinnerDto,
  ) {
    const current = await this.prisma.winner.findUnique({
      where: { id },
      include: { campaign: true },
    });
    if (!current) throw new NotFoundException();
    this.assertOwner(current.campaign.organizerId, user);
    return this.prisma.winner.update({
      where: { id },
      data: {
        status: dto.status,
        claimedAt: dto.status === WinnerStatus.CLAIMED ? new Date() : undefined,
        deliveredAt:
          dto.status === WinnerStatus.DELIVERED ? new Date() : undefined,
      },
    });
  }
  async confirmReceipt(
    id: string,
    user: AuthenticatedUser,
    dto: ConfirmReceiptDto,
  ) {
    const winner = await this.prisma.winner.findUnique({ where: { id } });
    if (!winner || winner.buyerId !== user.id) throw new NotFoundException();
    if (!winner.deliveredAt)
      throw new BadRequestException(
        'O prêmio ainda não foi marcado como entregue.',
      );
    return this.prisma.winner.update({
      where: { id },
      data: {
        ...dto,
        status: WinnerStatus.CONFIRMED_BY_WINNER,
        winnerConfirmedReceipt: true,
        winnerConfirmedReceiptAt: new Date(),
      },
    });
  }
  async publicVerification(code: string) {
    const winner = await this.prisma.winner.findUnique({
      where: { publicVerificationCode: code },
      include: {
        campaign: {
          include: {
            organizer: {
              select: {
                name: true,
                organizerProfile: {
                  select: { organizationName: true, logoStorageKey: true },
                },
              },
            },
          },
        },
        campaignDraw: { include: { lotteryDraw: true } },
      },
    });
    if (!winner) throw new NotFoundException('Código de verificação inválido.');
    return {
      verificationCode: winner.publicVerificationCode,
      status: winner.status,
      prizeName: winner.prizeName,
      winningNumber: winner.winningNumber,
      publicDisplayName: winner.publicDisplayName,
      publicCity: winner.publicCity,
      deliveryConfirmed: winner.winnerConfirmedReceipt,
      testimonial: winner.publicDisclosureAuthorized
        ? winner.testimonialText
        : null,
      videoUrl: winner.publicDisclosureAuthorized
        ? winner.testimonialVideoUrl
        : null,
      campaign: { title: winner.campaign.title, slug: winner.campaign.slug },
      organizer: {
        name:
          winner.campaign.organizer.organizerProfile?.organizationName ??
          winner.campaign.organizer.name,
        logo: winner.campaign.organizer.organizerProfile?.logoStorageKey,
      },
      draw: {
        date: winner.campaignDraw.confirmedAt,
        auditHash: winner.campaignDraw.auditHash,
        rule: winner.campaignDraw.ruleSnapshot,
        result: winner.campaignDraw.resultSnapshot,
        lottery: winner.campaignDraw.lotteryDraw,
      },
    };
  }

  private async loadExecution(
    id: string,
    user: AuthenticatedUser,
    lotteryId: string,
    strict: boolean,
  ) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { drawRuleTemplate: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    this.assertOwner(campaign.organizerId, user);
    if (campaign.status !== CampaignStatus.PUBLISHED)
      throw new BadRequestException('A campanha precisa estar publicada.');
    if (strict && (!campaign.drawDate || campaign.drawDate > new Date()))
      throw new BadRequestException('A data do sorteio ainda não chegou.');
    if (strict && campaign.salesEndAt && campaign.salesEndAt > new Date())
      throw new BadRequestException('As vendas ainda não foram encerradas.');
    const lottery = await this.getLotteryDraw(lotteryId);
    if (
      lottery.status !== LotteryDrawStatus.VERIFIED &&
      lottery.status !== LotteryDrawStatus.LOCKED
    )
      throw new BadRequestException(
        'O resultado da Loteria precisa estar verificado.',
      );
    const rule = (campaign.publishedRuleSnapshot ??
      campaign.drawRuleTemplate?.ruleDefinition ??
      campaign.customDrawRule) as unknown as DrawRuleDefinition;
    if (!rule) throw new BadRequestException('Campanha sem regra publicada.');
    return { campaign, lottery, rule };
  }
  private async authorizedCampaign(id: string, user: AuthenticatedUser) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { drawRuleTemplate: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    this.assertOwner(campaign.organizerId, user);
    return campaign;
  }
  private normalizeLookupNumber(raw: string, totalNumbers: number) {
    const value = raw.trim();
    if (!/^\d+$/.test(value))
      throw new BadRequestException('Informe um número válido.');
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0 || number >= totalNumbers)
      throw new BadRequestException(
        `Informe um número entre 0 e ${Math.max(0, totalNumbers - 1)}.`,
      );
    return number;
  }
  private winnerTicket(campaignId: string, number: number) {
    return this.prisma.ticket.findFirst({
      where: { campaignId, number, status: TicketStatus.SOLD },
      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            state: true,
          },
        },
        purchase: {
          include: {
            payments: {
              select: {
                id: true,
                status: true,
                method: true,
                approvedAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
  }
  private winnerLookupPayload(
    campaign: {
      id: string;
      title: string;
      totalNumbers: number;
      mainPrizeName: string | null;
      estimatedPrizeValue: Prisma.Decimal | null;
    },
    ticket: Awaited<ReturnType<DrawsService['winnerTicket']>> & {},
    mode: 'AUTOMATIC' | 'MANUAL',
    calculatedNumber: number,
    lotteryDrawId?: string | null,
  ) {
    const payment = ticket.purchase.payments[0] ?? null;
    return {
      mode,
      campaign: { id: campaign.id, title: campaign.title },
      calculatedNumber: String(calculatedNumber).padStart(
        String(Math.max(0, campaign.totalNumbers - 1)).length,
        '0',
      ),
      winningNumber: String(ticket.number).padStart(
        String(Math.max(0, campaign.totalNumbers - 1)).length,
        '0',
      ),
      lotteryDrawId: lotteryDrawId ?? null,
      prize: {
        name: campaign.mainPrizeName ?? 'Prêmio principal',
        value: campaign.estimatedPrizeValue
          ? Number(campaign.estimatedPrizeValue)
          : null,
      },
      buyer: {
        ...ticket.buyer,
        profileImageUrl: null,
      },
      purchase: {
        id: ticket.purchase.id,
        createdAt: ticket.purchase.createdAt,
        status: ticket.purchase.status,
        total: Number(ticket.purchase.total),
        payment,
      },
      consultedAt: new Date(),
    };
  }
  private recordWinnerLookup(
    campaignId: string,
    user: AuthenticatedUser,
    mode: 'AUTOMATIC' | 'MANUAL',
    informedNumber: string,
    resolvedNumber: number | null,
    found: boolean,
    lotteryDrawId?: string | null,
  ) {
    return this.prisma.auditLog.create({
      data: {
        entityType: 'Campaign',
        entityId: campaignId,
        action: `WINNER_LOOKUP_${mode}`,
        actorUserId: user.id,
        actorRole: user.role,
        newData: {
          mode,
          informedNumber,
          resolvedNumber,
          found,
          lotteryDrawId: lotteryDrawId ?? null,
        },
      },
    });
  }
  private async resolveTicket(
    campaignId: string,
    number: number,
    policy: string,
  ) {
    const exact = await this.prisma.ticket.findFirst({
      where: { campaignId, number, status: TicketStatus.SOLD },
    });
    if (exact) return exact;
    if (policy === 'NEXT_SOLD_NUMBER')
      return this.prisma.ticket.findFirst({
        where: {
          campaignId,
          status: TicketStatus.SOLD,
          number: { gt: number },
        },
        orderBy: { number: 'asc' },
      });
    if (policy === 'PREVIOUS_SOLD_NUMBER')
      return this.prisma.ticket.findFirst({
        where: {
          campaignId,
          status: TicketStatus.SOLD,
          number: { lt: number },
        },
        orderBy: { number: 'desc' },
      });
    if (policy === 'CLOSEST_SOLD_NUMBER') {
      const [next, previous] = await Promise.all([
        this.prisma.ticket.findFirst({
          where: {
            campaignId,
            status: TicketStatus.SOLD,
            number: { gt: number },
          },
          orderBy: { number: 'asc' },
        }),
        this.prisma.ticket.findFirst({
          where: {
            campaignId,
            status: TicketStatus.SOLD,
            number: { lt: number },
          },
          orderBy: { number: 'desc' },
        }),
      ]);
      return !previous
        ? next
        : !next
          ? previous
          : next.number - number < number - previous.number
            ? next
            : previous;
    }
    return null;
  }
  private prizes(draw: {
    firstPrize: string;
    secondPrize: string;
    thirdPrize: string;
    fourthPrize: string;
    fifthPrize: string;
  }) {
    return [
      draw.firstPrize,
      draw.secondPrize,
      draw.thirdPrize,
      draw.fourthPrize,
      draw.fifthPrize,
    ] as [string, string, string, string, string];
  }
  private assertFivePrizes(dto: CreateLotteryDrawDto) {
    [
      dto.firstPrize,
      dto.secondPrize,
      dto.thirdPrize,
      dto.fourthPrize,
      dto.fifthPrize,
    ].forEach((v) => {
      if (!/^\d{5}$/.test(v))
        throw new BadRequestException(
          'Cada prêmio deve conter exatamente cinco dígitos.',
        );
    });
  }
  private assertOwner(owner: string, user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN && owner !== user.id)
      throw new ForbiddenException('Você não pode operar esta campanha.');
  }
  private maskName(name: string) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : parts[0];
  }
  private audit(
    entityType: string,
    entityId: string,
    action: string,
    user: AuthenticatedUser,
    previousData?: unknown,
    newData?: unknown,
  ) {
    return this.prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        actorUserId: user.id,
        actorRole: user.role,
        previousData: previousData as Prisma.InputJsonValue,
        newData: newData as Prisma.InputJsonValue,
      },
    });
  }
}
