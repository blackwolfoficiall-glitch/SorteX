import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CampaignMilestonePrizeDto } from './campaign-milestone.dto';

function validateMilestone(
  scheduledAt?: string,
  imageCrop?: Record<string, unknown>,
) {
  const instance = plainToInstance(CampaignMilestonePrizeDto, {
    name: 'Prêmio de homologação',
    percentage: 20,
    scheduledAt,
    imageCrop,
  });
  return { instance, errors: validateSync(instance) };
}

describe('CampaignMilestonePrizeDto', () => {
  it('trata data vazia como campo opcional ausente', () => {
    const { instance, errors } = validateMilestone('');

    expect(errors).toHaveLength(0);
    expect(instance.scheduledAt).toBeUndefined();
  });

  it('aceita data e horário ISO 8601 completos', () => {
    const { instance, errors } = validateMilestone('2026-07-27T18:30:00.000Z');

    expect(errors).toHaveLength(0);
    expect(instance.scheduledAt).toBe('2026-07-27T18:30:00.000Z');
  });

  it('rejeita data inválida com mensagem amigável', () => {
    const { errors } = validateMilestone('27/07/2026');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isDateString).toBe(
      'Informe uma data e um horário válidos para o prêmio adicional.',
    );
  });

  it('aceita o enquadramento persistível da imagem', () => {
    const imageCrop = {
      desktop: { x: 30, y: 45, zoom: 1.2 },
      mobile: { x: 55, y: 20, zoom: 1.35 },
    };
    const { instance, errors } = validateMilestone(undefined, imageCrop);

    expect(errors).toHaveLength(0);
    expect(instance.imageCrop).toEqual(imageCrop);
  });
});
