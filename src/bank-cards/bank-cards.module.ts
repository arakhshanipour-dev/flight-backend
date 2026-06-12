import { Module } from '@nestjs/common';
import { BankCardsService } from './bank-cards.service';
import { BankCardsController } from './bank-cards.controller';

@Module({
  controllers: [BankCardsController],
  providers: [BankCardsService],
  exports: [BankCardsService],
})
export class BankCardsModule {}