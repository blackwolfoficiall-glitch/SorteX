import {
  Controller,
  Get,
  Module,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { states, citiesByState } from './locations';

@Public()
@Controller('locations')
class LocationsController {
  @Get('states') states() {
    return states;
  }
  @Get('states/:uf/cities') cities(@Param('uf') uf: string) {
    const cities = citiesByState[uf.toUpperCase()];
    if (!cities) throw new BadRequestException('UF inválida.');
    return cities;
  }
}

@Module({ controllers: [LocationsController] })
export class LocationsModule {}
