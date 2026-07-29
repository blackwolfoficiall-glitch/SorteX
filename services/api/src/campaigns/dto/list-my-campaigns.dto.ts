import { CampaignStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListMyCampaignsDto {
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;
}
