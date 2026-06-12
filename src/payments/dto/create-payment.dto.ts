import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, IsString, IsOptional, Min, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentDto {
  @ApiProperty({ example: 'invoice-uuid', description: 'شناسه فاکتور' })
  @IsUUID()
  invoiceId!: string;

  @ApiProperty({ example: 1250000, description: 'مبلغ پرداختی (باید برابر با مبلغ فاکتور باشد)' })
  @IsNumber()
  @IsPositive()
  @Min(0)
  @Type(() => Number)
  amount!: number;

  @ApiProperty({ example: 'TRK123456789', required: false, description: 'کد رهگیری پرداخت' })
  @IsString()
  @IsOptional()
  trackingCode?: string;
}