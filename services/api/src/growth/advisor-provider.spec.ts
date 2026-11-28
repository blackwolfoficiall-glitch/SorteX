import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import {
  AdvisorProviderRateLimitError,
  createAdvisorProvider,
  GEMINI_FREE_MODEL,
} from './advisor-provider';

const mockKey = 'AQ.example-not-a-real-key';
const utc = '2026-11-27T04:00:00.000Z';
const organizer = {
  id: 'isolated-sandbox-organizer',
  role: 'ORGANIZER',
  isActive: true,
  email: 'only-synthetic@example.test',
} as AuthenticatedUser;
const safeRequestedContext = {
  intent: 'OVERVIEW',
  aggregates: { campaigns: 3 },
};
const approved = {
  APP_ENV: 'staging',
  INTEGRATIONS_MODE: 'sandbox',
  FEATURE_REAL_PAYMENTS: 'false',
  SORTEX_ADVISOR_PROVIDER: 'gemini',
  SORTEX_ADVISOR_PILOT_BUDGET: 'approved',
  SORTEX_ADVISOR_SYNTHETIC_DATA: 'verified-fixtures-only',
  SORTEX_ADVISOR_PILOT_ORGANIZER_ID: organizer.id,
  GEMINI_MODEL: GEMINI_FREE_MODEL,
  GEMINI_API_KEY: mockKey,
  SORTEX_GEMINI_FREE_TIER: 'verified-no-billing',
  SORTEX_GEMINI_FREE_KEY_SHA256: createHash('sha256')
    .update(mockKey)
    .digest('hex'),
  SORTEX_GEMINI_FREE_VERIFIED_AT: utc,
  // Both configured to prove errors never fall through to another provider.
  OPENAI_API_KEY: 'synthetic-openai-key',
  OPENAI_MODEL: 'synthetic-model',
};
const candidate = {
  finishReason: 'STOP',
  content: {
    role: 'model',
    parts: [{ text: '{"answer":"Confira a evolução."}' }],
  },
};
const validResponse = {
  candidates: [candidate],
  usageMetadata: {
    promptTokenCount: 100,
    candidatesTokenCount: 30,
    thoughtsTokenCount: 5,
    totalTokenCount: 135,
  },
};

function getRequest(env: NodeJS.ProcessEnv = approved, maxOutput = 256) {
  const adapter = createAdvisorProvider(env, organizer);
  if (!adapter) throw new Error('test configuration unavailable');
  return {
    mode: adapter.mode,
    ...adapter.prepare(safeRequestedContext, maxOutput),
  };
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(utc) + 1_000);
});
afterEach(() => jest.restoreAllMocks());

describe('Gemini free-only provider registry (all transport substituted)', () => {
  it.each([
    'SORTEX_ADVISOR_PILOT_BUDGET',
    'SORTEX_ADVISOR_PILOT_ORGANIZER_ID',
    'GEMINI_MODEL',
    'GEMINI_API_KEY',
    'SORTEX_GEMINI_FREE_TIER',
    'SORTEX_GEMINI_FREE_KEY_SHA256',
    'SORTEX_GEMINI_FREE_VERIFIED_AT',
  ])(
    'stays off if %s lacks a verified value, even if OpenAI is configured',
    (field) => {
      const spy = jest.spyOn(globalThis, 'fetch');
      const env: NodeJS.ProcessEnv = { ...approved };
      delete env[field];
      expect(createAdvisorProvider(env, organizer)).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    },
  );

  it.each([
    { SORTEX_ADVISOR_PROVIDER: 'unknown' },
    { SORTEX_ADVISOR_PILOT_BUDGET: 'false' },
    { GEMINI_MODEL: 'gemini-3.1-flash-lite-preview' },
    { GEMINI_MODEL: 'gemini-4-neon' },
    { GEMINI_API_KEY: 'AQ.rotated-test-key' },
    { SORTEX_GEMINI_FREE_KEY_SHA256: '0000' },
    { SORTEX_GEMINI_FREE_TIER: 'paid' },
    { SORTEX_GEMINI_FREE_VERIFIED_AT: '2026-11-26T04:00:00.000Z' },
    { SORTEX_GEMINI_FREE_VERIFIED_AT: '2026-11-27T04:01:00.000Z' },
    { SORTEX_GEMINI_FREE_VERIFIED_AT: '2026-10-32T04:00:00.000Z' },
    { APP_ENV: 'production' },
    { INTEGRATIONS_MODE: 'production' },
    { FEATURE_REAL_PAYMENTS: 'true' },
  ])('fails closed on unsafe configuration %j', (changes) => {
    expect(
      createAdvisorProvider({ ...approved, ...changes }, organizer),
    ).toBeNull();
  });

  it.each(['gemini', 'openai'])(
    'keeps %s unavailable without separate synthetic data verification',
    (provider) => {
      const env: NodeJS.ProcessEnv = {
        ...approved,
        SORTEX_ADVISOR_PROVIDER: provider,
      };
      delete env.SORTEX_ADVISOR_SYNTHETIC_DATA;
      expect(createAdvisorProvider(env, organizer)).toBeNull();
      env.SORTEX_ADVISOR_SYNTHETIC_DATA = 'example-test-account-only';
      expect(createAdvisorProvider(env, organizer)).toBeNull();
    },
  );

  it('never makes either model available to other tenants, buyers or organizers with real accounts', () => {
    expect(
      createAdvisorProvider(approved, { ...organizer, id: 'other' }),
    ).toBeNull();
    expect(
      createAdvisorProvider(approved, {
        ...organizer,
        email: 'real@example.net',
      }),
    ).toBeNull();
    expect(
      createAdvisorProvider(approved, { ...organizer, role: 'BUYER' }),
    ).toBeNull();
    expect(
      createAdvisorProvider(approved, { ...organizer, isActive: false }),
    ).toBeNull();
  });

  it('prepares exactly the bounded payload without network, only once to the pinned Gemini URL, normalizing output and thought usage', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json(validResponse));
    const prepared = getRequest();
    expect(spy).not.toHaveBeenCalled();
    expect(prepared.mode).toBe('GEMINI');
    expect(prepared.outputUnits).toBe(256);
    await expect(prepared.generate()).resolves.toEqual({
      answer: 'Confira a evolução.',
      usage: { inputTokens: 100, outputTokens: 35 },
    });
    await expect(prepared.generate()).rejects.toThrow(
      'Advisor request already consumed',
    );
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, req] = spy.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
    );
    expect(req).toMatchObject({
      method: 'POST',
      redirect: 'error',
      headers: {
        'x-goog-api-key': mockKey,
        'Content-Type': 'application/json',
      },
    });
    expect(req?.signal).toBeInstanceOf(AbortSignal);
    if (typeof req?.body !== 'string')
      throw new Error('expected serialized body');
    expect(req.body).not.toContain(mockKey);
    expect(prepared.inputUnits).toBe(Buffer.byteLength(req.body, 'utf8') + 128);
    expect(JSON.parse(req.body) as unknown).toMatchObject({
      contents: [
        {
          role: 'user',
          parts: [{ text: JSON.stringify(safeRequestedContext) }],
        },
      ],
      generationConfig: {
        candidateCount: 1,
        maxOutputTokens: prepared.outputUnits,
        responseMimeType: 'application/json',
        responseJsonSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['answer'],
        },
        thinkingConfig: { thinkingLevel: 'MINIMAL', includeThoughts: false },
      },
    });
    const document = JSON.parse(req.body) as Record<string, unknown>;
    expect(Object.keys(document).sort()).toEqual([
      'contents',
      'generationConfig',
      'systemInstruction',
    ]);
  });

  it('refuses expired or rotated authorization even after request preparation', async () => {
    const env = { ...approved };
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json(validResponse));
    const expires = getRequest(env);
    jest
      .mocked(Date.now)
      .mockReturnValue(Date.parse(utc) + 24 * 60 * 60 * 1000);
    await expect(expires.generate()).rejects.toThrow(
      /^Advisor provider unavailable$/,
    );
    jest.mocked(Date.now).mockReturnValue(Date.parse(utc) + 1_000);
    const switches = getRequest(env);
    env.SORTEX_ADVISOR_PROVIDER = 'openai';
    await expect(switches.generate()).rejects.toThrow(
      /^Advisor provider unavailable$/,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses invalid preflight budget before network', () => {
    const spy = jest.spyOn(globalThis, 'fetch');
    const provider = createAdvisorProvider(approved, organizer);
    expect(() =>
      provider?.prepare({ context: 'é'.repeat(2_000) }, 256),
    ).toThrow('A consulta ultrapassa o limite individual');
    for (const limit of [0, 1.5, 513, Infinity])
      expect(() => getRequest(approved, limit)).toThrow(
        'Invalid advisor output budget',
      );
    expect(spy).not.toHaveBeenCalled();
  });

  it.each([
    [
      'gemini',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
    ],
    ['openai', 'https://api.openai.com/v1/responses'],
  ])(
    'classifies %s HTTP 429 without consuming raw error content or retrying',
    async (selected, expectedUrl) => {
      const response = Response.json(
        { detail: 'sensitive backend error body' },
        {
          status: 429,
          statusText: 'sensitive upstream status text',
          headers: { 'Retry-After': '7331' },
        },
      );
      const parseSpy = jest.spyOn(response, 'json');
      const textSpy = jest.spyOn(response, 'text');
      const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
      const result = getRequest({
        ...approved,
        SORTEX_ADVISOR_PROVIDER: selected,
      }).generate();
      await expect(result).rejects.toBeInstanceOf(
        AdvisorProviderRateLimitError,
      );
      await expect(result).rejects.toThrow(
        /^Advisor provider temporarily rate limited$/,
      );
      expect(parseSpy).not.toHaveBeenCalled();
      expect(textSpy).not.toHaveBeenCalled();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBe(expectedUrl);
    },
  );

  it('does not infer quota from errors or anything outside HTTP 429', async () => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('429 secret response body'))
      .mockResolvedValueOnce(Response.json({ error: '429' }, { status: 403 }));
    for (let i = 0; i < 2; i++) {
      const failed = getRequest().generate();
      await expect(failed).rejects.not.toBeInstanceOf(
        AdvisorProviderRateLimitError,
      );
      await expect(failed).rejects.toThrow(/^Advisor provider unavailable$/);
    }
    expect(spy).toHaveBeenCalledTimes(2);
    expect(
      spy.mock.calls
        .map(([url]) => url)
        .every(
          (url) =>
            typeof url === 'string' &&
            url.startsWith('https://generativelanguage.googleapis.com/'),
        ),
    ).toBe(true);
  });

  it.each([
    { ...validResponse, promptFeedback: { blockReason: 'SAFETY' } },
    {
      ...validResponse,
      candidates: [{ ...candidate, finishReason: 'MAX_TOKENS' }],
    },
    { ...validResponse, candidates: [candidate, candidate] },
    {
      ...validResponse,
      candidates: [
        {
          ...candidate,
          content: {
            role: 'model',
            parts: [{ text: '{"answer":"result","action":true}' }],
          },
        },
      ],
    },
    {
      ...validResponse,
      candidates: [
        {
          ...candidate,
          content: {
            role: 'model',
            parts: [{ text: '{"answer":"result"}', thought: true }],
          },
        },
      ],
    },
    {
      ...validResponse,
      candidates: [
        {
          ...candidate,
          content: {
            role: 'model',
            parts: [{ text: '{"answer":"result"}', functionCall: {} }],
          },
        },
      ],
    },
    {
      ...validResponse,
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 250,
        thoughtsTokenCount: 10,
      },
    },
    {
      ...validResponse,
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: -1 },
    },
    {
      ...validResponse,
      usageMetadata: { promptTokenCount: '100', candidatesTokenCount: 8 },
    },
  ])(
    'does not return blocked, incomplete, malformed, or over-budget responses',
    async (value) => {
      jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(value));
      await expect(getRequest().generate()).rejects.toThrow(
        /^Advisor provider unavailable$/,
      );
    },
  );

  it('retains OpenAI as an explicitly selected provider and never reaches Gemini in that mode', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [
              { type: 'output_text', text: '{"answer":"Confira a evolução."}' },
            ],
          },
        ],
        usage: { input_tokens: 100, output_tokens: 40 },
      }),
    );
    const args = getRequest({ ...approved, SORTEX_ADVISOR_PROVIDER: 'openai' });
    expect(args.mode).toBe('OPENAI');
    await expect(args.generate()).resolves.toEqual({
      answer: 'Confira a evolução.',
      usage: { inputTokens: 100, outputTokens: 40 },
    });
    expect(spy).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        redirect: 'error',
        headers: {
          Authorization: 'Bearer synthetic-openai-key',
          'Content-Type': 'application/json',
        },
      }),
    );
  });
});
