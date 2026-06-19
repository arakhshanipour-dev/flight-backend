import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean, MaxLength, MinLength,Matches } from 'class-validator';
import { AirportType } from '@prisma/client';

export class CreateAirportDto {
  @ApiProperty({ example: 'THR', description: 'کد IATA فرودگاه (۳ حرفی)' })
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/, { message: 'IATA code must be 3 uppercase letters' })
  iataCode!: string;

  @ApiProperty({ example: 'OIII', required: false, description: 'کد ICAO فرودگاه (۴ حرفی)' })
  @IsString()
  @IsOptional()
  @MinLength(4)
  @MaxLength(4)
  @Matches(/^[A-Z]{4}$/, { message: 'ICAO code must be 4 uppercase letters' })
  icaoCode?: string;

  @ApiProperty({ example: 'مهرآباد', description: 'نام فرودگاه' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'تهران', description: 'شهر' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  city!: string;

  @ApiProperty({ example: 'تهران', description: 'استان' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  province!: string;

  @ApiProperty({ example: 'IRAN', default: 'IRAN', description: 'کشور' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  country?: string;

  @ApiProperty({ example: 'Asia/Tehran', default: 'Asia/Tehran', required: false })
  @IsString()
  @IsOptional()
  timezone?: string;

  @ApiProperty({ enum: AirportType, default: AirportType.DOMESTIC })
  @IsEnum(AirportType)
  @IsOptional()
  type?: AirportType;

  @ApiProperty({ default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}