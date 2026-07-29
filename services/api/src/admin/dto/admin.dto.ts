import { Type } from 'class-transformer';
import {
  AdminPermission,
  AdminGatewayStatus,
  AdminTeamRole,
  CampaignCategory,
  CampaignStatus,
  ContentPageType,
  GatewayProvider,
  PaymentMethod,
  PaymentStatus,
  ReportStatus,
  SupportPriority,
  SupportStatus,
  UserRole,
  UserStatus,
  VerificationStatus,
  OrganizerDocumentStatus,
  OrganizerInternalNoteCategory,
  OrganizerRiskLevel,
  OrganizerPlan,
  PlatformFeeRuleType,
  WinnerStatus,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class AdminListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() sort?: string;
}
export class UserListDto extends AdminListDto {
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
}
export class UserActionDto {
  @IsEnum([
    'ACTIVATE',
    'DEACTIVATE',
    'SUSPEND',
    'BLOCK',
    'UNBLOCK',
    'REVOKE_SESSIONS',
    'FORCE_PASSWORD_RESET',
  ] as const)
  action!:
    | 'ACTIVATE'
    | 'DEACTIVATE'
    | 'SUSPEND'
    | 'BLOCK'
    | 'UNBLOCK'
    | 'REVOKE_SESSIONS'
    | 'FORCE_PASSWORD_RESET';
  @IsString() @MinLength(5) reason!: string;
}
export class UpdateAdminPermissionsDto {
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  permissions!: AdminPermission[];
  @IsString() @MinLength(5) reason!: string;
}
export class CampaignListDto extends AdminListDto {
  @IsOptional() @IsEnum(CampaignStatus) status?: CampaignStatus;
  @IsOptional() @IsEnum(CampaignCategory) category?: CampaignCategory;
  @IsOptional() @IsString() organizerId?: string;
  @IsOptional() @IsBoolean() blocked?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
}
export class CampaignActionDto {
  @IsEnum([
    'APPROVE',
    'REJECT',
    'REQUEST_CHANGES',
    'PAUSE',
    'REACTIVATE',
    'CANCEL',
    'BLOCK_PURCHASES',
    'UNBLOCK_PURCHASES',
    'BLOCK_PUBLICATION',
    'UNBLOCK_PUBLICATION',
    'FEATURE',
    'UNFEATURE',
  ] as const)
  action!: string;
  @IsString() @MinLength(5) reason!: string;
  @IsOptional() @IsString() note?: string;
}
export class PaymentListDto extends AdminListDto {
  @IsOptional() @IsEnum(GatewayProvider) provider?: GatewayProvider;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() buyerId?: string;
  @IsOptional() @IsString() organizerId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() minValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxValue?: number;
}
export class AdminNoteDto {
  @IsString() @MinLength(5) reason!: string;
  @IsOptional() @IsString() note?: string;
}
export class ResolveReportDto {
  @IsEnum(ReportStatus) status!: ReportStatus;
  @IsString() @MinLength(5) resolution!: string;
}
export class CreateBannerDto {
  @IsString() title!: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() linkUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsString() @MinLength(5) reason!: string;
}
export class CreateNoticeDto {
  @IsString() title!: string;
  @IsString() message!: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsString() @MinLength(5) reason!: string;
}
export class UpsertContentDto {
  @IsString() slug!: string;
  @IsString() title!: string;
  @IsEnum(ContentPageType) type!: ContentPageType;
  @IsString() content!: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  @IsString() @MinLength(5) reason!: string;
}
export class UpsertSettingDto {
  @IsObject() value!: Record<string, unknown>;
  @IsString() category!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsString() @MinLength(5) reason!: string;
}
export class SupportListDto extends AdminListDto {
  @IsOptional() @IsEnum(SupportStatus) status?: SupportStatus;
  @IsOptional() @IsEnum(SupportPriority) priority?: SupportPriority;
}
export class SupportActionDto {
  @IsEnum(SupportStatus) status!: SupportStatus;
  @IsOptional() @IsEnum(SupportPriority) priority?: SupportPriority;
  @IsOptional() @IsString() assignedAdminId?: string;
  @IsString() @MinLength(5) reason!: string;
}
export class SupportMessageDto {
  @IsString() @MinLength(1) message!: string;
  @IsOptional() @IsString() attachmentUrl?: string;
}
export class WinnerActionDto {
  @IsEnum(WinnerStatus) status!: WinnerStatus;
  @IsOptional() @IsBoolean() publicDisclosureAuthorized?: boolean;
  @IsString() @MinLength(5) reason!: string;
}
export class WinnerListDto extends AdminListDto {
  @IsOptional() @IsEnum(WinnerStatus) status?: WinnerStatus;
}
export class PlanDto {
  @IsString() code!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @Type(() => Number) @IsNumber() monthlyPrice!: number;
  @IsOptional() @Type(() => Number) @IsNumber() annualPrice?: number;
  @Type(() => Number) @IsNumber() platformFeeRate!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) campaignLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) ticketLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) teamMemberLimit?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) trialDays?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsString() @MinLength(5) reason!: string;
}

export class ApprovalListDto extends AdminListDto {
  @IsOptional() @IsEnum(VerificationStatus) status?: VerificationStatus;
  @IsOptional() @IsEnum(OrganizerRiskLevel) riskLevel?: OrganizerRiskLevel;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() assignedAdminId?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsEnum(OrganizerPlan) plan?: OrganizerPlan;
  @IsOptional() @IsString() personType?: 'PF' | 'PJ';
  @IsOptional() @IsString() documentation?: 'complete' | 'pending';
  @IsOptional()
  @IsEnum([
    'priority',
    'oldest',
    'recent',
    'risk_desc',
    'risk_asc',
    'documents_desc',
  ] as const)
  declare sort?:
    | 'priority'
    | 'oldest'
    | 'recent'
    | 'risk_desc'
    | 'risk_asc'
    | 'documents_desc';
}

export class OrganizerDecisionDto {
  @IsEnum(VerificationStatus) status!: VerificationStatus;
  @IsString() @MinLength(5) reason!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) requestedFields?: string[];
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requestedDocuments?: string[];
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsBoolean() canResubmit?: boolean;
  @IsOptional() @IsBoolean() blockCampaigns?: boolean;
  @IsOptional() @IsBoolean() blockSales?: boolean;
  @IsOptional() @IsBoolean() readOnlyAccess?: boolean;
  @IsOptional() @IsString() internalNote?: string;
  @IsOptional() @IsString() externalMessage?: string;
  @IsOptional() @IsString() category?: string;
}

export class OrganizerChecklistDto {
  @IsObject() checklist!: Record<string, boolean>;
}

export class DocumentDecisionDto {
  @IsEnum(OrganizerDocumentStatus) status!: OrganizerDocumentStatus;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() note?: string;
}

export class InternalNoteDto {
  @IsEnum(OrganizerInternalNoteCategory)
  category!: OrganizerInternalNoteCategory;
  @IsString() @MinLength(3) text!: string;
}

export class AdminGatewayDto {
  @IsEnum(GatewayProvider) provider!: GatewayProvider;
  @IsString() displayName!: string;
  @IsEnum(AdminGatewayStatus) status!: AdminGatewayStatus;
  @IsBoolean() sandboxEnabled!: boolean;
  @IsBoolean() productionEnabled!: boolean;
  @IsBoolean() splitAvailable!: boolean;
  @IsBoolean() planBillingAvailable!: boolean;
  @Type(() => Number) @IsInt() priority!: number;
  @Type(() => Number) @IsNumber() @Min(0) estimatedFeeRate!: number;
  @IsString() collectionModel!: string;
  @IsString() @MinLength(5) reason!: string;
}

export class AdminTeamDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsEnum(AdminTeamRole) adminTeamRole!: AdminTeamRole;
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  permissions?: AdminPermission[];
  @IsOptional() @IsString() @MaxLength(500) message?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  validityDays?: number;
  @IsString() @MinLength(5) reason!: string;
}

export class AcceptAdminInvitationDto {
  @IsString() @MinLength(2) name!: string;
  @IsString() @MinLength(12) password!: string;
  @IsString() @MinLength(12) passwordConfirmation!: string;
}

export class AdminMemberActionDto {
  @IsEnum([
    'CHANGE_ROLE',
    'DEACTIVATE',
    'REACTIVATE',
    'REVOKE_SESSIONS',
  ] as const)
  action!: 'CHANGE_ROLE' | 'DEACTIVATE' | 'REACTIVATE' | 'REVOKE_SESSIONS';
  @IsOptional() @IsEnum(AdminTeamRole) adminTeamRole?: AdminTeamRole;
  @IsOptional() @IsString() @MinLength(5) reason?: string;
}

export class OrganizerFeeDto {
  @IsEnum(PlatformFeeRuleType) ruleType!: PlatformFeeRuleType;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) rate!: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsString() @MinLength(5) reason!: string;
}
