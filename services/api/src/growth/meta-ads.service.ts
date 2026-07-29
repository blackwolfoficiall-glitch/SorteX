import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizerIntegrationStatus,
  OrganizerIntegrationType,
  Prisma,
  SortexAdStatus,
} from '@prisma/client';
import { createDecipheriv, createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Injectable()
export class MetaAdsService {
  constructor(private readonly prisma: PrismaService) {}
  async publish(user: AuthenticatedUser, id: string) {
    const ad = await this.prisma.sortexAdCampaign.findFirst({
      where: { id, organizerId: user.id },
      include: { campaign: true },
    });
    if (!ad) throw new NotFoundException('Divulgação não encontrada.');
    const integration = await this.prisma.organizerIntegration.findUnique({
      where: {
        organizerId_type: {
          organizerId: user.id,
          type: OrganizerIntegrationType.META_ADS,
        },
      },
    });
    if (
      !integration ||
      integration.sandbox ||
      integration.status !== OrganizerIntegrationStatus.CONNECTED
    ) {
      const updated = await this.prisma.sortexAdCampaign.update({
        where: { id },
        data: { status: SortexAdStatus.SANDBOX_ACTIVE },
      });
      await this.audit(user, id, 'SORTEX_AD_SANDBOX_PUBLISHED');
      return {
        ...updated,
        sandbox: true,
        message:
          'Divulgação ativada em sandbox. Nenhum anúncio foi publicado e nenhuma cobrança foi realizada.',
      };
    }
    if (!['DRAFT', 'PAUSED'].includes(ad.status))
      throw new BadRequestException(
        'A divulgação precisa estar em rascunho ou pausada.',
      );
    const token = this.decrypt(integration.secretCiphertext),
      cfg = integration.publicConfig as any,
      adAccountId = cfg?.selectedAdAccountId,
      pageId = cfg?.selectedPageId;
    if (!token || !adAccountId || !pageId)
      throw new BadRequestException(
        'Selecione a conta de anúncios e a Página do Facebook na integração Meta.',
      );
    const creative = ad.creative as any,
      audience = ad.audience as any,
      location = ad.location as any,
      version = process.env.META_GRAPH_VERSION || 'v23.0',
      destination = creative.link?.startsWith('http')
        ? creative.link
        : `${process.env.PUBLIC_WEB_URL || process.env.WEB_APP_URL || 'http://localhost:3000'}${creative.link || `/campanha/${ad.campaign.slug}`}`;
    const campaign = await this.post(
      version,
      `${adAccountId}/campaigns`,
      token,
      {
        name: ad.name,
        objective: this.objective(ad.objective),
        status: 'PAUSED',
        special_ad_categories: '[]',
      },
    );
    const targeting = {
      geo_locations: { countries: ['BR'] },
      age_min: Number(audience.minAge || 18),
      age_max: Number(audience.maxAge || 65),
      ...(audience.gender === 'MALE'
        ? { genders: [1] }
        : audience.gender === 'FEMALE'
          ? { genders: [2] }
          : {}),
      ...(Array.isArray(audience.metaInterests) && audience.metaInterests.length
        ? { interests: audience.metaInterests }
        : {}),
      ...(location.metaGeoLocations
        ? { geo_locations: location.metaGeoLocations }
        : {}),
    };
    const adSet = await this.post(version, `${adAccountId}/adsets`, token, {
      name: `${ad.name} — Público`,
      campaign_id: campaign.id,
      daily_budget:
        ad.budgetType === 'DAILY'
          ? String(Math.round(Number(ad.budget) * 100))
          : undefined,
      lifetime_budget:
        ad.budgetType === 'TOTAL'
          ? String(Math.round(Number(ad.budget) * 100))
          : undefined,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      start_time: ad.startsAt?.toISOString(),
      end_time: ad.endsAt?.toISOString(),
      targeting: JSON.stringify(targeting),
      status: 'PAUSED',
    });
    const objectStorySpec = {
      page_id: pageId,
      link_data: {
        link: destination,
        message: creative.text || ad.name,
        name: creative.title || ad.campaign.title,
        call_to_action: { type: 'LEARN_MORE', value: { link: destination } },
        ...(creative.imageUrl ? { picture: creative.imageUrl } : {}),
      },
    };
    const metaCreative = await this.post(
      version,
      `${adAccountId}/adcreatives`,
      token,
      {
        name: `${ad.name} — Criativo`,
        object_story_spec: JSON.stringify(objectStorySpec),
      },
    );
    const externalAd = await this.post(version, `${adAccountId}/ads`, token, {
      name: ad.name,
      adset_id: adSet.id,
      creative: JSON.stringify({ creative_id: metaCreative.id }),
      status: 'ACTIVE',
    });
    await this.post(version, campaign.id, token, { status: 'ACTIVE' });
    await this.post(version, adSet.id, token, { status: 'ACTIVE' });
    const updated = await this.prisma.sortexAdCampaign.update({
      where: { id },
      data: {
        status: SortexAdStatus.LIVE_ACTIVE,
        externalCampaignId: campaign.id,
        externalAdSetId: adSet.id,
        externalCreativeId: metaCreative.id,
        externalAdId: externalAd.id,
        lastSyncedAt: new Date(),
      },
    });
    await this.audit(user, id, 'SORTEX_AD_META_PUBLISHED');
    return {
      ...updated,
      sandbox: false,
      message: 'Campanha publicada pela API oficial da Meta.',
    };
  }
  async status(user: AuthenticatedUser) {
    const integration = await this.prisma.organizerIntegration.findUnique({
      where: {
        organizerId_type: {
          organizerId: user.id,
          type: OrganizerIntegrationType.META_ADS,
        },
      },
    });
    if (!integration) return { status: 'NOT_CONNECTED', sandbox: true };
    const cfg = integration.publicConfig as any;
    return {
      status: integration.status,
      sandbox: integration.sandbox,
      permissions: integration.permissions,
      lastSyncedAt: integration.lastSyncedAt,
      adAccounts: cfg?.adAccounts ?? [],
      pages: cfg?.pages ?? [],
      businesses: cfg?.businesses ?? [],
      selectedAdAccountId: cfg?.selectedAdAccountId ?? null,
      selectedPageId: cfg?.selectedPageId ?? null,
    };
  }
  async selectAssets(
    user: AuthenticatedUser,
    adAccountId: string,
    pageId: string,
  ) {
    const integration = await this.prisma.organizerIntegration.findUnique({
      where: {
        organizerId_type: {
          organizerId: user.id,
          type: OrganizerIntegrationType.META_ADS,
        },
      },
    });
    if (!integration)
      throw new NotFoundException('Integração Meta não encontrada.');
    const cfg = (integration.publicConfig ?? {}) as any;
    if (
      !(cfg.adAccounts ?? []).some((x: any) => x.id === adAccountId) ||
      !(cfg.pages ?? []).some((x: any) => x.id === pageId)
    )
      throw new BadRequestException(
        'Selecione ativos retornados pela conta Meta conectada.',
      );
    return this.prisma.organizerIntegration.update({
      where: { id: integration.id },
      data: {
        publicConfig: {
          ...cfg,
          selectedAdAccountId: adAccountId,
          selectedPageId: pageId,
        },
      },
    });
  }
  async sync(user: AuthenticatedUser, id: string) {
    const ad = await this.prisma.sortexAdCampaign.findFirst({
      where: { id, organizerId: user.id },
    });
    if (!ad?.externalAdId)
      throw new BadRequestException(
        'Esta divulgação ainda não possui anúncio publicado na Meta.',
      );
    const integration = await this.prisma.organizerIntegration.findUnique({
        where: {
          organizerId_type: {
            organizerId: user.id,
            type: OrganizerIntegrationType.META_ADS,
          },
        },
      }),
      token = this.decrypt(integration?.secretCiphertext),
      version = process.env.META_GRAPH_VERSION || 'v23.0';
    if (!token) throw new BadRequestException('Reconecte a conta Meta.');
    const insights = await this.get(
        version,
        `${ad.externalAdId}/insights?fields=reach,impressions,clicks,ctr,cpm,cpc,spend,actions&date_preset=maximum`,
        token,
      ),
      row = insights.data?.[0] ?? {},
      conversions = (row.actions ?? [])
        .filter((x: any) =>
          ['purchase', 'offsite_conversion.fb_pixel_purchase'].includes(
            x.action_type,
          ),
        )
        .reduce((n: number, x: any) => n + Number(x.value || 0), 0);
    return this.prisma.sortexAdCampaign.update({
      where: { id },
      data: {
        reach: Number(row.reach || 0),
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        ctr: new Prisma.Decimal(row.ctr || 0),
        cpm: new Prisma.Decimal(row.cpm || 0),
        cpc: new Prisma.Decimal(row.cpc || 0),
        spent: new Prisma.Decimal(row.spend || 0),
        approvedSales: Math.max(ad.approvedSales, conversions),
        lastSyncedAt: new Date(),
      },
    });
  }
  async changeStatus(
    user: AuthenticatedUser,
    id: string,
    action: 'activate' | 'pause' | 'end',
  ) {
    const ad = await this.prisma.sortexAdCampaign.findFirst({
      where: { id, organizerId: user.id },
    });
    if (!ad) throw new NotFoundException('Divulgação não encontrada.');
    if (!ad.externalAdId) return null;
    const integration = await this.prisma.organizerIntegration.findUnique({
        where: {
          organizerId_type: {
            organizerId: user.id,
            type: OrganizerIntegrationType.META_ADS,
          },
        },
      }),
      token = this.decrypt(integration?.secretCiphertext);
    if (!token) throw new BadRequestException('Reconecte a conta Meta.');
    const version = process.env.META_GRAPH_VERSION || 'v23.0',
      remoteStatus = action === 'activate' ? 'ACTIVE' : 'PAUSED';
    await this.post(version, ad.externalAdId, token, { status: remoteStatus });
    if (ad.externalAdSetId)
      await this.post(version, ad.externalAdSetId, token, {
        status: remoteStatus,
      });
    if (ad.externalCampaignId)
      await this.post(version, ad.externalCampaignId, token, {
        status: remoteStatus,
      });
    const status =
      action === 'activate'
        ? SortexAdStatus.LIVE_ACTIVE
        : action === 'pause'
          ? SortexAdStatus.PAUSED
          : SortexAdStatus.ENDED;
    const updated = await this.prisma.sortexAdCampaign.update({
      where: { id },
      data: { status, lastSyncedAt: new Date() },
    });
    await this.audit(user, id, `SORTEX_AD_META_${action.toUpperCase()}`);
    return updated;
  }
  private objective(value: string) {
    return value === 'SALES'
      ? 'OUTCOME_SALES'
      : value === 'PARTICIPANTS' || value === 'ABANDONED_RESERVATIONS'
        ? 'OUTCOME_ENGAGEMENT'
        : 'OUTCOME_TRAFFIC';
  }
  private async post(
    version: string,
    path: string,
    token: string,
    data: Record<string, unknown>,
  ) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(data))
      if (v !== undefined && v !== null) params.set(k, String(v));
    const r = await fetch(`https://graph.facebook.com/${version}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const body = await r.json();
    if (!r.ok)
      console.error(
        '[Meta Ads] Operação recusada pela API oficial.',
        body?.error,
      );
    throw new BadRequestException(
      'Não foi possível concluir esta ação na Meta. Revise a conexão e tente novamente.',
    );
    return body;
  }
  private async get(version: string, path: string, token: string) {
    const r = await fetch(`https://graph.facebook.com/${version}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await r.json();
    if (!r.ok) {
      console.error(
        '[Meta Ads] Consulta recusada pela API oficial.',
        body?.error,
      );
      throw new BadRequestException(
        'Não foi possível atualizar as métricas agora. Tente novamente mais tarde.',
      );
    }
    return body;
  }
  private decrypt(value?: string | null) {
    if (!value) return null;
    const keySecret = process.env.INTEGRATION_ENCRYPTION_KEY;
    if (!keySecret)
      throw new BadRequestException(
        'A conexão com a Meta está temporariamente indisponível.',
      );
    const all = Buffer.from(value, 'base64url'),
      iv = all.subarray(0, 12),
      tag = all.subarray(12, 28),
      encrypted = all.subarray(28),
      decipher = createDecipheriv(
        'aes-256-gcm',
        createHash('sha256').update(keySecret).digest(),
        iv,
      );
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
  private audit(user: AuthenticatedUser, id: string, action: string) {
    return this.prisma.auditLog.create({
      data: {
        entityType: 'SORTEX_AD',
        entityId: id,
        action,
        actorUserId: user.id,
        actorRole: user.role,
        metadata: { officialApi: true },
      },
    });
  }
}
