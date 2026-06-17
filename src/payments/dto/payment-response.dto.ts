// src/payments/dto/payment-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus, PaymentMethod } from '@prisma/client';

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  agencyId!: string;

  @ApiProperty({ nullable: true })
  bankCardId!: string | null;

  @ApiProperty()
  bankName!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @ApiProperty({ nullable: true })
  trackingCode!: string | null;

  @ApiProperty({ nullable: true })
  receiptNumber!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ nullable: true })
  paidAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ nullable: true })
  remainingAmount?: number | null;
}