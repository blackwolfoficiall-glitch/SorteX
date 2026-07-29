import { PaymentStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListPaymentsDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;
}
