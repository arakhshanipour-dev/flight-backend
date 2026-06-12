import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateBankCardDto {
  @ApiProperty({ example: '6037991234567890', description: 'شماره کارت بانکی (۱۶ رقم)' })
  @IsString()
  @MinLength(16)
  @MaxLength(16)
  @Matches(/^[0-9]{16}$/, { message: 'Card number must be 16 digits' })
  cardNumber!: string;

  @ApiProperty({ example: 'بانک ملی', description: 'نام بانک' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  bankName!: string;

  @ApiProperty({ example: 'آژانس هواپیمایی البرز', description: 'نام صاحب حساب' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  accountHolder!: string;

  @ApiProperty({ example: 'IR570540102180020123456789', required: false, description: 'شماره شبا (اختیاری)' })
  @IsString()
  @IsOptional()
  @MaxLength(34)
  sheba?: string;

  @ApiProperty({ example: true, required: false, description: 'آیا این کارت پیش‌فرض باشد؟' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}