import { Test } from '@nestjs/testing';
import { CampaignCategory } from '@prisma/client';
import { CampaignsService } from './campaigns.service';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { PublicCampaignsController } from './public-campaigns.controller';
import { CampaignMilestonesService } from './campaign-milestones.service';

describe('PublicCampaignsController', () => {
  const campaignsService = {
    listPublic: jest.fn(),
    getPublic: jest.fn(),
  };
  const milestonesService = { listPublic: jest.fn() };
  let controller: PublicCampaignsController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [PublicCampaignsController],
      providers: [
        { provide: CampaignsService, useValue: campaignsService },
        { provide: CampaignMilestonesService, useValue: milestonesService },
      ],
    }).compile();
    controller = module.get(PublicCampaignsController);
  });

  it('lista campanhas públicas com filtro de categoria', async () => {
    campaignsService.listPublic.mockResolvedValue([{ id: 'campaign-1' }]);
    await expect(
      controller.list({ category: CampaignCategory.AUTOMOBILE }),
    ).resolves.toEqual([{ id: 'campaign-1' }]);
    expect(campaignsService.listPublic).toHaveBeenCalledWith(
      CampaignCategory.AUTOMOBILE,
    );
  });

  it('busca campanha publicada pelo slug', async () => {
    campaignsService.getPublic.mockResolvedValue({ slug: 'campanha-publica' });
    await expect(controller.get('campanha-publica')).resolves.toEqual({
      slug: 'campanha-publica',
    });
  });

  it('mantém públicas as rotas que entregam imagens de campanhas publicadas', () => {
    const media = Object.getOwnPropertyDescriptor(
      PublicCampaignsController.prototype,
      'media',
    )?.value as object;
    const mediaWithId = Object.getOwnPropertyDescriptor(
      PublicCampaignsController.prototype,
      'mediaWithId',
    )?.value as object;
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicCampaignsController)).toBe(
      true,
    );
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, media)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, mediaWithId)).toBe(true);
  });
});
