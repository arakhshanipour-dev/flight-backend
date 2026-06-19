import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateAirlineDto {
  @ApiProperty({ example: 'IR', description: 'کد IATA شرکت (۲ حرفی)' })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  @Matches(/^[A-Z]{2}$/, { message: 'IATA code must be 2 uppercase letters' })
  iataCode!: string;

  @ApiProperty({ example: 'IRA', required: false, description: 'کد ICAO شرکت (۳ حرفی)' })
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/, { message: 'ICAO code must be 3 uppercase letters' })
  icaoCode?: string;

  @ApiProperty({ example: 'هواپیمایی جمهوری اسلامی ایران (هما)', description: 'نام شرکت' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'IRAN', default: 'IRAN', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  country?: string;

  @ApiProperty({ default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}