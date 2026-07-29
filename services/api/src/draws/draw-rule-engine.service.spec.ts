import { BadRequestException } from '@nestjs/common';
import {
  DrawRuleEngineService,
  type DrawRuleDefinition,
} from './draw-rule-engine.service';

describe('DrawRuleEngineService', () => {
  const service = new DrawRuleEngineService();
  const rule: DrawRuleDefinition = {
    version: 1,
    outputLength: 5,
    steps: [1, 2, 3, 4, 5].map((sourcePrize, index) => ({
      order: index + 1,
      sourcePrize,
      digitPosition: 'UNIT',
    })),
    normalization: { mode: 'MODULO_TOTAL_NUMBERS' },
  };
  it('combina dígitos de forma determinística e preserva zeros', () => {
    const input = {
      prizes: ['12340', '00001', '70002', '88003', '99004'] as [
        string,
        string,
        string,
        string,
        string,
      ],
      totalNumbers: 100000,
    };
    expect(service.evaluate(rule, input).normalizedResult).toBe('01234');
    expect(service.evaluate(rule, input)).toEqual(
      service.evaluate(rule, input),
    );
  });
  it('normaliza por módulo para o intervalo', () => {
    const custom = {
      ...rule,
      outputLength: 6,
      steps: [
        ...rule.steps,
        { order: 6, sourcePrize: 1, digitPosition: 'TEN_THOUSAND' as const },
      ],
    };
    expect(
      Number(
        service.evaluate(custom, {
          prizes: ['99999', '99999', '99999', '99999', '99999'],
          totalNumbers: 1000,
        }).normalizedResult,
      ),
    ).toBeLessThan(1000);
  });
  it('lê prêmio invertido', () => {
    const reverse = {
      version: 1,
      outputLength: 1,
      steps: [
        {
          order: 1,
          sourcePrize: 1,
          digitPosition: 'TEN_THOUSAND' as const,
          direction: 'REVERSE' as const,
        },
      ],
      normalization: { mode: 'REJECT_OUT_OF_RANGE' as const },
    };
    expect(
      service.evaluate(reverse, {
        prizes: ['12345', '00000', '00000', '00000', '00000'],
        totalNumbers: 10,
      }).normalizedResult,
    ).toBe('5');
  });
  it('rejeita prêmio sem cinco dígitos', () => {
    expect(() =>
      service.evaluate(rule, {
        prizes: ['123', '00000', '00000', '00000', '00000'],
        totalNumbers: 100000,
      }),
    ).toThrow(BadRequestException);
  });
  it('rejeita regra incompleta', () => {
    expect(() =>
      service.validate({ ...rule, steps: rule.steps.slice(1) }),
    ).toThrow(BadRequestException);
  });
  it('rejeita resultado fora da faixa quando configurado', () => {
    expect(() =>
      service.evaluate(
        { ...rule, normalization: { mode: 'REJECT_OUT_OF_RANGE' } },
        {
          prizes: ['99999', '99999', '99999', '99999', '99999'],
          totalNumbers: 10,
        },
      ),
    ).toThrow(BadRequestException);
  });
});
