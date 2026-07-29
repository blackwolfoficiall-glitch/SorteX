import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseStatus } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

type RouletteRule = { id: string; minQuantity: number; rounds: number };
type RouletteItem = {
  id: string;
  name: string;
  type: string;
  imageUrl?: string;
  quantity: number;
  probability: number;
  isActive: boolean;
};
type RouletteConfig = {
  enabled: boolean;
  name: string;
  description?: string;
  imageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  rules: RouletteRule[];
  items: RouletteItem[];
};
type SpinMetadata = {
  campaignId: string;
  purchaseId: string;
  itemId: string;
  itemName: string;
  itemType: string;
  imageUrl?: string;
  isPrize: boolean;
};

@Injectable()
export class RouletteService {
  constructor(private readonly prisma: PrismaService) {}

  async buyerStatus(campaignId: string, buyerId: string) {
    const campaign = await this.campaignWithConfig(campaignId);
    const config = this.config(campaign.customization?.configuration);
    const purchases = await this.prisma.purchase.findMany({
      where: { campaignId, buyerId, status: PurchaseStatus.PAID },
      select: { id: true, quantity: true, confirmedAt: true },
    });
    const spins = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'ROULETTE',
        entityId: campaignId,
        action: 'ROULETTE_SPIN',
        actorUserId: buyerId,
      },
      orderBy: { createdAt: 'desc' },
    });
    const totalRounds = purchases.reduce(
      (total, purchase) =>
        total + this.roundsFor(purchase.quantity, config.rules),
      0,
    );
    return {
      campaign: { id: campaign.id, title: campaign.title, slug: campaign.slug },
      config: this.publicConfig(config),
      totalRounds,
      usedRounds: spins.length,
      availableRounds: Math.max(0, totalRounds - spins.length),
      history: spins.map((spin) => this.historyItem(spin)),
    };
  }

  async spin(campaignId: string, buyerId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
          include: { customization: true },
        });
        if (!campaign) throw new NotFoundException('Campanha não encontrada.');
        const config = this.config(campaign.customization?.configuration);
        this.ensureActive(config);
        const purchases = await tx.purchase.findMany({
          where: { campaignId, buyerId, status: PurchaseStatus.PAID },
          select: { id: true, quantity: true },
        });
        const used = await tx.auditLog.count({
          where: {
            entityType: 'ROULETTE',
            entityId: campaignId,
            action: 'ROULETTE_SPIN',
            actorUserId: buyerId,
          },
        });
        const entitlements = purchases.flatMap((purchase) =>
          Array.from(
            { length: this.roundsFor(purchase.quantity, config.rules) },
            () => purchase.id,
          ),
        );
        if (used >= entitlements.length)
          throw new BadRequestException(
            'Você não possui rodadas disponíveis nesta campanha.',
          );
        const existing = await tx.auditLog.findMany({
          where: {
            entityType: 'ROULETTE',
            entityId: campaignId,
            action: 'ROULETTE_SPIN',
          },
          select: { metadata: true },
        });
        const wonByItem = new Map<string, number>();
        for (const row of existing) {
          const metadata = this.metadata(row.metadata);
          if (metadata?.isPrize)
            wonByItem.set(
              metadata.itemId,
              (wonByItem.get(metadata.itemId) || 0) + 1,
            );
        }
        const available = config.items.filter(
          (item) =>
            item.isActive &&
            item.probability > 0 &&
            (item.type === 'NO_PRIZE' ||
              (wonByItem.get(item.id) || 0) < item.quantity),
        );
        if (!available.length)
          throw new BadRequestException(
            'A roleta está temporariamente sem itens disponíveis.',
          );
        const totalWeight = available.reduce(
          (total, item) =>
            total + Math.max(1, Math.round(item.probability * 100)),
          0,
        );
        let draw = randomInt(totalWeight);
        const selected =
          available.find((item) => {
            draw -= Math.max(1, Math.round(item.probability * 100));
            return draw < 0;
          }) || available[available.length - 1];
        const metadata: SpinMetadata = {
          campaignId,
          purchaseId: entitlements[used],
          itemId: selected.id,
          itemName: selected.name,
          itemType: selected.type,
          imageUrl: selected.imageUrl,
          isPrize: selected.type !== 'NO_PRIZE',
        };
        const log = await tx.auditLog.create({
          data: {
            entityType: 'ROULETTE',
            entityId: campaignId,
            action: 'ROULETTE_SPIN',
            actorUserId: buyerId,
            metadata: metadata,
          },
        });
        return {
          result: metadata,
          createdAt: log.createdAt,
          availableRounds: entitlements.length - used - 1,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async organizerStatus(campaignId: string, organizerId: string) {
    const campaign = await this.campaignWithConfig(campaignId);
    if (campaign.organizerId !== organizerId)
      throw new ForbiddenException('Você não possui acesso a esta campanha.');
    const config = this.config(campaign.customization?.configuration);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'ROULETTE',
        entityId: campaignId,
        action: 'ROULETTE_SPIN',
      },
      include: { actor: { select: { id: true, name: true, city: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const used = new Map<string, number>();
    logs.forEach((log) => {
      const metadata = this.metadata(log.metadata);
      if (metadata?.isPrize)
        used.set(metadata.itemId, (used.get(metadata.itemId) || 0) + 1);
    });
    return {
      totalRounds: logs.length,
      prizesDelivered: logs.filter(
        (log) => this.metadata(log.metadata)?.isPrize,
      ).length,
      items: config.items.map((item) => ({
        ...item,
        remaining:
          item.type === 'NO_PRIZE'
            ? null
            : Math.max(0, item.quantity - (used.get(item.id) || 0)),
      })),
      history: logs.map((log) => ({
        ...this.historyItem(log),
        buyer: log.actor,
      })),
    };
  }

  private async campaignWithConfig(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { customization: true },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    return campaign;
  }
  private config(value: unknown): RouletteConfig {
    const root =
      value && typeof value === 'object'
        ? (value as Record<string, unknown>)
        : {};
    const source =
      root.roulette && typeof root.roulette === 'object'
        ? (root.roulette as Record<string, unknown>)
        : {};
    return {
      enabled: source.enabled === true,
      name: String(source.name || 'Roleta SorteX'),
      description: source.description ? String(source.description) : undefined,
      imageUrl: source.imageUrl ? String(source.imageUrl) : undefined,
      startsAt: source.startsAt ? String(source.startsAt) : undefined,
      endsAt: source.endsAt ? String(source.endsAt) : undefined,
      rules: Array.isArray(source.rules)
        ? source.rules
            .map((rule, index) => {
              const item = rule as Record<string, unknown>;
              return {
                id: String(item.id || `regra-${index}`),
                minQuantity: Math.max(1, Number(item.minQuantity) || 1),
                rounds: Math.max(0, Math.floor(Number(item.rounds) || 0)),
              };
            })
            .sort((a, b) => a.minQuantity - b.minQuantity)
        : [],
      items: Array.isArray(source.items)
        ? source.items.map((entry, index) => {
            const item = entry as Record<string, unknown>;
            return {
              id: String(item.id || `item-${index}`),
              name: String(item.name || 'Item'),
              type: String(item.type || 'OTHER'),
              imageUrl: item.imageUrl ? String(item.imageUrl) : undefined,
              quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
              probability: Math.max(0, Number(item.probability) || 0),
              isActive: item.isActive !== false,
            };
          })
        : [],
    };
  }
  private ensureActive(config: RouletteConfig) {
    const now = Date.now();
    if (!config.enabled)
      throw new BadRequestException('A roleta não está ativa.');
    if (config.startsAt && new Date(config.startsAt).getTime() > now)
      throw new BadRequestException('A roleta ainda não começou.');
    if (config.endsAt && new Date(config.endsAt).getTime() < now)
      throw new BadRequestException('A roleta foi encerrada.');
  }
  private roundsFor(quantity: number, rules: RouletteRule[]) {
    return (
      [...rules]
        .filter((rule) => quantity >= rule.minQuantity)
        .sort((a, b) => b.minQuantity - a.minQuantity)[0]?.rounds || 0
    );
  }
  private publicConfig(config: RouletteConfig) {
    return {
      enabled: config.enabled,
      name: config.name,
      description: config.description,
      imageUrl: config.imageUrl,
      startsAt: config.startsAt,
      endsAt: config.endsAt,
    };
  }
  private metadata(value: unknown) {
    return value && typeof value === 'object'
      ? (value as unknown as SpinMetadata)
      : null;
  }
  private historyItem(log: { metadata: unknown; createdAt: Date }) {
    const metadata = this.metadata(log.metadata);
    return { result: metadata, createdAt: log.createdAt };
  }
}
