// src/agencies/dto/create-agency.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsEnum, IsDateString } from 'class-validator';
import { AgencyStatus } from '@prisma/client';

export class CreateAgencyDto {
  @ApiProperty({ example: 'آژانس سفر پلاس' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false, example: 'REG-14031234' })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiProperty({ required: false, example: '021-88551234' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false, example: 'info@travelplus.ir' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, example: 'تهران، خیابان ولیعصر، پلاک ۱۲۳۴' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false, example: 'TP001', description: 'کد IATA آژانس' })
  @IsString()
  @IsOptional()
  iataCode?: string;  // 🔥 جدید

  @ApiProperty({ enum: AgencyStatus, default: AgencyStatus.TRIAL })
  @IsEnum(AgencyStatus)
  @IsOptional()
  status?: AgencyStatus;

  @ApiProperty({ required: false, example: '2025-12-31T23:59:59Z' })
  @IsDateString()
  @IsOptional()
  trialExpiresAt?: string;

  @ApiProperty({ required: false, example: 'علی رضایی', description: 'نام مدیر کل' })
  @IsString()
  @IsOptional()
  contactName?: string;
}