import { UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(8)
  passwordConfirmation: string;

  @IsBoolean()
  @Equals(true, { message: 'Aceite os Termos de Uso para continuar.' })
  termsAccepted: boolean;

  @IsBoolean()
  @Equals(true, { message: 'Aceite a Política de Privacidade para continuar.' })
  privacyAccepted: boolean;

  @IsBoolean()
  @Equals(true, { message: 'Autorize o tratamento de dados para continuar.' })
  dataProcessingAccepted: boolean;

  @IsString()
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^\d{10,13}$/, { message: 'Telefone inválido.' })
  phone: string;

  @IsString()
  @Transform(({ value }) => String(value).replace(/\D/g, ''))
  @Matches(/^\d{11}$/, { message: 'CPF inválido.' })
  cpf: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value ? String(value).replace(/\D/g, '') : undefined,
  )
  @Matches(/^\d{14}$/, { message: 'CNPJ inválido.' })
  cnpj?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value ? String(value).trim().toUpperCase() : undefined,
  )
  @Matches(/^[A-Z]{2}$/, {
    message: 'Estado deve conter a sigla com 2 letras.',
  })
  state?: string;
}
