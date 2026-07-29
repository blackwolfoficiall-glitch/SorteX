import { Injectable } from '@nestjs/common';
import {
  AutomationStatus,
  CampaignStatus,
  InstantPrizeStatus,
  PurchaseStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { AdvisorMessageDto, AdvisorSimulationDto } from './dto/growth.dto';

type AdvisorAction = { label: string; url: string; confirmation: string };
type AdvisorAlert = {
  id: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  evidence: string;
  actions: AdvisorAction[];
};

@Injectable()
export class AiAdvisorService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot(user: AuthenticatedUser) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { organizerId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        totalNumbers: true,
        soldNumbers: true,
        grossRevenue: true,
        numberPrice: true,
        drawDate: true,
        _count: {
          select: {
            promotions: { where: { isActive: true, deletedAt: null } },
            purchases: { where: { status: PurchaseStatus.PAID } },
            instantPrizes: true,
          },
        },
      },
    });
    const ids = campaigns.map((c) => c.id);
    const [
      abandoned,
      pending,
      contacts,
      automations,
      affiliates,
      availablePrizes,
      paid,
    ] = await Promise.all([
      this.prisma.purchase.count({
        where: { campaignId: { in: ids }, status: PurchaseStatus.EXPIRED },
      }),
      this.prisma.purchase.count({
        where: {
          campaignId: { in: ids },
          status: {
            in: [
              PurchaseStatus.PENDING,
              PurchaseStatus.RESERVED,
              PurchaseStatus.AWAITING_PAYMENT,
            ],
          },
        },
      }),
      this.prisma.crmContact.count({
        where: { organizerId: user.id, deletedAt: null },
      }),
      this.prisma.automation.count({
        where: { organizerId: user.id, status: AutomationStatus.ACTIVE },
      }),
      this.prisma.affiliate.count({
        where: { organizerId: user.id, status: 'ACTIVE' },
      }),
      this.prisma.campaignInstantPrize.count({
        where: {
          campaignId: { in: ids },
          status: InstantPrizeStatus.AVAILABLE,
        },
      }),
      this.prisma.purchase.aggregate({
        where: { campaignId: { in: ids }, status: PurchaseStatus.PAID },
        _count: { _all: true },
        _sum: { total: true, quantity: true },
      }),
    ]);
    const published = campaigns.filter(
      (c) => c.status === CampaignStatus.PUBLISHED,
    );
    const alerts: AdvisorAlert[] = [];
    if (abandoned > 0)
      alerts.push({
        id: 'abandoned',
        priority: 'HIGH',
        title: `Existem ${abandoned} reservas abandonadas`,
        detail:
          'Há compradores que iniciaram a participação e não concluíram o pagamento.',
        evidence: `${abandoned} reservas expiradas encontradas`,
        actions: [
          {
            label: 'Enviar mensagem IA',
            url: '/dashboard/comunicacao?tab=new&audience=ABANDONED',
            confirmation:
              'Deseja abrir a Comunicação com esse público selecionado?',
          },
          {
            label: 'Criar automação',
            url: '/dashboard/crm/automacoes?template=abandoned',
            confirmation: 'Deseja abrir o construtor de automações?',
          },
        ],
      });
    for (const c of published) {
      const progress = c.totalNumbers
        ? Math.round((c.soldNumbers / c.totalNumbers) * 100)
        : 0;
      if (!c._count.promotions)
        alerts.push({
          id: `promotion-${c.id}`,
          priority: progress < 20 ? 'HIGH' : 'MEDIUM',
          title: `${c.title} não possui promoção ativa`,
          detail:
            'Uma promoção pode ser preparada e revisada antes de ser ativada.',
          evidence: `Progresso atual: ${progress}%`,
          actions: [
            {
              label: 'Criar promoção',
              url: `/dashboard/promocoes?campaignId=${c.id}`,
              confirmation: `Deseja criar uma promoção para ${c.title}?`,
            },
            {
              label: 'Abrir campanha',
              url: `/dashboard/campanhas/${c.id}`,
              confirmation: 'Deseja abrir esta campanha?',
            },
          ],
        });
    }
    if (availablePrizes > 0)
      alerts.push({
        id: 'prizes',
        priority: 'LOW',
        title: `Ainda existem ${availablePrizes} cotas premiadas disponíveis`,
        detail:
          'Você pode comunicar esse benefício sem revelar os números premiados.',
        evidence: `${availablePrizes} cotas disponíveis`,
        actions: [
          {
            label: 'Criar divulgação',
            url: '/dashboard/ads',
            confirmation: 'Deseja abrir SorteX Ads em modo sandbox?',
          },
          {
            label: 'Gerar mensagem',
            url: '/dashboard/comunicacao?tab=new&objective=PRIZE',
            confirmation: 'Deseja preparar uma mensagem sobre cotas premiadas?',
          },
        ],
      });
    const revenue = Number(paid._sum.total ?? 0);
    const summary = {
      campaigns: campaigns.length,
      publishedCampaigns: published.length,
      revenue,
      approvedSales: paid._count._all,
      ticketsSold: Number(paid._sum.quantity ?? 0),
      conversion: Number(
        (
          (paid._count._all /
            Math.max(paid._count._all + abandoned + pending, 1)) *
          100
        ).toFixed(1),
      ),
      abandonedReservations: abandoned,
      pendingPayments: pending,
      promotions: campaigns.reduce((n, c) => n + c._count.promotions, 0),
      availablePrizes,
      automations,
      affiliates,
      contacts,
    };
    return {
      organizerName: user.name.split(' ')[0],
      generatedAt: new Date().toISOString(),
      summary,
      campaigns: campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        status: c.status,
        revenue: Number(c.grossRevenue),
        price: Number(c.numberPrice),
        sold: c.soldNumbers,
        total: c.totalNumbers,
        progress: c.totalNumbers
          ? Number(((c.soldNumbers / c.totalNumbers) * 100).toFixed(1))
          : 0,
        activePromotions: c._count.promotions,
        approvedSales: c._count.purchases,
        instantPrizes: c._count.instantPrizes,
        drawDate: c.drawDate?.toISOString() ?? null,
      })),
      alerts,
    };
  }

  async chat(user: AuthenticatedUser, question: string) {
    const context = await this.snapshot(user);
    const fallback = this.deterministicAnswer(question, context);
    if (!process.env.OPENAI_API_KEY)
      return { ...fallback, mode: 'DETERMINISTIC' as const };
    try {
      const tools = [
        {
          type: 'function',
          name: 'get_account_summary',
          description: 'Consulta os indicadores reais da conta do organizador.',
          strict: true,
          parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
        {
          type: 'function',
          name: 'get_campaign_performance',
          description:
            'Consulta o desempenho real das campanhas do organizador.',
          strict: true,
          parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
        {
          type: 'function',
          name: 'get_recovery_opportunities',
          description:
            'Consulta reservas abandonadas, pagamentos pendentes e alertas reais.',
          strict: true,
          parameters: {
            type: 'object',
            properties: {},
            required: [],
            additionalProperties: false,
          },
        },
      ];
      const first = await this.openAi({
        model: process.env.OPENAI_MODEL || 'gpt-5.4',
        instructions:
          'Você é o SorteX Advisor. Use as ferramentas somente leitura antes de responder. Nunca invente métricas ou execute alterações.',
        input: question,
        tools,
        tool_choice: 'required',
      });
      const calls = (first.output ?? []).filter(
        (item: any) => item.type === 'function_call',
      );
      if (!calls.length) throw new Error('Nenhuma ferramenta consultada');
      const toolOutput = calls.map((call: any) => ({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(this.toolResult(call.name, context)),
      }));
      const body = await this.openAi({
        model: process.env.OPENAI_MODEL || 'gpt-5.4',
        previous_response_id: first.id,
        instructions:
          'Responda em português do Brasil somente com os dados retornados pelas ferramentas. Não prometa resultados. Sugira ações, mas informe que exigem confirmação.',
        input: toolOutput,
        text: {
          format: {
            type: 'json_schema',
            name: 'advisor_answer',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                answer: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } },
                suggestedQuestions: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['answer', 'evidence', 'suggestedQuestions'],
            },
          },
        },
      });
      const raw =
        body.output_text ??
        body.output
          ?.flatMap((o: any) => o.content ?? [])
          .find((c: any) => typeof c.text === 'string')?.text;
      if (!raw) throw new Error('Resposta vazia');
      return {
        ...JSON.parse(raw),
        actions: fallback.actions,
        mode: 'OPENAI' as const,
      };
    } catch {
      return { ...fallback, mode: 'DETERMINISTIC' as const };
    }
  }

  private async openAi(payload: Record<string, unknown>) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok)
      throw new Error(`Provedor indisponível (${response.status})`);
    return response.json();
  }

  private toolResult(
    name: string,
    context: Awaited<ReturnType<AiAdvisorService['snapshot']>>,
  ) {
    if (name === 'get_account_summary') return context.summary;
    if (name === 'get_campaign_performance') return context.campaigns;
    if (name === 'get_recovery_opportunities')
      return {
        abandonedReservations: context.summary.abandonedReservations,
        pendingPayments: context.summary.pendingPayments,
        alerts: context.alerts,
      };
    return { error: 'Ferramenta não autorizada' };
  }

  async simulate(user: AuthenticatedUser, dto: AdvisorSimulationDto) {
    const c = dto.campaignId
      ? await this.prisma.campaign.findFirst({
          where: { id: dto.campaignId, organizerId: user.id },
          select: { id: true, title: true, numberPrice: true },
        })
      : null;
    const unitPrice = dto.price ?? Number(c?.numberPrice ?? 0),
      gross = Number((dto.quantity * unitPrice).toFixed(2)),
      discount = Number(
        ((gross * (dto.discountPercent ?? 0)) / 100).toFixed(2),
      );
    return {
      campaign: c ? { id: c.id, title: c.title } : null,
      quantity: dto.quantity,
      unitPrice,
      grossRevenue: gross,
      discount,
      estimatedRevenue: Number((gross - discount).toFixed(2)),
      formula: `${dto.quantity.toLocaleString('pt-BR')} × R$ ${unitPrice.toFixed(2)}${dto.discountPercent ? ` − ${dto.discountPercent}%` : ''}`,
      disclaimer:
        'Simulação aritmética baseada nos valores informados. Não é garantia de vendas ou faturamento.',
    };
  }

  async message(user: AuthenticatedUser, dto: AdvisorMessageDto) {
    const context = await this.snapshot(user),
      c =
        context.campaigns.find((x) => x.id === dto.campaignId) ??
        context.campaigns[0],
      link = c ? `/campanha/${c.slug}` : '{{link}}';
    return {
      title: dto.objective,
      content: `Olá, {{nome}}! ${c ? `A campanha ${c.title}` : 'Temos novidades na SorteX'} está esperando por você. ${dto.objective}. Confira: ${link}`,
      cta: 'Participar agora',
      tone: dto.tone,
      campaign: c ?? null,
      requiresConfirmation: true,
      openUrl: `/dashboard/comunicacao?tab=new&campaignId=${c?.id ?? ''}&objective=${encodeURIComponent(dto.objective)}`,
    };
  }

  async adStrategy(
    user: AuthenticatedUser,
    campaignId: string,
    objective = 'SALES',
  ) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, organizerId: user.id },
      select: {
        id: true,
        title: true,
        slug: true,
        shortDescription: true,
        mainPrizeName: true,
        numberPrice: true,
        grossRevenue: true,
        purchases: {
          where: { status: PurchaseStatus.PAID },
          select: {
            createdAt: true,
            buyer: { select: { city: true, state: true } },
          },
        },
      },
    });
    if (!campaign) throw new Error('Campanha não encontrada.');
    const cities = new Map<string, number>(),
      hours = new Map<number, number>();
    for (const purchase of campaign.purchases) {
      const place = [purchase.buyer.city, purchase.buyer.state]
        .filter(Boolean)
        .join('/');
      if (place) cities.set(place, (cities.get(place) ?? 0) + 1);
      const hour = purchase.createdAt.getHours();
      hours.set(hour, (hours.get(hour) ?? 0) + 1);
    }
    const bestCities = [...cities.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, purchases]) => ({ name, purchases })),
      bestHour = [...hours.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 18,
      revenue = Number(campaign.grossRevenue),
      budget = Math.max(
        20,
        Math.min(500, Math.round((revenue > 0 ? revenue * 0.03 : 35) / 5) * 5),
      );
    return {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      objective,
      suggestedBudget: budget,
      budgetType: 'TOTAL',
      audience: {
        minAge: 18,
        maxAge: 65,
        gender: 'ALL',
        cities: bestCities.map((x) => x.name),
        interests: ['sorteios', 'prêmios'],
        evidence: bestCities.length
          ? `Cidades com mais compras aprovadas: ${bestCities.map((x) => x.name).join(', ')}`
          : 'Ainda não há volume suficiente por cidade; mantenha segmentação ampla.',
      },
      creative: {
        title: campaign.mainPrizeName || campaign.title,
        text: `${campaign.shortDescription || `Participe da campanha ${campaign.title}`} Títulos a partir de R$ ${Number(campaign.numberPrice).toFixed(2).replace('.', ',')}.`,
        cta: 'PARTICIPAR_AGORA',
        link: `/campanha/${campaign.slug}`,
      },
      calendar: [
        { format: 'Story', hour: 12 },
        { format: 'Feed', hour: 18 },
        { format: 'Reels', hour: bestHour },
      ],
      bestHour,
      evidence: [
        `${campaign.purchases.length} compras aprovadas analisadas`,
        `Receita observada: R$ ${revenue.toFixed(2)}`,
        bestCities.length
          ? `${bestCities.length} localidades com histórico`
          : 'Sem histórico suficiente por localidade',
      ],
      requiresConfirmation: true,
      executorUrl: `/dashboard/ads?strategyCampaignId=${campaign.id}`,
    };
  }

  private deterministicAnswer(
    question: string,
    context: Awaited<ReturnType<AiAdvisorService['snapshot']>>,
  ) {
    const q = question.toLowerCase(),
      s = context.summary;
    let answer = `Analisei ${s.campaigns} campanhas. A receita aprovada observada é R$ ${s.revenue.toFixed(2)} e a conversão calculada é ${s.conversion}%.`;
    let actions: AdvisorAction[] = [];
    if (q.includes('reserva') || q.includes('recuper')) {
      answer = `Existem ${s.abandonedReservations} reservas abandonadas e ${s.pendingPayments} pagamentos pendentes. Esses são os públicos mais diretos para recuperação, sem garantia de conversão.`;
      actions = context.alerts.find((a) => a.id === 'abandoned')?.actions ?? [];
    } else if (q.includes('pior') || q.includes('potencial')) {
      const r = [...context.campaigns].sort(
        (a, b) => a.progress - b.progress,
      )[0];
      answer = r
        ? `${r.title} possui o menor progresso: ${r.progress}%, com ${r.approvedSales} vendas aprovadas.`
        : 'Ainda não há campanhas suficientes para comparar.';
      actions = r
        ? [
            {
              label: 'Abrir campanha',
              url: `/dashboard/campanhas/${r.id}`,
              confirmation: 'Deseja revisar esta campanha?',
            },
          ]
        : [];
    } else if (q.includes('promo')) {
      answer = `Há ${s.promotions} promoções ativas. ${context.alerts.filter((a) => a.id.startsWith('promotion-')).length} campanhas publicadas estão sem promoção ativa.`;
      actions =
        context.alerts.find((a) => a.id.startsWith('promotion-'))?.actions ??
        [];
    } else if (q.includes('horário'))
      answer =
        'Não há dados horários suficientes para recomendar um horário com segurança.';
    else if (context.alerts[0]) {
      answer += ` A prioridade de hoje é: ${context.alerts[0].title}.`;
      actions = context.alerts[0].actions;
    }
    return {
      answer,
      evidence: [
        `${s.approvedSales} vendas aprovadas`,
        `${s.abandonedReservations} reservas abandonadas`,
        `${s.promotions} promoções ativas`,
      ],
      suggestedQuestions: [
        'Qual campanha está pior?',
        'Como recuperar reservas abandonadas?',
        'Qual promoção devo criar?',
      ],
      actions,
    };
  }
}
