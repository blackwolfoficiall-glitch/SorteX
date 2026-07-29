import { IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class BuyerProfileDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @Length(8, 30) phone?: string;
  @IsOptional() @IsString() @Length(2, 100) city?: string;
  @IsOptional() @IsString() @Length(2, 2) state?: string;
}

export class CreateSupportTicketDto {
  @IsString() category!: string;
  @IsString() @Length(3, 160) subject!: string;
  @IsString() @Length(10, 5000) description!: string;
}

export class SupportMessageDto {
  @IsString() @Length(1, 5000) message!: string;
  @IsOptional() @IsUrl() attachmentUrl?: string;
}
