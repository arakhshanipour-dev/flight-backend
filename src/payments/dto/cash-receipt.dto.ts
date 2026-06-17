// src/payments/dto/cash-receipt.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CashReceiptDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  paymentId!: string;

  @ApiProperty()
  receiptNumber!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty({ nullable: true })
  customerPhone!: string | null;

  @ApiProperty({ type: [String] })
  ticketNumbers!: string[];

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  paidAmount!: number;

  @ApiProperty()
  remainingAmount!: number;

  @ApiProperty()
  paymentDate!: Date;

  @ApiProperty({ nullable: true })
  printedAt!: Date | null;

  @ApiProperty({ nullable: true })
  printedBy!: string | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;
}