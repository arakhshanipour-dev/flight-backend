import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FinancialReportDto,
  ReportType,
  ReportPeriod,
  ProfitLossReportDto,
  BalanceSheetDto,
  AgencyComparisonDto,
  AgencyDashboardStatsDto,
  SupportDashboardStatsDto,
  MonthlyTrendDto,
  CashFlowReportDto,
  MonthlyCashFlowItemDto,
  InvoiceSummaryDto,
  PaymentSummaryDto,
  ReportResult,
} from './dto'; // 🔥 import از dto
import {
  UserRole,
  InvoiceStatus,
  PaymentStatus,
  TicketStatus,
  AgencyStatus,
  UserStatus,
} from '@prisma/client';

// 🔥 PDFKit با require
// @ts-ignore
const PDFDocument = require('pdfkit');
import * as ExcelJS from 'exceljs';

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  // ============ Helper Methods ============

  private async validateAgencyAccess(
    agencyId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<{ limited: boolean; normalUser: boolean }> {
    // SUPER_ADMIN دسترسی کامل دارد
    if (userRole === UserRole.SUPER_ADMIN) {
      return { limited: false, normalUser: false };
    }

    // بررسی وجود کاربر در آژانس
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        status: UserStatus.ACTIVE,
      },
    });

    if (!user) {
      throw new ForbiddenException('Access denied to this agency');
    }

    // GENERAL_MANAGER دسترسی کامل دارد
    if (userRole === UserRole.GENERAL_MANAGER) {
      return { limited: false, normalUser: false };
    }

    // AGENCY_MANAGER دسترسی محدود دارد
    if (userRole === UserRole.AGENCY_MANAGER) {
      return { limited: true, normalUser: false };
    }

    // NORMAL_USER فقط اطلاعات پایه
    if (userRole === UserRole.NORMAL_USER) {
      return { limited: true, normalUser: true };
    }

    return { limited: true, normalUser: false };
  }

  private getDateRange(
    period: ReportPeriod,
    startDate?: string,
    endDate?: string,
  ): { start: Date; end: Date } {
    const now = new Date();
    let start: Date;
    const end: Date = new Date();

    if (period === ReportPeriod.CUSTOM && startDate && endDate) {
      start = new Date(startDate);
      const customEnd = new Date(endDate);
      customEnd.setHours(23, 59, 59, 999);
      return { start, end: customEnd };
    }

    switch (period) {
      case ReportPeriod.DAILY:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case ReportPeriod.WEEKLY:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case ReportPeriod.MONTHLY:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case ReportPeriod.QUARTERLY:
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case ReportPeriod.YEARLY:
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  // ============ Agency Dashboard ============

  async getAgencyDashboard(
    agencyId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<AgencyDashboardStatsDto> {
    const access = await this.validateAgencyAccess(agencyId, userId, userRole);

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        agencyPlans: {
          where: { isActive: true },
          include: { plan: true },
          take: 1,
        },
      },
    });

    if (!agency) {
      throw new BadRequestException('Agency not found');
    }

    // ============ User stats ============
    let users;
    if (userRole === UserRole.NORMAL_USER) {
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true },
      });
      users = currentUser
        ? [{ role: currentUser.role, status: currentUser.status, _count: 1 }]
        : [];
    } else {
      users = await this.prisma.user.groupBy({
        by: ['role', 'status'],
        where: { agencyId: agencyId },
        _count: true,
      });
    }

    const userStats = {
      total: users.reduce((sum, u) => sum + u._count, 0),
      active: users
        .filter((u) => u.status === 'ACTIVE')
        .reduce((sum, u) => sum + u._count, 0),
      inactive: users
        .filter((u) => u.status === 'INACTIVE')
        .reduce((sum, u) => sum + u._count, 0),
      byRole: users.reduce(
        (acc, u) => {
          acc[u.role] = (acc[u.role] || 0) + u._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };

    // ============ Ticket stats ============
    let tickets;
    if (userRole === UserRole.NORMAL_USER) {
      tickets = await this.prisma.ticket.groupBy({
        by: ['status'],
        where: {
          agencyId: agencyId,
          userId: userId,
        },
        _count: true,
      });
    } else {
      tickets = await this.prisma.ticket.groupBy({
        by: ['status'],
        where: { agencyId: agencyId },
        _count: true,
      });
    }

    const ticketStats = {
      total: tickets.reduce((sum, t) => sum + t._count, 0),
      draft: tickets.find((t) => t.status === TicketStatus.DRAFT)?._count || 0,
      completed:
        tickets.find((t) => t.status === TicketStatus.COMPLETED)?._count || 0,
      finalized:
        tickets.find((t) => t.status === TicketStatus.FINALIZED)?._count || 0,
      invoiced:
        tickets.find((t) => t.status === TicketStatus.INVOICED)?._count || 0,
    };

    // ============ Invoice stats ============
    let invoices;
    if (userRole === UserRole.NORMAL_USER) {
      const userTickets = await this.prisma.ticket.findMany({
        where: { agencyId: agencyId, userId: userId },
        select: { invoiceId: true },
      });

      const invoiceIds = userTickets
        .map((t) => t.invoiceId)
        .filter((id): id is string => id !== null);

      if (invoiceIds.length > 0) {
        invoices = await this.prisma.invoice.groupBy({
          by: ['status'],
          where: {
            agencyId: agencyId,
            id: { in: invoiceIds },
          },
          _count: true,
          _sum: { total: true },
        });
      } else {
        invoices = [];
      }
    } else {
      invoices = await this.prisma.invoice.groupBy({
        by: ['status'],
        where: { agencyId: agencyId },
        _count: true,
        _sum: { total: true },
      });
    }

    const invoiceStats = {
      total: invoices.reduce((sum, i) => sum + i._count, 0),
      unpaid: invoices.find((i) => i.status === InvoiceStatus.UNPAID)?._count ||
        0,
      paid: invoices.find((i) => i.status === InvoiceStatus.PAID)?._count || 0,
      cancelled:
        invoices.find((i) => i.status === InvoiceStatus.CANCELLED)?._count || 0,
      totalAmount: invoices.reduce((sum, i) => sum + (i._sum.total || 0), 0),
      paidAmount: invoices.find((i) => i.status === InvoiceStatus.PAID)?._sum
        .total || 0,
      unpaidAmount: invoices.find((i) => i.status === InvoiceStatus.UNPAID)
        ?._sum.total || 0,
    };

    // ============ Payment stats ============
    let payments;
    if (userRole === UserRole.NORMAL_USER) {
      const userTickets = await this.prisma.ticket.findMany({
        where: { agencyId: agencyId, userId: userId },
        select: { invoiceId: true },
      });

      const invoiceIds = userTickets
        .map((t) => t.invoiceId)
        .filter((id): id is string => id !== null);

      if (invoiceIds.length > 0) {
        payments = await this.prisma.payment.groupBy({
          by: ['status'],
          where: {
            agencyId: agencyId,
            invoiceId: { in: invoiceIds },
          },
          _count: true,
          _sum: { amount: true },
        });
      } else {
        payments = [];
      }
    } else {
      payments = await this.prisma.payment.groupBy({
        by: ['status'],
        where: { agencyId: agencyId },
        _count: true,
        _sum: { amount: true },
      });
    }

    const paymentStats = {
      total: payments.reduce((sum, p) => sum + p._count, 0),
      completed:
        payments.find((p) => p.status === PaymentStatus.COMPLETED)?._count || 0,
      failed: payments.find((p) => p.status === PaymentStatus.FAILED)?._count ||
        0,
      totalAmount: payments.find((p) => p.status === PaymentStatus.COMPLETED)
        ?._sum.amount || 0,
    };

    // Bank cards count
    const bankCardsCount =
      userRole === UserRole.GENERAL_MANAGER
        ? await this.prisma.bankCard.count({
            where: { agencyId: agencyId, status: 'ACTIVE' },
          })
        : 0;

    // Monthly trends
    let monthlyTrends: MonthlyTrendDto[] = [];
    if (userRole !== UserRole.NORMAL_USER) {
      monthlyTrends = await this.getMonthlyTrends(agencyId);
    }

    const limitedAccess = access.limited;
    const isNormalUser = access.normalUser;

    return {
      agencyId: agency.id,
      agencyName: agency.name,
      agencyStatus: agency.status,
      currentPlan: agency.agencyPlans[0]?.plan.name || 'No Plan',
      trialExpiresAt: agency.trialExpiresAt,
      users: userStats,
      tickets: ticketStats,
      invoices: limitedAccess || isNormalUser
        ? {
            total: invoiceStats.total,
            unpaid: invoiceStats.unpaid,
            paid: invoiceStats.paid,
            cancelled: invoiceStats.cancelled,
            totalAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
          }
        : invoiceStats,
      payments: limitedAccess || isNormalUser
        ? {
            total: paymentStats.total,
            completed: paymentStats.completed,
            failed: paymentStats.failed,
            totalAmount: 0,
          }
        : paymentStats,
      bankCardsCount,
      monthlyTrends:
        limitedAccess || isNormalUser
          ? monthlyTrends.map((t) => ({ ...t, revenue: 0 }))
          : monthlyTrends,
    };
  }

  private async getMonthlyTrends(agencyId: string): Promise<MonthlyTrendDto[]> {
    const results: MonthlyTrendDto[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      const [revenue, invoiceCount, paymentCount] = await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            agencyId: agencyId,
            status: PaymentStatus.COMPLETED,
            paidAt: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amount: true },
        }),
        this.prisma.invoice.count({
          where: {
            agencyId: agencyId,
            issuedAt: { gte: monthStart, lte: monthEnd },
          },
        }),
        this.prisma.payment.count({
          where: {
            agencyId: agencyId,
            status: PaymentStatus.COMPLETED,
            paidAt: { gte: monthStart, lte: monthEnd },
          },
        }),
      ]);

      results.push({
        month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(
          2,
          '0',
        )}`,
        revenue: revenue._sum.amount || 0,
        invoiceCount,
        paymentCount,
      });
    }

    return results;
  }

  // ============ Support Dashboard ============

  async getSupportDashboard(userId: string): Promise<SupportDashboardStatsDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: UserRole.SUPER_ADMIN },
    });

    if (!user) {
      throw new ForbiddenException('Only Super Admin can access support dashboard');
    }

    const [
      totalAgencies,
      totalUsers,
      totalRevenue,
      totalInvoices,
      totalPayments,
      totalTickets,
      openTickets,
      topAgencies,
      overallTrends,
    ] = await Promise.all([
      this.prisma.agency.count(),
      this.prisma.user.count(),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.COMPLETED },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count(),
      this.prisma.payment.count({ where: { status: PaymentStatus.COMPLETED } }),
      this.prisma.supportTicket.count(),
      this.prisma.supportTicket.count({
        where: { status: { not: 'CLOSED' } },
      }),
      this.getTopAgencies(10),
      this.getOverallTrends(),
    ]);

    const agencyStatusCounts = await this.prisma.agency.groupBy({
      by: ['status'],
      _count: true,
    });

    return {
      totalAgencies,
      activeAgencies:
        agencyStatusCounts.find((a) => a.status === AgencyStatus.ACTIVE)
          ?._count || 0,
      trialAgencies:
        agencyStatusCounts.find((a) => a.status === AgencyStatus.TRIAL)
          ?._count || 0,
      totalUsers,
      totalRevenue: totalRevenue._sum.amount || 0,
      totalInvoices,
      totalPayments,
      totalTickets,
      openTickets,
      topAgencies,
      overallTrends,
    };
  }

  private async getTopAgencies(
    limit: number = 10,
  ): Promise<AgencyComparisonDto[]> {
    const agencies = await this.prisma.agency.findMany({
      where: { status: AgencyStatus.ACTIVE },
      take: limit,
    });

    const results: AgencyComparisonDto[] = [];

    for (const agency of agencies) {
      const [payments, invoices, users, tickets] = await Promise.all([
        this.prisma.payment.findMany({
          where: { agencyId: agency.id, status: PaymentStatus.COMPLETED },
          select: { amount: true },
        }),
        this.prisma.invoice.count({ where: { agencyId: agency.id } }),
        this.prisma.user.count({
          where: { agencyId: agency.id, status: UserStatus.ACTIVE },
        }),
        this.prisma.ticket.count({ where: { agencyId: agency.id } }),
      ]);

      results.push({
        agencyId: agency.id,
        agencyName: agency.name,
        totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
        totalInvoices: invoices,
        totalPayments: payments.length,
        activeUsers: users,
        totalTickets: tickets,
      });
    }

    return results
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  }

  private async getOverallTrends(): Promise<MonthlyTrendDto[]> {
    const results: MonthlyTrendDto[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(
        month.getFullYear(),
        month.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      const [revenue, invoiceCount, paymentCount] = await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            status: PaymentStatus.COMPLETED,
            paidAt: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amount: true },
        }),
        this.prisma.invoice.count({
          where: { issuedAt: { gte: monthStart, lte: monthEnd } },
        }),
        this.prisma.payment.count({
          where: {
            status: PaymentStatus.COMPLETED,
            paidAt: { gte: monthStart, lte: monthEnd },
          },
        }),
      ]);

      results.push({
        month: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(
          2,
          '0',
        )}`,
        revenue: revenue._sum.amount || 0,
        invoiceCount,
        paymentCount,
      });
    }

    return results;
  }

  // ============ Financial Reports ============

  async getFinancialReport(
    agencyId: string | null,
    userId: string,
    userRole: UserRole,
    dto: FinancialReportDto,
  ): Promise<ReportResult> {
    if (userRole !== UserRole.SUPER_ADMIN && !agencyId) {
      throw new BadRequestException('Agency ID is required for non-admin users');
    }

    if (agencyId && userRole !== UserRole.SUPER_ADMIN) {
      await this.validateAgencyAccess(agencyId, userId, userRole);
    }

    const { start, end } = this.getDateRange(
      dto.period || ReportPeriod.MONTHLY,
      dto.startDate,
      dto.endDate,
    );
    const targetAgencyId = dto.agencyId || agencyId;

    switch (dto.reportType) {
      case ReportType.PROFIT_LOSS:
        return this.getProfitLossReport(targetAgencyId, start, end);
      case ReportType.BALANCE_SHEET:
        return this.getBalanceSheet(targetAgencyId, end);
      case ReportType.CASH_FLOW:
        return this.getCashFlowReport(targetAgencyId, start, end);
      case ReportType.INVOICE_SUMMARY:
        return this.getInvoiceSummary(targetAgencyId, start, end);
      case ReportType.PAYMENT_SUMMARY:
        return this.getPaymentSummary(targetAgencyId, start, end);
      case ReportType.AGENCY_COMPARISON:
        if (userRole !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenException(
            'Only Super Admin can access agency comparison',
          );
        }
        return this.getAgencyComparisonReport(start, end);
      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  // ... ادامه متدهای گزارش‌گیری (همانند قبل) ...

  private async getProfitLossReport(
    agencyId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<ProfitLossReportDto> {
    // ... کد قبلی ...
    const paymentWhere: any = {
      status: PaymentStatus.COMPLETED,
      paidAt: { gte: startDate, lte: endDate },
    };
    if (agencyId) paymentWhere.agencyId = agencyId;

    const totalRevenueResult = await this.prisma.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
    });

    let revenueItems: any[] = [];
    const totalRevenue = totalRevenueResult._sum.amount || 0;

    if (!agencyId) {
      const revenueByAgency = await this.prisma.payment.groupBy({
        by: ['agencyId'],
        where: paymentWhere,
        _sum: { amount: true },
      });

      for (const r of revenueByAgency) {
        const agency = await this.prisma.agency.findUnique({
          where: { id: r.agencyId! },
          select: { name: true },
        });
        revenueItems.push({
          category: agency?.name || r.agencyId,
          amount: r._sum.amount || 0,
          percentage:
            totalRevenue > 0 ? ((r._sum.amount || 0) / totalRevenue) * 100 : 0,
        });
      }
    } else {
      revenueItems = [{ category: 'فروش بلیط', amount: totalRevenue, percentage: 100 }];
    }

    const expenses = [
      { category: 'هزینه‌های عملیاتی', amount: 0, percentage: 0 },
      { category: 'هزینه‌های پرسنلی', amount: 0, percentage: 0 },
    ];

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;
    const netProfitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      period: `${startDate.toISOString().slice(0, 10)} تا ${endDate.toISOString().slice(0, 10)}`,
      startDate,
      endDate,
      revenue: revenueItems,
      totalRevenue,
      expenses: expenses.map((e) => ({
        ...e,
        percentage: totalRevenue > 0 ? (e.amount / totalRevenue) * 100 : 0,
      })),
      totalExpenses,
      netProfit,
      netProfitMargin,
    };
  }

  private async getBalanceSheet(
    agencyId: string | null,
    asOfDate: Date,
  ): Promise<BalanceSheetDto> {
    // ... کد قبلی ...
    const paymentWhere: any = {
      status: PaymentStatus.COMPLETED,
      paidAt: { lte: asOfDate },
    };
    if (agencyId) paymentWhere.agencyId = agencyId;

    const totalAssetsResult = await this.prisma.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
    });

    const invoiceWhere: any = {
      status: InvoiceStatus.UNPAID,
      issuedAt: { lte: asOfDate },
    };
    if (agencyId) invoiceWhere.agencyId = agencyId;

    const totalLiabilitiesResult = await this.prisma.invoice.aggregate({
      where: invoiceWhere,
      _sum: { total: true },
    });

    const totalAssets = totalAssetsResult._sum.amount || 0;
    const totalLiabilities = totalLiabilitiesResult._sum.total || 0;
    const equity = totalAssets - totalLiabilities;

    return {
      asOfDate,
      assets: [
        { category: 'موجودی نقد', amount: totalAssets, percentage: 100 },
        { category: 'حساب‌های دریافتنی', amount: 0, percentage: 0 },
      ],
      totalAssets,
      liabilities: [
        { category: 'حساب‌های پرداختنی', amount: totalLiabilities, percentage: 100 },
      ],
      totalLiabilities,
      equity,
    };
  }

  private async getCashFlowReport(
    agencyId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<CashFlowReportDto> {
    // ... کد قبلی ...
    const paymentWhere: any = {
      status: PaymentStatus.COMPLETED,
      paidAt: { gte: startDate, lte: endDate },
    };
    if (agencyId) paymentWhere.agencyId = agencyId;

    const monthlyCashFlow: MonthlyCashFlowItemDto[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );
      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );

      const inflowResult = await this.prisma.payment.aggregate({
        where: {
          ...paymentWhere,
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      });

      const inflow = inflowResult._sum.amount || 0;
      monthlyCashFlow.push({
        month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
        inflow,
        outflow: 0,
        netCashFlow: inflow,
      });

      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return {
      period: `${startDate.toISOString().slice(0, 10)} تا ${endDate.toISOString().slice(0, 10)}`,
      monthlyCashFlow,
      totalInflow: monthlyCashFlow.reduce((sum, m) => sum + m.inflow, 0),
      totalOutflow: 0,
      netCashFlow: monthlyCashFlow.reduce((sum, m) => sum + m.netCashFlow, 0),
    };
  }

  private async getInvoiceSummary(
    agencyId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<InvoiceSummaryDto> {
    // ... کد قبلی ...
    const where: any = {
      issuedAt: { gte: startDate, lte: endDate },
    };
    if (agencyId) where.agencyId = agencyId;

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        agency: { select: { name: true } },
        tickets: { select: { ticketNumber: true, price: true } },
      },
      orderBy: { issuedAt: 'desc' },
    });

    return {
      total: invoices.length,
      totalAmount: invoices.reduce((sum, i) => sum + i.total, 0),
      paid: invoices.filter((i) => i.status === InvoiceStatus.PAID).length,
      paidAmount: invoices
        .filter((i) => i.status === InvoiceStatus.PAID)
        .reduce((sum, i) => sum + i.total, 0),
      unpaid: invoices.filter((i) => i.status === InvoiceStatus.UNPAID).length,
      unpaidAmount: invoices
        .filter((i) => i.status === InvoiceStatus.UNPAID)
        .reduce((sum, i) => sum + i.total, 0),
      invoices: invoices.map((i) => ({
        invoiceNumber: i.invoiceNumber,
        agencyName: i.agency.name,
        customerName: i.customerName,
        total: i.total,
        status: i.status,
        issuedAt: i.issuedAt,
        ticketCount: i.tickets.length,
      })),
    };
  }

  private async getPaymentSummary(
    agencyId: string | null,
    startDate: Date,
    endDate: Date,
  ): Promise<PaymentSummaryDto> {
    // ... کد قبلی ...
    const where: any = {
      status: PaymentStatus.COMPLETED,
      paidAt: { gte: startDate, lte: endDate },
    };
    if (agencyId) where.agencyId = agencyId;

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        invoice: { select: { invoiceNumber: true, customerName: true } },
        agency: { select: { name: true } },
      },
      orderBy: { paidAt: 'desc' },
    });

    return {
      total: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      payments: payments.map((p) => ({
        trackingCode: p.trackingCode,
        amount: p.amount,
        agencyName: p.agency.name,
        invoiceNumber: p.invoice.invoiceNumber,
        customerName: p.invoice.customerName,
        paidAt: p.paidAt,
      })),
    };
  }

  private async getAgencyComparisonReport(
    startDate: Date,
    endDate: Date,
  ): Promise<AgencyComparisonDto[]> {
    // ... کد قبلی ...
    const agencies = await this.prisma.agency.findMany({
      where: { status: AgencyStatus.ACTIVE },
    });

    const results: AgencyComparisonDto[] = [];

    for (const agency of agencies) {
      const [payments, invoices, users, tickets] = await Promise.all([
        this.prisma.payment.findMany({
          where: {
            agencyId: agency.id,
            status: PaymentStatus.COMPLETED,
            paidAt: { gte: startDate, lte: endDate },
          },
          select: { amount: true },
        }),
        this.prisma.invoice.count({
          where: {
            agencyId: agency.id,
            issuedAt: { gte: startDate, lte: endDate },
          },
        }),
        this.prisma.user.count({
          where: {
            agencyId: agency.id,
            status: UserStatus.ACTIVE,
          },
        }),
        this.prisma.ticket.count({
          where: {
            agencyId: agency.id,
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
      ]);

      results.push({
        agencyId: agency.id,
        agencyName: agency.name,
        totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
        totalInvoices: invoices,
        totalPayments: payments.length,
        activeUsers: users,
        totalTickets: tickets,
      });
    }

    return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }

  // ============ 🔥 Export Reports ============

  async exportReportPDF(
    agencyId: string | null,
    userId: string,
    userRole: UserRole,
    reportType: ReportType,
    period?: ReportPeriod,
    startDate?: string,
    endDate?: string,
  ): Promise<StreamableFile> {
    // دریافت گزارش
    const report = await this.getFinancialReport(agencyId, userId, userRole, {
      reportType,
      period,
      startDate,
      endDate,
    });

    // ایجاد PDF
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {});

    // عنوان گزارش
    doc.fontSize(24).font('Helvetica-Bold').text('Financial Report', {
      align: 'center',
    });
    doc.moveDown();

    // تاریخ
    doc.fontSize(12).font('Helvetica');
    const now = new Date();
    doc.text(`Report Generated: ${now.toLocaleDateString('fa-IR')}`, {
      align: 'right',
    });
    doc.moveDown();

    // اطلاعات گزارش
    if (report && typeof report === 'object') {
      if ('totalRevenue' in report && 'netProfit' in report) {
        const data = report as ProfitLossReportDto;
        doc.fontSize(16).font('Helvetica-Bold').text('Profit & Loss Summary', {
          underline: true,
        });
        doc.moveDown();

        doc.fontSize(12).font('Helvetica');
        doc.text(`Period: ${data.period}`);
        doc.text(`Total Revenue: ${data.totalRevenue.toLocaleString()} IRR`);
        doc.text(`Total Expenses: ${data.totalExpenses.toLocaleString()} IRR`);
        doc.text(`Net Profit: ${data.netProfit.toLocaleString()} IRR`);
        doc.text(`Profit Margin: ${data.netProfitMargin.toFixed(2)}%`);
        doc.moveDown();

        if (data.revenue && data.revenue.length > 0) {
          doc.fontSize(14).font('Helvetica-Bold').text('Revenue Breakdown');
          doc.moveDown();

          data.revenue.forEach((item) => {
            doc
              .fontSize(10)
              .font('Helvetica')
              .text(
                `${item.category}: ${item.amount.toLocaleString()} IRR (${item.percentage.toFixed(1)}%)`,
              );
          });
        }
      }

      if ('total' in report && 'invoices' in report) {
        const data = report as InvoiceSummaryDto;
        doc.fontSize(16).font('Helvetica-Bold').text('Invoice Summary', {
          underline: true,
        });
        doc.moveDown();

        doc.fontSize(12).font('Helvetica');
        doc.text(`Total Invoices: ${data.total}`);
        doc.text(`Total Amount: ${data.totalAmount.toLocaleString()} IRR`);
        doc.text(`Paid: ${data.paid} (${data.paidAmount.toLocaleString()} IRR)`);
        doc.text(
          `Unpaid: ${data.unpaid} (${data.unpaidAmount.toLocaleString()} IRR)`,
        );
      }
    }

    doc.end();

    const pdfBuffer = Buffer.concat(chunks);

    return new StreamableFile(pdfBuffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="report-${Date.now()}.pdf"`,
    });
  }

  async exportReportExcel(
    agencyId: string | null,
    userId: string,
    userRole: UserRole,
    reportType: ReportType,
    period?: ReportPeriod,
    startDate?: string,
    endDate?: string,
  ): Promise<StreamableFile> {
    // دریافت گزارش
    const report = await this.getFinancialReport(agencyId, userId, userRole, {
      reportType,
      period,
      startDate,
      endDate,
    });

    // ایجاد Excel
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Flight Agency System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Report', {
      properties: { tabColor: { argb: 'FF0000FF' } },
    });

    worksheet.columns = [
      { header: 'Category', key: 'category', width: 35 },
      { header: 'Amount (IRR)', key: 'amount', width: 20 },
      { header: 'Percentage (%)', key: 'percentage', width: 15 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    let rowIndex = 2;

    if (report && typeof report === 'object') {
      if ('totalRevenue' in report && 'netProfit' in report) {
        const data = report as ProfitLossReportDto;

        worksheet.addRow(['Profit & Loss Report']);
        worksheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
        const titleRow = worksheet.getRow(rowIndex);
        titleRow.font = { bold: true, size: 14 };
        rowIndex++;

        worksheet.addRow(['Period', data.period, '']);
        rowIndex++;
        worksheet.addRow(['Total Revenue', data.totalRevenue, '']);
        worksheet.addRow(['Total Expenses', data.totalExpenses, '']);
        worksheet.addRow(['Net Profit', data.netProfit, '']);
        worksheet.addRow(['Profit Margin', data.netProfitMargin.toFixed(2), '']);
        rowIndex += 2;

        const revenueHeaderRow = worksheet.addRow(['Revenue Breakdown', '', '']);
        revenueHeaderRow.font = { bold: true };
        rowIndex++;

        data.revenue.forEach((item) => {
          worksheet.addRow([item.category, item.amount, item.percentage]);
          rowIndex++;
        });
        rowIndex++;

        const expenseHeaderRow = worksheet.addRow(['Expenses Breakdown', '', '']);
        expenseHeaderRow.font = { bold: true };
        rowIndex++;

        data.expenses.forEach((item) => {
          worksheet.addRow([item.category, item.amount, item.percentage]);
          rowIndex++;
        });
      }

      if ('total' in report && 'invoices' in report) {
        const data = report as InvoiceSummaryDto;

        worksheet.addRow(['Invoice Summary Report']);
        worksheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
        const titleRow = worksheet.getRow(rowIndex);
        titleRow.font = { bold: true, size: 14 };
        rowIndex++;

        worksheet.addRow(['Total Invoices', data.total, '']);
        worksheet.addRow(['Total Amount', data.totalAmount, '']);
        worksheet.addRow(['Paid Invoices', data.paid, '']);
        worksheet.addRow(['Paid Amount', data.paidAmount, '']);
        worksheet.addRow(['Unpaid Invoices', data.unpaid, '']);
        worksheet.addRow(['Unpaid Amount', data.unpaidAmount, '']);
        rowIndex += 2;

        const invoiceHeaderRow = worksheet.addRow([
          'Invoice Number',
          'Customer',
          'Total',
          'Status',
        ]);
        invoiceHeaderRow.font = { bold: true };
        rowIndex++;

        data.invoices.forEach((inv) => {
          worksheet.addRow([
            inv.invoiceNumber,
            inv.customerName,
            inv.total,
            inv.status,
          ]);
          rowIndex++;
        });
      }
    }

    worksheet.eachRow((row) => {
      row.eachCell((cell, colNumber) => {
        if (typeof cell.value === 'number' && colNumber === 2) {
          cell.numFmt = '#,##0';
        }
        if (typeof cell.value === 'number' && colNumber === 3) {
          cell.numFmt = '0.00';
        }
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(excelBuffer);

    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="report-${Date.now()}.xlsx"`,
    });
  }
}