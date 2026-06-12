import { Module } from '@nestjs/common';
import { AgencyUsersService } from './agency-users.service';
import { AgencyUsersController } from './agency-users.controller';

@Module({
  controllers: [AgencyUsersController],
  providers: [AgencyUsersService],
  exports: [AgencyUsersService],
})
export class AgencyUsersModule {}