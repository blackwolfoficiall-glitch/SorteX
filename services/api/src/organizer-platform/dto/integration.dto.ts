import { OrganizerIntegrationType } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';

export class ConfigureIntegrationDto {
  @IsEnum(OrganizerIntegrationType) type: OrganizerIntegrationType;
  @IsOptional() @IsString() @MaxLength(100) displayName?: string;
  @IsOptional() @IsString() @MaxLength(120) accountId?: string;
  @IsOptional() @IsString() @MaxLength(80) provider?: string;
  @IsOptional() @IsString() @MaxLength(500) credential?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) webhookUrl?: string;
  @IsOptional() @IsObject() publicConfig?: Record<string, unknown>;
  @IsOptional() @IsArray() @IsString({ each: true }) permissions?: string[];
  @IsBoolean() sandbox: boolean;
}
