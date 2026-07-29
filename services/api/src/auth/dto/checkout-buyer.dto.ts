import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class PhoneLookupDto {
  @IsString()
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^(?:55)?\d{10,11}$/, { message: 'Telefone brasileiro inválido.' })
  phone: string;
}

export class CompleteCheckoutBuyerDto {
  @IsString()
  paymentId: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  city: string;

  @IsString()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @IsIn([
    'AC',
    'AL',
    'AP',
    'AM',
    'BA',
    'CE',
    'DF',
    'ES',
    'GO',
    'MA',
    'MT',
    'MS',
    'MG',
    'PA',
    'PB',
    'PR',
    'PE',
    'PI',
    'RJ',
    'RN',
    'RS',
    'RO',
    'RR',
    'SC',
    'SP',
    'SE',
    'TO',
  ])
  state: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve possuir pelo menos 8 caracteres.' })
  password: string;

  @IsString()
  @MinLength(8)
  passwordConfirmation: string;

  @IsBoolean()
  @Equals(true, { message: 'Aceite os termos para continuar.' })
  termsAccepted: boolean;
}

export class MiniBuyerDto extends PhoneLookupDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'A senha deve possuir pelo menos 8 caracteres.' })
  password: string;

  @IsString()
  @MinLength(8)
  passwordConfirmation: string;

  @IsBoolean()
  @Equals(true, { message: 'Aceite os termos para continuar.' })
  termsAccepted: boolean;
}
