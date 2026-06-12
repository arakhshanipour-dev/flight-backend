import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';

class TicketInInvoiceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ticketNumber!: string;

  @ApiProperty()
  passengerName!: string;

  @ApiProperty()
  passengerPhone!: string;

  @ApiProperty()
  flightNumber!: string;

  @ApiProperty()
  origin!: string;

  @ApiProperty()
  destination!: string;

  @ApiProperty()
  flightDate!: Date;

  @ApiProperty()
  seatClass!: string;

  @ApiProperty()
  price!: number;
}

class BankCardInInvoiceDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  bankName!: string;

  @ApiProperty()
  accountHolder!: string;

  @ApiProperty()
  maskedCardNumber!: string;
}

export class InvoiceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  agencyName!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty({ nullable: true })
  customerPhone!: string | null;

  @ApiProperty({ nullable: true })
  organizationId!: string | null;

  @ApiProperty()
  templateStyle!: number;

  @ApiProperty()
  subtotal!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty({ nullable: true })
  issuedAt!: Date;

  @ApiProperty({ nullable: true })
  paidAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: [TicketInInvoiceDto] })
  tickets!: TicketInInvoiceDto[];

  @ApiProperty({ type: BankCardInInvoiceDto })
  bankCard!: BankCardInInvoiceDto;

  @ApiProperty({ required: false })
  paymentId?: string;
}