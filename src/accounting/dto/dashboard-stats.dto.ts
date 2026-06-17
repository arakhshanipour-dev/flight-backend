import { ApiProperty } from '@nestjs/swagger';
import { AgencyComparisonDto, MonthlyTrendDto } from './financial-report.dto';

export class UserStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  active!: number;

  @ApiProperty()
  inactive!: number;

  @ApiProperty()
  byRole!: Record<string, number>;
}

export class TicketStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  draft!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  finalized!: number;

  @ApiProperty()
  invoiced!: number;
}

export class InvoiceStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  unpaid!: number;

  @ApiProperty()
  paid!: number;

  @ApiProperty()
  cancelled!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  paidAmount!: number;

  @ApiProperty()
  unpaidAmount!: number;
}

export class PaymentStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  completed!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  totalAmount!: number;
}

export class AgencyDashboardStatsDto {
  @ApiProperty()
  agencyId!: string;

  @ApiProperty()
  agencyName!: string;

  @ApiProperty()
  agencyStatus!: string;

  @ApiProperty()
  currentPlan!: string;

  @ApiProperty({ nullable: true })
  trialExpiresAt!: Date | null;

  @ApiProperty({ type: UserStatsDto })
  users!: UserStatsDto;

  @ApiProperty({ type: TicketStatsDto })
  tickets!: TicketStatsDto;

  @ApiProperty({ type: InvoiceStatsDto })
  invoices!: InvoiceStatsDto;

  @ApiProperty({ type: PaymentStatsDto })
  payments!: PaymentStatsDto;

  @ApiProperty()
  bankCardsCount!: number;

  @ApiProperty({ type: [MonthlyTrendDto] })
  monthlyTrends!: MonthlyTrendDto[];
}

export class SupportDashboardStatsDto {
  @ApiProperty()
  totalAgencies!: number;

  @ApiProperty()
  activeAgencies!: number;

  @ApiProperty()
  trialAgencies!: number;

  @ApiProperty()
  totalUsers!: number;

  @ApiProperty()
  totalRevenue!: number;

  @ApiProperty()
  totalInvoices!: number;

  @ApiProperty()
  totalPayments!: number;

  @ApiProperty()
  totalTickets!: number;

  @ApiProperty()
  openTickets!: number;

  @ApiProperty({ type: [AgencyComparisonDto] })
  topAgencies!: AgencyComparisonDto[];

  @ApiProperty({ type: [MonthlyTrendDto] })
  overallTrends!: MonthlyTrendDto[];
}