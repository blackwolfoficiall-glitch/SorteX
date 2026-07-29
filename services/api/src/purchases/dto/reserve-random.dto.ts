import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ReserveRandomDto {
  @IsString()
  campaignId!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;

  @IsOptional()
  @IsString()
  promotionId?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  affiliateCode?: string;
}
