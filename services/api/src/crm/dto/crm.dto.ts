import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  AutomationActionType,
  AutomationAudienceType,
  AutomationTriggerType,
  CrmChannel,
  CrmContactStatus,
  CrmTaskPriority,
  NotificationCategory,
  SegmentType,
} from '@prisma/client';
export class ContactQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(CrmContactStatus) status?: CrmContactStatus;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() cityMissing?: boolean;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() tagId?: string;
  @IsOptional() @IsString() order?: 'recent' | 'spent';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @Type(() => Number) @IsNumber() minSpent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxSpent?: number;
}
export class CreateTagDto {
  @IsString() name!: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() description?: string;
}
export class CreateNoteDto {
  @IsString() content!: string;
}
export class CreateSegmentDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(SegmentType) type!: SegmentType;
  @IsObject() rules!: Record<string, unknown>;
  @IsOptional() @IsBoolean() isDynamic?: boolean;
}
export class CreateTaskDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsEnum(CrmTaskPriority) priority?: CrmTaskPriority;
  @IsOptional() @IsString() dueAt?: string;
  @IsOptional() @IsString() assignedUserId?: string;
}
export class CreateAutomationDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(AutomationTriggerType) triggerType!: AutomationTriggerType;
  @IsObject() triggerConfig!: Record<string, unknown>;
  @IsOptional()
  @IsEnum(AutomationAudienceType)
  audienceType?: AutomationAudienceType;
  @IsObject() audienceConfig!: Record<string, unknown>;
  @IsEnum(AutomationActionType) actionType!: AutomationActionType;
  @IsObject() actionConfig!: Record<string, unknown>;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) delayMinutes?: number;
}
export class CreateTemplateDto {
  @IsString() name!: string;
  @IsEnum(CrmChannel) channel!: CrmChannel;
  @IsEnum(NotificationCategory) category!: NotificationCategory;
  @IsOptional() @IsString() subject?: string;
  @IsString() content!: string;
  @IsOptional() @IsObject() variables?: Record<string, unknown>;
}

export class CreateCommunicationDto {
  @IsEnum(CrmChannel) channel!: CrmChannel;
  @IsString() audienceType!:
    'CONTACT' | 'SEGMENT' | 'CAMPAIGN' | 'ABANDONED' | 'MANUAL';
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() segmentId?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) contactIds?: string[];
  @IsOptional() @IsString() templateId?: string;
  @IsOptional() @IsString() subject?: string;
  @IsString() content!: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsBoolean() draft?: boolean;
}
