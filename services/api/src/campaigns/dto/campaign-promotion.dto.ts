import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CampaignPromotionDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsInt()
  @Min(1)
  numberQuantity: number;

  @ValidateIf((promotion: CampaignPromotionDto) => !promotion.isPopular)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  packagePrice?: number;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;
}
