import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CampaignPrizeType,
  LotterySourceType,
  WinnerStatus,
} from '@prisma/client';

export class RuleStepDto {
  @IsInt() @Min(1) order!: number;
  @IsInt() @Min(1) @Max(5) sourcePrize!: number;
  @IsString() digitPosition!:
    'TEN_THOUSAND' | 'THOUSAND' | 'HUNDRED' | 'TEN' | 'UNIT';
  @IsOptional() @IsString() direction?: 'NORMAL' | 'REVERSE';
  @IsOptional() @IsString() transformation?: 'NONE' | 'COMPLEMENT_9';
}
export class RuleDefinitionDto {
  @IsInt() @Min(1) version!: number;
  @IsInt() @Min(1) @Max(12) outputLength!: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RuleStepDto)
  steps!: RuleStepDto[];
  @IsObject() normalization!: {
    mode:
      | 'MODULO_TOTAL_NUMBERS'
      | 'LAST_N_DIGITS'
      | 'PAD_LEFT_ZERO'
      | 'REJECT_OUT_OF_RANGE'
      | 'CUSTOM_PIPELINE';
  };
}
export class SimulateRuleDto {
  @ValidateNested()
  @Type(() => RuleDefinitionDto)
  ruleDefinition!: RuleDefinitionDto;
  @IsArray() @Length(5, 5, { each: true }) prizes!: [
    string,
    string,
    string,
    string,
    string,
  ];
  @IsInt() @Min(1) totalNumbers!: number;
}
export class CreateLotteryDrawDto {
  @IsOptional() @IsString() provider?: string;
  @IsOptional() @IsString() lotteryName?: string;
  @IsOptional() @IsString() extractionNumber?: string;
  @IsDateString() drawDate!: string;
  @IsOptional() @IsString() drawTime?: string;
  @Length(5, 5) firstPrize!: string;
  @Length(5, 5) secondPrize!: string;
  @Length(5, 5) thirdPrize!: string;
  @Length(5, 5) fourthPrize!: string;
  @Length(5, 5) fifthPrize!: string;
  @IsOptional() @IsString() sourceUrl?: string;
  @IsOptional() @IsEnum(LotterySourceType) sourceType?: LotterySourceType;
  @IsOptional() @IsString() notes?: string;
}
export class ExecuteDrawDto {
  @IsString() lotteryDrawId!: string;
  @IsOptional() @IsString() notes?: string;
}
export class ConfirmDrawDto {
  @IsOptional() @IsString() notes?: string;
}
export class ManualWinnerLookupDto {
  @IsString()
  winningNumber!: string;
}
export class RejectDrawDto {
  @IsString() reason!: string;
}
export class UpdateWinnerDto {
  @IsEnum(WinnerStatus) status!: WinnerStatus;
  @IsOptional() @IsString() notes?: string;
}
export class ConfirmReceiptDto {
  @IsOptional() @IsString() testimonialText?: string;
  @IsOptional() @IsString() testimonialVideoUrl?: string;
  @IsOptional() @IsString() testimonialImageUrl?: string;
  @IsOptional() @IsString() publicDisplayName?: string;
  @IsOptional() @IsString() publicCity?: string;
  @IsOptional() @IsBoolean() publicDisclosureAuthorized?: boolean;
}

export class CreateInstantPrizeDto {
  @IsString() campaignId!: string;
  @IsArray() @IsString({ each: true }) numbers!: string[];
  @IsString() description!: string;
  @IsOptional() @IsString() instructions?: string;
  @Type(() => Number) @Min(0) value!: number;
  @IsEnum(CampaignPrizeType) type!: CampaignPrizeType;
  @IsOptional() @IsString() origin?: string;
  @IsOptional() @IsBoolean() activate?: boolean;
}

export class UpdateInstantPrizeDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() instructions?: string;
  @IsOptional() @Type(() => Number) @Min(0) value?: number;
  @IsOptional() @IsEnum(CampaignPrizeType) type?: CampaignPrizeType;
}

export class PrizeTicketQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsEnum(CampaignPrizeType) type?: CampaignPrizeType;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}
