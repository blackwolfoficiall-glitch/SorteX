import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { inactiveAdsReportingCapabilities } from './ads-reporting-capabilities';

const zone = 'America/Sao_Paulo';
const dayMs = 86_400_000;
const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const trailingDays = { '7D': 7, '15D': 15, '30D': 30, '90D': 90 } as const;
const origins = ['AFFILIATE', 'UNKNOWN'] as const;
const originFilters = ['ALL', ...origins] as const;
const periods = [
  'TODAY',
  'YESTERDAY',
  '7D',
  '15D',
  '30D',
  '90D',
  'CUSTOM',
] as const;

export class AdsConfirmedSalesQuery {
  @IsOptional()
  @IsIn(periods)
  period: (typeof periods)[number] = '30D';

  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  campaignId?: string;

  @IsOptional()
  @IsIn(originFilters)
  origin?: (typeof originFilters)[number];

  @IsOptional()
  @Matches(dayPattern)
  startDate?: string;

  @IsOptional()
  @Matches(dayPattern)
  endDate?: string;
}

const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const toDayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function parseDay(day?: string) {
  if (!day || !dayPattern.test(day) || day.startsWith('0000'))
    throw new BadRequestException('Informe datas válidas (AAAA-MM-DD).');
  const value = Date.parse(day + 'T00:00:00.000Z');
  if (!Number.isFinite(value) || toDayKey(value) !== day)
    throw new BadRequestException('Informe datas válidas (AAAA-MM-DD).');
  return value;
}

export function confirmedSalesPeriod(query: AdsConfirmedSalesQuery, now: Date) {
  const key = query.period ?? '30D';
  const today = parseDay(localDate.format(now));
  let from: number;
  let to: number;
  if (key === 'CUSTOM') {
    from = parseDay(query.startDate);
    const last = parseDay(query.endDate);
    if (from > last || last > today || last - from >= 366 * dayMs)
      throw new BadRequestException(
        'Escolha até 366 dias, sem datas futuras, em ordem cronológica.',
      );
    to = last + dayMs;
  } else {
    if (query.startDate !== undefined || query.endDate !== undefined)
      throw new BadRequestException(
        'Use o período personalizado para informar datas.',
      );
    if (key === 'YESTERDAY') {
      from = today - dayMs;
      to = today;
    } else {
      const days = key === 'TODAY' ? 1 : trailingDays[key];
      from = today - (days - 1) * dayMs;
      to = today + dayMs;
    }
  }
  return {
    key,
    timeZone: zone,
    fromDate: toDayKey(from),
    toDateExclusive: toDayKey(to),
  };
}

type Origin = (typeof origins)[number];
type Aggregate = {
  origin: Origin | null;
  day: string | null;
  confirmedOrders: number;
  buyers: number;
  titlesSold: number;
  paidOrderValue: string;
  averageOrderValue: string | null;
};

const zero = {
  confirmedOrders: 0,
  buyers: 0,
  titlesSold: 0,
  paidOrderValue: '0.00',
  averageOrderValue: null,
};

const metrics = (row?: Aggregate) =>
  row
    ? {
        confirmedOrders: row.confirmedOrders,
        buyers: row.buyers,
        titlesSold: row.titlesSold,
        paidOrderValue: row.paidOrderValue,
        averageOrderValue: row.averageOrderValue,
      }
    : { ...zero };

type ReadonlyDb = {
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
};

export async function readAdsConfirmedSales(
  db: ReadonlyDb,
  organizerId: string,
  query: AdsConfirmedSalesQuery,
  now = new Date(),
) {
  const period = confirmedSalesPeriod(query, now);
  const origin = query.origin ?? 'ALL';
  const channels: readonly Origin[] = origin === 'ALL' ? origins : [origin];
  const restrictOrigin =
    origin === 'ALL' ? Prisma.empty : Prisma.sql`WHERE origin = ${origin}`;
  const restrictCampaign = query.campaignId
    ? Prisma.sql`AND p."campaignId" = ${query.campaignId}`
    : Prisma.empty;
  // Prisma's PostgreSQL timestamp columns are UTC wall time. Convert São Paulo
  // midnight to UTC for indexable filtering; convert back only for grouping.
  // Do not read browser pixels, ad event claims/counters or provider snapshots.
  const rows = await db.$queryRaw<Aggregate[]>(Prisma.sql`
    WITH paid AS (
      SELECT p."buyerId" AS buyer, p.quantity, p.total,
             to_char(p."confirmedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day,
             CASE WHEN EXISTS (
               SELECT 1 FROM "AffiliateConversion" ac
               JOIN "AffiliateProgram" ap ON ap.id = ac."programId"
               JOIN "Affiliate" a ON a.id = ac."affiliateId"
               JOIN "Payment" pay ON pay.id = ac."paymentId"
               WHERE ac."purchaseId" = p.id AND ac."campaignId" = p."campaignId"
                 AND ac."buyerId" = p."buyerId" AND ap."organizerId" = c."organizerId"
                 AND a."programId" = ap.id AND a."organizerId" = c."organizerId"
                 AND (ap."campaignId" IS NULL OR ap."campaignId" = p."campaignId")
                 AND ac."approvedAt" IS NOT NULL
                 AND ac.status IN ('APPROVED', 'AVAILABLE', 'PAID')
                 AND pay."purchaseId" = p.id AND pay."campaignId" = p."campaignId"
                 AND pay."buyerId" = p."buyerId" AND pay."organizerId" = c."organizerId"
                 AND pay.status = 'APPROVED'
             ) THEN 'AFFILIATE' ELSE 'UNKNOWN' END AS origin
      FROM "Purchase" p
      JOIN "Campaign" c ON c.id = p."campaignId"
      WHERE c."organizerId" = ${organizerId} AND p.status = 'PAID'
        AND p."confirmedAt" >= (${period.fromDate}::date::timestamp AT TIME ZONE 'America/Sao_Paulo' AT TIME ZONE 'UTC')
        AND p."confirmedAt" < (${period.toDateExclusive}::date::timestamp AT TIME ZONE 'America/Sao_Paulo' AT TIME ZONE 'UTC')
        AND p."confirmedAt" <= (${now.toISOString()}::timestamptz AT TIME ZONE 'UTC')
        ${restrictCampaign}
    )
    SELECT origin, day, COUNT(*)::int AS "confirmedOrders",
           COUNT(DISTINCT buyer)::int AS buyers,
           COALESCE(SUM(quantity), 0)::float8 AS "titlesSold",
           COALESCE(SUM(total), 0.00)::text AS "paidOrderValue",
           ROUND(AVG(total), 2)::text AS "averageOrderValue"
    FROM paid
    ${restrictOrigin}
    GROUP BY GROUPING SETS ((), (origin), (day))
    ORDER BY day NULLS FIRST, origin NULLS FIRST
  `);
  return {
    source: 'SORTEX_CONFIRMED_PURCHASES' as const,
    currency: 'BRL' as const,
    period,
    campaignId: query.campaignId ?? null,
    originFilter: origin,
    totals: metrics(
      rows.find((row) => row.origin === null && row.day === null),
    ),
    daily: rows.flatMap((row) =>
      row.day ? [{ date: row.day, ...metrics(row) }] : [],
    ),
    attribution: {
      model: 'APPROVED_AFFILIATE_CONVERSION_ONLY' as const,
      adsWindowDays: null,
      channels: channels.map((channel) => ({
        origin: channel,
        ...metrics(rows.find((row) => row.origin === channel)),
      })),
    },
    paidMedia: {
      reportingProviders: inactiveAdsReportingCapabilities(),
      status: 'UNAVAILABLE' as const,
      reason: 'NO_VERIFIED_AD_ATTRIBUTION_OR_PERIOD_SPEND' as const,
      spend: null,
      attributedRevenue: null,
      platformReportedConversions: null,
      roas: null,
      roi: null,
      cpa: null,
    },
  };
}
