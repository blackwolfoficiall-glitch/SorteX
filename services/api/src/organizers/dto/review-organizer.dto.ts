import { VerificationStatus } from '@prisma/client';
import { IsIn, IsString, MinLength } from 'class-validator';

export class ReviewOrganizerDto {
  @IsIn([VerificationStatus.VERIFIED, VerificationStatus.REJECTED])
  status: VerificationStatus;

  @IsString()
  @MinLength(5)
  reason: string;
}
