import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsNumber, IsOptional, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTicketDto {
  @ApiProperty({ example: 'TK001', description: 'شماره بلیط یکتا' })
  @IsString()
  @MaxLength(50)
  ticketNumber!: string;

  @ApiProperty({ example: 'REF12345', required: false, description: 'شماره مرجع (اختیاری)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceNumber?: string;

  @ApiProperty({ example: 'علی رضایی', description: 'نام مسافر' })
  @IsString()
  @MaxLength(100)
  passengerName!: string;

  @ApiProperty({ example: '09123456789', description: 'شماره تماس مسافر' })
  @IsString()
  @MaxLength(15)
  passengerPhone!: string;

  @ApiProperty({ example: 'IRM123', description: 'شماره پرواز' })
  @IsString()
  @MaxLength(20)
  flightNumber!: string;

  @ApiProperty({ example: 'تهران (IKA)', description: 'مبدأ' })
  @IsString()
  @MaxLength(100)
  origin!: string;

  @ApiProperty({ example: 'مشهد (MHD)', description: 'مقصد' })
  @IsString()
  @MaxLength(100)
  destination!: string;

  @ApiProperty({ example: '2025-02-15T08:00:00Z', description: 'تاریخ و زمان پرواز' })
  @IsDateString()
  flightDate!: string;

  @ApiProperty({ example: 'اقتصادی', description: 'کلاس پرواز' })
  @IsString()
  @MaxLength(50)
  seatClass!: string;

  @ApiProperty({ example: 1250000, description: 'قیمت فروش (تومان)' })
  @IsNumber()
  @Min(0)
  price!: number;
}