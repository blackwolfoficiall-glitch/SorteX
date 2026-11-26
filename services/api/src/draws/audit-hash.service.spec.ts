import { AuditHashService } from './audit-hash.service';
describe('AuditHashService', () => {
  const service = new AuditHashService();
  it('produz hash reproduzível independentemente da ordem das chaves', () => {
    expect(service.create({ a: 1, b: { c: 2 } })).toBe(
      service.create({ b: { c: 2 }, a: 1 }),
    );
  });
  it('muda quando o snapshot muda', () => {
    expect(service.create({ result: '1' })).not.toBe(
      service.create({ result: '2' }),
    );
  });
  it('reconstitui o registro JSON do PostgreSQL sem perder a data ou zeros', () => {
    const facts = {
      campaignId: 'campaign-synthetic',
      lotteryDrawId: 'federal-synthetic',
      ruleSnapshot: { version: 1, normalization: { mode: 'PAD_LEFT_ZERO' } },
      resultSnapshot: {
        lottery: {
          drawDate: new Date('2026-08-12T00:00:00.000Z'),
          sourcePrizes: ['000091'],
        },
        rawResult: '00091',
      },
      winningNumber: '00091',
      normalizedWinningNumber: '00091',
      executedAt: new Date('2026-11-26T03:30:00.125Z'),
    };
    const roundTrip: unknown = JSON.parse(JSON.stringify(facts.resultSnapshot));
    const proof = service.drawHash(facts);
    expect(service.drawHash({ ...facts, resultSnapshot: roundTrip })).toBe(
      proof,
    );
    expect(
      service.drawHash({
        ...facts,
        executedAt: new Date('2026-11-26T03:30:00.126Z'),
      }),
    ).not.toBe(proof);
    expect(
      service.drawHash({ ...facts, normalizedWinningNumber: '91' }),
    ).not.toBe(proof);
    expect(
      service.drawHash({
        ...facts,
        resultSnapshot: {
          ...facts.resultSnapshot,
          lottery: {
            ...facts.resultSnapshot.lottery,
            drawDate: new Date('2026-08-13T00:00:00Z'),
          },
        },
      }),
    ).not.toBe(proof);
  });
  it('produz SHA-256 hexadecimal', () =>
    expect(service.create({ x: 1 })).toMatch(/^[a-f0-9]{64}$/));
});
