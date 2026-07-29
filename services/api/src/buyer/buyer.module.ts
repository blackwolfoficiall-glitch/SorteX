import { Module } from '@nestjs/common';
import { BuyerController } from './buyer.controller';
import { BuyerService } from './buyer.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [PrismaModule, CrmModule],
  controllers: [BuyerController],
  providers: [BuyerService],
})
export class BuyerModule {}
