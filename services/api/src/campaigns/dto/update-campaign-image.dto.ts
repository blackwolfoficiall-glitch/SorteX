import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateCampaignImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  caption?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
