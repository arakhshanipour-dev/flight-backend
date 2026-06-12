import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto';
import { UserRole, UserStatus, InvoiceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  // ============ Helper Methods ============

  private async validateSuperAdminAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
    });
    if (!user) {
      throw new ForbiddenException('Only Super Admin can perform this action');
    }
    return user;
  }

  private async validateOrganizationAccess(organizationId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: organizationId,
        role: UserRole.ORGANIZATION_ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    if (!user) {
      throw new ForbiddenException('Access denied');
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization || !organization.hasPanel) {
      throw new ForbiddenException('Organization panel is not active');
    }
    return { user, organization };
  }

  // ============ Super Admin Methods ============

  async create(adminId: string, dto: CreateOrganizationDto) {
    await this.validateSuperAdminAccess(adminId);

    // Check if organization with same name or email exists
    const existing = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { name: dto.name },
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(dto.nationalId ? [{ nationalId: dto.nationalId }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException('Organization with this name, email, or national ID already exists');
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        nationalId: dto.nationalId,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        hasPanel: dto.hasPanel || false,
        panelCreatedAt: dto.hasPanel ? new Date() : null,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'CREATE_ORGANIZATION',
        entityType: 'Organization',
        entityId: organization.id,
        newData: { name: dto.name, hasPanel: dto.hasPanel },
      },
    });

    return organization;
  }

  async findAll(adminId: string, page: number = 1, limit: number = 20, search?: string, hasPanel?: boolean) {
    await this.validateSuperAdminAccess(adminId);

    const skip = (page - 1) * limit;
    
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nationalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (hasPanel !== undefined) {
      where.hasPanel = hasPanel;
    }

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          users: {
            where: { role: UserRole.ORGANIZATION_ADMIN },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          _count: {
            select: { invoices: true },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data: organizations,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(adminId: string, organizationId: string) {
    await this.validateSuperAdminAccess(adminId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          where: { role: UserRole.ORGANIZATION_ADMIN },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            status: true,
          },
        },
        _count: {
          select: { invoices: true },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(adminId: string, organizationId: string, dto: UpdateOrganizationDto) {
    await this.validateSuperAdminAccess(adminId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // If enabling panel for the first time
    const wasPanelEnabled = organization.hasPanel;
    const isPanelEnabled = dto.hasPanel === true;

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: dto.name,
        nationalId: dto.nationalId,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        hasPanel: dto.hasPanel,
        panelCreatedAt: (!wasPanelEnabled && isPanelEnabled) ? new Date() : organization.panelCreatedAt,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'UPDATE_ORGANIZATION',
        entityType: 'Organization',
        entityId: organizationId,
        newData: { updatedFields: Object.keys(dto) },
      },
    });

    return updated;
  }

  async createOrganizationAdmin(
    adminId: string,
    organizationId: string,
    email: string,
    firstName: string,
    lastName: string,
    phone?: string,
  ) {
    await this.validateSuperAdminAccess(adminId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          where: { role: UserRole.ORGANIZATION_ADMIN },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (!organization.hasPanel) {
      throw new BadRequestException('Organization does not have a panel. Enable panel first.');
    }

    // Check if organization already has an admin
    if (organization.users.length > 0) {
      throw new BadRequestException('Organization already has an admin. Update existing user instead.');
    }

    // Check if user with this email exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const temporaryPassword = `Org${Math.random().toString(36).slice(-8)}A1!`;
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        phone,
        role: UserRole.ORGANIZATION_ADMIN,
        organizationId: organizationId,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        organizationId: organizationId,
        action: 'CREATE_ORGANIZATION_ADMIN',
        entityType: 'User',
        entityId: user.id,
        newData: { email },
      },
    });

    return {
      user,
      temporaryPassword,
      message: 'Organization admin created successfully',
    };
  }

  async delete(adminId: string, organizationId: string) {
    await this.validateSuperAdminAccess(adminId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        invoices: {
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.invoices.length > 0) {
      throw new BadRequestException('Cannot delete organization with existing invoices');
    }

    await this.prisma.organization.delete({ where: { id: organizationId } });

    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        action: 'DELETE_ORGANIZATION',
        entityType: 'Organization',
        entityId: organizationId,
      },
    });

    return { message: 'Organization deleted successfully' };
  }

  // ============ Organization Admin Methods ============

  async getMyInvoices(
    organizationId: string,
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: InvoiceStatus,
    search?: string,
  ) {
    await this.validateOrganizationAccess(organizationId, userId);

    const skip = (page - 1) * limit;
    
    const where: any = {
      organizationId: organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { agency: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agency: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
            },
          },
          tickets: {
            select: {
              ticketNumber: true,
              passengerName: true,
              passengerPhone: true,
              flightNumber: true,
              origin: true,
              destination: true,
              flightDate: true,
              seatClass: true,
              price: true,
            },
          },
          bankCard: {
            select: {
              bankName: true,
              accountHolder: true,
            },
          },
          payment: {
            select: {
              trackingCode: true,
              paidAt: true,
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getMyInvoice(organizationId: string, userId: string, invoiceId: string) {
    await this.validateOrganizationAccess(organizationId, userId);

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        organizationId: organizationId,
      },
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            registrationNumber: true,
            phone: true,
            address: true,
            email: true,
          },
        },
        tickets: true,
        bankCard: {
          select: {
            bankName: true,
            accountHolder: true,
            sheba: true,
          },
        },
        payment: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async getMyStats(organizationId: string, userId: string) {
    const { organization } = await this.validateOrganizationAccess(organizationId, userId);

    const invoices = await this.prisma.invoice.findMany({
      where: { organizationId: organizationId },
      include: {
        agency: true,
      },
    });

    const totalInvoices = invoices.length;
    const totalPaidInvoices = invoices.filter(i => i.status === InvoiceStatus.PAID).length;
    const totalUnpaidInvoices = invoices.filter(i => i.status === InvoiceStatus.UNPAID).length;
    const totalAmount = invoices.reduce((sum, i) => sum + i.total, 0);
    const totalPaidAmount = invoices
      .filter(i => i.status === InvoiceStatus.PAID)
      .reduce((sum, i) => sum + i.total, 0);

    // Agency interactions
    const agencyMap = new Map<string, { agencyId: string; agencyName: string; invoiceCount: number; totalAmount: number; paidAmount: number }>();
    
    for (const invoice of invoices) {
      const agencyId = invoice.agencyId;
      const agencyName = invoice.agency.name;
      
      if (!agencyMap.has(agencyId)) {
        agencyMap.set(agencyId, {
          agencyId,
          agencyName,
          invoiceCount: 0,
          totalAmount: 0,
          paidAmount: 0,
        });
      }
      
      const stats = agencyMap.get(agencyId)!;
      stats.invoiceCount++;
      stats.totalAmount += invoice.total;
      if (invoice.status === InvoiceStatus.PAID) {
        stats.paidAmount += invoice.total;
      }
    }

    const agencyInteractions = Array.from(agencyMap.values())
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Monthly stats
    const monthlyMap = new Map<string, { invoiceCount: number; totalAmount: number }>();
    
    for (const invoice of invoices) {
      const month = invoice.issuedAt.toISOString().slice(0, 7);
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { invoiceCount: 0, totalAmount: 0 });
      }
      const stats = monthlyMap.get(month)!;
      stats.invoiceCount++;
      stats.totalAmount += invoice.total;
    }

    const monthlyStats = Array.from(monthlyMap.entries())
      .map(([month, stats]) => ({
        month,
        invoiceCount: stats.invoiceCount,
        totalAmount: stats.totalAmount,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    return {
      totalInvoices,
      totalPaidInvoices,
      totalUnpaidInvoices,
      totalAmount,
      totalPaidAmount,
      agencyInteractions,
      monthlyStats,
    };
  }

  async getMyProfile(organizationId: string, userId: string) {
    const { organization, user } = await this.validateOrganizationAccess(organizationId, userId);

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        nationalId: organization.nationalId,
        phone: organization.phone,
        email: organization.email,
        address: organization.address,
        panelCreatedAt: organization.panelCreatedAt,
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    };
  }

  async getAvailableAgencies(organizationId: string, userId: string) {
    await this.validateOrganizationAccess(organizationId, userId);

    // Get all agencies that have issued invoices to this organization
    const agenciesWithInvoices = await this.prisma.invoice.findMany({
      where: { organizationId: organizationId },
      distinct: ['agencyId'],
      include: {
        agency: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
      },
    });

    return agenciesWithInvoices.map(item => item.agency);
  }
}