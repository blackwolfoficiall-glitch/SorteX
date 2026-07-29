import { OrganizerPlan } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateCommercialTermsDto {
  @IsOptional()
  @IsEnum(OrganizerPlan)
  currentPlan?: OrganizerPlan;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  platformFee?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyFee?: number;

  @IsOptional()
  @IsBoolean()
  firstCampaignFree?: boolean;

  @IsOptional()
  @IsBoolean()
  platformFeeWaived?: boolean;

  @IsOptional()
  @IsBoolean()
  monthlyFeeWaived?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  customPlatformFee?: number | null;

  @IsOptional()
  @IsBoolean()
  founder?: boolean;

  @IsOptional()
  @IsBoolean()
  vip?: boolean;
}
