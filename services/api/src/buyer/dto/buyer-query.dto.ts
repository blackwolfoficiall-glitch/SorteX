import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BuyerCampaignQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional()
  @IsIn(['LIVE', 'UPCOMING', 'ENDING', 'MOST_SOLD', 'LOWEST_PRICE'])
  filter?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 12;
}
