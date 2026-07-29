import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, DrawBasis, Prisma, UserRole } from '@prisma/client';
import { createReadStream, existsSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { OrganizerStorageService } from '../organizers/organizer-storage.service';
import type { UploadedOrganizerFile } from '../organizers/types/uploaded-file.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CreateDrawRuleTemplateDto } from './dto/create-draw-rule-template.dto';
import type { CampaignMediaTarget } from './dto/upload-campaign-media.dto';

const campaignInclude = {
  organizer: {
    select: {
      id: true,
      name: true,
      verified: true,
      organizerProfile: {
        select: {
          organizationName: true,
          logoStorageKey: true,
          verificationStatus: true,
          platformFee: true,
          customPlatformFee: true,
          platformFeeWaived: true,
          campaignsBlocked: true,
        },
      },
      organizerBrandProfile: {
        select: {
          slogan: true,
          publicName: true,
          primaryLogoUrl: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          buttonColor: true,
          progressColor: true,
          backgroundColor: true,
          cardColor: true,
          themeMode: true,
          layoutStyle: true,
          appearanceConfig: true,
          updatedAt: true,
        },
      },
      organizerSocialLinks: {
        where: { isActive: true },
        select: {
          id: true,
          type: true,
          label: true,
          url: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' as const },
      },
      organizerCommunities: {
        where: { isActive: true },
        select: {
          id: true,
          type: true,
          name: true,
          url: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  galleryImages: { orderBy: { sortOrder: 'asc' as const } },
  instantPrizes: { orderBy: { createdAt: 'asc' as const } },
  promotions: { orderBy: { sortOrder: 'asc' as const } },
  drawRuleTemplate: true,
  customization: true,
  milestonePrizes: {
    orderBy: { percentage: 'asc' as const },
    include: {
      winnerTicket: {
        include: {
          buyer: {
            select: { name: true, city: true },
          },
        },
      },
    },
  },
} as const satisfies Prisma.CampaignInclude;

type CampaignPayload = Prisma.CampaignGetPayload<{
  include: typeof campaignInclude;
}>;

const imageMimeTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const videoMimeTypes = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const systemTemplates = [
  {
    id: 'system-last-5-first',
    name: 'Últimos 5 dígitos do 1º prêmio',
    description: 'Utiliza os cinco dígitos do primeiro prêmio.',
    digits: [0, 1, 2, 3, 4].map((position, order) => ({
      prize: 1,
      position,
      order,
    })),
  },
  {
    id: 'system-last-4-first',
    name: 'Últimos 4 dígitos do 1º prêmio',
    description: 'Utiliza os quatro últimos dígitos do primeiro prêmio.',
    digits: [1, 2, 3, 4].map((position, order) => ({
      prize: 1,
      position,
      order,
    })),
  },
  {
    id: 'system-thousand-first',
    name: 'Milhar do 1º prêmio',
    description: 'Utiliza a milhar do primeiro prêmio.',
    digits: [1, 2, 3, 4].map((position, order) => ({
      prize: 1,
      position,
      order,
    })),
  },
  {
    id: 'system-hundred-first',
    name: 'Centena do 1º prêmio',
    description: 'Utiliza a centena do primeiro prêmio.',
    digits: [2, 3, 4].map((position, order) => ({
      prize: 1,
      position,
      order,
    })),
  },
  {
    id: 'system-ten-first',
    name: 'Dezena do 1º prêmio',
    description: 'Utiliza a dezena do primeiro prêmio.',
    digits: [3, 4].map((position, order) => ({
      prize: 1,
      position,
      order,
    })),
  },
  {
    id: 'system-combined-prizes',
    name: 'Últimos dígitos dos cinco prêmios',
    description: 'Concatena o último dígito dos cinco prêmios.',
    digits: [1, 2, 3, 4, 5].map((prize, order) => ({
      prize,
      position: 4,
      order,
    })),
  },
  {
    id: 'system-unit-first',
    name: 'Unidade do 1º prêmio',
    description: 'Utiliza somente a unidade do primeiro prêmio.',
    digits: [{ prize: 1, position: 4, order: 0 }],
  },
  {
    id: 'system-combined-123',
    name: 'Combinação entre 1º, 2º e 3º prêmios',
    description:
      'Combina unidade, dezena e centena dos três primeiros prêmios.',
    digits: [
      { prize: 1, position: 4, order: 0 },
      { prize: 2, position: 3, order: 1 },
      { prize: 3, position: 2, order: 2 },
    ],
  },
  {
    id: 'system-custom-five',
    name: 'Combinação personalizada de cinco dígitos',
    description: 'Modelo genérico editável com um dígito de cada prêmio.',
    digits: [1, 2, 3, 4, 5].map((prize, order) => ({
      prize,
      position: order,
      order,
    })),
  },
  {
    id: 'system-100k',
    name: 'Campanhas de 100 mil números',
    description:
      'Resultado de cinco dígitos normalizado para até 100 mil títulos.',
    digits: [0, 1, 2, 3, 4].map((position, order) => ({
      prize: 1,
      position,
      order,
    })),
  },
  {
    id: 'system-1m',
    name: 'Campanhas de 1 milhão de números',
    description:
      'Combinação genérica de seis dígitos para campanhas de até um milhão.',
    digits: [
      ...[0, 1, 2, 3, 4].map((position, order) => ({
        prize: 1,
        position,
        order,
      })),
      { prize: 2, position: 4, order: 5 },
    ],
  },
  {
    id: 'system-10m',
    name: 'Campanhas de 10 milhões de números',
    description:
      'Combinação genérica de sete dígitos para campanhas de até dez milhões.',
    digits: [
      ...[0, 1, 2, 3, 4].map((position, order) => ({
        prize: 1,
        position,
        order,
      })),
      { prize: 2, position: 3, order: 5 },
      { prize: 2, position: 4, order: 6 },
    ],
  },
] as const;

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: OrganizerStorageService,
  ) {}

  async create(user: AuthenticatedUser, data: CreateCampaignDto) {
    this.ensureOrganizer(user);
    data = this.normalizePopularQuantity(data);
    await this.validateRuleSelection(user.id, data);
    const title = data.title?.trim() || 'Nova rifa';
    const slug = await this.uniqueSlug(data.slug || title);
    const campaign = await this.prisma.campaign.create({
      data: {
        organizerId: user.id,
        title,
        slug,
        ...this.scalarData(data),
        promotions: data.promotions
          ? { create: this.promotionData(data.promotions, data.numberPrice) }
          : undefined,
        instantPrizes: data.instantPrizes
          ? {
              create: this.instantPrizeData(
                data.instantPrizes,
                data.totalNumbers ?? 10000,
              ),
            }
          : undefined,
        milestoneWinnersRemainEligible:
          data.milestoneWinnersRemainEligible ?? true,
        milestonePrizes: data.milestones?.length
          ? { create: this.milestoneData(data.milestones) }
          : undefined,
      },
      include: campaignInclude,
    });
    await this.saveDisplayPreference(
      campaign.id,
      user.id,
      data.showParticipants,
    );
    await this.saveTitleDisplayMode(
      campaign.id,
      user.id,
      data.titleDisplayMode,
    );
    await this.saveVisualPreferences(campaign.id, user.id, data);
    await this.saveCustomization(campaign.id, user.id, data.customization);
    return {
      ...this.serialize(campaign),
      showParticipants: data.showParticipants ?? true,
      titleDisplayMode: data.titleDisplayMode ?? 'SIMPLE',
      ...this.visualDefaults(data),
      customization: data.customization
        ? {
            useOrganizerDefaults:
              data.customization.useOrganizerDefaults !== false,
            configuration: data.customization,
          }
        : campaign.customization,
    };
  }

  async listMine(user: AuthenticatedUser, status?: CampaignStatus) {
    this.ensureOrganizer(user);
    const campaigns = await this.prisma.campaign.findMany({
      where: { organizerId: user.id, ...(status ? { status } : {}) },
      include: campaignInclude,
      orderBy: { updatedAt: 'desc' },
    });
    return campaigns.map((campaign) => this.serialize(campaign));
  }

  async getOwned(id: string, user: AuthenticatedUser) {
    this.ensureOrganizer(user);
    const campaign = await this.findOwned(id, user.id);
    return {
      ...this.serialize(campaign),
      showParticipants: await this.showParticipants(id),
      titleDisplayMode: await this.titleDisplayMode(id),
      ...(await this.visualPreferences(id)),
      customization: campaign.customization,
    };
  }

  async update(id: string, user: AuthenticatedUser, data: CreateCampaignDto) {
    data = this.normalizePopularQuantity(data);
    const current = await this.findOwned(id, user.id);
    this.ensureCampaignEditable(current.status);
    this.ensureCriticalFieldsEditable(current, data);
    await this.validateRuleSelection(user.id, data);
    const slug = data.slug
      ? await this.uniqueSlug(data.slug, current.id)
      : undefined;

    const campaign = await this.prisma.$transaction(async (transaction) => {
      if (
        data.promotions &&
        current.status !== CampaignStatus.PUBLISHED &&
        current.status !== CampaignStatus.PAUSED
      ) {
        await transaction.campaignPromotion.deleteMany({
          where: { campaignId: id },
        });
        const promotions = this.promotionData(
          data.promotions,
          data.numberPrice ?? Number(current.numberPrice),
        );
        if (promotions.length) {
          await transaction.campaignPromotion.createMany({
            data: promotions.map((promotion) => ({
              ...promotion,
              campaignId: id,
            })),
          });
        }
      }
      if (
        data.instantPrizes &&
        current.status !== CampaignStatus.PUBLISHED &&
        current.status !== CampaignStatus.PAUSED
      ) {
        await transaction.campaignInstantPrize.deleteMany({
          where: { campaignId: id },
        });
        await transaction.campaignInstantPrize.createMany({
          data: this.instantPrizeData(
            data.instantPrizes,
            data.totalNumbers ?? current.totalNumbers,
          ).map((prize) => ({
            ...prize,
            campaignId: id,
          })),
        });
      }
      if (data.milestones) {
        const percentages = data.milestones.map((item) => item.percentage);
        if (new Set(percentages).size !== percentages.length)
          throw new BadRequestException(
            'Não é permitido cadastrar duas metas no mesmo percentual.',
          );
        const locked = await transaction.campaignMilestonePrize.findMany({
          where: { campaignId: id, status: { not: 'WAITING' } },
          select: { percentage: true },
        });
        const lockedPercentages = new Set(
          locked.map((milestone) => milestone.percentage),
        );
        const editableMilestones = data.milestones.filter(
          (milestone) => !lockedPercentages.has(milestone.percentage),
        );
        await transaction.campaignMilestonePrize.deleteMany({
          where: { campaignId: id, status: 'WAITING' },
        });
        if (editableMilestones.length)
          await transaction.campaignMilestonePrize.createMany({
            data: this.milestoneData(editableMilestones).map((item) => ({
              ...item,
              campaignId: id,
            })),
          });
      }
      return transaction.campaign.update({
        where: { id },
        data: {
          ...this.scalarData(data),
          title: data.title,
          slug,
          milestoneWinnersRemainEligible: data.milestoneWinnersRemainEligible,
        },
        include: campaignInclude,
      });
    });
    await this.saveDisplayPreference(id, user.id, data.showParticipants);
    await this.saveTitleDisplayMode(id, user.id, data.titleDisplayMode);
    await this.saveVisualPreferences(id, user.id, data);
    await this.saveCustomization(id, user.id, data.customization);
    return {
      ...this.serialize(campaign),
      showParticipants: await this.showParticipants(id),
      titleDisplayMode: await this.titleDisplayMode(id),
      ...(await this.visualPreferences(id)),
      customization: data.customization
        ? {
            useOrganizerDefaults:
              data.customization.useOrganizerDefaults !== false,
            configuration: data.customization,
          }
        : campaign.customization,
    };
  }

  async remove(id: string, user: AuthenticatedUser) {
    const campaign = await this.findOwned(id, user.id);
    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException(
        'Somente campanhas em rascunho podem ser excluídas.',
      );
    }
    await this.prisma.campaign.delete({ where: { id } });
    return { message: 'Rascunho excluído com sucesso.' };
  }

  async publish(id: string, user: AuthenticatedUser) {
    const current = await this.findOwned(id, user.id);
    if (
      current.organizer.organizerProfile?.verificationStatus !== 'VERIFIED' ||
      current.organizer.organizerProfile?.campaignsBlocked
    ) {
      throw new ForbiddenException(
        'Seu cadastro precisa estar aprovado para publicar campanhas.',
      );
    }
    if (
      current.status !== CampaignStatus.DRAFT &&
      current.status !== CampaignStatus.PENDING_REVIEW &&
      current.status !== CampaignStatus.PAUSED
    ) {
      throw new BadRequestException(
        'Somente campanhas em rascunho ou pausadas podem ser publicadas.',
      );
    }
    const missing = this.publishChecklist(current);
    if (missing.length) {
      throw new BadRequestException(
        `Complete os seguintes itens: ${missing.join(', ')}.`,
      );
    }

    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedRuleSnapshot: (current.drawRuleTemplate?.ruleDefinition ??
          current.customDrawRule) as Prisma.InputJsonValue,
      },
      include: campaignInclude,
    });
    return this.serialize(campaign);
  }

  async pause(id: string, user: AuthenticatedUser) {
    const current = await this.findOwned(id, user.id);
    if (current.status !== CampaignStatus.PUBLISHED) {
      throw new BadRequestException(
        'Somente campanhas publicadas podem ser pausadas.',
      );
    }
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PAUSED },
      include: campaignInclude,
    });
    return this.serialize(campaign);
  }

  async finish(id: string, user: AuthenticatedUser) {
    const current = await this.findOwned(id, user.id);
    if (
      current.status !== CampaignStatus.PUBLISHED &&
      current.status !== CampaignStatus.PAUSED
    ) {
      throw new BadRequestException(
        'Somente campanhas publicadas ou pausadas podem ser finalizadas.',
      );
    }
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.FINISHED },
      include: campaignInclude,
    });
    return this.serialize(campaign);
  }

  async duplicate(id: string, user: AuthenticatedUser) {
    const source = await this.findOwned(id, user.id);
    const slug = await this.uniqueSlug(`${source.slug}-copia`);
    const campaign = await this.prisma.campaign.create({
      data: {
        organizerId: user.id,
        title: source.title.replace(/\s*[—-]\s*Cópia\s*$/i, ''),
        slug,
        shortDescription: source.shortDescription,
        description: source.description,
        regulation: source.regulation,
        category: source.category,
        mainPrizeName: source.mainPrizeName,
        mainPrizeDescription: source.mainPrizeDescription,
        mainPrizeImage: source.mainPrizeImage,
        mainPrizeQuantity: source.mainPrizeQuantity,
        cashAlternative: source.cashAlternative,
        estimatedPrizeValue: source.estimatedPrizeValue,
        coverImage: source.coverImage,
        promotionalVideo: source.promotionalVideo,
        totalNumbers: source.totalNumbers,
        numberPrice: source.numberPrice,
        minimumPurchase: source.minimumPurchase,
        maximumPurchasePerBuyer: source.maximumPurchasePerBuyer,
        numberSelectionMode: source.numberSelectionMode,
        drawDate: source.drawDate,
        drawTime: source.drawTime,
        drawBasis: source.drawBasis,
        drawRuleTemplateId: source.drawRuleTemplateId,
        customDrawRule: source.customDrawRule ?? undefined,
        salesStartAt: source.salesStartAt,
        salesEndAt: source.salesEndAt,
        galleryImages: {
          create: source.galleryImages.map((image) => ({
            storageKey: image.storageKey,
            originalName: image.originalName,
            mimeType: image.mimeType,
            size: image.size,
            sortOrder: image.sortOrder,
          })),
        },
        promotions: {
          create: source.promotions
            .filter((promotion) => !promotion.isPopular)
            .map((promotion) => ({
              name: promotion.name,
              numberQuantity: promotion.numberQuantity,
              packagePrice: promotion.packagePrice,
              discountRate: promotion.discountRate,
              isPopular: promotion.isPopular,
              isActive: promotion.isActive,
              startsAt: promotion.startsAt,
              endsAt: promotion.endsAt,
              sortOrder: promotion.sortOrder,
            })),
        },
        instantPrizes: {
          create: source.instantPrizes.map((prize) => ({
            exactNumber: prize.exactNumber,
            generationRule: prize.generationRule ?? undefined,
            value: prize.value,
            description: prize.description,
            imageStorageKey: prize.imageStorageKey,
            type: prize.type,
            quantity: prize.quantity,
          })),
        },
        milestoneWinnersRemainEligible: source.milestoneWinnersRemainEligible,
        milestonePrizes: {
          create: source.milestonePrizes.map((milestone) => ({
            name: milestone.name,
            description: milestone.description,
            imageUrl: milestone.imageUrl,
            imageCrop:
              milestone.imageCrop === null
                ? Prisma.JsonNull
                : milestone.imageCrop,
            videoUrl: milestone.videoUrl,
            estimatedValue: milestone.estimatedValue,
            percentage: milestone.percentage,
            scheduledAt: milestone.scheduledAt,
            notes: milestone.notes,
          })),
        },
      },
      include: campaignInclude,
    });
    return this.serialize(campaign);
  }

  async uploadMedia(
    id: string,
    user: AuthenticatedUser,
    target: CampaignMediaTarget,
    files: UploadedOrganizerFile[],
    instantPrizeId?: string,
  ) {
    const current = await this.findOwned(id, user.id);
    this.ensureCampaignEditable(current.status);
    if (!files.length) throw new BadRequestException('Selecione um arquivo.');
    if (target !== 'GALLERY' && files.length > 1) {
      throw new BadRequestException('Envie apenas um arquivo para este campo.');
    }

    const isVideo = target === 'VIDEO';
    const saved = await Promise.all(
      files.map((file) =>
        this.storage.save(`campaigns/${id}`, file, {
          maxSize: isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024,
          allowedMimeTypes: isVideo ? videoMimeTypes : imageMimeTypes,
        }),
      ),
    );

    if (target === 'GALLERY') {
      const start = await this.prisma.campaignImage.count({
        where: { campaignId: id },
      });
      await this.prisma.campaignImage.createMany({
        data: saved.map((file, index) => ({
          campaignId: id,
          storageKey: file.storageKey,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          sortOrder: start + index,
        })),
      });
    } else if (target === 'INSTANT_PRIZE') {
      if (!instantPrizeId) {
        throw new BadRequestException('Informe a cota premiada.');
      }
      const prize = await this.prisma.campaignInstantPrize.findFirst({
        where: { id: instantPrizeId, campaignId: id },
        select: { id: true },
      });
      if (!prize) throw new NotFoundException('Cota premiada não encontrada.');
      await this.prisma.campaignInstantPrize.update({
        where: { id: prize.id },
        data: { imageStorageKey: saved[0].storageKey },
      });
    } else if (target === 'MILESTONE') {
      const filename = saved[0].storageKey.split('/').pop();
      if (!filename) throw new BadRequestException('Arquivo inválido.');
      return {
        ...this.serialize(current),
        uploadedMediaUrl: `/public/campaigns/media/${id}/milestone/${filename}`,
      };
    } else {
      const field = {
        COVER: 'coverImage',
        VIDEO: 'promotionalVideo',
        MAIN_PRIZE: 'mainPrizeImage',
      }[target] as 'coverImage' | 'promotionalVideo' | 'mainPrizeImage';
      await this.prisma.campaign.update({
        where: { id },
        data: {
          [field]: saved[0].storageKey,
        },
      });
    }
    return this.getOwned(id, user);
  }

  async deleteImage(id: string, imageId: string, user: AuthenticatedUser) {
    const campaign = await this.findOwned(id, user.id);
    this.ensureCampaignEditable(campaign.status);
    const image = await this.prisma.campaignImage.findFirst({
      where: { id: imageId, campaignId: id },
      select: { id: true },
    });
    if (!image) throw new NotFoundException('Imagem não encontrada.');
    await this.prisma.campaignImage.delete({ where: { id: image.id } });
    return this.getOwned(id, user);
  }

  async updateImage(
    id: string,
    imageId: string,
    user: AuthenticatedUser,
    data: { caption?: string; sortOrder?: number },
  ) {
    const campaign = await this.findOwned(id, user.id);
    this.ensureCampaignEditable(campaign.status);
    const image = await this.prisma.campaignImage.findFirst({
      where: { id: imageId, campaignId: id },
      select: { id: true },
    });
    if (!image) throw new NotFoundException('Imagem não encontrada.');
    await this.prisma.campaignImage.update({
      where: { id: image.id },
      data: {
        originalName: data.caption?.trim() || undefined,
        sortOrder: data.sortOrder,
      },
    });
    return this.getOwned(id, user);
  }

  async listPublic(category?: CampaignPayload['category']) {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.PUBLISHED,
        ...(category ? { category } : {}),
      },
      include: campaignInclude,
      orderBy: { publishedAt: 'desc' },
    });
    return campaigns.map((campaign) => this.serializePublic(campaign));
  }

  async getPublic(slug: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { slug, status: CampaignStatus.PUBLISHED },
      include: campaignInclude,
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    const [participants, affiliateProgram] = await Promise.all([
      this.prisma.purchase.groupBy({
        by: ['buyerId'],
        where: { campaignId: campaign.id, status: 'PAID' },
      }),
      this.prisma.affiliateProgram.findFirst({
        where: {
          campaignId: campaign.id,
          status: 'ACTIVE',
          allowSelfSignup: true,
          OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
          AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }],
        },
        select: { id: true },
      }),
    ]);
    return {
      ...this.serializePublic(campaign),
      participantsCount: participants.length,
      affiliateProgramActive: Boolean(affiliateProgram),
      showParticipants: await this.showParticipants(campaign.id),
      titleDisplayMode: await this.titleDisplayMode(campaign.id),
      ...(await this.visualPreferences(campaign.id)),
    };
  }

  async getPublicOrganizerProfile(organizerId: string) {
    const organizer = await this.prisma.user.findFirst({
      where: { id: organizerId, role: 'ORGANIZER' },
      select: {
        id: true,
        name: true,
        verified: true,
        organizerProfile: {
          select: { organizationName: true, logoStorageKey: true },
        },
        organizerBrandProfile: {
          select: {
            publicName: true,
            primaryLogoUrl: true,
            publicPhone: true,
            publicEmail: true,
            themeMode: true,
            primaryColor: true,
            backgroundColor: true,
            cardColor: true,
            appearanceConfig: true,
          },
        },
        organizerSocialLinks: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, type: true, label: true, url: true },
        },
      },
    });
    if (!organizer) throw new NotFoundException('Organizador não encontrado.');
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        organizerId,
        status: { in: ['PUBLISHED', 'SOLD_OUT', 'DRAWN', 'FINISHED'] },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        status: true,
        coverImage: true,
        salesStartAt: true,
        salesEndAt: true,
        drawDate: true,
        createdAt: true,
        draws: {
          select: {
            status: true,
            winningNumber: true,
            executedAt: true,
            confirmedAt: true,
          },
          take: 1,
        },
        winners: {
          where: { publicDisclosureAuthorized: true },
          select: {
            id: true,
            prizeName: true,
            winningNumber: true,
            publicDisplayName: true,
            publicCity: true,
            status: true,
            deliveredAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
    return {
      organizer: {
        id: organizer.id,
        name:
          organizer.organizerProfile?.organizationName ||
          organizer.organizerBrandProfile?.publicName ||
          organizer.name,
        verified: organizer.verified,
        logoUrl:
          organizer.organizerProfile?.logoStorageKey ||
          organizer.organizerBrandProfile?.primaryLogoUrl
            ? `/organizers/${organizer.id}/logo`
            : null,
        brand: organizer.organizerBrandProfile,
        socialLinks: organizer.organizerSocialLinks,
      },
      campaigns: campaigns.map(({ coverImage, ...campaign }) => ({
        ...campaign,
        coverImageUrl: coverImage
          ? `/public/campaigns/media/${campaign.id}/cover`
          : null,
      })),
      totals: {
        campaigns: campaigns.length,
        winners: campaigns.reduce(
          (total, item) => total + item.winners.length,
          0,
        ),
      },
    };
  }

  async listRuleTemplates(user: AuthenticatedUser) {
    this.ensureOrganizer(user);
    await this.ensureSystemTemplates();
    return this.prisma.drawRuleTemplate.findMany({
      where: { OR: [{ isSystemTemplate: true }, { organizerId: user.id }] },
      orderBy: [{ isSystemTemplate: 'desc' }, { name: 'asc' }],
    });
  }

  async createRuleTemplate(
    user: AuthenticatedUser,
    data: CreateDrawRuleTemplateDto,
  ) {
    this.ensureOrganizer(user);
    this.validateRuleDefinition(data.ruleDefinition);
    return this.prisma.drawRuleTemplate.create({
      data: {
        organizerId: user.id,
        name: data.name,
        description: data.description,
        ruleDefinition: data.ruleDefinition as Prisma.InputJsonValue,
      },
    });
  }

  simulateRule(ruleDefinition: Record<string, unknown>) {
    const digits = this.validateRuleDefinition(ruleDefinition);
    const prizes = ['48271', '15036', '90742', '63198', '27465'];
    const selected = digits
      .sort((a, b) => a.order - b.order)
      .map((digit) => ({
        ...digit,
        value: prizes[digit.prize - 1][digit.position],
      }));
    return {
      prizes: prizes.map((number, index) => ({ prize: index + 1, number })),
      selected,
      finalNumber: selected.map((digit) => digit.value).join(''),
    };
  }

  async getMediaFile(
    campaignId: string,
    kind:
      'cover' | 'video' | 'main-prize' | 'gallery' | 'instant' | 'milestone',
    mediaId?: string,
    user?: AuthenticatedUser,
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId },
      select: {
        organizerId: true,
        status: true,
        coverImage: true,
        promotionalVideo: true,
        mainPrizeImage: true,
        milestonePrizes: { select: { imageUrl: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (
      campaign.status !== CampaignStatus.PUBLISHED &&
      campaign.organizerId !== user?.id &&
      user?.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException('Você não pode acessar esta mídia.');
    }

    let storageKey: string | null = null;
    let mimeType: string | null = null;
    if (kind === 'cover') storageKey = campaign.coverImage;
    if (kind === 'video') storageKey = campaign.promotionalVideo;
    if (kind === 'main-prize') storageKey = campaign.mainPrizeImage;
    if (kind === 'gallery' && mediaId) {
      const image = await this.prisma.campaignImage.findFirst({
        where: { id: mediaId, campaignId },
      });
      storageKey = image?.storageKey ?? null;
      mimeType = image?.mimeType ?? null;
    }
    if (kind === 'instant' && mediaId) {
      const prize = await this.prisma.campaignInstantPrize.findFirst({
        where: { id: mediaId, campaignId },
        select: { imageStorageKey: true },
      });
      storageKey = prize?.imageStorageKey ?? null;
    }
    if (kind === 'milestone' && mediaId) {
      if (!/^[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(mediaId)) {
        throw new BadRequestException('Arquivo inválido.');
      }
      const imageUrl = `/public/campaigns/media/${campaignId}/milestone/${mediaId}`;
      const isReferenced = campaign.milestonePrizes.some(
        (milestone) => milestone.imageUrl === imageUrl,
      );
      const canPreview =
        campaign.organizerId === user?.id || user?.role === UserRole.ADMIN;
      if (!isReferenced && !canPreview)
        throw new NotFoundException('Mídia não encontrada.');
      storageKey = `campaigns/${campaignId}/${mediaId}`;
    }
    if (!storageKey) throw new NotFoundException('Mídia não encontrada.');
    const path = this.storage.resolve(storageKey);
    if (!existsSync(path))
      throw new NotFoundException('Arquivo não encontrado.');
    return {
      stream: createReadStream(path),
      mimeType: mimeType ?? this.storage.mimeType(storageKey),
    };
  }

  private async findOwned(id: string, organizerId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: campaignInclude,
    });
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.organizerId !== organizerId) {
      throw new ForbiddenException('Você não pode alterar esta campanha.');
    }
    return campaign;
  }

  private scalarData(data: CreateCampaignDto) {
    return {
      shortDescription: data.shortDescription,
      description: data.description,
      regulation: data.regulation,
      category: data.category,
      mainPrizeName: data.mainPrizeName,
      mainPrizeDescription: data.mainPrizeDescription,
      mainPrizeQuantity: data.mainPrizeQuantity,
      cashAlternative: data.cashAlternative,
      estimatedPrizeValue: data.estimatedPrizeValue,
      totalNumbers: data.totalNumbers,
      numberPrice: data.numberPrice,
      minimumPurchase: data.minimumPurchase,
      maximumPurchasePerBuyer: data.maximumPurchasePerBuyer,
      numberSelectionMode: data.numberSelectionMode,
      drawDate: data.drawDate ? new Date(data.drawDate) : undefined,
      drawTime: data.drawTime,
      drawBasis: data.drawBasis,
      drawRuleTemplateId: data.drawRuleTemplateId,
      customDrawRule: data.customDrawRule as Prisma.InputJsonValue | undefined,
      salesStartAt: data.salesStartAt ? new Date(data.salesStartAt) : undefined,
      salesEndAt: data.salesEndAt ? new Date(data.salesEndAt) : undefined,
    };
  }

  private async saveCustomization(
    campaignId: string,
    organizerId: string,
    configuration?: Record<string, unknown>,
  ) {
    if (!configuration) return;
    const useOrganizerDefaults = configuration.useOrganizerDefaults !== false;
    await this.prisma.campaignCustomization.upsert({
      where: { campaignId },
      create: {
        campaignId,
        organizerId,
        useOrganizerDefaults,
        configuration: configuration as Prisma.InputJsonValue,
      },
      update: {
        useOrganizerDefaults,
        configuration: configuration as Prisma.InputJsonValue,
      },
    });
  }

  private promotionData(
    promotions: NonNullable<CreateCampaignDto['promotions']>,
    numberPrice = 0.1,
  ) {
    if (
      promotions.filter((promotion) => this.isLegacyPopular(promotion)).length >
      1
    ) {
      throw new BadRequestException(
        'Apenas um pacote pode ser marcado como mais popular.',
      );
    }
    return promotions
      .filter((promotion) => !this.isLegacyPopular(promotion))
      .map((promotion, index) => {
        const regularPrice = promotion.numberQuantity * numberPrice;
        if (promotion.packagePrice === undefined) {
          throw new BadRequestException(
            `Informe o preço do pacote ${promotion.name}.`,
          );
        }
        if (promotion.packagePrice > regularPrice) {
          throw new BadRequestException(
            `O pacote ${promotion.name} não pode custar mais que os títulos avulsos.`,
          );
        }
        return {
          name: promotion.name,
          numberQuantity: promotion.numberQuantity,
          packagePrice: promotion.packagePrice,
          discountRate:
            regularPrice > 0
              ? Number(
                  (
                    ((regularPrice - promotion.packagePrice) / regularPrice) *
                    100
                  ).toFixed(2),
                )
              : 0,
          isPopular: false,
          isActive: promotion.isActive ?? true,
          sortOrder: promotion.sortOrder ?? index,
          startsAt: promotion.startsAt
            ? new Date(promotion.startsAt)
            : undefined,
          endsAt: promotion.endsAt ? new Date(promotion.endsAt) : undefined,
        };
      });
  }

  private milestoneData(
    milestones: NonNullable<CreateCampaignDto['milestones']>,
  ) {
    const percentages = milestones.map((item) => item.percentage);
    if (new Set(percentages).size !== percentages.length)
      throw new BadRequestException(
        'Não é permitido cadastrar duas metas no mesmo percentual.',
      );
    return milestones.map((item) => ({
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
    }));
  }

  private normalizePopularQuantity(data: CreateCampaignDto): CreateCampaignDto {
    const legacyPopular = data.promotions?.find((promotion) =>
      this.isLegacyPopular(promotion),
    );
    return {
      ...data,
      popularQuickQuantity:
        data.popularQuickQuantity ??
        (legacyPopular &&
        [50, 100, 250, 500, 1000, 2000].includes(legacyPopular.numberQuantity)
          ? legacyPopular.numberQuantity
          : undefined),
      promotions: data.promotions?.filter(
        (promotion) => !this.isLegacyPopular(promotion),
      ),
    };
  }

  private isLegacyPopular(promotion: { name: string; isPopular?: boolean }) {
    return (
      promotion.isPopular === true ||
      promotion.name.trim().toLocaleLowerCase('pt-BR') === 'mais popular'
    );
  }

  private instantPrizeData(
    prizes: NonNullable<CreateCampaignDto['instantPrizes']>,
    totalNumbers: number,
  ) {
    const numberWidth = Math.max(
      1,
      String(Math.max(0, totalNumbers - 1)).length,
    );
    const used = new Set<string>();
    return prizes.flatMap((prize) => {
      if (!prize.exactNumber && !prize.generationRule) {
        throw new BadRequestException(
          'Informe o número exato ou a regra da cota premiada.',
        );
      }
      const count = Math.max(1, prize.quantity);
      return Array.from({ length: count }, (_, index) => {
        let exactNumber = prize.exactNumber;
        if (exactNumber && count > 1) {
          exactNumber = String(Number(exactNumber) + index).padStart(
            numberWidth,
            '0',
          );
        }
        if (!exactNumber && prize.generationRule) {
          do {
            exactNumber = String(randomInt(0, totalNumbers)).padStart(
              numberWidth,
              '0',
            );
          } while (used.has(exactNumber));
        }
        if (!exactNumber || Number(exactNumber) >= totalNumbers) {
          throw new BadRequestException(
            `A cota ${exactNumber ?? ''} não existe nesta campanha.`,
          );
        }
        if (exactNumber.length !== numberWidth) {
          throw new BadRequestException(
            `A cota ${exactNumber} deve possuir ${numberWidth} dígitos.`,
          );
        }
        if (used.has(exactNumber)) {
          throw new BadRequestException(`A cota ${exactNumber} está repetida.`);
        }
        used.add(exactNumber);
        return {
          exactNumber,
          generationRule: prize.generationRule as
            Prisma.InputJsonValue | undefined,
          value: prize.value,
          description: prize.description,
          type: prize.type,
          quantity: 1,
          status: prize.status,
        };
      });
    });
  }

  private ensureOrganizer(user: AuthenticatedUser) {
    if (user.role !== UserRole.ORGANIZER) {
      throw new ForbiddenException('Apenas organizadores podem criar rifas.');
    }
  }

  private ensureCampaignEditable(status: CampaignStatus) {
    // PENDING_REVIEW is accepted only to recover legacy records. New
    // publications never enter this status.
    if (
      status !== CampaignStatus.DRAFT &&
      status !== CampaignStatus.PENDING_REVIEW &&
      status !== CampaignStatus.PUBLISHED &&
      status !== CampaignStatus.PAUSED
    ) {
      throw new BadRequestException(
        'Esta campanha não pode mais ser editada neste estado.',
      );
    }
  }

  private ensureCriticalFieldsEditable(
    campaign: CampaignPayload,
    data: CreateCampaignDto,
  ) {
    if (campaign.status === CampaignStatus.DRAFT) return;
    const changedTotal =
      data.totalNumbers !== undefined &&
      data.totalNumbers !== campaign.totalNumbers;
    const changedSelection =
      data.numberSelectionMode !== undefined &&
      data.numberSelectionMode !== campaign.numberSelectionMode;
    const changedDrawBasis =
      data.drawBasis !== undefined && data.drawBasis !== campaign.drawBasis;
    const changedTemplate =
      data.drawRuleTemplateId !== undefined &&
      data.drawRuleTemplateId !== campaign.drawRuleTemplateId;
    const changedCustomRule =
      data.customDrawRule !== undefined &&
      JSON.stringify(data.customDrawRule) !==
        JSON.stringify(campaign.customDrawRule);
    if (
      changedTotal ||
      changedSelection ||
      changedDrawBasis ||
      changedTemplate ||
      changedCustomRule
    ) {
      throw new BadRequestException(
        'Quantidade emitida e regras do sorteio não podem ser alteradas após a publicação.',
      );
    }
  }

  private publishChecklist(campaign: CampaignPayload) {
    const hasRule =
      campaign.drawBasis === DrawBasis.MANUAL_RESULT ||
      Boolean(campaign.drawRuleTemplateId || campaign.customDrawRule);
    return [
      ['título', campaign.title],
      ['regulamento', campaign.regulation],
      ['prêmio principal', campaign.mainPrizeName],
      ['descrição do prêmio', campaign.mainPrizeDescription],
      ['valor estimado do prêmio', campaign.estimatedPrizeValue],
      ['imagem principal do prêmio', campaign.coverImage],
      ['data do sorteio', campaign.drawDate],
      ['horário do sorteio', campaign.drawTime],
      ['início das vendas', campaign.salesStartAt],
      ['regra de sorteio', hasRule],
      ['quantidade total válida', campaign.totalNumbers > 0],
      ['preço válido', Number(campaign.numberPrice) > 0],
      [
        'compra mínima válida',
        campaign.minimumPurchase > 0 &&
          campaign.minimumPurchase <= campaign.totalNumbers,
      ],
    ]
      .filter(([, value]) => !value)
      .map(([label]) => String(label));
  }

  private async uniqueSlug(value: string, excludeId?: string) {
    const base = this.slugify(value) || 'campanha';
    let slug = base;
    let suffix = 2;
    while (
      await this.prisma.campaign.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      })
    ) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  private slugify(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async ensureSystemTemplates() {
    await Promise.all(
      systemTemplates.map((template) =>
        this.prisma.drawRuleTemplate.upsert({
          where: { id: template.id },
          update: {
            name: template.name,
            description: template.description,
            ruleDefinition: { digits: template.digits },
          },
          create: {
            id: template.id,
            name: template.name,
            description: template.description,
            isSystemTemplate: true,
            ruleDefinition: { digits: template.digits },
          },
        }),
      ),
    );
  }

  private validateRuleDefinition(definition: Record<string, unknown>) {
    const raw = definition.digits;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 10) {
      throw new BadRequestException('A regra deve conter de 1 a 10 dígitos.');
    }
    return raw.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new BadRequestException('Definição de regra inválida.');
      }
      const digit = item as Record<string, unknown>;
      const prize = Number(digit.prize);
      const position = Number(digit.position);
      const order = Number(digit.order ?? index);
      if (
        !Number.isInteger(prize) ||
        prize < 1 ||
        prize > 5 ||
        !Number.isInteger(position) ||
        position < 0 ||
        position > 4 ||
        !Number.isInteger(order) ||
        order < 0
      ) {
        throw new BadRequestException('Dígito da regra inválido.');
      }
      return { prize, position, order };
    });
  }

  private async validateRuleSelection(
    organizerId: string,
    data: CreateCampaignDto,
  ) {
    if (data.customDrawRule) {
      this.validateRuleDefinition(data.customDrawRule);
    }
    if (!data.drawRuleTemplateId) return;
    const template = await this.prisma.drawRuleTemplate.findFirst({
      where: {
        id: data.drawRuleTemplateId,
        OR: [{ isSystemTemplate: true }, { organizerId }],
      },
      select: { id: true },
    });
    if (!template) {
      throw new NotFoundException('Modelo de regra não encontrado.');
    }
  }

  private async saveDisplayPreference(
    campaignId: string,
    userId: string,
    value?: boolean,
  ) {
    if (value === undefined) return;
    await this.prisma.platformSetting.upsert({
      where: { key: `campaign:${campaignId}:showParticipants` },
      create: {
        key: `campaign:${campaignId}:showParticipants`,
        value,
        category: 'CAMPAIGN_DISPLAY',
        description: 'Exibir participantes na página da campanha.',
        isPublic: false,
        updatedByUserId: userId,
      },
      update: { value, updatedByUserId: userId },
    });
  }

  private async showParticipants(campaignId: string) {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: `campaign:${campaignId}:showParticipants` },
      select: { value: true },
    });
    return typeof setting?.value === 'boolean' ? setting.value : true;
  }

  private async saveTitleDisplayMode(
    campaignId: string,
    userId: string,
    value?: 'SIMPLE' | 'HIGHLIGHT',
  ) {
    if (value === undefined) return;
    await this.prisma.platformSetting.upsert({
      where: { key: `campaign:${campaignId}:titleDisplayMode` },
      create: {
        key: `campaign:${campaignId}:titleDisplayMode`,
        value,
        category: 'CAMPAIGN_DISPLAY',
        description: 'Modo de exibição do título da campanha.',
        isPublic: false,
        updatedByUserId: userId,
      },
      update: { value, updatedByUserId: userId },
    });
  }

  private async titleDisplayMode(campaignId: string) {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: `campaign:${campaignId}:titleDisplayMode` },
      select: { value: true },
    });
    return setting?.value === 'HIGHLIGHT' ? 'HIGHLIGHT' : 'SIMPLE';
  }

  private visualDefaults(data: CreateCampaignDto) {
    return {
      titleColorMode: data.titleColorMode ?? 'AUTO',
      customTitleColor: data.customTitleColor ?? '#7C00FF',
      titleCompositionMode: data.titleCompositionMode ?? 'SINGLE',
      titleSegments: (data.titleSegments ?? [])
        .slice(0, 3)
        .map((segment) => ({
          text: segment.text.trim(),
          color: segment.color.toUpperCase(),
          order: segment.order,
        }))
        .filter((segment) => segment.text.length > 0)
        .sort((first, second) => first.order - second.order),
      rewardSectionsOrder: this.rewardSectionsOrder(data.rewardSectionsOrder),
      accentColorMode: data.accentColorMode ?? 'BLUE',
      customAccentColor: data.customAccentColor ?? '#2563EB',
      popularQuickQuantity: data.popularQuickQuantity ?? 1000,
    };
  }

  private async saveVisualPreferences(
    campaignId: string,
    userId: string,
    data: CreateCampaignDto,
  ) {
    const values = this.visualDefaults(data);
    if (
      data.titleColorMode === undefined &&
      data.customTitleColor === undefined &&
      data.titleCompositionMode === undefined &&
      data.titleSegments === undefined &&
      data.rewardSectionsOrder === undefined &&
      data.accentColorMode === undefined &&
      data.customAccentColor === undefined &&
      data.popularQuickQuantity === undefined
    )
      return;
    await this.prisma.platformSetting.upsert({
      where: { key: `campaign:${campaignId}:visualPreferences` },
      create: {
        key: `campaign:${campaignId}:visualPreferences`,
        value: values,
        category: 'CAMPAIGN_DISPLAY',
        description: 'Cores e destaque visual da campanha.',
        isPublic: false,
        updatedByUserId: userId,
      },
      update: { value: values, updatedByUserId: userId },
    });
  }

  private async visualPreferences(campaignId: string) {
    const setting = await this.prisma.platformSetting.findUnique({
      where: { key: `campaign:${campaignId}:visualPreferences` },
      select: { value: true },
    });
    const value =
      setting?.value &&
      typeof setting.value === 'object' &&
      !Array.isArray(setting.value)
        ? (setting.value as Record<string, unknown>)
        : {};
    return {
      titleColorMode: ['WHITE', 'BLACK', 'BLUE', 'AUTO', 'CUSTOM'].includes(
        String(value.titleColorMode),
      )
        ? value.titleColorMode
        : 'AUTO',
      customTitleColor:
        typeof value.customTitleColor === 'string' &&
        /^#[0-9A-Fa-f]{6}$/.test(value.customTitleColor)
          ? value.customTitleColor.toUpperCase()
          : '#7C00FF',
      titleCompositionMode:
        value.titleCompositionMode === 'SEGMENTS' ? 'SEGMENTS' : 'SINGLE',
      titleSegments: Array.isArray(value.titleSegments)
        ? value.titleSegments
            .filter(
              (segment): segment is Record<string, unknown> =>
                Boolean(segment) &&
                typeof segment === 'object' &&
                !Array.isArray(segment),
            )
            .map((segment, index) => ({
              text: typeof segment.text === 'string' ? segment.text.trim() : '',
              color: /^#[0-9A-Fa-f]{6}$/.test(String(segment.color))
                ? String(segment.color).toUpperCase()
                : '#FFFFFF',
              order: Number.isInteger(Number(segment.order))
                ? Number(segment.order)
                : index,
            }))
            .filter((segment) => segment.text.length > 0)
            .slice(0, 3)
            .sort((first, second) => first.order - second.order)
        : [],
      rewardSectionsOrder: this.rewardSectionsOrder(value.rewardSectionsOrder),
      accentColorMode: [
        'BLUE',
        'GREEN',
        'RED',
        'PURPLE',
        'PINK',
        'ORANGE',
        'YELLOW',
        'BLACK',
        'CUSTOM',
      ].includes(String(value.accentColorMode))
        ? value.accentColorMode
        : 'BLUE',
      customAccentColor:
        typeof value.customAccentColor === 'string'
          ? value.customAccentColor
          : '#2563EB',
      popularQuickQuantity: [50, 100, 250, 500, 1000, 2000].includes(
        Number(value.popularQuickQuantity),
      )
        ? Number(value.popularQuickQuantity)
        : 1000,
    };
  }

  private rewardSectionsOrder(value: unknown) {
    const fallback = ['INSTANT_WIN', 'MILESTONES', 'ROULETTE'] as const;
    if (
      !Array.isArray(value) ||
      value.length !== fallback.length ||
      new Set(value).size !== fallback.length ||
      value.some(
        (item) =>
          typeof item !== 'string' ||
          !(fallback as readonly string[]).includes(item),
      )
    )
      return [...fallback];
    return value as Array<(typeof fallback)[number]>;
  }

  private serialize(campaign: CampaignPayload) {
    const organizerProfile = campaign.organizer.organizerProfile;
    const organizerBrand = campaign.organizer.organizerBrandProfile;
    const customizationConfiguration =
      campaign.customization?.configuration &&
      typeof campaign.customization.configuration === 'object' &&
      !Array.isArray(campaign.customization.configuration)
        ? campaign.customization.configuration
        : null;
    const campaignLogoUrl =
      customizationConfiguration &&
      typeof customizationConfiguration.logoUrl === 'string' &&
      customizationConfiguration.logoUrl.trim()
        ? customizationConfiguration.logoUrl.trim()
        : null;
    const organizerLogoUrl = campaignLogoUrl
      ? campaignLogoUrl
      : organizerBrand?.primaryLogoUrl
        ? `/organizers/${campaign.organizer.id}/brand-assets/logo?v=${organizerBrand.updatedAt.getTime()}`
        : organizerProfile?.logoStorageKey
          ? `/organizers/${campaign.organizer.id}/logo`
          : null;
    const { coverImage, promotionalVideo, mainPrizeImage, ...safeCampaign } =
      campaign;
    return {
      ...safeCampaign,
      numberPrice: Number(campaign.numberPrice),
      cashAlternative:
        campaign.cashAlternative == null
          ? null
          : Number(campaign.cashAlternative),
      estimatedPrizeValue:
        campaign.estimatedPrizeValue == null
          ? null
          : Number(campaign.estimatedPrizeValue),
      grossRevenue: Number(campaign.grossRevenue),
      coverImageUrl: coverImage
        ? `/public/campaigns/media/${campaign.id}/cover`
        : null,
      promotionalVideoUrl: promotionalVideo
        ? `/public/campaigns/media/${campaign.id}/video`
        : null,
      mainPrizeImageUrl: mainPrizeImage
        ? `/public/campaigns/media/${campaign.id}/main-prize`
        : null,
      galleryImages: campaign.galleryImages.map(({ storageKey, ...image }) => {
        void storageKey;
        return {
          ...image,
          url: `/public/campaigns/media/${campaign.id}/gallery/${image.id}`,
        };
      }),
      instantPrizes: campaign.instantPrizes.map(
        ({ imageStorageKey, ...prize }) => ({
          ...prize,
          value: Number(prize.value),
          imageUrl: imageStorageKey
            ? `/public/campaigns/media/${campaign.id}/instant/${prize.id}`
            : null,
        }),
      ),
      milestonePrizes: (campaign.milestonePrizes ?? []).map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        description: milestone.description,
        imageUrl: milestone.imageUrl,
        imageCrop: milestone.imageCrop,
        videoUrl: milestone.videoUrl,
        estimatedValue:
          milestone.estimatedValue == null
            ? null
            : Number(milestone.estimatedValue),
        percentage: milestone.percentage,
        scheduledAt: milestone.scheduledAt,
        status: milestone.status,
        reachedAt: milestone.reachedAt,
        drawnAt: milestone.executedAt,
        eligibleTicketCount: milestone.eligibleTicketCount,
        winner: milestone.winnerTicket
          ? {
              name: maskPublicWinnerName(milestone.winnerTicket.buyer.name),
              city: milestone.winnerTicket.buyer.city,
              number:
                milestone.winningNumber ??
                String(milestone.winnerTicket.number),
            }
          : null,
      })),
      promotions: campaign.promotions
        .filter(
          (promotion) =>
            !promotion.isPopular &&
            promotion.name.trim().toLocaleLowerCase('pt-BR') !==
              'mais popular' &&
            promotion.isActive &&
            promotion.status === 'ACTIVE' &&
            !promotion.deletedAt &&
            (!promotion.startsAt || promotion.startsAt <= new Date()) &&
            (!promotion.endsAt || promotion.endsAt > new Date()) &&
            (!promotion.totalLimit ||
              promotion.usageCount < promotion.totalLimit),
        )
        .map((promotion) => ({
          ...promotion,
          packagePrice: Number(promotion.packagePrice),
          discountRate: Number(promotion.discountRate),
        })),
      organizer: {
        id: campaign.organizer.id,
        name: organizerProfile?.organizationName || campaign.organizer.name,
        verified: campaign.organizer.verified,
        logoUrl: organizerLogoUrl,
        slogan: organizerBrand?.slogan ?? null,
        brand: organizerBrand
          ? {
              publicName: organizerBrand.publicName,
              primaryColor: organizerBrand.primaryColor,
              secondaryColor: organizerBrand.secondaryColor,
              accentColor: organizerBrand.accentColor,
              buttonColor: organizerBrand.buttonColor,
              progressColor: organizerBrand.progressColor,
              backgroundColor: organizerBrand.backgroundColor,
              cardColor: organizerBrand.cardColor,
              themeMode: organizerBrand.themeMode,
              layoutStyle: organizerBrand.layoutStyle,
              appearanceConfig: organizerBrand.appearanceConfig,
            }
          : null,
        socialLinks: campaign.organizer.organizerSocialLinks,
        communities: campaign.organizer.organizerCommunities,
        platformFee: organizerProfile?.platformFeeWaived
          ? 0
          : Number(
              organizerProfile?.customPlatformFee ??
                organizerProfile?.platformFee ??
                0,
            ),
      },
    };
  }

  private serializePublic(campaign: CampaignPayload) {
    const serialized = this.serialize(campaign);
    const customization = serialized.customization;
    const configuration =
      customization?.configuration &&
      typeof customization.configuration === 'object' &&
      !Array.isArray(customization.configuration)
        ? (customization.configuration as Record<string, unknown>)
        : null;
    const roulette =
      configuration?.roulette &&
      typeof configuration.roulette === 'object' &&
      !Array.isArray(configuration.roulette)
        ? (configuration.roulette as Record<string, unknown>)
        : null;
    if (!configuration || !roulette) return serialized;
    const rules = (Array.isArray(roulette.rules) ? roulette.rules : []).map(
      (entry) => {
        const rule =
          entry && typeof entry === 'object' && !Array.isArray(entry)
            ? (entry as Record<string, unknown>)
            : {};
        return {
          id: typeof rule.id === 'string' ? rule.id : '',
          minQuantity: Number(rule.minQuantity) || 0,
          rounds: Number(rule.rounds) || 0,
        };
      },
    );
    return {
      ...serialized,
      customization: {
        ...customization,
        configuration: {
          ...configuration,
          roulette: {
            enabled: roulette.enabled === true,
            name: typeof roulette.name === 'string' ? roulette.name : undefined,
            startsAt: roulette.startsAt,
            endsAt: roulette.endsAt,
            rules,
          },
        },
      },
    };
  }
}

function maskPublicWinnerName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part, index) =>
      index === 0
        ? `${part.slice(0, 1)}${'*'.repeat(Math.max(2, part.length - 1))}`
        : `${part.slice(0, 1)}.`,
    )
    .join(' ');
}
