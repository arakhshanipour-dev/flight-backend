import { PartialType } from '@nestjs/swagger';
import { CreateAirportDto } from './create-airport.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { AirportType } from '@prisma/client';

export class UpdateAirportDto extends PartialType(CreateAirportDto) {
  @ApiProperty({ enum: AirportType, required: false })
  @IsEnum(AirportType)
  @IsOptional()
  type?: AirportType;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}