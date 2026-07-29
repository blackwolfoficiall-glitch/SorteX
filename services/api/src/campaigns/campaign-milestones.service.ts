import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CampaignMilestoneStatus,
  LotteryDrawStatus,
  Prisma,
  TicketStatus,
  UserRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  DrawRuleEngineService,
  type DrawRuleDefinition,
} from '../draws/draw-rule-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import type { SaveCampaignMilestonesDto } from './dto/campaign-milestone.dto';

type MilestoneWithWinner = Prisma.CampaignMilestonePrizeGetPayload<{
  include: {
    winnerTicket: {
      include: {
        buyer: { select: { name: true; city: true; state: true } };
      };
    };
  };
}>;

@Injectable()
export class CampaignMilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: DrawRuleEngineService,
  ) {}

  async listOwned(campaignId: string, user: AuthenticatedUser) {
    await this.ownedCampaign(campaignId, user);
    return this.list(campaignId, true);
  }

  async listPublic(slug: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        slug,
        status: { in: ['PUBLISHED', 'SOLD_OUT', 'DRAWN', 'FINISHED'] },
      },
      select: { id: true, milestoneWinnersRemainEligible: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    const milestones = await this.list(campaign.id, false);
    return {
      winnersRemainEligible: campaign.milestoneWinnersRemainEligible,
      milestones,
    };
  }

  async save(
    campaignId: string,
    user: AuthenticatedUser,
    dto: SaveCampaignMilestonesDto,
  ) {
    await this.ownedCampaign(campaignId, user);
    const percentages = dto.milestones.map((item) => item.percentage);
    if (new Set(percentages).size !== percentages.length)
      throw new BadRequestException(
        'Não é permitido cadastrar duas metas no mesmo percentual.',
      );

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.campaignMilestonePrize.findMany({
        where: {
          campaignId,
          status: { not: CampaignMilestoneStatus.WAITING },
        },
        select: { percentage: true },
      });
      const lockedPercentages = new Set(locked.map((item) => item.percentage));
      if (dto.milestones.some((item) => lockedPercentages.has(item.percentage)))
        throw new BadRequestException(
          'Metas já alcançadas não podem ser alteradas.',
        );

      await tx.campaignMilestonePrize.deleteMany({
        where: { campaignId, status: CampaignMilestoneStatus.WAITING },
      });
      if (dto.milestones.length)
        await tx.campaignMilestonePrize.createMany({
          data: dto.milestones.map((item) => ({
            campaignId,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            imageUrl: item.imageUrl?.trim() || null,
            imageCrop: item.imageCrop
              ? {
                  desktop: { ...item.imageCrop.desktop },
                  mobile: { ...item.imageCrop.mobile },
                }
              : undefined,
            videoUrl: item.videoUrl?.trim() || null,
            estimatedValue:
              item.estimatedValue == null
                ? null
                : new Prisma.Decimal(item.estimatedValue),
            percentage: item.percentage,
            scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : null,
            notes: item.notes?.trim() || null,
          })),
        });
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          milestoneWinnersRemainEligible: dto.winnersRemainEligible,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'Campaign',
          entityId: campaignId,
          action: 'MILESTONES_UPDATED',
          actorUserId: user.id,
          actorRole: user.role,
          newData: {
            percentages,
            winnersRemainEligible: dto.winnersRemainEligible,
          },
        },
      });
    });
    return this.listOwned(campaignId, user);
  }

  async evaluateReached(campaignId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
          select: {
            id: true,
            totalNumbers: true,
            soldNumbers: true,
            milestoneWinnersRemainEligible: true,
            milestonePrizes: {
              where: { status: CampaignMilestoneStatus.WAITING },
              orderBy: { percentage: 'asc' },
            },
          },
        });
        if (!campaign || campaign.totalNumbers < 1) return [];
        const progress = (campaign.soldNumbers / campaign.totalNumbers) * 100;
        const due = campaign.milestonePrizes.filter(
          (item) =>
            item.percentage <= progress &&
            (!item.scheduledAt || item.scheduledAt <= new Date()),
        );
        const released: string[] = [];
        for (const milestone of due) {
          const excludedWinnerIds = campaign.milestoneWinnersRemainEligible
            ? []
            : (
                await tx.campaignMilestonePrize.findMany({
                  where: {
                    campaignId,
                    status: {
                      in: [
                        CampaignMilestoneStatus.DRAWN,
                        CampaignMilestoneStatus.COMPLETED,
                      ],
                    },
                    winnerTicketId: { not: null },
                  },
                  select: { winnerTicketId: true },
                })
              ).flatMap((item) =>
                item.winnerTicketId ? [item.winnerTicketId] : [],
              );
          const tickets = await tx.ticket.findMany({
            where: {
              campaignId,
              status: TicketStatus.SOLD,
              purchase: { status: 'PAID' },
              ...(excludedWinnerIds.length
                ? { id: { notIn: excludedWinnerIds } }
                : {}),
            },
            select: {
              id: true,
              buyerId: true,
              purchaseId: true,
              number: true,
            },
            orderBy: { number: 'asc' },
          });
          if (!tickets.length) continue;
          const capturedAt = new Date();
          await tx.campaignMilestoneEligibleTicket.createMany({
            data: tickets.map((ticket) => ({
              milestoneId: milestone.id,
              ticketId: ticket.id,
              buyerId: ticket.buyerId,
              purchaseId: ticket.purchaseId,
              number: ticket.number,
              capturedAt,
            })),
            skipDuplicates: true,
          });
          await tx.campaignMilestonePrize.update({
            where: { id: milestone.id },
            data: {
              status: CampaignMilestoneStatus.RELEASED,
              reachedAt: capturedAt,
              snapshotAt: capturedAt,
              eligibleTicketCount: tickets.length,
            },
          });
          await tx.auditLog.create({
            data: {
              entityType: 'CampaignMilestonePrize',
              entityId: milestone.id,
              action: 'ELIGIBILITY_SNAPSHOT_CREATED',
              newData: {
                campaignId,
                percentage: milestone.percentage,
                eligibleTicketCount: tickets.length,
                capturedAt,
              },
            },
          });
          released.push(milestone.id);
        }
        return released;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async draw(id: string, user: AuthenticatedUser) {
    const milestone = await this.prisma.campaignMilestonePrize.findUnique({
      where: { id },
      include: {
        campaign: { include: { drawRuleTemplate: true } },
        eligibleTickets: { orderBy: { number: 'asc' } },
      },
    });
    if (!milestone) throw new NotFoundException('Meta não encontrada.');
    this.assertOwner(milestone.campaign.organizerId, user);
    if (milestone.status !== CampaignMilestoneStatus.RELEASED)
      throw new BadRequestException(
        'A meta precisa estar liberada e possuir uma fotografia elegível.',
      );
    if (!milestone.eligibleTickets.length)
      throw new BadRequestException('A fotografia elegível está vazia.');

    const lottery = await this.prisma.lotteryDraw.findFirst({
      where: {
        status: { in: [LotteryDrawStatus.VERIFIED, LotteryDrawStatus.LOCKED] },
        ...(milestone.scheduledAt
          ? { drawDate: { gte: milestone.scheduledAt } }
          : {}),
      },
      orderBy: { drawDate: 'asc' },
    });
    if (!lottery)
      throw new NotFoundException(
        'Ainda não existe resultado verificado para esta meta.',
      );
    const rule = (milestone.campaign.publishedRuleSnapshot ??
      milestone.campaign.drawRuleTemplate?.ruleDefinition ??
      milestone.campaign.customDrawRule) as unknown as DrawRuleDefinition;
    if (!rule)
      throw new BadRequestException('Campanha sem regra de sorteio publicada.');
    const result = this.engine.evaluate(rule, {
      prizes: [
        lottery.firstPrize,
        lottery.secondPrize,
        lottery.thirdPrize,
        lottery.fourthPrize,
        lottery.fifthPrize,
      ],
      totalNumbers: milestone.campaign.totalNumbers,
    });
    const calculated = Number(result.normalizedResult);
    const eligible = this.resolveEligible(
      milestone.eligibleTickets,
      calculated,
      milestone.campaign.unsoldNumberPolicy,
    );
    if (!eligible)
      throw new NotFoundException(
        'O resultado não encontrou título elegível conforme a política da campanha.',
      );
    const auditPayload = {
      milestoneId: id,
      lotteryDrawId: lottery.id,
      calculated,
      resolved: eligible.number,
      eligibleTicketCount: milestone.eligibleTickets.length,
      rule,
      result,
    };
    const auditHash = createHash('sha256')
      .update(JSON.stringify(auditPayload))
      .digest('hex');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.campaignMilestonePrize.update({
        where: {
          id,
          status: CampaignMilestoneStatus.RELEASED,
        },
        data: {
          status: CampaignMilestoneStatus.DRAWN,
          lotteryDrawId: lottery.id,
          winnerTicketId: eligible.ticketId,
          winningNumber: String(eligible.number).padStart(
            String(milestone.campaign.totalNumbers - 1).length,
            '0',
          ),
          ruleSnapshot: rule as unknown as Prisma.InputJsonValue,
          resultSnapshot: result,
          auditHash,
          executedByUserId: user.id,
          executedAt: new Date(),
        },
        include: {
          winnerTicket: {
            include: {
              buyer: { select: { name: true, city: true, state: true } },
            },
          },
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: 'CampaignMilestonePrize',
          entityId: id,
          action: 'MILESTONE_DRAW_EXECUTED',
          actorUserId: user.id,
          actorRole: user.role,
          newData: { auditHash, lotteryDrawId: lottery.id },
        },
      });
      return this.serialize(updated, true);
    });
  }

  private async list(campaignId: string, privateView: boolean) {
    const rows = await this.prisma.campaignMilestonePrize.findMany({
      where: { campaignId },
      include: {
        winnerTicket: {
          include: {
            buyer: { select: { name: true, city: true, state: true } },
          },
        },
      },
      orderBy: { percentage: 'asc' },
    });
    return rows.map((item) => this.serialize(item, privateView));
  }

  private serialize(item: MilestoneWithWinner, privateView: boolean) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      imageUrl: item.imageUrl,
      imageCrop: item.imageCrop,
      videoUrl: item.videoUrl,
      estimatedValue:
        item.estimatedValue == null ? null : Number(item.estimatedValue),
      percentage: item.percentage,
      scheduledAt: item.scheduledAt,
      status: item.status,
      reachedAt: item.reachedAt,
      snapshotAt: item.snapshotAt,
      winningNumber: item.winningNumber,
      ...(privateView
        ? {
            notes: item.notes,
            eligibleTicketCount: item.eligibleTicketCount,
            auditHash: item.auditHash,
          }
        : {}),
      winner: item.winnerTicket
        ? {
            name: this.maskName(item.winnerTicket.buyer.name),
            city: item.winnerTicket.buyer.city,
            state: item.winnerTicket.buyer.state,
          }
        : null,
    };
  }

  private resolveEligible(
    rows: Array<{ ticketId: string; number: number }>,
    number: number,
    policy: string,
  ) {
    const exact = rows.find((item) => item.number === number);
    if (exact) return exact;
    const next = rows.find((item) => item.number > number);
    const previous = [...rows].reverse().find((item) => item.number < number);
    if (policy === 'NEXT_SOLD_NUMBER') return next ?? null;
    if (policy === 'PREVIOUS_SOLD_NUMBER') return previous ?? null;
    if (policy === 'CLOSEST_SOLD_NUMBER')
      return !previous
        ? (next ?? null)
        : !next
          ? previous
          : next.number - number < number - previous.number
            ? next
            : previous;
    return null;
  }

  private async ownedCampaign(id: string, user: AuthenticatedUser) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, organizerId: user.id },
      select: { id: true },
    });
    if (!campaign || user.role !== UserRole.ORGANIZER)
      throw new ForbiddenException('Você não pode gerenciar esta campanha.');
    return campaign;
  }

  private assertOwner(ownerId: string, user: AuthenticatedUser) {
    if (user.role !== UserRole.ADMIN && ownerId !== user.id)
      throw new ForbiddenException('Você não pode operar esta meta.');
  }

  private maskName(name: string) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts.at(-1)?.[0]}.` : parts[0];
  }
}
