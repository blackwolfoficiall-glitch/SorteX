import { validate } from 'class-validator';
import { CampaignPromotionDto } from './campaign-promotion.dto';

function promotion(values: Partial<CampaignPromotionDto>) {
  return Object.assign(new CampaignPromotionDto(), values);
}

describe('CampaignPromotionDto', () => {
  it('aceita o formato legado do destaque Mais popular sem packagePrice', async () => {
    const errors = await validate(
      promotion({
        name: 'Mais popular',
        numberQuantity: 1000,
        isPopular: true,
      }),
    );

    expect(errors).toHaveLength(0);
  });

  it('mantém packagePrice obrigatório para pacote promocional real', async () => {
    const errors = await validate(
      promotion({ name: 'Pacote 500', numberQuantity: 500, isPopular: false }),
    );

    expect(errors.some((error) => error.property === 'packagePrice')).toBe(
      true,
    );
  });

  it('mantém o preço mínimo dos pacotes promocionais reais', async () => {
    const errors = await validate(
      promotion({
        name: 'Pacote 500',
        numberQuantity: 500,
        packagePrice: 0,
        isPopular: false,
      }),
    );

    expect(errors.some((error) => error.property === 'packagePrice')).toBe(
      true,
    );
  });
});
