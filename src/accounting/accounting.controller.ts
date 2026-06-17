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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
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
  @Roles(UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER, UserRole.NORMAL_USER)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Get agency dashboard statistics',
    description: 'دریافت آمار داشبورد آژانس با توجه به نقش کاربر'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Dashboard statistics retrieved successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Access denied to this agency' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Agency ID not found' 
  })
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Get support dashboard statistics',
    description: 'دریافت آمار داشبورد پشتیبانی (فقط SUPER_ADMIN)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Support dashboard statistics retrieved successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Only Super Admin can access' 
  })
  async getSupportDashboard(@CurrentUser('id') userId: string) {
    return this.accountingService.getSupportDashboard(userId);
  }

  // ============ Financial Reports ============

  @Post('reports')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER, UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Generate financial report',
    description: 'ایجاد گزارش مالی با توجه به نوع گزارش و بازه زمانی'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Financial report generated successfully' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid report parameters' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Access denied' 
  })
  async generateReport(
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body(ValidationPipe) dto: FinancialReportDto,
  ) {
    return this.accountingService.getFinancialReport(
      agencyId, 
      userId, 
      userRole, 
      dto
    );
  }

  // ============ Quick Reports (Shortcuts) ============

  @Get('reports/profit-loss')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Get profit & loss report',
    description: 'دریافت گزارش سود و زیان'
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ReportPeriod, 
    default: ReportPeriod.MONTHLY 
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: String, 
    example: '2025-01-01',
    description: 'تاریخ شروع (فرمت: YYYY-MM-DD)'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: String, 
    example: '2025-12-31',
    description: 'تاریخ پایان (فرمت: YYYY-MM-DD)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profit & loss report generated successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Access denied' 
  })
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
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Get balance sheet',
    description: 'دریافت ترازنامه مالی'
  })
  @ApiQuery({ 
    name: 'asOfDate', 
    required: false, 
    type: String, 
    example: '2025-12-31',
    description: 'تاریخ ترازنامه (فرمت: YYYY-MM-DD)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Balance sheet generated successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Access denied' 
  })
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
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Get cash flow report',
    description: 'دریافت گزارش جریان نقدی'
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ReportPeriod, 
    default: ReportPeriod.MONTHLY 
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: String, 
    example: '2025-01-01',
    description: 'تاریخ شروع (فرمت: YYYY-MM-DD)'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: String, 
    example: '2025-12-31',
    description: 'تاریخ پایان (فرمت: YYYY-MM-DD)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Cash flow report generated successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Access denied' 
  })
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
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Get invoice summary report',
    description: 'دریافت خلاصه گزارش فاکتورها'
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ReportPeriod, 
    default: ReportPeriod.MONTHLY 
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: String, 
    example: '2025-01-01',
    description: 'تاریخ شروع (فرمت: YYYY-MM-DD)'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: String, 
    example: '2025-12-31',
    description: 'تاریخ پایان (فرمت: YYYY-MM-DD)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Invoice summary generated successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Access denied' 
  })
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
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Get payment summary report',
    description: 'دریافت خلاصه گزارش پرداخت‌ها'
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ReportPeriod, 
    default: ReportPeriod.MONTHLY 
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: String, 
    example: '2025-01-01',
    description: 'تاریخ شروع (فرمت: YYYY-MM-DD)'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: String, 
    example: '2025-12-31',
    description: 'تاریخ پایان (فرمت: YYYY-MM-DD)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Payment summary generated successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Access denied' 
  })
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ 
    summary: 'Get agency comparison report',
    description: 'دریافت گزارش مقایسه آژانس‌ها (فقط SUPER_ADMIN)'
  })
  @ApiQuery({ 
    name: 'period', 
    required: false, 
    enum: ReportPeriod, 
    default: ReportPeriod.MONTHLY 
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: false, 
    type: String, 
    example: '2025-01-01',
    description: 'تاریخ شروع (فرمت: YYYY-MM-DD)'
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: false, 
    type: String, 
    example: '2025-12-31',
    description: 'تاریخ پایان (فرمت: YYYY-MM-DD)'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Agency comparison generated successfully' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Only Super Admin can access' 
  })
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