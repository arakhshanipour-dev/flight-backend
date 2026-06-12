import { ApiProperty } from '@nestjs/swagger';

class AgencyInteractionDto {
  @ApiProperty()
  agencyId!: string;

  @ApiProperty()
  agencyName!: string;

  @ApiProperty()
  invoiceCount!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  paidAmount!: number;
}

class MonthlyStatsDto {
  @ApiProperty()
  month!: string;

  @ApiProperty()
  invoiceCount!: number;

  @ApiProperty()
  totalAmount!: number;
}

export class OrganizationStatsDto {
  @ApiProperty()
  totalInvoices!: number;

  @ApiProperty()
  totalPaidInvoices!: number;

  @ApiProperty()
  totalUnpaidInvoices!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  totalPaidAmount!: number;

  @ApiProperty({ type: [AgencyInteractionDto] })
  agencyInteractions!: AgencyInteractionDto[];

  @ApiProperty({ type: [MonthlyStatsDto] })
  monthlyStats!: MonthlyStatsDto[];
}