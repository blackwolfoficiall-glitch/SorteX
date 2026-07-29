import { Equals, IsBoolean, IsString } from 'class-validator';

export class CreatePixPaymentDto {
  @IsString()
  purchaseId!: string;

  @IsBoolean()
  @Equals(true)
  acceptedTerms!: boolean;
}
