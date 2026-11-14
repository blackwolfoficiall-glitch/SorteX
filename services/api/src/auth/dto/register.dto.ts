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
  MaxLength,
  IsIn,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { normalizeDocument } from '../../common/brazilian-documents';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class RegisterDto {
  @IsString() @Transform(trim) @MinLength(2) @MaxLength(120) name: string;
  @IsEmail() @Transform(trim) email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() @MinLength(8) passwordConfirmation: string;
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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  )
  @Matches(/^\d{10,13}$/, { message: 'Telefone inválido.' })
  phone: string;
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeDocument(value) : value,
  )
  @Matches(/^\d{11}$/, { message: 'CPF inválido.' })
  cpf: string;
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeDocument(value) : value,
  )
  @Matches(/^[A-Z0-9]{12}\d{2}$/, { message: 'CNPJ inválido.' })
  cnpj?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsString() @MinLength(2) @MaxLength(120) city?: string;
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/, {
    message: 'Estado deve conter a sigla com 2 letras.',
  })
  state?: string;
  @IsString() @Matches(/^\d{7}$/) municipalityCode?: string;
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/[\s-]/g, '') : value,
  )
  @Matches(/^\d{8}$/, { message: 'CEP deve conter 8 dígitos.' })
  postalCode?: string;
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(120)
  neighborhood?: string;
  @IsString() @Transform(trim) @MinLength(3) @MaxLength(200) address?: string;
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(30)
  addressNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) addressComplement?: string;
  @ValidateIf((data: RegisterDto) => data.role === UserRole.ORGANIZER)
  @IsIn(['PF', 'PJ'])
  personType?: 'PF' | 'PJ';
  @IsOptional() @IsString() @MaxLength(200) organizationName?: string;
  @IsOptional() @IsString() @MaxLength(120) fantasyName?: string;
  @IsOptional() @IsDateString({ strict: true }) birthDate?: string;
}
