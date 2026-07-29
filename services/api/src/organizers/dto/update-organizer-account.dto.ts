import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
export class UpdateOrganizerAccountDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(8) phone?: string;
  @IsOptional() @IsString() cpf?: string;
  @IsOptional() @IsString() cnpj?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() @Length(2, 2) state?: string;
  @IsOptional() @IsString() currentPassword?: string;
  @IsOptional() @IsString() @MinLength(8) newPassword?: string;
}
