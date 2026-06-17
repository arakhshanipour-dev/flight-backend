// src/invoices/dto/invoice-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus, PaymentStatus, PaymentMethod, TicketStatus } from '@prisma/client';

// ============ DTO برای بلیط‌های داخل فاکتور ============
class TicketInInvoiceDto {
  @ApiProperty({ description: 'شناسه بلیط' })
  id!: string;

  @ApiProperty({ description: 'شماره بلیط' })
  ticketNumber!: string;

  @ApiProperty({ description: 'نام مسافر' })
  passengerName!: string;

  @ApiProperty({ description: 'شماره تماس مسافر' })
  passengerPhone!: string;

  @ApiProperty({ description: 'شماره پرواز' })
  flightNumber!: string;

  @ApiProperty({ description: 'مسیر', nullable: true })  // 🔥 اصلاح: به جای origin و destination
  route!: string | null;

  @ApiProperty({ description: 'تاریخ پرواز' })
  flightDate!: Date;

  @ApiProperty({ description: 'کلاس پرواز' })
  seatClass!: string;

  @ApiProperty({ description: 'قیمت' })
  price!: number;

  @ApiProperty({ enum: TicketStatus })
  status!: TicketStatus;
}

// ============ DTO برای کارت بانکی داخل فاکتور ============
class BankCardInInvoiceDto {
  @ApiProperty({ description: 'شناسه کارت بانکی' })
  id!: string;

  @ApiProperty({ description: 'نام بانک' })
  bankName!: string;

  @ApiProperty({ description: 'صاحب حساب' })
  accountHolder!: string;

  @ApiProperty({ description: 'شماره کارت ماسک شده', example: '****-****-****-1234' })
  maskedCardNumber!: string;
}

// ============ DTO برای پرداخت‌های داخل فاکتور ============
class PaymentInInvoiceDto {
  @ApiProperty({ description: 'شناسه پرداخت' })
  id!: string;

  @ApiProperty({ description: 'مبلغ پرداخت شده' })
  amount!: number;

  @ApiProperty({ enum: PaymentStatus, description: 'وضعیت پرداخت' })
  status!: PaymentStatus;

  @ApiProperty({ enum: PaymentMethod, description: 'روش پرداخت' })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ description: 'کد رهگیری', nullable: true })
  trackingCode!: string | null;

  @ApiProperty({ description: 'شماره رسید نقدی', nullable: true })
  receiptNumber!: string | null;

  @ApiProperty({ description: 'تاریخ پرداخت', nullable: true })
  paidAt!: Date | null;
}

// ============ DTO اصلی پاسخ فاکتور ============
export class InvoiceResponseDto {
  @ApiProperty({ description: 'شناسه فاکتور' })
  id!: string;

  @ApiProperty({ description: 'شماره فاکتور یکتا' })
  invoiceNumber!: string;

  @ApiProperty({ description: 'نام آژانس' })
  agencyName!: string;

  @ApiProperty({ description: 'نام مشتری' })
  customerName!: string;

  @ApiProperty({ description: 'شماره تماس مشتری', nullable: true })
  customerPhone!: string | null;

  @ApiProperty({ description: 'شناسه سازمان (اگر مشتری سازمانی است)', nullable: true })
  organizationId!: string | null;

  @ApiProperty({ description: 'طرح فاکتور (۱، ۲، یا ۳)', minimum: 1, maximum: 3 })
  templateStyle!: number;

  @ApiProperty({ description: 'جمع قیمت بلیط‌ها (بدون مالیات)' })
  subtotal!: number;

  @ApiProperty({ description: 'مبلغ کل فاکتور' })
  total!: number;

  @ApiProperty({ enum: InvoiceStatus, description: 'وضعیت فاکتور' })
  status!: InvoiceStatus;

  @ApiProperty({ description: 'تاریخ صدور فاکتور' })
  issuedAt!: Date;

  @ApiProperty({ description: 'تاریخ تکمیل پرداخت', nullable: true })
  paidAt!: Date | null;

  @ApiProperty({ description: 'تاریخ ایجاد' })
  createdAt!: Date;

  @ApiProperty({ description: 'تاریخ بروزرسانی' })
  updatedAt!: Date;

  @ApiProperty({ type: [TicketInInvoiceDto], description: 'لیست بلیط‌های فاکتور' })
  tickets!: TicketInInvoiceDto[];

  @ApiProperty({ type: BankCardInInvoiceDto, description: 'اطلاعات کارت بانکی مقصد' })
  bankCard!: BankCardInInvoiceDto;

  @ApiProperty({ type: [PaymentInInvoiceDto], description: 'لیست پرداخت‌های انجام شده برای این فاکتور' })
  payments!: PaymentInInvoiceDto[];

  // ============ فیلدهای اختیاری ============
  @ApiProperty({ description: 'شماره ثبت آژانس', nullable: true, required: false })
  agencyRegistrationNumber?: string | null;

  @ApiProperty({ description: 'تلفن آژانس', nullable: true, required: false })
  agencyPhone?: string | null;

  @ApiProperty({ description: 'آدرس آژانس', nullable: true, required: false })
  agencyAddress?: string | null;

  @ApiProperty({ description: 'مبلغ پرداخت شده (جمع کل پرداخت‌ها)', required: false })
  paidAmount?: number;

  @ApiProperty({ description: 'مبلغ باقی‌مانده', required: false })
  remainingAmount?: number;
}