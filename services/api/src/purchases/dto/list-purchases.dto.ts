import { PurchaseStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListPurchasesDto {
  @IsOptional()
  @IsEnum(PurchaseStatus)
  status?: PurchaseStatus;
}
