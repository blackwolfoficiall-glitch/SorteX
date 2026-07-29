import {
  Equals,
  IsBoolean,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCardPaymentDto {
  @IsString()
  purchaseId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(256)
  cardToken!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(40)
  paymentMethodId!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  installments!: number;

  @IsBoolean()
  @Equals(true)
  acceptedTerms!: boolean;
}
