import { CampaignPrizeType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class DraftInstantPrizeFieldsDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(120)
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999999.99)
  value!: number;

  @IsEnum(CampaignPrizeType)
  type!: CampaignPrizeType;
}

export class CreateDraftInstantPrizeDto extends DraftInstantPrizeFieldsDto {
  @IsString()
  @Matches(/^\d{1,7}$/)
  exactNumber!: string;
}

export class UpdateDraftInstantPrizeDto extends DraftInstantPrizeFieldsDto {
  @IsISO8601()
  revision!: string;
}

export class DraftInstantPrizeRevisionDto {
  @IsISO8601()
  revision!: string;
}
