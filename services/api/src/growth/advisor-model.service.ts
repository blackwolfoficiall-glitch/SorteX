import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  createAdvisorProvider,
  ADVISOR_MAX_OUTPUT_TOKENS,
} from './advisor-provider';
import { AiUsageQuotaService } from './ai-usage-quota.service';

export type AdvisorIntent =
  'OVERVIEW' | 'RECOVERY' | 'PROMOTIONS' | 'CRM' | 'FINANCE' | 'ADS';

type AdvisorAggregates = {
  campaigns: number;
  publishedCampaigns: number;
  approvedSales: number;
  revenue: number;
  ticketsSold: number;
  abandonedReservations: number;
  pendingPayments: number;
  promotions: number;
  contacts?: number;
  automations?: number;
};
type FinanceTotals = {
  availableBalance: string;
  pendingBalance: string;
};
type AdsTotals = {
  affiliateOrders: number;
  unknownOriginOrders: number;
};
export type AdvisorDetails = {
  finance?: FinanceTotals | null;
  ads?: AdsTotals | null;
};

export function advisorIntent(question: string): AdvisorIntent | null {
  const clean = question
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[?!.]+$/u, '');
  if (
    [
      'qual o resumo da operacao',
      'resumo da operacao',
      'como estao minhas vendas',
    ].includes(clean)
  )
    return 'OVERVIEW';
  if (clean === 'como recuperar reservas abandonadas') return 'RECOVERY';
  if (clean === 'qual promocao devo criar') return 'PROMOTIONS';
  if (clean === 'como esta meu crm') return 'CRM';
  if (clean === 'como esta meu financeiro') return 'FINANCE';
  if (clean === 'qual a origem das vendas') return 'ADS';
  return null;
}

@Injectable()
export class AdvisorModelService {
  constructor(private readonly quota: AiUsageQuotaService) {}

  canAnalyze(user: AuthenticatedUser) {
    return createAdvisorProvider(process.env, user) !== null;
  }

  async analyze(
    user: AuthenticatedUser,
    intent: AdvisorIntent | null,
    summary: AdvisorAggregates,
    readDetails?: () => Promise<AdvisorDetails>,
  ) {
    const provider = createAdvisorProvider(process.env, user);
    if (!provider || !intent) return null;
    // No arbitrary text, IDs, contact records, campaign names or metadata pass
    // this allowlist. Module values come only from the authorized fixture DB.
    const aggregates = {
      campaigns: summary.campaigns,
      publishedCampaigns: summary.publishedCampaigns,
      approvedSales: summary.approvedSales,
      revenue: summary.revenue,
      ticketsSold: summary.ticketsSold,
      abandonedReservations: summary.abandonedReservations,
      pendingPayments: summary.pendingPayments,
      promotions: summary.promotions,
    };
    if (Object.values(aggregates).some((v) => !Number.isFinite(v) || v < 0))
      return null;
    const scopes: Record<string, unknown> = {};
    let request: ReturnType<typeof provider.prepare>;
    try {
      if (intent === 'CRM' || intent === 'RECOVERY') {
        scopes.crm =
          Number.isSafeInteger(summary.contacts) &&
          Number(summary.contacts) >= 0 &&
          Number.isSafeInteger(summary.automations) &&
          Number(summary.automations) >= 0
            ? {
                contactCount: summary.contacts,
                activeAutomationCount: summary.automations,
              }
            : null;
      }
      if (intent === 'FINANCE' || intent === 'ADS') {
        const data = await readDetails?.();
        if (intent === 'FINANCE') {
          const totals = data?.finance;
          const money = (v: unknown): v is string =>
            typeof v === 'string' && /^-?\d{1,12}\.\d{2}$/.test(v);
          scopes.finance =
            totals &&
            money(totals.availableBalance) &&
            money(totals.pendingBalance)
              ? {
                  currency: 'BRL',
                  internalAvailable: totals.availableBalance,
                  internalPending: totals.pendingBalance,
                  payoutsVerified: false,
                }
              : null;
        } else {
          const totals = data?.ads;
          scopes.ads =
            totals &&
            Number.isSafeInteger(totals.affiliateOrders) &&
            totals.affiliateOrders >= 0 &&
            Number.isSafeInteger(totals.unknownOriginOrders) &&
            totals.unknownOriginOrders >= 0
              ? {
                  periodDays: 30,
                  affiliateOrders: totals.affiliateOrders,
                  unknownOriginOrders: totals.unknownOriginOrders,
                  paidMediaMetricsAvailable: false,
                }
              : null;
        }
      }
      request = provider.prepare(
        { intent, aggregates, ...scopes },
        ADVISOR_MAX_OUTPUT_TOKENS,
      );
    } catch {
      return null;
    }
    // Reserve on the shared DB even for a single parallel invocation.
    // Any error here leaves the transport unopened; never return unused quota.
    await this.quota.reserve({
      organizerId: user.id,
      inputUnits: request.inputUnits,
      outputUnits: request.outputUnits,
    });
    try {
      const result = await request.generate();
      return { answer: result.answer, mode: provider.mode };
    } catch {
      // Preserve local-only mode on upstream failure, not AI success.
      return null;
    }
  }
}
