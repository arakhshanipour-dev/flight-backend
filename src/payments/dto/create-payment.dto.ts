// src/payments/dto/create-payment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsString, IsOptional, Min, IsPositive, IsEnum, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ example: 'invoice-uuid', description: 'شناسه فاکتور' })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ example: 1250000, description: 'مبلغ پرداختی' })
  @IsNumber()
  @IsPositive()
  @Min(0)
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ enum: PaymentMethod, description: 'روش پرداخت', default: PaymentMethod.CREDIT })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiProperty({ example: 'TRK123456789', required: false, description: 'کد رهگیری پرداخت (برای روش‌های غیرنقدی اجباری)' })
  @IsString()
  @IsOptional()
  trackingCode?: string;

  @ApiProperty({ example: 'RCP-1403-0001', required: false, description: 'شماره رسید نقدی' })
  @IsString()
  @IsOptional()
  receiptNumber?: string;

  @ApiProperty({ required: false, description: 'توضیحات اضافی' })
  @IsString()
  @IsOptional()
  notes?: string;
}