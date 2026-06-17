// src/tickets/dto/create-ticket.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsDateString, 
  IsNumber, 
  IsOptional, 
  Min, 
  MaxLength, 
  IsUUID,
  IsEnum,
  MinLength,
} from 'class-validator';
import { TicketStatus, AgeType, Gender, SalesType, TicketTransactionType } from '@prisma/client';

export class CreateTicketDto {
  // ===== اطلاعات اصلی =====
  @ApiProperty({ example: '109184430', description: 'شماره بلیط یکتا' })
  @IsString()
  @MaxLength(50)
  ticketNumber!: string;

  @ApiProperty({ example: '13141534', required: false, description: 'شماره مرجع (اختیاری)' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceNumber?: string;

  // ===== اطلاعات مسافر =====
  @ApiProperty({ example: 'HOSSEIN SAFARI', description: 'نام مسافر' })
  @IsString()
  @MaxLength(100)
  passengerName!: string;

  @ApiProperty({ example: '09156667834', description: 'شماره تماس مسافر' })
  @IsString()
  @MaxLength(15)
  passengerPhone!: string;

  @ApiProperty({ example: 'Mr', required: false, description: 'عنوان (Mr, Mrs, Ms, Dr)' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  passengerTitle?: string;

  @ApiProperty({ example: 'IRN', required: false, description: 'ملیت' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  nationality?: string;

  @ApiProperty({ example: '0880300779', required: false, description: 'کد ملی' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  nationalCode?: string;

  @ApiProperty({ example: 'F100752516', required: false, description: 'شماره پاسپورت' })
  @IsString()
  @IsOptional()
  @MaxLength(30)
  passportNumber?: string;

  @ApiProperty({ example: '09157930609', required: false, description: 'تلفن رزرو' })
  @IsString()
  @IsOptional()
  @MaxLength(15)
  reservationPhone?: string;

  @ApiProperty({ enum: AgeType, required: false, description: 'نوع سنی' })
  @IsEnum(AgeType)
  @IsOptional()
  ageType?: AgeType;

  @ApiProperty({ enum: Gender, required: false, description: 'جنسیت' })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  // ===== اطلاعات پرواز =====
  @ApiProperty({ example: '7310', description: 'شماره پرواز' })
  @IsString()
  @MaxLength(20)
  flightNumber!: string;

  @ApiProperty({ example: '2025-10-07T06:45:00Z', description: 'تاریخ و زمان پرواز' })
  @IsDateString()
  flightDate!: string;

  @ApiProperty({ example: '2025-10-07T06:45:00Z', required: false, description: 'تاریخ حرکت' })
  @IsDateString()
  @IsOptional()
  departureDate?: string;

  @ApiProperty({ example: 'E', description: 'کلاس پرواز (E, Y, Q, A, L)' })
  @IsString()
  @MaxLength(10)
  seatClass!: string;

  @ApiProperty({ example: 'MHD-NJF', required: false, description: 'مسیر کامل' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  route?: string;

  @ApiProperty({ example: '1', required: false, description: 'بخش/قطعه' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  segment?: string;

  // ===== اطلاعات رزرو =====
  @ApiProperty({ example: 'IKEKIN', required: false, description: 'کد رزرو (PNR) - 6 رقمی' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  pnr?: string;

  @ApiProperty({ example: 'TOUR123', required: false, description: 'کد تور' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  tourCode?: string;

  @ApiProperty({ example: 'sepehran-web', required: false, description: 'منبع فروش' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  source?: string;

  @ApiProperty({ example: 'هواپیمایی سپهران', required: false, description: 'نام شرکت هواپیمایی' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  customerAirline?: string;

  @ApiProperty({ example: 'آژانس کویران بیرجند', required: false, description: 'امضا/نشان' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  sign?: string;

  // ===== اطلاعات مالی =====
  @ApiProperty({ example: 'IRR', default: 'IRR', description: 'واحد ارز' })
  @IsString()
  @IsOptional()
  @MaxLength(10)
  currencyCode?: string;

  @ApiProperty({ example: 24748863, default: 0, description: 'قیمت پایه' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  fare?: number;

  @ApiProperty({ example: 0, default: 0, description: 'هزینه خدمات' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  fee?: number;

  @ApiProperty({ example: 9113740, default: 0, description: 'مالیات' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  tax?: number;

  @ApiProperty({ example: 91137397, default: 0, description: 'مالیات بر ارزش افزوده' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  vat?: number;

  @ApiProperty({ example: 0, default: 0, description: 'خدمات جانبی' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  ancillary?: number;

  @ApiProperty({ example: 0, default: 0, description: 'تخفیف' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  discount?: number;

  @ApiProperty({ example: 125000000, description: 'قیمت نهایی' })
  @IsNumber()
  @Min(0)
  price!: number;

  // ===== کارمزد و مارک‌آپ =====
  @ApiProperty({ example: 6, default: 0, description: 'درصد کارمزد' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  commission?: number;

  @ApiProperty({ example: 5468244, default: 0, description: 'مبلغ کارمزد' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  commissionAmount?: number;

  @ApiProperty({ example: 0, default: 0, description: 'سود/مارک‌آپ' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  markup?: number;

  // ===== فروش و حسابداری =====
  @ApiProperty({ enum: SalesType, default: SalesType.STANDARD, description: 'نوع فروش' })
  @IsEnum(SalesType)
  @IsOptional()
  salesType?: SalesType;

  @ApiProperty({ enum: TicketTransactionType, required: false, description: 'نوع تراکنش' })
  @IsEnum(TicketTransactionType)
  @IsOptional()
  transactionType?: TicketTransactionType;

  @ApiProperty({ example: '2025-10-01T13:30:22Z', required: false, description: 'تاریخ تراکنش' })
  @IsDateString()
  @IsOptional()
  transactionDate?: string;

  @ApiProperty({ example: 'REF-000001', required: false, description: 'شماره مرجع/سند' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  referenceNo?: string;

  @ApiProperty({ example: 0, required: false, description: 'مبلغ بدهی' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  debit?: number;

  @ApiProperty({ example: 0, required: false, description: 'مبلغ بستانکاری' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  credit?: number;

  @ApiProperty({ example: 0, required: false, description: 'مانده جاری' })
  @IsNumber()
  @IsOptional()
  runningBalance?: number;

  @ApiProperty({ example: 0, required: false, description: 'مبلغ کل برگشتی' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  totalRefund?: number;

  // ===== فروشنده =====
  @ApiProperty({ example: 'آژانس کویران بیرجند', required: false, description: 'نام فروشنده' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  agentName?: string;

  @ApiProperty({ example: 'XBJ17095', required: false, description: 'کد فروشنده' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  agentCode?: string;

  @ApiProperty({ example: '43013', required: false, description: 'کد IATA فروشنده' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  agentIATACode?: string;

  // ===== فرودگاه‌ها (اختیاری) =====
  @ApiProperty({ example: 'airport-uuid', required: false, description: 'شناسه فرودگاه مبدأ' })
  @IsUUID()
  @IsOptional()
  originAirportId?: string;

  @ApiProperty({ example: 'airport-uuid', required: false, description: 'شناسه فرودگاه مقصد' })
  @IsUUID()
  @IsOptional()
  destinationAirportId?: string;

  // ===== وضعیت =====
  @ApiProperty({ enum: TicketStatus, required: false, default: TicketStatus.DRAFT })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;
}