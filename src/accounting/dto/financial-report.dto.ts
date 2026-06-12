import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsEnum, IsUUID } from 'class-validator';

export enum ReportPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  YEARLY = 'YEARLY',
  CUSTOM = 'CUSTOM',
}

export enum ReportType {
  PROFIT_LOSS = 'PROFIT_LOSS',
  BALANCE_SHEET = 'BALANCE_SHEET',
  CASH_FLOW = 'CASH_FLOW',
  INVOICE_SUMMARY = 'INVOICE_SUMMARY',
  PAYMENT_SUMMARY = 'PAYMENT_SUMMARY',
  AGENCY_COMPARISON = 'AGENCY_COMPARISON',
}

export class FinancialReportDto {
  @ApiProperty({ enum: ReportType, description: 'نوع گزارش' })
  @IsEnum(ReportType)
  reportType!: ReportType;

  @ApiProperty({ enum: ReportPeriod, default: ReportPeriod.MONTHLY, required: false })
  @IsEnum(ReportPeriod)
  @IsOptional()
  period?: ReportPeriod;

  @ApiProperty({ example: '2025-01-01', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2025-12-31', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ required: false, description: 'شناسه آژانس (برای پشتیبانی)' })
  @IsUUID()
  @IsOptional()
  agencyId?: string;
}

export class ProfitLossItemDto {
  @ApiProperty()
  category!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  percentage!: number;
}

export class ProfitLossReportDto {
  @ApiProperty()
  period!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty({ type: [ProfitLossItemDto] })
  revenue!: ProfitLossItemDto[];

  @ApiProperty()
  totalRevenue!: number;

  @ApiProperty({ type: [ProfitLossItemDto] })
  expenses!: ProfitLossItemDto[];

  @ApiProperty()
  totalExpenses!: number;

  @ApiProperty()
  netProfit!: number;

  @ApiProperty()
  netProfitMargin!: number;
}

export class BalanceSheetDto {
  @ApiProperty()
  asOfDate!: Date;

  @ApiProperty({ type: [ProfitLossItemDto] })
  assets!: ProfitLossItemDto[];

  @ApiProperty()
  totalAssets!: number;

  @ApiProperty({ type: [ProfitLossItemDto] })
  liabilities!: ProfitLossItemDto[];

  @ApiProperty()
  totalLiabilities!: number;

  @ApiProperty()
  equity!: number;
}

export class AgencyComparisonDto {
  @ApiProperty()
  agencyId!: string;

  @ApiProperty()
  agencyName!: string;

  @ApiProperty()
  totalRevenue!: number;

  @ApiProperty()
  totalInvoices!: number;

  @ApiProperty()
  totalPayments!: number;

  @ApiProperty()
  activeUsers!: number;

  @ApiProperty()
  totalTickets!: number;
}