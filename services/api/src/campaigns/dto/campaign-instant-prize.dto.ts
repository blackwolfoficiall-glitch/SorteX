import { CampaignPrizeType, InstantPrizeStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  Matches,
} from 'class-validator';

export class CampaignInstantPrizeDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/, { message: 'A cota premiada deve conter apenas números.' })
  exactNumber?: string;

  @IsOptional()
  @IsObject()
  generationRule?: Record<string, unknown>;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number;

  @IsString()
  @MinLength(2)
  description: string;

  @IsEnum(CampaignPrizeType)
  type: CampaignPrizeType;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsEnum(InstantPrizeStatus)
  status?: InstantPrizeStatus;
}
