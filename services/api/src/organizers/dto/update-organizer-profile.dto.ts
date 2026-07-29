import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class UpdateOrganizerProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(11)
  cpf?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  phone?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  organizationName?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  postalCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  address?: string;

  @IsOptional()
  @IsString()
  addressNumber?: string;

  @IsOptional()
  @IsString()
  addressComplement?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  municipalityCode?: string;

  @IsOptional()
  @IsString()
  addressReference?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  state?: string;
}
