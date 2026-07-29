import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CampaignImageViewportDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  x: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  y: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(2)
  zoom: number;
}

export class CampaignImageCropDto {
  @ValidateNested()
  @Type(() => CampaignImageViewportDto)
  desktop: CampaignImageViewportDto;

  @ValidateNested()
  @Type(() => CampaignImageViewportDto)
  mobile: CampaignImageViewportDto;
}

export class CampaignMilestonePrizeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignImageCropDto)
  imageCrop?: CampaignImageCropDto;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  videoUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedValue?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(5)
  @Max(100)
  @IsIn([
    5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
    100,
  ])
  percentage: number;

  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    const candidate: unknown = value;
    return typeof candidate === 'string' && candidate.trim() === ''
      ? undefined
      : candidate;
  })
  @IsDateString(
    {},
    {
      message: 'Informe uma data e um horário válidos para o prêmio adicional.',
    },
  )
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class SaveCampaignMilestonesDto {
  @IsBoolean()
  winnersRemainEligible: boolean;

  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CampaignMilestonePrizeDto)
  milestones: CampaignMilestonePrizeDto[];
}
