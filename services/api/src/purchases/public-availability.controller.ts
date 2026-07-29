import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { ListNumbersDto } from './dto/list-numbers.dto';
import { PurchasesService } from './purchases.service';

@Controller('public/campaigns')
@Public()
export class PublicAvailabilityController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get(':slug/availability')
  availability(@Param('slug') slug: string) {
    return this.purchases.availability(slug);
  }

  @Get(':slug/numbers')
  numbers(@Param('slug') slug: string, @Query() query: ListNumbersDto) {
    return this.purchases.listNumbers(slug, query);
  }

  @Get(':slug/promotions')
  promotions(@Param('slug') slug: string) {
    return this.purchases.promotions(slug);
  }
}
