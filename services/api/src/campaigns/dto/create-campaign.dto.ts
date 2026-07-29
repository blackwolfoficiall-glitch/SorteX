import {
  CampaignCategory,
  DrawBasis,
  NumberSelectionMode,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsHexColor,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CampaignInstantPrizeDto } from './campaign-instant-prize.dto';
import { CampaignPromotionDto } from './campaign-promotion.dto';
import { CampaignMilestonePrizeDto } from './campaign-milestone.dto';

export class CampaignTitleSegmentDto {
  @IsString()
  @MinLength(1)
  text: string;

  @IsHexColor()
  color: string;

  @IsInt()
  @Min(0)
  @Max(2)
  order: number;
}

export class CreateCampaignDto {
  @IsOptional() @IsBoolean() showParticipants?: boolean;
  @IsOptional() @IsIn(['SIMPLE', 'HIGHLIGHT']) titleDisplayMode?:
    'SIMPLE' | 'HIGHLIGHT';
  @IsOptional()
  @IsIn(['WHITE', 'BLACK', 'BLUE', 'AUTO', 'CUSTOM'])
  titleColorMode?: 'WHITE' | 'BLACK' | 'BLUE' | 'AUTO' | 'CUSTOM';
  @IsOptional() @IsHexColor() customTitleColor?: string;
  @IsOptional()
  @IsIn(['SINGLE', 'SEGMENTS'])
  titleCompositionMode?: 'SINGLE' | 'SEGMENTS';
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => CampaignTitleSegmentDto)
  titleSegments?: CampaignTitleSegmentDto[];
  @IsOptional()
  @Transform(({ value }) => normalizeRewardSectionsOrder(value))
  @IsArray()
  @IsIn(['INSTANT_WIN', 'MILESTONES', 'ROULETTE'], { each: true })
  rewardSectionsOrder?: Array<'INSTANT_WIN' | 'MILESTONES' | 'ROULETTE'>;
  @IsOptional()
  @IsIn([
    'BLUE',
    'GREEN',
    'RED',
    'PURPLE',
    'PINK',
    'ORANGE',
    'YELLOW',
    'BLACK',
    'CUSTOM',
  ])
  accentColorMode?:
    | 'BLUE'
    | 'GREEN'
    | 'RED'
    | 'PURPLE'
    | 'PINK'
    | 'ORANGE'
    | 'YELLOW'
    | 'BLACK'
    | 'CUSTOM';
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) customAccentColor?: string;
  @IsOptional()
  @IsInt()
  @IsIn([50, 100, 250, 500, 1000, 2000])
  popularQuickQuantity?: number;
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  slug?: string;
  @IsOptional() @IsString() shortDescription?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() regulation?: string;
  @IsOptional() @IsEnum(CampaignCategory) category?: CampaignCategory;
  @IsOptional() @IsString() mainPrizeName?: string;
  @IsOptional() @IsString() mainPrizeDescription?: string;
  @IsOptional() @IsInt() @Min(1) mainPrizeQuantity?: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cashAlternative?: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedPrizeValue?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000) totalNumbers?: number;
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  numberPrice?: number;
  @IsOptional() @IsInt() @Min(1) minimumPurchase?: number;
  @IsOptional() @IsInt() @Min(1) maximumPurchasePerBuyer?: number;
  @IsOptional()
  @IsEnum(NumberSelectionMode)
  numberSelectionMode?: NumberSelectionMode;
  @IsOptional() @IsDateString() drawDate?: string;
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  drawTime?: string;
  @IsOptional() @IsEnum(DrawBasis) drawBasis?: DrawBasis;
  @IsOptional() @IsString() drawRuleTemplateId?: string;
  @IsOptional() @IsObject() customDrawRule?: Record<string, unknown>;
  @IsOptional() @IsObject() customization?: Record<string, unknown>;
  @IsOptional() @IsDateString() salesStartAt?: string;
  @IsOptional() @IsDateString() salesEndAt?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignInstantPrizeDto)
  instantPrizes?: CampaignInstantPrizeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignPromotionDto)
  promotions?: CampaignPromotionDto[];

  @IsOptional()
  @IsBoolean()
  milestoneWinnersRemainEligible?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignMilestonePrizeDto)
  milestones?: CampaignMilestonePrizeDto[];
}

const defaultRewardSectionsOrder = [
  'INSTANT_WIN',
  'MILESTONES',
  'ROULETTE',
] as const;

function normalizeRewardSectionsOrder(
  value: unknown,
): Array<(typeof defaultRewardSectionsOrder)[number]> {
  if (
    !Array.isArray(value) ||
    value.length !== defaultRewardSectionsOrder.length ||
    new Set(value).size !== defaultRewardSectionsOrder.length ||
    value.some(
      (item) =>
        !defaultRewardSectionsOrder.includes(
          item as (typeof defaultRewardSectionsOrder)[number],
        ),
    )
  )
    return [...defaultRewardSectionsOrder];
  return value as Array<(typeof defaultRewardSectionsOrder)[number]>;
}
