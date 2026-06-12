import { PartialType } from '@nestjs/swagger';
import { CreateAgencyDto } from './create-agency.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { AgencyStatus } from '@prisma/client';

export class UpdateAgencyDto extends PartialType(CreateAgencyDto) {
  @IsEnum(AgencyStatus)
  @IsOptional()
  status?: AgencyStatus;
}