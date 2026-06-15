import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyDto, UpdateAgencyDto, ChangeAgencyPlanDto } from './dto';
import { AgencyStatus, UserRole, UserStatus, AgencyPlan, Plan, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Define proper return type using Prisma's types
type AgencyWithDetails = Prisma.AgencyGetPayload<{
  include: {
    _count: {
      select: {
        users: boolean;
        bankCards: boolean;
        invoices: boolean;
        tickets: boolean;
        payments: boolean;
      };
    };
    users: {
      select: {
        id: boolean;
        email: boolean;
        firstName: boolean;
        lastName: boolean;
        role: boolean;
        status: boolean;
        createdAt: boolean;
      };
    };
    bankCards: boolean;
    agencyPlans: {
      include: {
        plan: boolean;
      };
    };
  };
}>;

@Injectable()
export class AgenciesService {
  constructor(private prisma: PrismaService) {}

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + 'A1!';
  }

  private sanitizeString(input: string): string {
    if (!input) return input;
    return input.trim().replace(/[<>]/g, '');
  }

async create(dto: CreateAgencyDto , adminId?: string) {
  // Check if agency with same name or email already exists
  const existingAgency = await this.prisma.agency.findFirst({
    where: {
      OR: [
        { name: dto.name },
        ...(dto.email ? [{ email: dto.email }] : []),
        ...(dto.registrationNumber ? [{ registrationNumber: dto.registrationNumber }] : []),
      ],
    },
  });

  if (existingAgency) {
    throw new ConflictException('Agency with this name, email, or registration number already exists');
  }

  // Create agency
  const agency = await this.prisma.agency.create({
    data: {
      name: this.sanitizeString(dto.name),
      registrationNumber: dto.registrationNumber ? this.sanitizeString(dto.registrationNumber) : null,
      phone: dto.phone ? this.sanitizeString(dto.phone) : null,
      email: dto.email ? this.sanitizeString(dto.email) : null,
      address: dto.address ? this.sanitizeString(dto.address) : null,
      status: dto.status || AgencyStatus.TRIAL,
      trialExpiresAt: dto.trialExpiresAt,
    },
  });

  // Create General Manager user for the agency
  const temporaryPassword = this.generateTemporaryPassword();
  const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

  const contactName = dto.contactName || 'مدیر کل';
  const firstName = contactName.split(' ')[0] || 'مدیر';
  const lastName = contactName.split(' ')[1] || 'کل';

  const generalManager = await this.prisma.user.create({
    data: {
      email: dto.email || `${agency.name.replace(/\s/g, '').toLowerCase()}@agency.com`,
      passwordHash: hashedPassword,
      firstName: this.sanitizeString(firstName),
      lastName: this.sanitizeString(lastName),
      phone: dto.phone || null,
      role: UserRole.GENERAL_MANAGER,
      agencyId: agency.id,
      status: UserStatus.ACTIVE,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
    },
  });

  // Log activity - حذف شده یا با userId معتبر جایگزین کنید
  // اگر می‌خواهید لاگ داشته باشید، باید userId واقعی (مثلاً از JWT) دریافت کنید
  // فعلاً این بخش را کامنت می‌کنیم تا خطا ندهد
  
  // await this.prisma.activityLog.create({
  //   data: {
  //     userId: 'system', // این خط مشکل دارد چون کاربر 'system' وجود ندارد
  //     agencyId: agency.id,
  //     action: 'CREATE_AGENCY_WITH_MANAGER',
  //     entityType: 'Agency',
  //     entityId: agency.id,
  //     newData: { agencyName: agency.name, managerEmail: generalManager.email },
  //   },
  // });

  return {
    agency,
    generalManager,
    temporaryPassword,
    message: `Agency created successfully. General Manager password: ${temporaryPassword}`,
  };
}
  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: AgencyStatus,
    search?: string,
  ): Promise<{
    data: any[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { registrationNumber: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [agencies, total] = await Promise.all([
      this.prisma.agency.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              bankCards: true,
              invoices: true,
              tickets: true,
            },
          },
          agencyPlans: {
            where: { isActive: true },
            include: { plan: true },
            take: 1,
          },
        },
      }),
      this.prisma.agency.count({ where }),
    ]);

    return {
      data: agencies,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, includeDetails: boolean = false): Promise<any> {
    const includeObj: Prisma.AgencyInclude = {
      _count: {
        select: {
          users: true,
          bankCards: true,
          invoices: true,
          tickets: true,
          payments: true,
        },
      },
    };

    if (includeDetails) {
      includeObj.users = {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
        },
      };
      includeObj.bankCards = true;
      includeObj.agencyPlans = {
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      };
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id },
      include: includeObj,
    });

    if (!agency) {
      throw new NotFoundException(`Agency with ID ${id} not found`);
    }

    return agency;
  }

  async update(id: string, dto: UpdateAgencyDto) {
    await this.findOne(id);

    // If changing email, check for uniqueness
    if (dto.email) {
      const existing = await this.prisma.agency.findFirst({
        where: {
          email: dto.email,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException('Another agency with this email already exists');
      }
    }

    const agency = await this.prisma.agency.update({
      where: { id },
      data: {
        name: dto.name ? this.sanitizeString(dto.name) : undefined,
        registrationNumber: dto.registrationNumber ? this.sanitizeString(dto.registrationNumber) : undefined,
        phone: dto.phone ? this.sanitizeString(dto.phone) : undefined,
        email: dto.email ? this.sanitizeString(dto.email) : undefined,
        address: dto.address ? this.sanitizeString(dto.address) : undefined,
        status: dto.status,
        trialExpiresAt: dto.trialExpiresAt,
      },
    });

    return agency;
  }

  async changeStatus(id: string, status: AgencyStatus) {
    await this.findOne(id);

    const agency = await this.prisma.agency.update({
      where: { id },
      data: { status },
    });

    // If agency is deactivated, deactivate all its users
    if (status === AgencyStatus.INACTIVE || status === AgencyStatus.SUSPENDED) {
      await this.prisma.user.updateMany({
        where: { agencyId: id },
        data: { status: UserStatus.INACTIVE },
      });
    }

    return agency;
  }

  async changePlan(id: string, dto: ChangeAgencyPlanDto, adminId: string) {
    const agency = await this.findOne(id);

    // Check if plan exists
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${dto.planId} not found or inactive`);
    }

    // Deactivate current active plan
    await this.prisma.agencyPlan.updateMany({
      where: {
        agencyId: id,
        isActive: true,
      },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });

    // Create new agency plan
    const agencyPlan = await this.prisma.agencyPlan.create({
      data: {
        agencyId: id,
        planId: dto.planId,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isActive: true,
      },
      include: { plan: true },
    });

    // Get the actual plan ID from the agency object safely
    let previousPlanId: string | null = null;
    if (agency.agencyPlans && Array.isArray(agency.agencyPlans) && agency.agencyPlans.length > 0) {
      previousPlanId = agency.agencyPlans[0].planId;
    }

    // Log plan change
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        agencyId: id,
        action: 'CHANGE_AGENCY_PLAN',
        entityType: 'AgencyPlan',
        entityId: agencyPlan.id,
        oldData: { previousPlan: previousPlanId },
        newData: { newPlan: dto.planId },
      },
    });

    return agencyPlan;
  }

  async getPlanHistory(id: string) {
    await this.findOne(id);

    const history = await this.prisma.agencyPlan.findMany({
      where: { agencyId: id },
      include: { plan: true },
      orderBy: { startDate: 'desc' },
    });

    return history;
  }

  async delete(id: string) {
    await this.findOne(id);

    // Check if agency has any data that might be problematic to delete
    const agency = await this.prisma.agency.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            invoices: true,
            tickets: true,
            payments: true,
          },
        },
      },
    });

    if (agency?._count.invoices && agency._count.invoices > 0) {
      throw new BadRequestException(
        `Cannot delete agency with ${agency._count.invoices} invoices. Archive instead.`,
      );
    }

    await this.prisma.agency.delete({ where: { id } });

    return { message: 'Agency deleted successfully' };
  }

  async getDashboardStats(id: string) {
    await this.findOne(id);

    const [users, tickets, invoices, payments, bankCards] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role', 'status'],
        where: { agencyId: id },
        _count: true,
      }),
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { agencyId: id },
        _count: true,
      }),
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: { agencyId: id },
        _count: true,
        _sum: { total: true },
      }),
      this.prisma.payment.groupBy({
        by: ['status'],
        where: { agencyId: id },
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.bankCard.count({
        where: { agencyId: id, status: 'ACTIVE' },
      }),
    ]);

    // Type-safe aggregation
    const totalRevenue = payments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + (p._sum.amount || 0), 0);

    const totalUnpaidInvoices = invoices
      .filter(i => i.status === 'UNPAID')
      .reduce((sum, i) => sum + (i._sum.total || 0), 0);

    return {
      users: {
        total: users.reduce((sum, u) => sum + u._count, 0),
        byRole: users,
        byStatus: users,
      },
      tickets: {
        total: tickets.reduce((sum, t) => sum + t._count, 0),
        byStatus: tickets,
      },
      invoices: {
        total: invoices.reduce((sum, i) => sum + i._count, 0),
        totalUnpaidAmount: totalUnpaidInvoices,
        byStatus: invoices,
      },
      payments: {
        total: payments.reduce((sum, p) => sum + p._count, 0),
        totalRevenue,
        byStatus: payments,
      },
      bankCards: {
        active: bankCards,
      },
    };
  }
}