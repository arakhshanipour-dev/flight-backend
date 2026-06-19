import { PartialType } from '@nestjs/swagger';
import { CreateAirlineDto } from './create-airline.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAirlineDto extends PartialType(CreateAirlineDto) {
  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}