import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

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

  // Omitted by the existing web editor; supplied by the native draft editor.
  @IsOptional()
  @Matches(/^(none|[a-f0-9]{16})$/)
  expectedDraftCoverRevision?: string;
}
