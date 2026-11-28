import { IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class BuyerCouponQuoteDto {
  @IsString()
  @Matches(/\S/)
  campaignId!: string;

  @IsInt()
  @Min(1)
  @Max(100000)
  quantity!: number;

  @IsString()
  @Matches(/\S/, { message: 'Informe o código do cupom.' })
  couponCode!: string;
}
