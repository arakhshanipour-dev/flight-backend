import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength, MaxLength, IsEnum } from 'class-validator';
import { AgencyStatus } from '@prisma/client';

export class CreateAgencyDto {
  @ApiProperty({ example: 'آژانس هواپیمایی البرز', description: 'نام آژانس' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '1234567890', required: false, description: 'شماره ثبت/کد اقتصادی' })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiProperty({ example: '+982188776655', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'info@alborzagency.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'تهران، خیابان آزادی، پلاک ۱۲۳', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ enum: AgencyStatus, default: AgencyStatus.TRIAL, required: false })
  @IsEnum(AgencyStatus)
  @IsOptional()
  status?: AgencyStatus;

  @ApiProperty({ example: '2025-01-15T00:00:00Z', required: false, description: 'تاریخ انقضای دمو' })
  @IsOptional()
  trialExpiresAt?: Date;

  @ApiProperty({ example: 'علی رضایی', required: false, description: 'نام شخص تماس (مدیر کل)' })
  @IsString()
  @IsOptional()
  contactName?: string;
}