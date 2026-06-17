import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyUserDto, UpdateAgencyUserDto } from './dto';
import { UserRole, UserStatus, AgencyStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AgencyUsersService {
  constructor(private prisma: PrismaService) {}

  // ============ Helper Methods ============

  /**
   * اعتبارسنجی دسترسی کاربر به آژانس
   */
  private async validateAgencyAccess(
    agencyId: string,
    userId: string,
    userRole: UserRole,
    requireGeneralManager: boolean = false,
  ) {
    // بررسی وجود آژانس
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        agencyPlans: {
          where: { isActive: true },
          include: { plan: true },
        },
      },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    // بررسی وضعیت آژانس
    if (agency.status !== AgencyStatus.ACTIVE && agency.status !== AgencyStatus.TRIAL) {
      throw new ForbiddenException('Agency is not active');
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
      throw new ForbiddenException('User does not belong to this agency');
    }

    // اگر نیاز به دسترسی GENERAL_MANAGER باشد
    if (requireGeneralManager) {
      if (user.role !== UserRole.GENERAL_MANAGER) {
        throw new ForbiddenException('Only General Manager can perform this action');
      }
    }

    // بررسی دسترسی AGENCY_MANAGER
    if (userRole === UserRole.AGENCY_MANAGER) {
      if (user.role !== UserRole.AGENCY_MANAGER) {
        throw new ForbiddenException('Agency Manager access required');
      }
    }

    // NORMAL_USER دسترسی محدود دارد
    if (userRole === UserRole.NORMAL_USER) {
      return { ...agency, isNormalUser: true };
    }

    return agency;
  }

  /**
   * بررسی محدودیت‌های پلن برای ایجاد کاربر جدید
   */
  private async checkPlanLimits(agencyId: string, role: UserRole, agency: any) {
    const activePlan = agency.agencyPlans[0]?.plan;
    if (!activePlan) return;

    if (role === UserRole.NORMAL_USER) {
      const normalUserCount = await this.prisma.user.count({
        where: {
          agencyId: agencyId,
          role: UserRole.NORMAL_USER,
          status: UserStatus.ACTIVE,
        },
      });
      if (normalUserCount >= activePlan.maxNormalUsers) {
        throw new BadRequestException(
          `Maximum number of normal users (${activePlan.maxNormalUsers}) reached for this agency`,
        );
      }
    }

    if (role === UserRole.AGENCY_MANAGER) {
      const managerCount = await this.prisma.user.count({
        where: {
          agencyId: agencyId,
          role: UserRole.AGENCY_MANAGER,
          status: UserStatus.ACTIVE,
        },
      });
      if (managerCount >= activePlan.maxAgencyManagers) {
        throw new BadRequestException(
          `Maximum number of agency managers (${activePlan.maxAgencyManagers}) reached for this agency`,
        );
      }
    }
  }

  /**
   * اعتبارسنجی ایمیل
   */
  private async validateEmail(email: string, excludeUserId?: string): Promise<void> {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: email,
        id: excludeUserId ? { not: excludeUserId } : undefined,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }
  }

  /**
   * اعتبارسنجی نقش کاربر
   */
  private validateUserRole(role: UserRole): void {
    if (role !== UserRole.AGENCY_MANAGER && role !== UserRole.NORMAL_USER) {
      throw new BadRequestException(
        'Invalid role. Only AGENCY_MANAGER and NORMAL_USER can be created through this endpoint',
      );
    }
  }

  /**
   * سانیتیز کردن رشته‌ها
   */
  private sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  // ============ CRUD Operations ============

  /**
   * دریافت لیست کاربران آژانس با صفحه‌بندی و فیلتر
   */
  async findAll(
    agencyId: string,
    currentUserId: string,
    userRole: UserRole,
    page: number = 1,
    limit: number = 20,
    search?: string,
    role?: UserRole,
  ) {
    await this.validateAgencyAccess(agencyId, currentUserId, userRole);

    const skip = (page - 1) * limit;

    const where: any = {
      agencyId: agencyId,
      id: { not: currentUserId }, // کاربر جاری را نشان نده
    };

    // اگر GENERAL_MANAGER باشد، خودش را هم نشان نمی‌دهد
    if (userRole === UserRole.GENERAL_MANAGER) {
      where.role = { not: UserRole.GENERAL_MANAGER };
    }

    // فیلتر بر اساس نقش
    if (role) {
      where.role = role;
    }

    // جستجو
    if (search) {
      const sanitizedSearch = this.sanitizeString(search);
      where.OR = [
        { email: { contains: sanitizedSearch, mode: 'insensitive' } },
        { firstName: { contains: sanitizedSearch, mode: 'insensitive' } },
        { lastName: { contains: sanitizedSearch, mode: 'insensitive' } },
        { phone: { contains: sanitizedSearch, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          penalties: {
            select: { points: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    // محاسبه مجموع امتیاز جریمه برای هر کاربر
    const usersWithPenalties = users.map((user) => ({
      ...user,
      penaltyPoints: user.penalties.reduce((sum, p) => sum + p.points, 0),
      penalties: undefined,
    }));

    return {
      data: usersWithPenalties,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * دریافت اطلاعات یک کاربر خاص
   */
  async findOne(
    agencyId: string,
    currentUserId: string,
    userRole: UserRole,
    userId: string,
  ) {
    await this.validateAgencyAccess(agencyId, currentUserId, userRole);

    // اگر NORMAL_USER باشد، فقط می‌تواند خودش را ببیند
    if (userRole === UserRole.NORMAL_USER && userId !== currentUserId) {
      throw new ForbiddenException('You can only view your own profile');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        ...(userRole !== UserRole.GENERAL_MANAGER
          ? { role: { not: UserRole.GENERAL_MANAGER } }
          : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        penalties: {
          select: {
            points: true,
            reason: true,
            createdAt: true,
            ticket: {
              select: { ticketNumber: true },
            },
          },
        },
        activityLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            action: true,
            createdAt: true,
            entityType: true,
          },
        },
        tickets: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            ticketNumber: true,
            status: true,
            price: true,
            departureDate: true, // ✅ اصلاح شده
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    const totalPenaltyPoints = user.penalties?.reduce((sum, p) => sum + p.points, 0) || 0;

    return {
      ...user,
      totalPenaltyPoints,
    };
  }

  /**
   * ایجاد کاربر جدید در آژانس
   */
  async create(
    agencyId: string,
    currentUserId: string,
    userRole: UserRole,
    dto: CreateAgencyUserDto,
  ) {
    // فقط GENERAL_MANAGER و AGENCY_MANAGER می‌توانند ایجاد کنند
    if (userRole !== UserRole.GENERAL_MANAGER && userRole !== UserRole.AGENCY_MANAGER) {
      throw new ForbiddenException('Only General Manager or Agency Manager can create users');
    }

    const agency = await this.validateAgencyAccess(agencyId, currentUserId, userRole);

    // اعتبارسنجی ایمیل
    await this.validateEmail(dto.email);

    // اعتبارسنجی نقش
    this.validateUserRole(dto.role);

    // بررسی محدودیت‌های پلن
    await this.checkPlanLimits(agencyId, dto.role, agency);

    // هش کردن رمز عبور
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // ایجاد کاربر
    const user = await this.prisma.user.create({
      data: {
        email: this.sanitizeString(dto.email),
        passwordHash: hashedPassword,
        firstName: this.sanitizeString(dto.firstName),
        lastName: this.sanitizeString(dto.lastName),
        phone: dto.phone ? this.sanitizeString(dto.phone) : null,
        role: dto.role,
        agencyId: agencyId,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    // ثبت لاگ فعالیت
    await this.prisma.activityLog.create({
      data: {
        userId: currentUserId,
        agencyId: agencyId,
        action: 'CREATE_AGENCY_USER',
        entityType: 'User',
        entityId: user.id,
        newData: { role: dto.role },
      },
    });

    return user;
  }

  /**
   * بروزرسانی اطلاعات کاربر
   */
  async update(
    agencyId: string,
    currentUserId: string,
    userRole: UserRole,
    userId: string,
    dto: UpdateAgencyUserDto,
  ) {
    // فقط GENERAL_MANAGER و AGENCY_MANAGER می‌توانند بروزرسانی کنند
    if (userRole !== UserRole.GENERAL_MANAGER && userRole !== UserRole.AGENCY_MANAGER) {
      throw new ForbiddenException('Only General Manager or Agency Manager can update users');
    }

    await this.validateAgencyAccess(agencyId, currentUserId, userRole);

    // پیدا کردن کاربر
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        ...(userRole !== UserRole.GENERAL_MANAGER
          ? { role: { not: UserRole.GENERAL_MANAGER } }
          : {}),
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    // اگر نقش در حال تغییر است، اعتبارسنجی شود
    if (dto.role && dto.role !== user.role) {
      this.validateUserRole(dto.role);
    }

    // اگر ایمیل در حال تغییر است، یکتایی بررسی شود
    if (dto.email && dto.email !== user.email) {
      await this.validateEmail(dto.email, userId);
    }

    // آماده‌سازی داده‌های بروزرسانی
    const updateData: any = {};

    if (dto.email) updateData.email = this.sanitizeString(dto.email);
    if (dto.firstName) updateData.firstName = this.sanitizeString(dto.firstName);
    if (dto.lastName) updateData.lastName = this.sanitizeString(dto.lastName);
    if (dto.phone !== undefined) updateData.phone = dto.phone ? this.sanitizeString(dto.phone) : null;
    if (dto.role) updateData.role = dto.role;
    if (dto.status) updateData.status = dto.status;

    // اگر رمز عبور جدید داده شده، هش شود
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    // بروزرسانی کاربر
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    // ثبت لاگ فعالیت
    await this.prisma.activityLog.create({
      data: {
        userId: currentUserId,
        agencyId: agencyId,
        action: 'UPDATE_AGENCY_USER',
        entityType: 'User',
        entityId: userId,
        newData: { updatedFields: Object.keys(dto) },
      },
    });

    return updatedUser;
  }

  /**
   * تغییر وضعیت کاربر (فعال/غیرفعال)
   */
  async changeStatus(
    agencyId: string,
    currentUserId: string,
    userRole: UserRole,
    userId: string,
    status: UserStatus,
  ) {
    // فقط GENERAL_MANAGER می‌تواند وضعیت را تغییر دهد
    if (userRole !== UserRole.GENERAL_MANAGER) {
      throw new ForbiddenException('Only General Manager can change user status');
    }

    await this.validateAgencyAccess(agencyId, currentUserId, userRole, true);

    // پیدا کردن کاربر
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        role: { not: UserRole.GENERAL_MANAGER }, // نمی‌تواند GENERAL_MANAGER را تغییر دهد
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    // اگر کاربر خودش را تغییر می‌دهد
    if (userId === currentUserId) {
      throw new BadRequestException('You cannot change your own status');
    }

    // بروزرسانی وضعیت
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    // ثبت لاگ فعالیت
    await this.prisma.activityLog.create({
      data: {
        userId: currentUserId,
        agencyId: agencyId,
        action: status === UserStatus.ACTIVE ? 'ACTIVATE_AGENCY_USER' : 'DEACTIVATE_AGENCY_USER',
        entityType: 'User',
        entityId: userId,
        newData: { status },
      },
    });

    return updatedUser;
  }

  /**
   * حذف کاربر (فقط در صورتی که بلیطی نداشته باشد)
   */
  async delete(
    agencyId: string,
    currentUserId: string,
    userRole: UserRole,
    userId: string,
  ) {
    // فقط GENERAL_MANAGER می‌تواند حذف کند
    if (userRole !== UserRole.GENERAL_MANAGER) {
      throw new ForbiddenException('Only General Manager can delete users');
    }

    await this.validateAgencyAccess(agencyId, currentUserId, userRole, true);

    // پیدا کردن کاربر
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        role: { not: UserRole.GENERAL_MANAGER }, // نمی‌تواند GENERAL_MANAGER را حذف کند
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    // اگر کاربر خودش را حذف می‌کند
    if (userId === currentUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    // بررسی وجود بلیط برای کاربر
    const ticketCount = await this.prisma.ticket.count({
      where: { userId: userId },
    });

    if (ticketCount > 0) {
      throw new BadRequestException(
        `Cannot delete user with ${ticketCount} tickets. Deactivate instead.`,
      );
    }

    // حذف کاربر
    await this.prisma.user.delete({
      where: { id: userId },
    });

    // ثبت لاگ فعالیت
    await this.prisma.activityLog.create({
      data: {
        userId: currentUserId,
        agencyId: agencyId,
        action: 'DELETE_AGENCY_USER',
        entityType: 'User',
        entityId: userId,
      },
    });

    return { message: 'User deleted successfully' };
  }

  /**
   * دریافت جریمه‌های کاربر
   */
  async getUserPenalties(
    agencyId: string,
    currentUserId: string,
    userRole: UserRole,
    userId: string,
  ) {
    await this.validateAgencyAccess(agencyId, currentUserId, userRole);

    // اگر NORMAL_USER باشد، فقط می‌تواند جریمه‌های خودش را ببیند
    if (userRole === UserRole.NORMAL_USER && userId !== currentUserId) {
      throw new ForbiddenException('You can only view your own penalties');
    }

    // پیدا کردن کاربر
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        ...(userRole !== UserRole.GENERAL_MANAGER
          ? { role: { not: UserRole.GENERAL_MANAGER } }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    // دریافت جریمه‌ها
    const penalties = await this.prisma.penalty.findMany({
      where: { userId: userId },
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            passengerName: true,
            flightNumber: true,
            departureDate: true, // ✅ اصلاح شده
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPoints = penalties.reduce((sum, p) => sum + p.points, 0);

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
      totalPoints,
      penalties,
    };
  }

  /**
   * دریافت آمار کاربران آژانس (برای داشبورد)
   */
  async getUserStatistics(agencyId: string) {
    const stats = await this.prisma.user.groupBy({
      by: ['role', 'status'],
      where: { agencyId: agencyId },
      _count: true,
    });

    const total = stats.reduce((sum, s) => sum + s._count, 0);

    const byRole = stats.reduce((acc, s) => {
      const key = s.role;
      if (!acc[key]) acc[key] = 0;
      acc[key] += s._count;
      return acc;
    }, {} as Record<string, number>);

    const byStatus = stats.reduce((acc, s) => {
      const key = s.status;
      if (!acc[key]) acc[key] = 0;
      acc[key] += s._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      byRole,
      byStatus,
    };
  }
}