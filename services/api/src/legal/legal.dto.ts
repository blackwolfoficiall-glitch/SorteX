import { LegalDocumentStatus } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class SaveLegalDocumentDto {
  @IsString() @MaxLength(140) title!: string;
  @IsOptional() @IsString() @MaxLength(240) subtitle?: string;
  @IsString() @Matches(/^[a-z0-9-]+$/) slug!: string;
  @IsString() @MaxLength(80) category!: string;
  @IsObject() content!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(500) changeSummary?: string;
  @IsOptional() @IsBoolean() required?: boolean;
}

export class LegalStatusDto {
  @IsOptional() @IsString() @MaxLength(500) changeSummary?: string;
}

export class RestoreLegalVersionDto {
  @IsInt()
  @Min(1)
  version!: number;
}

export class ListLegalDocumentsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(LegalDocumentStatus) status?: LegalDocumentStatus;
  @IsOptional() @IsString() category?: string;
}

export class DataSubjectRequestDto {
  @IsString() type!: string;
  @IsOptional() @IsString() @MaxLength(1000) reason?: string;
}
