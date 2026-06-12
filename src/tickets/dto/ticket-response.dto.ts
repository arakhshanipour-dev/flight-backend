import { ApiProperty } from '@nestjs/swagger';
import { TicketStatus } from '@prisma/client';

export class TicketResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ticketNumber!: string;

  @ApiProperty({ nullable: true })
  referenceNumber!: string | null;

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

  @ApiProperty({ enum: TicketStatus })
  status!: TicketStatus;

  @ApiProperty({ nullable: true })
  invoiceId!: string | null;

  @ApiProperty({ nullable: true })
  finalizedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ required: false })
  invoiceNumber?: string;
}