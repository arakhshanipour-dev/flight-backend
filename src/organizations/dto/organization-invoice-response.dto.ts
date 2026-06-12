import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';

class OrganizationTicketDto {
  @ApiProperty()
  ticketNumber!: string;

  @ApiProperty()
  passengerName!: string;

  @ApiProperty()
  flightNumber!: string;

  @ApiProperty()
  origin!: string;

  @ApiProperty()
  destination!: string;

  @ApiProperty()
  flightDate!: Date;

  @ApiProperty()
  price!: number;
}

class OrganizationAgencyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  phone!: string | null;
}

export class OrganizationInvoiceResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  agencyName!: string;

  @ApiProperty()
  agencyId!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty({ nullable: true })
  customerPhone!: string | null;

  @ApiProperty()
  templateStyle!: number;

  @ApiProperty()
  subtotal!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  issuedAt!: Date;

  @ApiProperty({ nullable: true })
  paidAt!: Date | null;

  @ApiProperty({ type: [OrganizationTicketDto] })
  tickets!: OrganizationTicketDto[];

  @ApiProperty({ type: OrganizationAgencyDto })
  agency!: OrganizationAgencyDto;
}