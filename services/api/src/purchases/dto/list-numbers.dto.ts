import { TicketStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListNumbersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rangeStart?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rangeEnd?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  search?: number;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
