import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateCampaignDto } from './create-campaign.dto';

describe('CreateCampaignDto visual do título', () => {
  it('aceita cor hexadecimal e até três segmentos', () => {
    const instance = plainToInstance(CreateCampaignDto, {
      titleColorMode: 'CUSTOM',
      customTitleColor: '#7C00FF',
      titleCompositionMode: 'SEGMENTS',
      titleSegments: [
        { text: 'BMW', color: '#0066FF', order: 0 },
        { text: 'OU 500 MIL', color: '#FFFFFF', order: 1 },
      ],
    });

    expect(validateSync(instance)).toHaveLength(0);
  });

  it('rejeita hexadecimal inválido e mais de três segmentos', () => {
    const instance = plainToInstance(CreateCampaignDto, {
      titleColorMode: 'CUSTOM',
      customTitleColor: 'roxo',
      titleCompositionMode: 'SEGMENTS',
      titleSegments: Array.from({ length: 4 }, (_, order) => ({
        text: `Parte ${order + 1}`,
        color: '#FFFFFF',
        order,
      })),
    });

    expect(validateSync(instance).length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ['INSTANT_WIN', 'MILESTONES', 'ROULETTE'],
    ['INSTANT_WIN', 'ROULETTE', 'MILESTONES'],
    ['MILESTONES', 'INSTANT_WIN', 'ROULETTE'],
    ['MILESTONES', 'ROULETTE', 'INSTANT_WIN'],
    ['ROULETTE', 'INSTANT_WIN', 'MILESTONES'],
    ['ROULETTE', 'MILESTONES', 'INSTANT_WIN'],
  ])('preserva a ordem válida %j', (...rewardSectionsOrder) => {
    const instance = plainToInstance(CreateCampaignDto, {
      rewardSectionsOrder,
    });

    expect(validateSync(instance)).toHaveLength(0);
    expect(instance.rewardSectionsOrder).toEqual(rewardSectionsOrder);
  });

  it.each([
    [['INSTANT_WIN', 'INSTANT_WIN', 'ROULETTE']],
    [['INSTANT_WIN', 'MILESTONES', 'DESCONHECIDO']],
    [[]],
  ])('normaliza ordem inválida %j para o padrão seguro', (invalidOrder) => {
    const instance = plainToInstance(CreateCampaignDto, {
      rewardSectionsOrder: invalidOrder,
    });

    expect(validateSync(instance)).toHaveLength(0);
    expect(instance.rewardSectionsOrder).toEqual([
      'INSTANT_WIN',
      'MILESTONES',
      'ROULETTE',
    ]);
  });
});
