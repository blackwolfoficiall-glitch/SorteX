import { BadGatewayException } from '@nestjs/common';
import { parseCaixaFederalResponse } from './caixa-federal-results.service';
import { DrawRuleEngineService } from './draw-rule-engine.service';

const historicalCases = [
  {
    numero: 6091,
    dataApuracao: '12/08/2026',
    listaDezenas: ['086997', '004852', '000091', '082438', '039210'],
    prizes: ['86997', '04852', '00091', '82438', '39210'],
  },
  {
    numero: 6109,
    dataApuracao: '14/10/2026',
    listaDezenas: ['087637', '075621', '078748', '055165', '075592'],
    prizes: ['87637', '75621', '78748', '55165', '75592'],
  },
  {
    numero: 6110,
    dataApuracao: '18/10/2026',
    listaDezenas: ['046831', '031652', '060252', '078093', '009231'],
    prizes: ['46831', '31652', '60252', '78093', '09231'],
  },
  {
    numero: 6111,
    dataApuracao: '21/10/2026',
    listaDezenas: ['068003', '033062', '034756', '044114', '005674'],
    prizes: ['68003', '33062', '34756', '44114', '05674'],
  },
];

const payload = (extra: Record<string, unknown>) =>
  Buffer.from(JSON.stringify({ tipoJogo: 'LOTERIA_FEDERAL', ...extra }));

describe('CAIXA Federal format', () => {
  it.each(historicalCases)(
    'normalizes official extraction $numero without dropping ticket zeros',
    ({ numero, dataApuracao, listaDezenas, prizes }) => {
      const actual = parseCaixaFederalResponse(
        payload({ numero, dataApuracao, listaDezenas }),
        String(numero),
      );
      expect(actual.sourcePrizes).toEqual(listaDezenas);
      expect(actual.prizes).toEqual(prizes);
    },
  );

  it('keeps canonical five-character input and produces deterministic forward and reversed results', () => {
    const { prizes } = parseCaixaFederalResponse(
      payload({
        ...historicalCases[0],
        listaDezenas: ['86997', '04852', '00091', '82438', '39210'],
      }),
      '6091',
    );
    const engine = new DrawRuleEngineService();
    const positions = [
      'TEN_THOUSAND',
      'THOUSAND',
      'HUNDRED',
      'TEN',
      'UNIT',
    ] as const;
    const evaluate = (direction: 'NORMAL' | 'REVERSE') =>
      engine.evaluate(
        {
          version: 1,
          outputLength: 5,
          steps: positions.map((digitPosition, i) => ({
            order: i + 1,
            sourcePrize: 3,
            digitPosition,
            direction,
          })),
          normalization: { mode: 'REJECT_OUT_OF_RANGE' },
        },
        { prizes, totalNumbers: 100000 },
      ).normalizedResult;
    expect(evaluate('NORMAL')).toBe('00091');
    expect(evaluate('REVERSE')).toBe('19000');
  });

  it.each([
    { listaDezenas: ['186997', '004852', '000091', '082438', '039210'] },
    { listaDezenas: ['0086997', '004852', '000091', '082438', '039210'] },
    { listaDezenas: ['86997\n', '004852', '000091', '082438', '039210'] },
    { listaDezenas: [86997, '004852', '000091', '082438', '039210'] },
    { listaDezenas: ['086997', '004852', '000091', '082438'] },
    { numero: 6092 },
    { dataApuracao: '31/02/2026' },
    { tipoJogo: 'MEGA_SENA' },
  ])('rejects an incompatible or ambiguous response: %o', (override) => {
    expect(() =>
      parseCaixaFederalResponse(
        payload({ ...historicalCases[0], ...override }),
        '6091',
      ),
    ).toThrow(BadGatewayException);
  });
});
