import { CampaignCategory } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListPublicCampaignsDto {
  @IsOptional()
  @IsEnum(CampaignCategory)
  category?: CampaignCategory;
}
