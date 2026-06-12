import { PartialType } from '@nestjs/swagger';
import { CreateBankCardDto } from './create-bank-card.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsEnum } from 'class-validator';
import { BankCardStatus } from '@prisma/client';

export class UpdateBankCardDto extends PartialType(CreateBankCardDto) {
  @ApiProperty({ enum: BankCardStatus, required: false, description: 'وضعیت کارت' })
  @IsEnum(BankCardStatus)
  @IsOptional()
  status?: BankCardStatus;

  @ApiProperty({ required: false, description: 'آیا این کارت پیش‌فرض باشد؟' })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}