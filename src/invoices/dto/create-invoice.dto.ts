import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional, IsEnum, IsInt, Min, Max, ArrayMinSize, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @ApiProperty({ 
    description: 'آرایه شناسه بلیط‌ها (حداقل یک بلیط)', 
    example: ['ticket-uuid-1', 'ticket-uuid-2'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ticketIds!: string[];

  @ApiProperty({ example: 'سازمان هواپیمایی کشوری', required: false, description: 'نام مشتری (اگر شخصی است نام کامل، اگر ارگان است نام ارگان)' })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiProperty({ example: '02112345678', required: false, description: 'شماره تماس مشتری' })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty({ example: 'organization-uuid', required: false, description: 'اگر مشتری ارگان است، شناسه ارگان' })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({ example: 'bank-card-uuid', description: 'شناسه کارت بانکی مقصد' })
  @IsUUID()
  bankCardId!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 3, description: 'طرح فاکتور (۱، ۲، یا ۳)' })
  @IsInt()
  @Min(1)
  @Max(3)
  templateStyle!: number;
}