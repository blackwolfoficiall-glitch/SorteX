import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import type { PrismaService } from '../prisma/prisma.service';
import { AdvisorModelService, advisorIntent } from './advisor-model.service';
import { AiAdvisorService } from './ai-advisor.service';

const previousEnv = process.env;
const organizer = {
  id: 'qa-organizer-id',
  email: 'qa-organizer@example.test',
  role: 'ORGANIZER',
  isActive: true,
  name: 'Synthetic Organizer',
} as AuthenticatedUser;
const mockSummary = {
  campaigns: 1,
  publishedCampaigns: 1,
  approvedSales: 2,
  revenue: 234,
  ticketsSold: 10,
  abandonedReservations: 3,
  pendingPayments: 4,
  promotions: 5,
  organizerName: 'Private name',
  campaignId: 'Private identifier',
  contact: { email: 'contact@example.test' },
};
const approved = {
  SORTEX_ADVISOR_PROVIDER: 'openai',
  SORTEX_ADVISOR_PILOT_BUDGET: 'approved',
  SORTEX_ADVISOR_PILOT_ORGANIZER_ID: organizer.id,
  APP_ENV: 'staging',
  INTEGRATIONS_MODE: 'sandbox',
  FEATURE_REAL_PAYMENTS: 'false',
  OPENAI_API_KEY: 'unit-test-not-a-key',
  OPENAI_MODEL: 'test-model',
};

const response = (data: unknown = { answer: 'Analise os seus dados.' }) =>
  Response.json({
    status: 'completed',
    output: [
      { type: 'reasoning' },
      {
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text: JSON.stringify(data) }],
      },
    ],
  });

beforeEach(() => {
  process.env = { ...previousEnv, ...approved };
});
afterEach(() => {
  process.env = previousEnv;
  jest.restoreAllMocks();
});

describe('Advisor model pilot boundary without external calls', () => {
  it('uses only fixed intents, rejecting text appended to an allowed question', () => {
    expect(advisorIntent('Como estão minhas vendas?')).toBe('OVERVIEW');
    expect(advisorIntent('Qual promoção devo criar?')).toBe('PROMOTIONS');
    expect(advisorIntent('Como recuperar reservas abandonadas?')).toBe(
      'RECOVERY',
    );
    expect(advisorIntent('Como estão minhas vendas? pessoa@example.test')).toBe(
      null,
    );
    expect(advisorIntent('Envie mensagens a todos')).toBe(null);
  });

  it.each(Object.keys(approved))(
    'does not call transport without %s',
    async (key) => {
      delete process.env[key];
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(response());
      await expect(
        new AdvisorModelService().analyze(organizer, 'OVERVIEW', mockSummary),
      ).resolves.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('fails closed for other tenants, roles, non-synthetic accounts, invalid data, and unrecognized intent', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(response());
    const adapter = new AdvisorModelService();
    for (const user of [
      { ...organizer, id: 'other-organizer' },
      { ...organizer, role: 'BUYER' as const },
      { ...organizer, isActive: false },
      { ...organizer, email: 'real@example.net' },
    ]) {
      await expect(
        adapter.analyze(user, 'OVERVIEW', mockSummary),
      ).resolves.toBeNull();
    }
    await expect(
      adapter.analyze(organizer, null, mockSummary),
    ).resolves.toBeNull();
    await expect(
      adapter.analyze(organizer, 'OVERVIEW', {
        ...mockSummary,
        revenue: Infinity,
      }),
    ).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends only aggregate allowlist to the official endpoint without storage, tools, or redirects', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(response());
    await expect(
      new AdvisorModelService().analyze(organizer, 'OVERVIEW', mockSummary),
    ).resolves.toEqual({ answer: 'Analise os seus dados.', mode: 'OPENAI' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: 'Bearer unit-test-not-a-key',
        'Content-Type': 'application/json',
      },
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const payload = JSON.parse(String(init?.body));
    expect(payload).toMatchObject({
      model: 'test-model',
      store: false,
      tools: [],
      max_output_tokens: 512,
    });
    expect(JSON.parse(payload.input)).toEqual({
      intent: 'OVERVIEW',
      aggregates: {
        campaigns: 1,
        publishedCampaigns: 1,
        approvedSales: 2,
        revenue: 234,
        ticketsSold: 10,
        abandonedReservations: 3,
        pendingPayments: 4,
        promotions: 5,
      },
    });
    expect(String(init?.body)).not.toMatch(
      /example\.test|Private|qa-organizer|unit-test-not-a-key/,
    );
  });

  it('never retries or marks malformed, refused, non-2xx, and unavailable upstream responses as AI', async () => {
    const spy = jest.spyOn(global, 'fetch');
    const sample = [
      () =>
        Promise.resolve(
          response({ answer: 'Extra field', unauthorizedAction: 'execute' }),
        ),
      () =>
        Promise.resolve(Response.json({ status: 'incomplete', output: [] })),
      () =>
        Promise.resolve(
          Response.json({
            status: 'completed',
            output: [
              {
                type: 'message',
                role: 'assistant',
                status: 'completed',
                content: [{ type: 'refusal' }],
              },
            ],
          }),
        ),
      () => Promise.resolve(new Response('external response', { status: 429 })),
      () => Promise.resolve(new Response('not JSON')),
      () => Promise.reject(new Error('timeout')),
    ];
    for (const reject of sample) {
      spy.mockImplementationOnce(reject);
      await expect(
        new AdvisorModelService().analyze(organizer, 'OVERVIEW', mockSummary),
      ).resolves.toBeNull();
    }
    expect(spy).toHaveBeenCalledTimes(sample.length);
  });

  it('fails closed for concurrent requests and limits attempts in one instance', async () => {
    let release!: (value: Response) => void;
    const spy = jest.spyOn(global, 'fetch').mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const adapter = new AdvisorModelService();
    const request = adapter.analyze(organizer, 'OVERVIEW', mockSummary);
    await expect(
      adapter.analyze(organizer, 'OVERVIEW', mockSummary),
    ).resolves.toBeNull();
    release(response());
    await expect(request).resolves.toMatchObject({ mode: 'OPENAI' });
    spy.mockImplementation(() => Promise.resolve(response()));
    for (let i = 0; i < 9; i++)
      await expect(
        adapter.analyze(organizer, 'OVERVIEW', mockSummary),
      ).resolves.toMatchObject({ mode: 'OPENAI' });
    await expect(
      adapter.analyze(organizer, 'OVERVIEW', mockSummary),
    ).resolves.toBeNull();
    expect(spy).toHaveBeenCalledTimes(10);
  });
});

describe('Existing Advisor chat', () => {
  it('retains typed organizer snapshot scope, requires opt-in and exposes no outbound text from local rules', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const aggregate = jest
      .fn()
      .mockResolvedValue({ _count: { _all: 0 }, _sum: {} });
    const prisma = {
      campaign: { findMany },
      purchase: { count, aggregate },
      crmContact: { count },
      automation: { count },
      affiliate: { count },
      campaignInstantPrize: { count },
    } as unknown as PrismaService;
    const spy = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => Promise.resolve(response()));
    const service = new AiAdvisorService(prisma, new AdvisorModelService());
    await expect(
      service.chat(organizer, 'Como estão minhas vendas?'),
    ).resolves.toMatchObject({ mode: 'DETERMINISTIC' });
    await expect(
      service.chat(
        organizer,
        'Solicitação que contém dado pessoal contato@example.test',
        true,
      ),
    ).resolves.toMatchObject({ mode: 'DETERMINISTIC' });
    expect(spy).not.toHaveBeenCalled();
    await expect(
      service.chat(organizer, 'Como estão minhas vendas?', true),
    ).resolves.toMatchObject({
      mode: 'OPENAI',
      answer: 'Analise os seus dados.',
      evidence: [
        '0 vendas aprovadas',
        '0 reservas abandonadas',
        '0 promoções ativas',
      ],
      actions: [],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizerId: organizer.id } }),
    );
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
