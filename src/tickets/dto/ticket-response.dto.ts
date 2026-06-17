// src/tickets/dto/ticket-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { TicketStatus, AgeType, Gender, SalesType, TicketTransactionType } from '@prisma/client';

class AirportInTicketDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  iataCode!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  province!: string;
}

class UserInTicketDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;
}

class InvoiceInTicketDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  status!: string;
}

export class TicketResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ticketNumber!: string;

  @ApiProperty({ nullable: true })
  referenceNumber!: string | null;

  // ===== اطلاعات مسافر =====
  @ApiProperty()
  passengerName!: string;

  @ApiProperty()
  passengerPhone!: string;

  @ApiProperty({ nullable: true })
  passengerTitle!: string | null;

  @ApiProperty({ nullable: true })
  nationality!: string | null;

  @ApiProperty({ nullable: true })
  nationalCode!: string | null;

  @ApiProperty({ nullable: true })
  passportNumber!: string | null;

  @ApiProperty({ nullable: true })
  reservationPhone!: string | null;

  @ApiProperty({ enum: AgeType, nullable: true })
  ageType!: AgeType | null;

  @ApiProperty({ enum: Gender, nullable: true })
  gender!: Gender | null;

  // ===== اطلاعات پرواز =====
  @ApiProperty()
  flightNumber!: string;

  @ApiProperty()
  flightDate!: Date;

  @ApiProperty({ nullable: true })
  departureDate!: Date | null;

  @ApiProperty()
  seatClass!: string;

  @ApiProperty({ nullable: true })
  route!: string | null;  // 🔥 اصلاح: به جای origin و destination

  @ApiProperty({ nullable: true })
  segment!: string | null;

  // ===== اطلاعات رزرو =====
  @ApiProperty({ nullable: true })
  pnr!: string | null;

  @ApiProperty({ nullable: true })
  tourCode!: string | null;

  @ApiProperty({ nullable: true })
  source!: string | null;

  @ApiProperty({ nullable: true })
  customerAirline!: string | null;

  @ApiProperty({ nullable: true })
  sign!: string | null;

  // ===== اطلاعات مالی =====
  @ApiProperty()
  currencyCode!: string;

  @ApiProperty()
  fare!: number;

  @ApiProperty()
  fee!: number;

  @ApiProperty()
  tax!: number;

  @ApiProperty()
  vat!: number;

  @ApiProperty()
  ancillary!: number;

  @ApiProperty()
  discount!: number;

  @ApiProperty()
  price!: number;

  // ===== کارمزد و مارک‌آپ =====
  @ApiProperty()
  commission!: number;

  @ApiProperty()
  commissionAmount!: number;

  @ApiProperty()
  markup!: number;

  // ===== فروش و حسابداری =====
  @ApiProperty({ enum: SalesType })
  salesType!: SalesType;

  @ApiProperty({ enum: TicketTransactionType, nullable: true })
  transactionType!: TicketTransactionType | null;

  @ApiProperty({ nullable: true })
  transactionDate!: Date | null;

  @ApiProperty({ nullable: true })
  referenceNo!: string | null;

  @ApiProperty({ nullable: true })
  debit!: number | null;

  @ApiProperty({ nullable: true })
  credit!: number | null;

  @ApiProperty({ nullable: true })
  runningBalance!: number | null;

  @ApiProperty({ nullable: true })
  totalRefund!: number | null;

  // ===== فروشنده =====
  @ApiProperty({ nullable: true })
  agentName!: string | null;

  @ApiProperty({ nullable: true })
  agentCode!: string | null;

  @ApiProperty({ nullable: true })
  agentIATACode!: string | null;

  // ===== وضعیت =====
  @ApiProperty({ enum: TicketStatus })
  status!: TicketStatus;

  @ApiProperty({ nullable: true })
  finalizedAt!: Date | null;

  @ApiProperty({ nullable: true })
  invoiceId!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  // ===== روابط =====
  @ApiProperty()
  agencyId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: AirportInTicketDto, nullable: true })
  originAirport!: AirportInTicketDto | null;

  @ApiProperty({ type: AirportInTicketDto, nullable: true })
  destinationAirport!: AirportInTicketDto | null;

  @ApiProperty({ type: UserInTicketDto, nullable: true })
  user!: UserInTicketDto | null;

  @ApiProperty({ type: InvoiceInTicketDto, nullable: true })
  invoice!: InvoiceInTicketDto | null;

  // ===== آمار =====
  @ApiProperty({ required: false })
  penaltyCount?: number;

  @ApiProperty({ required: false })
  totalPenaltyPoints?: number;
}