import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import {
  ADVISOR_INPUT_FRAMING_UNITS,
  ADVISOR_MAX_BODY_BYTES,
  ADVISOR_MAX_OUTPUT_TOKENS,
  estimateAdvisorUsage,
} from './ai-usage-budget';
import { AiUsageQuotaService } from './ai-usage-quota.service';

function setup() {
  const execute = jest.fn<Promise<number>, unknown[]>().mockResolvedValue(1);
  const transaction = jest.fn((work: (client: unknown) => Promise<void>) =>
    work({ $executeRaw: execute }),
  );
  const service = new AiUsageQuotaService({
    $transaction: transaction,
  } as unknown as PrismaService);
  return { service, transaction, execute };
}

function code(error: unknown) {
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), response: error.getResponse() };
}

const request = {
  organizerId: 'synthetic_organizer',
  inputUnits: 256,
  outputUnits: 256,
};

describe('advisor request size', () => {
  it('measures UTF-8 bytes and accepts exactly the fixed ceilings', () => {
    expect(estimateAdvisorUsage('{"answer":"ação"}', 1)).toEqual({
      inputUnits:
        Buffer.from('{"answer":"ação"}', 'utf8').length +
        ADVISOR_INPUT_FRAMING_UNITS,
      outputUnits: 1,
    });
    expect(
      estimateAdvisorUsage(
        'x'.repeat(ADVISOR_MAX_BODY_BYTES),
        ADVISOR_MAX_OUTPUT_TOKENS,
      ),
    ).toEqual({
      inputUnits: ADVISOR_MAX_BODY_BYTES + ADVISOR_INPUT_FRAMING_UNITS,
      outputUnits: ADVISOR_MAX_OUTPUT_TOKENS,
    });
  });

  it.each([
    ['', 1],
    [' ', 1],
    ['ç'.repeat(1025), 1],
    ['{}', 513],
    ['{}', 0],
    ['{}', 0.5],
    ['{}', NaN],
  ])('refuses invalid provider bodies/output estimates', (body, output) => {
    expect(() => estimateAdvisorUsage(body, output)).toThrow(
      'A consulta ultrapassa o limite individual da IA SorteX.',
    );
  });
});

describe('advisor quota reservation', () => {
  it('executes one transaction and always locks the shared global bucket first', async () => {
    const { service, transaction, execute } = setup();
    await service.reserve(request);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'ReadCommitted',
      maxWait: 2000,
      timeout: 5000,
    });
    expect(execute.mock.calls[0]?.slice(1, 5)).toEqual([
      'GLOBAL',
      'GLOBAL',
      256,
      256,
    ]);
    expect(execute.mock.calls[1]?.slice(1, 5)).toEqual([
      'ORGANIZER',
      request.organizerId,
      256,
      256,
    ]);
  });

  it.each([1, 2])('returns stable 429 for exhausted bucket %s', async (nth) => {
    const { service, execute } = setup();
    if (nth === 2) execute.mockResolvedValueOnce(1);
    execute.mockResolvedValueOnce(0);
    const failing = await service.reserve(request).catch(code);
    expect(failing).toMatchObject({
      status: 429,
      response: { code: 'AI_QUOTA_LIMIT' },
    });
    expect(execute).toHaveBeenCalledTimes(nth);
  });

  it.each([
    { organizerId: 'x\n' },
    { organizerId: ' ' },
    { inputUnits: 128 },
    { inputUnits: 2177 },
    { outputUnits: 512.5 },
    { outputUnits: Infinity },
  ])(
    'refuses invalid preflight without touching quota storage',
    async (input) => {
      const { service, transaction } = setup();
      const failure = await service
        .reserve({ ...request, ...input })
        .catch(code);
      const status = 'organizerId' in input ? 503 : 413;
      expect(failure).toMatchObject({ status });
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  it('obscures unknown DB and timeout outcomes and does not retry', async () => {
    const { service, transaction, execute } = setup();
    transaction.mockRejectedValueOnce(
      new Error('internal database table name and credential'),
    );
    const failure = await service.reserve(request).catch(code);
    expect(failure).toMatchObject({
      status: 503,
      response: { code: 'AI_QUOTA_UNAVAILABLE' },
    });
    expect(JSON.stringify(failure)).not.toMatch(/credential|table/i);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });
});
