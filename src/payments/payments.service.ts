import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto';
import { InvoiceStatus, PaymentStatus, UserRole, AgencyStatus, BankCardStatus } from '@prisma/client';

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

  private async validateInvoiceForPayment(invoiceId: string, agencyId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        agencyId: agencyId,
      },
      include: {
        bankCard: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay a cancelled invoice');
    }

    // Validate bank card is still active
    const bankCard = await this.prisma.bankCard.findFirst({
      where: {
        id: invoice.bankCardId,
        agencyId: agencyId,
        status: BankCardStatus.ACTIVE,
      },
    });

    if (!bankCard) {
      throw new BadRequestException('The bank card on this invoice is no longer active');
    }

    return invoice;
  }

  // ============ CRUD Operations ============

  async create(agencyId: string, userId: string, dto: CreatePaymentDto) {
    await this.validateAgencyManagerAccess(agencyId, userId, false);

    // Validate invoice
    const invoice = await this.validateInvoiceForPayment(dto.invoiceId, agencyId);

    // Validate amount
    if (dto.amount !== invoice.total) {
      throw new BadRequestException(`Payment amount must equal invoice total (${invoice.total})`);
    }

    // Check if payment already exists for this invoice
    const existingPayment = await this.prisma.payment.findUnique({
      where: { invoiceId: invoice.id },
    });

    if (existingPayment) {
      throw new BadRequestException('A payment already exists for this invoice');
    }

    // Create payment
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        agencyId: agencyId,
        bankCardId: invoice.bankCardId,
        amount: dto.amount,
        trackingCode: dto.trackingCode,
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

    // Update invoice status to PAID
    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
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
        newData: { invoiceNumber: invoice.invoiceNumber, amount: dto.amount, trackingCode: dto.trackingCode },
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
            newData: { invoiceNumber: invoice.invoiceNumber, amount: dto.amount },
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
      bankName: payment.bankCard.bankName,
      amount: payment.amount,
      trackingCode: payment.trackingCode,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
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
        trackingCode: payment.trackingCode,
        status: payment.status,
        bankName: payment.bankCard.bankName,
        paidAt: payment.paidAt,
        createdAt: payment.createdAt,
        tickets: payment.invoice.tickets,
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
      // Using Prisma's groupBy instead of raw SQL for better type safety
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

    // Process monthly stats from the results
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

    // Reverse payment: update invoice back to UNPAID
    await this.prisma.invoice.update({
      where: { id: payment.invoiceId },
      data: {
        status: InvoiceStatus.UNPAID,
        paidAt: null,
      },
    });

    await this.prisma.payment.delete({ where: { id: paymentId } });

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
}