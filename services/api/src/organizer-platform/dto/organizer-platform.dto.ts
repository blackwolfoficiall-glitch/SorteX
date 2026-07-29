import {
  CampaignLayoutStyle,
  MiniCampaignPrizeType,
  OrganizerCommunityType,
  OrganizerDomainType,
  OrganizerSocialNetwork,
  OrganizerThemeMode,
  PlanBillingCycle,
  PurchaseStatus,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SelectPlanDto {
  @IsString()
  planId: string;

  @IsEnum(PlanBillingCycle)
  billingCycle: PlanBillingCycle;
}

export class UpdateBrandDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) publicName?: string;
  @IsOptional() @IsString() @MaxLength(80) fantasyName?: string;
  @IsOptional() @IsString() @MaxLength(60) slogan?: string;
  @IsOptional() @IsString() @MaxLength(20) publicPhone?: string;
  @IsOptional() @IsEmail() publicEmail?: string;
  @IsOptional() @IsString() @MaxLength(500) primaryLogoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) profileImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) bannerUrl?: string;
  @IsOptional() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsHexColor() secondaryColor?: string;
  @IsOptional() @IsHexColor() accentColor?: string;
  @IsOptional() @IsHexColor() textColor?: string;
  @IsOptional() @IsHexColor() buttonColor?: string;
  @IsOptional() @IsHexColor() progressColor?: string;
  @IsOptional() @IsHexColor() backgroundColor?: string;
  @IsOptional() @IsHexColor() cardColor?: string;
  @IsOptional() @IsEnum(OrganizerThemeMode) themeMode?: OrganizerThemeMode;
  @IsOptional() @IsEnum(CampaignLayoutStyle) layoutStyle?: CampaignLayoutStyle;
  @IsOptional() @IsObject() appearanceConfig?: Record<string, unknown>;
}

export class SocialLinkDto {
  @IsEnum(OrganizerSocialNetwork) type: OrganizerSocialNetwork;
  @IsOptional() @IsString() @MaxLength(40) label?: string;
  @IsUrl({ require_protocol: true }) url: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class CommunityLinkDto {
  @IsEnum(OrganizerCommunityType) type: OrganizerCommunityType;
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(180) description?: string;
  @IsUrl({ require_protocol: true }) url: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class DomainDto {
  @IsEnum(OrganizerDomainType) type: OrganizerDomainType;
  @IsString()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @MaxLength(253)
  domain: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CampaignTemplateDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsOptional() @IsString() @MaxLength(180) description?: string;
  @IsOptional() @IsString() sourceCampaignId?: string;
  @IsObject() configuration: Record<string, unknown>;
}

export class ListOrdersDto {
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(PurchaseStatus) status?: PurchaseStatus;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsNumber() minValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxValue?: number;
  @IsOptional() @IsString() sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(250) limit = 25;
}

export class MiniCampaignDto {
  @IsString() @MinLength(3) @MaxLength(100) name: string;
  @IsString() mainCampaignId: string;
  @IsEnum(MiniCampaignPrizeType) prizeType: MiniCampaignPrizeType;
  @IsString() @MinLength(3) @MaxLength(180) prizeDescription: string;
  @Type(() => Number) @IsInt() @Min(1) maxTickets: number;
  @Type(() => Number) @IsPositive() ticketPrice: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  purchaseLimitPerBuyer?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsDateString() drawAt?: string;
  @IsString() @MinLength(10) rules: string;
  @IsOptional() @IsString() @MaxLength(600) description?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) imageUrl?: string;
}

export class UpdateMiniCampaignDto extends MiniCampaignDto {}

export class MiniCampaignResultDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  winningNumber: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReserveMiniCampaignDto {
  @Type(() => Number) @IsInt() @Min(1) quantity: number;
}
