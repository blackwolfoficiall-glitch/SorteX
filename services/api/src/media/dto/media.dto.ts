import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import {
  GeneratedMediaStatus,
  MediaFormat,
  MediaTemplateStatus,
  MediaTemplateType,
  ShareChannel,
} from '@prisma/client';
export class CreateGeneratedMediaDto {
  @IsString() templateId!: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() winnerId?: string;
  @IsOptional() @IsString() instantPrizeResultId?: string;
  @IsOptional() @IsString() affiliateId?: string;
  @IsOptional() @IsString() title?: string;
  @IsObject() inputData!: Record<string, unknown>;
  @IsOptional() @IsObject() editorConfig?: Record<string, unknown>;
}
export class UpdateGeneratedMediaDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsObject() inputData?: Record<string, unknown>;
  @IsOptional() @IsObject() editorConfig?: Record<string, unknown>;
  @IsOptional() @IsEnum(GeneratedMediaStatus) status?: GeneratedMediaStatus;
}
export class BrandProfileDto {
  @IsOptional() @IsString() primaryLogoUrl?: string;
  @IsOptional() @IsString() secondaryLogoUrl?: string;
  @IsHexColor() primaryColor!: `#${string}`;
  @IsHexColor() secondaryColor!: `#${string}`;
  @IsHexColor() accentColor!: `#${string}`;
  @IsHexColor() textColor!: `#${string}`;
  @IsString() publicName!: string;
  @IsOptional() @IsString() instagramHandle?: string;
  @IsOptional() @IsString() whatsappMasked?: string;
  @IsOptional() @IsString() @MaxLength(60) slogan?: string;
  @IsOptional() @IsBoolean() useSortexBranding?: boolean;
}
export class CreateTemplateDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(MediaTemplateType) type!: MediaTemplateType;
  @IsEnum(MediaFormat) format!: MediaFormat;
  @IsString() category!: string;
  @IsOptional() @IsEnum(MediaTemplateStatus) status?: MediaTemplateStatus;
  @IsInt() @Min(320) @Max(4096) width!: number;
  @IsInt() @Min(320) @Max(4096) height!: number;
  @IsOptional() @IsInt() durationSeconds?: number;
  @IsObject() templateDefinition!: Record<string, unknown>;
}
export class ShareLinkDto {
  @IsEnum(ShareChannel) channel!: ShareChannel;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() destinationUrl?: string;
}
