import { VerificationStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListOrganizersDto {
  @IsOptional()
  @IsEnum(VerificationStatus)
  status?: VerificationStatus;
}
