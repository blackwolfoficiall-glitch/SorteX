import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  AffiliateAttributionModel,
  AffiliateCommissionType,
} from '@prisma/client';

export class CreateAffiliateProgramDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsEnum(AffiliateCommissionType) commissionType!: AffiliateCommissionType;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  commissionPercentage?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commissionFixedAmount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  commissionMixedPercentage?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commissionMixedFixedAmount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minimumPayoutAmount?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  releaseDelayDays?: number;
  @IsOptional() @IsBoolean() allowSelfSignup?: boolean;
  @IsOptional() @IsBoolean() allowSelfReferral?: boolean;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  cookieDurationDays?: number;
  @IsOptional()
  @IsEnum(AffiliateAttributionModel)
  attributionModel?: AffiliateAttributionModel;
  @IsOptional() @IsString() startsAt?: string;
  @IsOptional() @IsString() endsAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) affiliateLimit?: number;
  @IsOptional() @IsString() commissionBasis?: string;
  @IsOptional() @IsString() rules?: string;
}

export class InviteAffiliateDto {
  @IsString() programId!: string;
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() message?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  validityDays?: number;
}

export class CreateAffiliateLinkDto {
  @IsString() affiliateId!: string;
  @IsOptional() @IsString() campaignId?: string;
}

export class TrackAffiliateClickDto {
  @IsString() code!: string;
  @IsString() visitorId!: string;
  @IsString() landingPage!: string;
  @IsOptional() @IsString() referrer?: string;
}

export class AffiliatePayoutDto {
  @Type(() => Number) @IsNumber() @Min(1) amount!: number;
  @IsOptional() destinationSnapshot?: Record<string, unknown>;
}
