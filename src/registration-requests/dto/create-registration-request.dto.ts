import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateRegistrationRequestDto {
  @ApiProperty({ example: 'پرواز سفر آژانس', description: 'نام آژانس' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  agencyName!: string;          // ← Added !

  @ApiProperty({ example: '1234567890', required: false, description: 'شماره ثبت/کد اقتصادی' })
  @IsString()
  @IsOptional()
  registrationNumber?: string;

  @ApiProperty({ example: 'علی رضایی', description: 'نام شخص تماس' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  contactName!: string;         // ← Added !

  @ApiProperty({ example: '09123456789', description: 'شماره تماس' })
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  contactPhone!: string;        // ← Added !

  @ApiProperty({ example: 'info@travelagency.com', description: 'ایمیل' })
  @IsEmail()
  contactEmail!: string;        // ← Added !

  @ApiProperty({ example: 'ما به خدمات ویژه برای پروازهای چارتر نیاز داریم...', required: false, description: 'پیام یا توضیحات اضافی' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;
}