import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

export type AdvisorIntent = 'OVERVIEW' | 'RECOVERY' | 'PROMOTIONS';
type AdvisorAggregates = {
  campaigns: number;
  publishedCampaigns: number;
  approvedSales: number;
  revenue: number;
  ticketsSold: number;
  abandonedReservations: number;
  pendingPayments: number;
  promotions: number;
};
type AdvisorModelInput = {
  intent: AdvisorIntent;
  aggregates: AdvisorAggregates;
};
type AdvisorModel = {
  mode: 'OPENAI';
  analyze(input: AdvisorModelInput): Promise<string>;
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
  return null;
}

// Accept only the exact sandbox pilot configuration, never merely an API key.
function pilotConfig(env: NodeJS.ProcessEnv, user: AuthenticatedUser) {
  const key = env.OPENAI_API_KEY?.trim();
  const model = env.OPENAI_MODEL?.trim();
  if (
    env.SORTEX_ADVISOR_PROVIDER !== 'openai' ||
    env.SORTEX_ADVISOR_PILOT_BUDGET !== 'approved' ||
    env.APP_ENV !== 'staging' ||
    env.INTEGRATIONS_MODE !== 'sandbox' ||
    env.FEATURE_REAL_PAYMENTS !== 'false' ||
    !env.SORTEX_ADVISOR_PILOT_ORGANIZER_ID ||
    user.id !== env.SORTEX_ADVISOR_PILOT_ORGANIZER_ID ||
    user.role !== 'ORGANIZER' ||
    !user.isActive ||
    !user.email?.toLowerCase().endsWith('@example.test') ||
    !key ||
    !model ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,79}$/.test(model)
  )
    return null;
  return { key, model };
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Invalid advisor response');
  return value as Record<string, unknown>;
}

function decodeOutput(body: unknown): string {
  const response = record(body);
  if (response.status !== 'completed' || !Array.isArray(response.output))
    throw new Error('Incomplete advisor response');
  const messages = response.output
    .map(record)
    .filter((item) => item.type === 'message');
  const message = messages[0];
  if (
    messages.length !== 1 ||
    message.role !== 'assistant' ||
    message.status !== 'completed' ||
    !Array.isArray(message.content) ||
    message.content.length !== 1
  )
    throw new Error('Invalid advisor response');
  const content = record(message.content[0]);
  if (
    content.type !== 'output_text' ||
    typeof content.text !== 'string' ||
    content.text.length > 4096
  )
    throw new Error('Invalid advisor response');
  const data = record(JSON.parse(content.text));
  if (
    Object.keys(data).length !== 1 ||
    typeof data.answer !== 'string' ||
    !data.answer.trim() ||
    data.answer.length > 1200
  )
    throw new Error('Invalid advisor answer');
  return data.answer.trim();
}

class OpenAiAdvisorModel implements AdvisorModel {
  readonly mode = 'OPENAI' as const;
  constructor(private readonly config: { key: string; model: string }) {}

  async analyze(input: AdvisorModelInput): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Bearer ${this.config.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        store: false,
        max_output_tokens: 512,
        tools: [],
        instructions:
          'Você é o SorteX Advisor. Responda em português brasileiro usando apenas os indicadores agregados observados. Não invente métricas, não prometa desempenho e não execute nenhuma ação. Informe limitações dos dados e sugira apenas próximos passos para revisão humana.',
        input: JSON.stringify(input),
        text: {
          format: {
            type: 'json_schema',
            name: 'advisor_answer',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: { answer: { type: 'string' } },
              required: ['answer'],
            },
          },
        },
      }),
    });
    if (!response.ok) throw new Error('Advisor provider unavailable');
    return decodeOutput(await response.json());
  }
}

@Injectable()
export class AdvisorModelService {
  private pending = false;
  private attempts = 0;

  async analyze(
    user: AuthenticatedUser,
    intent: AdvisorIntent | null,
    summary: AdvisorAggregates,
  ) {
    const config = pilotConfig(process.env, user);
    if (!config || !intent) return null;
    // Defense in depth only; not a global spending limit on replicated/serverless hosts.
    if (this.pending || this.attempts >= 10) return null;

    // Explicitly rebuild the outbound allowlist. Never forward a snapshot,
    // free-form query, identifier, title/slug, contact or other record fragment.
    const aggregates: AdvisorAggregates = {
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

    const provider: AdvisorModel = new OpenAiAdvisorModel(config);
    this.pending = true;
    this.attempts++;
    try {
      return {
        answer: await provider.analyze({ intent, aggregates }),
        mode: provider.mode,
      };
    } catch {
      // Fail closed without logging the upstream payload, key, prompt or response.
      return null;
    } finally {
      this.pending = false;
    }
  }
}
