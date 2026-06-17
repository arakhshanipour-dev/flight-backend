// src/payments/payments.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto';
import { InvoiceStatus, PaymentStatus, UserRole, AgencyStatus, BankCardStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // ============ Helper Methods ============

  private async validateAgencyManagerAccess(agencyId: string, userId: string, requireGeneralManager: boolean = false) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        status: 'ACTIVE',
      },
    });

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    if (requireGeneralManager && user.role !== UserRole.GENERAL_MANAGER) {
      throw new ForbiddenException('Only General Manager can perform this action');
    }

    if (!requireGeneralManager && user.role !== UserRole.AGENCY_MANAGER && user.role !== UserRole.GENERAL_MANAGER) {
      throw new ForbiddenException('Only Agency Manager or General Manager can perform this action');
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency || (agency.status !== AgencyStatus.ACTIVE && agency.status !== AgencyStatus.TRIAL)) {
      throw new ForbiddenException('Agency is not active');
    }

    return user;
  }

  // ✅ اصلاح شده: اضافه کردن tickets به include
  private async validateInvoiceForPayment(invoiceId: string, agencyId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        agencyId: agencyId,
      },
      include: {
        bankCard: true,
        tickets: {           // ✅ اضافه شده
          select: {
            ticketNumber: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.COMPLETED },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay a cancelled invoice');
    }

    return invoice;
  }

  private async checkInvoiceFullyPaid(invoiceId: string, agencyId: string): Promise<boolean> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, agencyId: agencyId },
      include: {
        payments: {
          where: { status: PaymentStatus.COMPLETED },
        },
      },
    });

    if (!invoice) return false;

    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    return totalPaid >= invoice.total;
  }

  // ============ CRUD Operations ============

async create(agencyId: string, userId: string, dto: CreatePaymentDto) {
  await this.validateAgencyManagerAccess(agencyId, userId, false);

  const invoice = await this.validateInvoiceForPayment(dto.invoiceId, agencyId);

  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingAmount = invoice.total - totalPaid;

  if (dto.amount <= 0) {
    throw new BadRequestException('Payment amount must be greater than 0');
  }

  if (dto.amount > remainingAmount) {
    throw new BadRequestException(
      `Payment amount (${dto.amount.toLocaleString()}) exceeds remaining amount (${remainingAmount.toLocaleString()})`
    );
  }

  if (dto.paymentMethod !== PaymentMethod.CASH && !dto.trackingCode) {
    throw new BadRequestException('Tracking code is required for non-cash payments');
  }

  if (dto.trackingCode) {
    const existing = await this.prisma.payment.findFirst({
      where: { trackingCode: dto.trackingCode },
    });
    if (existing) {
      throw new BadRequestException('Tracking code already exists');
    }
  }

  let receiptNumber = dto.receiptNumber;
  if (dto.paymentMethod === PaymentMethod.CASH && !receiptNumber) {
    const count = await this.prisma.cashReceipt.count();
    receiptNumber = `RCP-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  // 🔥 اضافه کردن currencyCode
  const payment = await this.prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      agencyId: agencyId,
      bankCardId: dto.paymentMethod !== PaymentMethod.CASH ? invoice.bankCardId : null,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
      trackingCode: dto.trackingCode || null,
      receiptNumber: receiptNumber || null,
      notes: dto.notes || null,
      currencyCode: 'IRR', // 🔥 جدید
      status: PaymentStatus.COMPLETED,
      paidAt: new Date(),
    },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
        },
      },
      bankCard: {
        select: {
          bankName: true,
          accountHolder: true,
        },
      },
    },
  });


    // Create cash receipt if payment method is CASH
    if (dto.paymentMethod === PaymentMethod.CASH && receiptNumber) {
      const newRemaining = remainingAmount - dto.amount;
      await this.prisma.cashReceipt.create({
        data: {
          paymentId: payment.id,
          receiptNumber: receiptNumber,
          customerName: invoice.customerName,
          customerPhone: invoice.customerPhone,
          ticketNumbers: invoice.tickets?.map(t => t.ticketNumber) || [], // ✅ الان کار می‌کند
          totalAmount: invoice.total,
          paidAmount: dto.amount,
          remainingAmount: newRemaining,
          paymentDate: new Date(),
          printedAt: new Date(),
          printedBy: userId,
        },
      });
    }

    // Check if invoice is fully paid
    const isFullyPaid = await this.checkInvoiceFullyPaid(invoice.id, agencyId);

    // Update invoice status
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.UNPAID,
        paidAt: isFullyPaid ? new Date() : null,
      },
    });

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'CREATE_PAYMENT',
        entityType: 'Payment',
        entityId: payment.id,
        newData: {
          invoiceNumber: invoice.invoiceNumber,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          trackingCode: dto.trackingCode,
        },
      },
    });

    // If organization has panel, update organization panel
    if (invoice.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: invoice.organizationId },
      });
      
      if (organization?.hasPanel) {
        await this.prisma.activityLog.create({
          data: {
            userId: userId,
            organizationId: invoice.organizationId,
            action: 'ORGANIZATION_PAYMENT_RECEIVED',
            entityType: 'Payment',
            entityId: payment.id,
            newData: {
              invoiceNumber: invoice.invoiceNumber,
              amount: dto.amount,
              remainingAmount: remainingAmount - dto.amount,
            },
          },
        });
      }
    }

    return {
      id: payment.id,
      invoiceId: payment.invoiceId,
      invoiceNumber: payment.invoice.invoiceNumber,
      agencyId: payment.agencyId,
      bankCardId: payment.bankCardId,
      bankName: payment.bankCard?.bankName || 'نقدی',
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      trackingCode: payment.trackingCode,
      receiptNumber: payment.receiptNumber,
      notes: payment.notes,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      remainingAmount: remainingAmount - dto.amount,
    };
  }


  async findAll(
    agencyId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: PaymentStatus,
    startDate?: string,
    endDate?: string,
  ) {
    await this.validateAgencyManagerAccess(agencyId, userId, false);

    const skip = (page - 1) * limit;
    
    const where: any = { agencyId: agencyId };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) {
        const startDateTime = new Date(startDate);
        startDateTime.setHours(0, 0, 0, 0);
        where.paidAt.gte = startDateTime;
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.paidAt.lte = endDateTime;
      }
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paidAt: 'desc' },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              customerName: true,
              tickets: {
                select: {
                  ticketNumber: true,
                  passengerName: true,
                },
                take: 3,
              },
            },
          },
          bankCard: {
            select: {
              bankName: true,
              accountHolder: true,
            },
          },
          cashReceipt: true,
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments.map(payment => ({
        id: payment.id,
        invoiceId: payment.invoiceId,
        invoiceNumber: payment.invoice.invoiceNumber,
        customerName: payment.invoice.customerName,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        trackingCode: payment.trackingCode,
        receiptNumber: payment.receiptNumber,
        notes: payment.notes,
        status: payment.status,
        bankName: payment.bankCard?.bankName || 'نقدی',
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        tickets: payment.invoice.tickets,
        cashReceipt: payment.cashReceipt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(agencyId: string, userId: string, paymentId: string) {
    await this.validateAgencyManagerAccess(agencyId, userId, false);

    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        agencyId: agencyId,
      },
      include: {
        invoice: {
          include: {
            tickets: true,
            organization: true,
          },
        },
        bankCard: {
          select: {
            id: true,
            bankName: true,
            accountHolder: true,
            sheba: true,
          },
        },
        cashReceipt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async getSummary(agencyId: string, userId: string) {
    await this.validateAgencyManagerAccess(agencyId, userId, false);

    const [totalRevenue, totalPayments, recentPayments, monthlyStats] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          agencyId: agencyId,
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.count({
        where: { agencyId: agencyId, status: PaymentStatus.COMPLETED },
      }),
      this.prisma.payment.findMany({
        where: { agencyId: agencyId, status: PaymentStatus.COMPLETED },
        take: 10,
        orderBy: { paidAt: 'desc' },
        include: {
          invoice: {
            select: { 
              invoiceNumber: true, 
              customerName: true,
            },
          },
        },
      }),
      this.prisma.payment.groupBy({
        by: ['paidAt'],
        where: {
          agencyId: agencyId,
          status: PaymentStatus.COMPLETED,
          paidAt: {
            not: null,
          },
        },
        _count: true,
        _sum: {
          amount: true,
        },
        orderBy: {
          paidAt: 'desc',
        },
        take: 12,
      }),
    ]);

    const monthlyStatsProcessed = monthlyStats.map(stat => ({
      month: stat.paidAt ? new Date(stat.paidAt).toISOString().slice(0, 7) : null,
      count: stat._count,
      total: stat._sum.amount || 0,
    }));

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      totalPaymentsCount: totalRevenue._count || 0,
      totalPayments,
      recentPayments: recentPayments.map(p => ({
        id: p.id,
        invoiceNumber: p.invoice.invoiceNumber,
        customerName: p.invoice.customerName,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        trackingCode: p.trackingCode,
        paidAt: p.paidAt,
      })),
      monthlyStats: monthlyStatsProcessed,
    };
  }

  async delete(agencyId: string, userId: string, paymentId: string) {
    await this.validateAgencyManagerAccess(agencyId, userId, true);

    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        agencyId: agencyId,
      },
      include: {
        invoice: true,
        cashReceipt: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Check if payment is old (optional: prevent reversing old payments)
    const daysSincePayment = Math.floor((Date.now() - (payment.paidAt?.getTime() || 0)) / (1000 * 60 * 60 * 24));
    if (daysSincePayment > 30) {
      throw new BadRequestException('Cannot reverse payments older than 30 days');
    }

    // Delete cash receipt if exists
    if (payment.cashReceipt) {
      await this.prisma.cashReceipt.delete({
        where: { id: payment.cashReceipt.id },
      });
    }

    // Delete payment
    await this.prisma.payment.delete({ where: { id: paymentId } });

    // Check if invoice has other payments
    const otherPayments = await this.prisma.payment.findMany({
      where: {
        invoiceId: payment.invoiceId,
        status: PaymentStatus.COMPLETED,
        id: { not: paymentId },
      },
    });

    // Update invoice status based on remaining payments
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: payment.invoiceId },
    });

    if (invoice) {
      const totalPaid = otherPayments.reduce((sum, p) => sum + p.amount, 0);
      const isFullyPaid = totalPaid >= invoice.total;

      await this.prisma.invoice.update({
        where: { id: payment.invoiceId },
        data: {
          status: isFullyPaid ? InvoiceStatus.PAID : InvoiceStatus.UNPAID,
          paidAt: isFullyPaid ? new Date() : null,
        },
      });
    }

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'DELETE_PAYMENT',
        entityType: 'Payment',
        entityId: paymentId,
        newData: { reversedBy: userId, reason: 'Payment reversal by General Manager' },
      },
    });

    return { 
      message: 'Payment reversed and deleted successfully',
      invoiceId: payment.invoiceId,
      reversedAmount: payment.amount,
    };
  }

  // ============ Cash Receipt Methods ============

  async getCashReceipt(agencyId: string, userId: string, receiptNumber: string) {
    await this.validateAgencyManagerAccess(agencyId, userId, false);

    const receipt = await this.prisma.cashReceipt.findFirst({
      where: {
        receiptNumber: receiptNumber,
        payment: {
          agencyId: agencyId,
        },
      },
      include: {
        payment: {
          include: {
            invoice: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new NotFoundException('Cash receipt not found');
    }

    return receipt;
  }

  async printCashReceipt(agencyId: string, userId: string, paymentId: string) {
    await this.validateAgencyManagerAccess(agencyId, userId, false);

    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        agencyId: agencyId,
        paymentMethod: PaymentMethod.CASH,
      },
      include: {
        cashReceipt: true,
        invoice: true,
      },
    });

    if (!payment) {
      throw new NotFoundException('Cash payment not found');
    }

    if (!payment.cashReceipt) {
      throw new NotFoundException('Cash receipt not found for this payment');
    }

    // Update printed status
    const receipt = await this.prisma.cashReceipt.update({
      where: { id: payment.cashReceipt.id },
      data: {
        printedAt: new Date(),
        printedBy: userId,
      },
    });

    return receipt;
  }
}