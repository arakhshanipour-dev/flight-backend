import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto';
import { InvoiceStatus, TicketStatus, BankCardStatus, UserRole, AgencyStatus } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  // ============ Helper Methods ============

  private async generateInvoiceNumber(agencyId: string): Promise<string> {
    const currentYear = new Date().getFullYear();
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        agencyId: agencyId,
        invoiceNumber: { startsWith: `INV-${currentYear}-` },
      },
      orderBy: { invoiceNumber: 'desc' },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastNumber = lastInvoice.invoiceNumber.split('-').pop();
      if (lastNumber) {
        sequence = parseInt(lastNumber) + 1;
      }
    }

    return `INV-${currentYear}-${sequence.toString().padStart(6, '0')}`;
  }

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

    return { user, agency };
  }

  // ============ CRUD Operations ============

  async create(agencyId: string, userId: string, dto: CreateInvoiceDto) {
    const { user, agency } = await this.validateAgencyManagerAccess(agencyId, userId, false);

    // Validate bank card
    const bankCard = await this.prisma.bankCard.findFirst({
      where: {
        id: dto.bankCardId,
        agencyId: agencyId,
        status: BankCardStatus.ACTIVE,
      },
    });

    if (!bankCard) {
      throw new BadRequestException('Invalid or inactive bank card');
    }

    // Validate tickets
    const tickets = await this.prisma.ticket.findMany({
      where: {
        id: { in: dto.ticketIds },
        agencyId: agencyId,
      },
    });

    if (tickets.length !== dto.ticketIds.length) {
      throw new BadRequestException('One or more tickets not found');
    }

    // Check if any ticket is already invoiced
    const invoicedTicket = tickets.find(t => t.status === TicketStatus.INVOICED);
    if (invoicedTicket) {
      throw new BadRequestException(`Ticket ${invoicedTicket.ticketNumber} is already invoiced`);
    }

    // Check if any ticket is not finalized
    const notFinalizedTicket = tickets.find(t => t.status !== TicketStatus.FINALIZED);
    if (notFinalizedTicket) {
      throw new BadRequestException(`Ticket ${notFinalizedTicket.ticketNumber} must be finalized before invoicing`);
    }

    // Calculate totals
    const subtotal = tickets.reduce((sum, t) => sum + t.price, 0);
    const total = subtotal; // Currently no tax, but can be extended

    // Determine customer name
    let customerName = dto.customerName;
    let organizationId = dto.organizationId;

    if (dto.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
      });
      if (!organization) {
        throw new BadRequestException('Organization not found');
      }
      customerName = organization.name;
    }

    if (!customerName && tickets.length === 1) {
      customerName = tickets[0].passengerName;
    }

    if (!customerName) {
      throw new BadRequestException('Customer name is required when invoicing multiple tickets without organization');
    }

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(agencyId);

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        invoiceNumber,
        agencyId: agencyId,
        organizationId: organizationId,
        customerName: customerName,
        customerPhone: dto.customerPhone,
        bankCardId: dto.bankCardId,
        templateStyle: dto.templateStyle,
        subtotal,
        total,
        status: InvoiceStatus.UNPAID,
        tickets: {
          connect: tickets.map(t => ({ id: t.id })),
        },
      },
      include: {
        tickets: true,
        bankCard: true,
      },
    });

    // Update ticket status to INVOICED
    await this.prisma.ticket.updateMany({
      where: { id: { in: dto.ticketIds } },
      data: { status: TicketStatus.INVOICED, invoiceId: invoice.id },
    });

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'CREATE_INVOICE',
        entityType: 'Invoice',
        entityId: invoice.id,
        newData: { invoiceNumber, total, ticketCount: tickets.length },
      },
    });

    // Return with masked card number
    return {
      ...invoice,
      agencyName: agency.name,
      bankCard: {
        ...invoice.bankCard,
        maskedCardNumber: '****-****-****-****',
      },
    };
  }

  async findAll(
    agencyId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: InvoiceStatus,
    search?: string,
  ) {
    await this.validateAgencyManagerAccess(agencyId, userId, false);

    const skip = (page - 1) * limit;
    
    const where: any = { agencyId: agencyId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tickets: {
            select: {
              id: true,
              ticketNumber: true,
              passengerName: true,
              price: true,
            },
          },
          bankCard: {
            select: {
              id: true,
              bankName: true,
              accountHolder: true,
            },
          },
          payment: {
            select: {
              id: true,
              status: true,
              amount: true,
              trackingCode: true,
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { name: true },
    });

    return {
      data: invoices.map(inv => ({
        ...inv,
        agencyName: agency?.name,
        bankCard: {
          ...inv.bankCard,
          maskedCardNumber: '****-****-****-****',
        },
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(agencyId: string, userId: string, invoiceId: string) {
    await this.validateAgencyManagerAccess(agencyId, userId, false);

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        agencyId: agencyId,
      },
      include: {
        tickets: true,
        bankCard: true,
        payment: true,
        organization: {
          select: {
            id: true,
            name: true,
            nationalId: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      select: { name: true, registrationNumber: true, phone: true, address: true },
    });

    return {
      ...invoice,
      agencyName: agency?.name,
      agencyRegistrationNumber: agency?.registrationNumber,
      agencyPhone: agency?.phone,
      agencyAddress: agency?.address,
      bankCard: {
        ...invoice.bankCard,
        maskedCardNumber: '****-****-****-****',
      },
    };
  }

    async update(agencyId: string, userId: string, invoiceId: string, dto: UpdateInvoiceDto) {
    await this.validateAgencyManagerAccess(agencyId, userId, true);

    const invoice = await this.prisma.invoice.findFirst({
        where: {
        id: invoiceId,
        agencyId: agencyId,
        },
    });

    if (!invoice) {
        throw new NotFoundException('Invoice not found');
    }

    // Check if invoice can be updated
    if (invoice.status === InvoiceStatus.PAID) {
        throw new BadRequestException('Cannot update a paid invoice');
    }

    // If status is being changed to CANCELLED
    if (dto.status === InvoiceStatus.CANCELLED) {
        // Return tickets to FINALIZED status (only if not already cancelled)
        await this.prisma.ticket.updateMany({
        where: { invoiceId: invoiceId },
        data: { status: TicketStatus.FINALIZED, invoiceId: null },
        });
    }

    const updatedInvoice = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        templateStyle: dto.templateStyle,
        status: dto.status,
        },
    });

    await this.prisma.activityLog.create({
        data: {
        userId: userId,
        agencyId: agencyId,
        action: 'UPDATE_INVOICE',
        entityType: 'Invoice',
        entityId: invoiceId,
        newData: { updatedFields: Object.keys(dto) },
        },
    });

    return updatedInvoice;
    }

  async delete(agencyId: string, userId: string, invoiceId: string) {
    await this.validateAgencyManagerAccess(agencyId, userId, true);

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        agencyId: agencyId,
      },
      include: {
        payment: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot delete a paid invoice');
    }

    if (invoice.payment) {
      throw new BadRequestException('Cannot delete an invoice with existing payment');
    }

    // Return tickets to FINALIZED status
    await this.prisma.ticket.updateMany({
      where: { invoiceId: invoiceId },
      data: { status: TicketStatus.FINALIZED, invoiceId: null },
    });

    await this.prisma.invoice.delete({ where: { id: invoiceId } });

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'DELETE_INVOICE',
        entityType: 'Invoice',
        entityId: invoiceId,
      },
    });

    return { message: 'Invoice deleted successfully' };
  }

  // ============ General Manager Approval ============

  async approveInvoice(agencyId: string, userId: string, invoiceId: string) {
    await this.validateAgencyManagerAccess(agencyId, userId, true);

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        agencyId: agencyId,
        status: InvoiceStatus.UNPAID,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Unpaid invoice not found');
    }

    // Approval is just marking that General Manager has reviewed
    // The actual payment will be registered by Agency Manager

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'APPROVE_INVOICE',
        entityType: 'Invoice',
        entityId: invoiceId,
      },
    });

    return { message: 'Invoice approved successfully. Ready for payment.' };
  }

  async getPendingApprovals(agencyId: string, userId: string) {
    await this.validateAgencyManagerAccess(agencyId, userId, true);

    const pendingInvoices = await this.prisma.invoice.findMany({
      where: {
        agencyId: agencyId,
        status: InvoiceStatus.UNPAID,
      },
      include: {
        tickets: {
          select: {
            ticketNumber: true,
            passengerName: true,
            price: true,
          },
        },
        bankCard: {
          select: {
            bankName: true,
            accountHolder: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pendingInvoices;
  }
}