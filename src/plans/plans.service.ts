import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto';
import { AgencyStatus, Plan, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(private prisma: PrismaService) {}

  // ============ CRUD Operations (Super Admin Only) ============

  async create(dto: CreatePlanDto): Promise<Plan> {
    const existing = await this.prisma.plan.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`Plan with name "${dto.name}" already exists`);
    }

    return this.prisma.plan.create({
      data: {
        name: dto.name,
        description: dto.description,
        priceMonthly: dto.priceMonthly,
        priceYearly: dto.priceYearly,
        maxNormalUsers: dto.maxNormalUsers,
        maxAgencyManagers: dto.maxAgencyManagers,
        maxTicketsPerMonth: dto.maxTicketsPerMonth,
        maxInvoicesPerMonth: dto.maxInvoicesPerMonth,
        features: dto.features,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(page: number = 1, limit: number = 20, isActive?: boolean): Promise<{ data: Plan[]; meta: any }> {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.plan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { priceMonthly: 'asc' },
        include: {
          _count: {
            select: { agencyPlans: true },
          },
        },
      }),
      this.prisma.plan.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        agencyPlans: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            agency: {
              select: { id: true, name: true, status: true },
            },
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    return plan;
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findOne(id);

    if (dto.name && dto.name !== plan.name) {
      const existing = await this.prisma.plan.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new ConflictException(`Plan with name "${dto.name}" already exists`);
      }
    }

    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        priceMonthly: dto.priceMonthly,
        priceYearly: dto.priceYearly,
        maxNormalUsers: dto.maxNormalUsers,
        maxAgencyManagers: dto.maxAgencyManagers,
        maxTicketsPerMonth: dto.maxTicketsPerMonth,
        maxInvoicesPerMonth: dto.maxInvoicesPerMonth,
        features: dto.features,
        isActive: dto.isActive,
      },
    });
  }

  async delete(id: string): Promise<{ message: string }> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: {
        agencyPlans: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.agencyPlans.length > 0) {
      throw new BadRequestException('Cannot delete plan that is currently assigned to agencies');
    }

    await this.prisma.plan.delete({ where: { id } });

    return { message: 'Plan deleted successfully' };
  }

  // ============ Validation Methods (برای اعمال محدودیت‌ها) ============

  async checkTicketLimit(agencyId: string): Promise<void> {
    const activePlan = await this.getActivePlan(agencyId);
    
    if (!activePlan || !activePlan.maxTicketsPerMonth) {
      return;
    }

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const ticketCount = await this.prisma.ticket.count({
      where: {
        agencyId,
        createdAt: { gte: currentMonthStart },
      },
    });

    if (ticketCount >= activePlan.maxTicketsPerMonth) {
      throw new BadRequestException(
        `Monthly ticket limit reached (${activePlan.maxTicketsPerMonth}/${ticketCount})`,
      );
    }
  }

  async checkInvoiceLimit(agencyId: string): Promise<void> {
    const activePlan = await this.getActivePlan(agencyId);
    
    if (!activePlan || !activePlan.maxInvoicesPerMonth) {
      return;
    }

    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);

    const invoiceCount = await this.prisma.invoice.count({
      where: {
        agencyId,
        issuedAt: { gte: currentMonthStart },
      },
    });

    if (invoiceCount >= activePlan.maxInvoicesPerMonth) {
      throw new BadRequestException(
        `Monthly invoice limit reached (${activePlan.maxInvoicesPerMonth}/${invoiceCount})`,
      );
    }
  }

  async getActivePlan(agencyId: string): Promise<{ maxTicketsPerMonth: number | null; maxInvoicesPerMonth: number | null } | null> {
    const agencyPlan = await this.prisma.agencyPlan.findFirst({
      where: {
        agencyId,
        isActive: true,
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } },
        ],
      },
      include: { plan: true },
    });

    if (!agencyPlan) {
      return null;
    }

    return {
      maxTicketsPerMonth: agencyPlan.plan.maxTicketsPerMonth,
      maxInvoicesPerMonth: agencyPlan.plan.maxInvoicesPerMonth,
    };
  }

  // ============ Automatic Plan Expiration & Renewal ============

  async checkAndUpdateExpiredPlans(): Promise<{ updated: number; expired: number }> {
    const now = new Date();
    
    // پیدا کردن پلن‌های منقضی شده
    const expiredPlans = await this.prisma.agencyPlan.findMany({
      where: {
        isActive: true,
        endDate: { lt: now },
      },
      include: {
        agency: true,
        plan: true,
      },
    });

    let updatedCount = 0;
    let expiredCount = expiredPlans.length;

    for (const expiredPlan of expiredPlans) {
      // غیرفعال کردن پلن منقضی شده
      await this.prisma.agencyPlan.update({
        where: { id: expiredPlan.id },
        data: { isActive: false },
      });

      // پیدا کردن پلن پیش‌فرض (Basic)
      const defaultPlan = await this.prisma.plan.findFirst({
        where: { name: 'Basic', isActive: true },
      });

      if (defaultPlan) {
        // ایجاد پلن جدید با پلن پیش‌فرض
        await this.prisma.agencyPlan.create({
          data: {
            agencyId: expiredPlan.agencyId,
            planId: defaultPlan.id,
            startDate: now,
            endDate: null,
            isActive: true,
          },
        });

        // اگر آژانس در حالت TRIAL بود، به ACTIVE تغییر بده (یا INACTIVE)
        if (expiredPlan.agency.status === AgencyStatus.TRIAL) {
          await this.prisma.agency.update({
            where: { id: expiredPlan.agencyId },
            data: { status: AgencyStatus.ACTIVE },
          });
        }

        // ثبت لاگ
        await this.prisma.activityLog.create({
          data: {
            userId: 'system',
            agencyId: expiredPlan.agencyId,
            action: 'AUTO_RENEW_PLAN',
            entityType: 'AgencyPlan',
            entityId: expiredPlan.id,
            oldData: { oldPlan: expiredPlan.plan.name, endDate: expiredPlan.endDate },
            newData: { newPlan: defaultPlan.name, reason: 'Plan expired, auto-renewed to Basic' },
          },
        });
      } else {
        // اگر پلن پیش‌فرض وجود نداشت، آژانس را غیرفعال کن
        await this.prisma.agency.update({
          where: { id: expiredPlan.agencyId },
          data: { status: AgencyStatus.INACTIVE },
        });
      }

      updatedCount++;
    }

    return { updated: updatedCount, expired: expiredCount };
  }

  async checkAndUpdateExpiredTrials(): Promise<{ updated: number }> {
    const now = new Date();
    
    const expiredTrials = await this.prisma.agency.findMany({
      where: {
        status: AgencyStatus.TRIAL,
        trialExpiresAt: { lt: now },
      },
    });

    for (const agency of expiredTrials) {
      // تغییر وضعیت آژانس به INACTIVE
      await this.prisma.agency.update({
        where: { id: agency.id },
        data: { status: AgencyStatus.INACTIVE },
      });

      // غیرفعال کردن تمام کاربران آژانس
      await this.prisma.user.updateMany({
        where: { agencyId: agency.id, status: UserStatus.ACTIVE },
        data: { status: UserStatus.INACTIVE },
      });

      // ثبت لاگ
      await this.prisma.activityLog.create({
        data: {
          userId: 'system',
          agencyId: agency.id,
          action: 'TRIAL_EXPIRED',
          entityType: 'Agency',
          entityId: agency.id,
          newData: { newStatus: AgencyStatus.INACTIVE, reason: 'Trial period expired' },
        },
      });
    }

    return { updated: expiredTrials.length };
  }

  async getExpiringPlans(daysBefore: number = 7): Promise<any[]> {
    const now = new Date();
    const expiryThreshold = new Date();
    expiryThreshold.setDate(now.getDate() + daysBefore);

    const expiringPlans = await this.prisma.agencyPlan.findMany({
      where: {
        isActive: true,
        endDate: {
          gt: now,
          lt: expiryThreshold,
        },
      },
      include: {
        agency: {
          select: { id: true, name: true, email: true, status: true },
        },
        plan: {
          select: { id: true, name: true },
        },
      },
    });

    return expiringPlans;
  }
}