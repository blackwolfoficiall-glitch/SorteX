import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ReserveManualDto {
  @IsString()
  campaignId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10000)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(9999999, { each: true })
  numbers!: number[];

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
