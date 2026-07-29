import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  GatewayProvider,
  FinancialAccountStatus,
  LedgerDirection,
  LedgerEntryType,
  LedgerStatus,
  PaymentMethod,
  PayoutDestinationType,
  PayoutStatus,
  SubscriptionStatus,
} from '@prisma/client';

export class StatementQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsEnum(LedgerEntryType) type?: LedgerEntryType;
  @IsOptional() @IsEnum(LedgerStatus) status?: LedgerStatus;
  @IsOptional() @IsEnum(LedgerDirection) direction?: LedgerDirection;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sort:
    'oldest' | 'recent' | 'amount_asc' | 'amount_desc' = 'recent';
  @IsOptional() @Type(() => Number) @IsNumber() minAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxAmount?: number;
  @IsOptional() @IsEnum(GatewayProvider) gateway?: GatewayProvider;
  @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(100) limit = 25;
}
export class AdminAccountQueryDto extends StatementQueryDto {
  @IsOptional()
  @IsEnum(FinancialAccountStatus)
  accountStatus?: FinancialAccountStatus;
}
export class AdminPayoutQueryDto extends StatementQueryDto {
  @IsOptional() @IsEnum(PayoutStatus) payoutStatus?: PayoutStatus;
}
export class AdminSubscriptionQueryDto extends StatementQueryDto {
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;
}
export class CreatePayoutDto {
  @Type(() => Number) @IsNumber() @Min(1) amount!: number;
  @IsEnum(PayoutDestinationType) destinationType!: PayoutDestinationType;
  @IsString() @MinLength(3) holderName!: string;
  @IsString() @MinLength(5) taxId!: string;
  @IsOptional() @IsString() pixKeyType?: string;
  @IsOptional() @IsString() pixKey?: string;
  @IsOptional() @IsString() bank?: string;
  @IsOptional() @IsString() agency?: string;
  @IsOptional() @IsString() account?: string;
  @IsOptional() @IsString() accountType?: string;
  @IsOptional() @IsString() notes?: string;
}
export class RejectPayoutDto {
  @IsString() @MinLength(5) reason!: string;
}
export class CreateAdjustmentDto {
  @IsString() accountId!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
  @IsEnum(LedgerDirection) direction!: LedgerDirection;
  @IsString() @MinLength(5) reason!: string;
  @IsOptional() @IsString() notes?: string;
}
export class ReportQueryDto {
  @IsOptional() @IsString() format: 'json' | 'csv' = 'json';
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}
