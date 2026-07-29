import { IsIn, IsOptional, IsString } from 'class-validator';

export const campaignMediaTargets = [
  'COVER',
  'GALLERY',
  'VIDEO',
  'MAIN_PRIZE',
  'INSTANT_PRIZE',
  'MILESTONE',
] as const;

export type CampaignMediaTarget = (typeof campaignMediaTargets)[number];

export class UploadCampaignMediaDto {
  @IsIn(campaignMediaTargets)
  target: CampaignMediaTarget;

  @IsOptional()
  @IsString()
  instantPrizeId?: string;
}
