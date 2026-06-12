import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PlansModule], // اضافه کردن PlansModule
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}