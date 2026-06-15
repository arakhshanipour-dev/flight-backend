import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  ValidationPipe,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AccountingService } from './accounting.service';
import { FinancialReportDto, ReportPeriod, ReportType } from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Accounting & Analytics')
@ApiBearerAuth('JWT-auth')
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // ============ Agency Dashboard ============

  @Get('agency/dashboard')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER, UserRole.NORMAL_USER)  // اضافه کردن NORMAL_USER
  @ApiOperation({ summary: 'Get agency dashboard statistics' })
  async getAgencyDashboard(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.accountingService.getAgencyDashboard(agencyId, userId, userRole);
  }

  // ============ Support Dashboard ============

  @Get('support/dashboard')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get support dashboard statistics (Super Admin only)' })
  async getSupportDashboard(@CurrentUser('id') userId: string) {
    return this.accountingService.getSupportDashboard(userId);
  }

  // ============ Financial Reports ============

  @Post('reports')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Generate financial report' })
  async generateReport(
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body(ValidationPipe) dto: FinancialReportDto,
  ) {
    return this.accountingService.getFinancialReport(agencyId, userId, userRole, dto);
  }

  // ============ Quick Reports (Shortcuts) ============

  @Get('reports/profit-loss')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get profit & loss report' })
  @ApiQuery({ name: 'period', required: false, enum: ReportPeriod, default: ReportPeriod.MONTHLY })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getProfitLoss(
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query('period') period?: ReportPeriod,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.accountingService.getFinancialReport(agencyId, userId, userRole, {
      reportType: ReportType.PROFIT_LOSS,
      period,
      startDate,
      endDate,
    });
  }

  @Get('reports/balance-sheet')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get balance sheet' })
  @ApiQuery({ name: 'asOfDate', required: false, type: String })
  async getBalanceSheet(
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query('asOfDate') asOfDate?: string,
  ) {
    const endDate = asOfDate ? new Date(asOfDate) : new Date();
    return this.accountingService.getFinancialReport(agencyId, userId, userRole, {
      reportType: ReportType.BALANCE_SHEET,
      startDate: asOfDate,
      endDate: asOfDate,
    });
  }

  @Get('reports/cash-flow')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get cash flow report' })
  @ApiQuery({ name: 'period', required: false, enum: ReportPeriod, default: ReportPeriod.MONTHLY })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getCashFlow(
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query('period') period?: ReportPeriod,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.accountingService.getFinancialReport(agencyId, userId, userRole, {
      reportType: ReportType.CASH_FLOW,
      period,
      startDate,
      endDate,
    });
  }

  @Get('reports/invoice-summary')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get invoice summary report' })
  @ApiQuery({ name: 'period', required: false, enum: ReportPeriod, default: ReportPeriod.MONTHLY })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getInvoiceSummary(
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query('period') period?: ReportPeriod,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.accountingService.getFinancialReport(agencyId, userId, userRole, {
      reportType: ReportType.INVOICE_SUMMARY,
      period,
      startDate,
      endDate,
    });
  }

  @Get('reports/payment-summary')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get payment summary report' })
  @ApiQuery({ name: 'period', required: false, enum: ReportPeriod, default: ReportPeriod.MONTHLY })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getPaymentSummary(
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query('period') period?: ReportPeriod,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.accountingService.getFinancialReport(agencyId, userId, userRole, {
      reportType: ReportType.PAYMENT_SUMMARY,
      period,
      startDate,
      endDate,
    });
  }

  @Get('reports/agency-comparison')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get agency comparison report (Super Admin only)' })
  @ApiQuery({ name: 'period', required: false, enum: ReportPeriod, default: ReportPeriod.MONTHLY })
  @ApiQuery({ name: 'startDate', required: false, type: String })
  @ApiQuery({ name: 'endDate', required: false, type: String })
  async getAgencyComparison(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query('period') period?: ReportPeriod,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.accountingService.getFinancialReport(null, userId, userRole, {
      reportType: ReportType.AGENCY_COMPARISON,
      period,
      startDate,
      endDate,
    });
  }
}