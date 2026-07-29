import { BadRequestException, Injectable } from '@nestjs/common';

export type PrizePosition =
  'TEN_THOUSAND' | 'THOUSAND' | 'HUNDRED' | 'TEN' | 'UNIT';
export type NormalizationMode =
  | 'MODULO_TOTAL_NUMBERS'
  | 'LAST_N_DIGITS'
  | 'PAD_LEFT_ZERO'
  | 'REJECT_OUT_OF_RANGE'
  | 'CUSTOM_PIPELINE';
export interface RuleStep {
  order: number;
  sourcePrize: number;
  digitPosition: PrizePosition;
  direction?: 'NORMAL' | 'REVERSE';
  transformation?: 'NONE' | 'COMPLEMENT_9';
}
export interface DrawRuleDefinition {
  version: number;
  outputLength: number;
  steps: RuleStep[];
  normalization: { mode: NormalizationMode };
}
export interface DrawInput {
  prizes: [string, string, string, string, string];
  totalNumbers: number;
}

@Injectable()
export class DrawRuleEngineService {
  validate(rule: DrawRuleDefinition) {
    if (
      !rule ||
      rule.version !== 1 ||
      !Number.isInteger(rule.outputLength) ||
      rule.outputLength < 1 ||
      rule.outputLength > 12
    )
      throw new BadRequestException('Regra de sorteio inválida.');
    if (!Array.isArray(rule.steps) || rule.steps.length !== rule.outputLength)
      throw new BadRequestException(
        'A regra deve possuir uma etapa por dígito de saída.',
      );
    const orders = new Set<number>();
    for (const step of rule.steps) {
      if (
        !Number.isInteger(step.order) ||
        orders.has(step.order) ||
        step.sourcePrize < 1 ||
        step.sourcePrize > 5 ||
        !this.positionIndex(step.digitPosition)
      )
        throw new BadRequestException('Etapa de regra inválida.');
      orders.add(step.order);
    }
    if (
      ![
        'MODULO_TOTAL_NUMBERS',
        'LAST_N_DIGITS',
        'PAD_LEFT_ZERO',
        'REJECT_OUT_OF_RANGE',
        'CUSTOM_PIPELINE',
      ].includes(rule.normalization?.mode)
    )
      throw new BadRequestException('Normalização inválida.');
    return true;
  }

  evaluate(rule: DrawRuleDefinition, input: DrawInput) {
    rule = this.upgradeLegacy(rule);
    this.validate(rule);
    if (!Number.isSafeInteger(input.totalNumbers) || input.totalNumbers < 1)
      throw new BadRequestException('Quantidade total de títulos inválida.');
    input.prizes.forEach((value) => {
      if (!/^\d{5}$/.test(value))
        throw new BadRequestException(
          'Cada prêmio deve conter exatamente cinco dígitos.',
        );
    });
    const steps = [...rule.steps]
      .sort((a, b) => a.order - b.order)
      .map((step) => {
        const prize = input.prizes[step.sourcePrize - 1];
        const display =
          step.direction === 'REVERSE'
            ? prize.split('').reverse().join('')
            : prize;
        const sourceIndex = this.positionIndex(step.digitPosition) - 1;
        let digit = display[sourceIndex];
        if (step.transformation === 'COMPLEMENT_9')
          digit = String(9 - Number(digit));
        return { ...step, sourceValue: prize, selectedDigit: digit };
      });
    const rawResult = steps.map((step) => step.selectedDigit).join('');
    const normalizedResult = this.normalize(
      rawResult,
      input.totalNumbers,
      rule.normalization.mode,
      rule.outputLength,
    );
    return {
      steps,
      rawResult,
      normalizedResult,
      explanation: `Resultado bruto ${rawResult}, normalizado por ${rule.normalization.mode} para ${normalizedResult}.`,
      warnings: [],
      valid: true,
    };
  }

  private normalize(
    raw: string,
    total: number,
    mode: NormalizationMode,
    length: number,
  ) {
    const width = Math.max(1, String(total - 1).length);
    const rawNumber = BigInt(raw || '0');
    let result: bigint;
    if (mode === 'MODULO_TOTAL_NUMBERS') result = rawNumber % BigInt(total);
    else if (mode === 'LAST_N_DIGITS')
      result = BigInt(raw.slice(-width) || '0') % BigInt(total);
    else if (mode === 'PAD_LEFT_ZERO') result = rawNumber;
    else if (mode === 'CUSTOM_PIPELINE')
      throw new BadRequestException(
        'Pipeline personalizada ainda não possui operações configuradas.',
      );
    else {
      if (rawNumber >= BigInt(total))
        throw new BadRequestException(
          'Resultado fora do intervalo da campanha.',
        );
      result = rawNumber;
    }
    return result
      .toString()
      .padStart(Math.max(width, Math.min(length, width)), '0');
  }

  private positionIndex(position: PrizePosition) {
    return (
      ({ TEN_THOUSAND: 1, THOUSAND: 2, HUNDRED: 3, TEN: 4, UNIT: 5 } as const)[
        position
      ] ?? 0
    );
  }
  private upgradeLegacy(rule: DrawRuleDefinition) {
    const legacy = (
      rule as unknown as {
        digits?: Array<{ prize: number; position: number; order: number }>;
      }
    ).digits;
    if (!legacy) return rule;
    const positions: PrizePosition[] = [
      'TEN_THOUSAND',
      'THOUSAND',
      'HUNDRED',
      'TEN',
      'UNIT',
    ];
    return {
      version: 1,
      outputLength: legacy.length,
      steps: legacy.map((item) => ({
        order: item.order + 1,
        sourcePrize: item.prize,
        digitPosition: positions[item.position],
      })),
      normalization: { mode: 'MODULO_TOTAL_NUMBERS' },
    } as DrawRuleDefinition;
  }
}
