import {
  AiRecommendationStatus,
  PromotionStatus,
  PromotionType,
  SortexAdBudgetType,
  SortexAdChannel,
  SortexAdObjective,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PromotionDto {
  @IsString() campaignId: string;
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsEnum(PromotionType) type: PromotionType;
  @IsOptional() @IsString() @MaxLength(240) description?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) totalLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) perBuyerLimit?: number;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsOptional() @IsObject() stackRules?: Record<string, unknown>;
  @IsOptional() @IsEnum(PromotionStatus) status?: PromotionStatus;
}
export class PromotionListDto {
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsEnum(PromotionType) type?: PromotionType;
  @IsOptional() @IsEnum(PromotionStatus) status?: PromotionStatus;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
export class PromotionQuoteDto {
  @IsString() campaignId: string;
  @Type(() => Number) @IsInt() @Min(1) quantity: number;
  @IsOptional() @IsString() couponCode?: string;
}

export class SortexAdDto {
  @IsString() campaignId: string;
  @IsOptional() @IsString() promotionId?: string;
  @IsString() @MinLength(2) @MaxLength(100) name: string;
  @IsEnum(SortexAdObjective) objective: SortexAdObjective;
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(SortexAdChannel, { each: true })
  channels: SortexAdChannel[];
  @IsObject() audience: Record<string, unknown>;
  @IsObject() location: Record<string, unknown>;
  @IsEnum(SortexAdBudgetType) budgetType: SortexAdBudgetType;
  @Type(() => Number) @IsPositive() budget: number;
  @IsObject() creative: Record<string, unknown>;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}
export class SortexAdListDto {
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() channel?: string;
  @IsOptional() @IsString() objective?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class SortexAdsDashboardQueryDto {
  @IsOptional() @IsIn(['TODAY', '7D', '30D', '90D', 'CUSTOM']) period = '30D';
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() platform?: string;
  @IsOptional() @IsString() adType?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
}
export class AdTrackDto {
  @IsString() type: string;
  @IsOptional() @IsString() visitorId?: string;
  @IsOptional() @IsString() buyerId?: string;
  @IsOptional() @IsString() purchaseId?: string;
  @IsOptional() @IsNumber() value?: number;
  @IsOptional() @IsString() channel?: string;
}
export class RecommendationFeedbackDto {
  @IsEnum(AiRecommendationStatus) status: AiRecommendationStatus;
  @IsOptional() @IsString() @MaxLength(300) feedback?: string;
}
export class AdvisorChatDto {
  @IsString() @MinLength(3) @MaxLength(600) question: string;
}
export class AdvisorSimulationDto {
  @IsOptional() @IsString() campaignId?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000000) quantity: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) price?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;
}
export class AdvisorMessageDto {
  @IsString() @MinLength(2) @MaxLength(80) objective: string;
  @IsString() @MinLength(2) @MaxLength(40) tone: string;
  @IsOptional() @IsString() campaignId?: string;
}
export class AdvisorAdStrategyDto {
  @IsString() campaignId: string;
  @IsOptional() @IsString() @MaxLength(80) objective?: string;
}
