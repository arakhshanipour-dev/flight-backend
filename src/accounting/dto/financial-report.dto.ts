import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';
import { CashFlowReportDto } from './cash-flow-report.dto'; // 🔥 import از cash-flow-report

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

// ============ 🔥 MonthlyTrendDto ============
export class MonthlyTrendDto {
  @ApiProperty()
  month!: string;

  @ApiProperty()
  revenue!: number;

  @ApiProperty()
  invoiceCount!: number;

  @ApiProperty()
  paymentCount!: number;
}

// ============ 🔥 Invoice Summary DTOs ============
export class InvoiceSummaryItemDto {
  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  agencyName!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty()
  total!: number;

  @ApiProperty({ enum: InvoiceStatus })
  status!: InvoiceStatus;

  @ApiProperty()
  issuedAt!: Date;

  @ApiProperty()
  ticketCount!: number;
}

export class InvoiceSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  paid!: number;

  @ApiProperty()
  paidAmount!: number;

  @ApiProperty()
  unpaid!: number;

  @ApiProperty()
  unpaidAmount!: number;

  @ApiProperty({ type: [InvoiceSummaryItemDto] })
  invoices!: InvoiceSummaryItemDto[];
}

// ============ 🔥 Payment Summary DTOs ============
export class PaymentSummaryItemDto {
  @ApiProperty({ nullable: true })
  trackingCode!: string | null;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  agencyName!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  customerName!: string;

  @ApiProperty({ nullable: true })
  paidAt!: Date | null;
}

export class PaymentSummaryDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty({ type: [PaymentSummaryItemDto] })
  payments!: PaymentSummaryItemDto[];
}

// ============ 🔥 تایپ ترکیبی برای گزارشات ============
export type ReportResult =
  | ProfitLossReportDto
  | BalanceSheetDto
  | CashFlowReportDto  // 🔥 از cash-flow-report.dto.ts import شده
  | InvoiceSummaryDto
  | PaymentSummaryDto
  | AgencyComparisonDto[];