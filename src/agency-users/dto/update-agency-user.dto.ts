import { PartialType } from '@nestjs/swagger';
import { CreateAgencyUserDto } from './create-agency-user.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { UserStatus } from '@prisma/client';

export class UpdateAgencyUserDto extends PartialType(CreateAgencyUserDto) {
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;
}