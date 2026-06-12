import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgencyUserDto, UpdateAgencyUserDto } from './dto';
import { UserRole, UserStatus, AgencyStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AgencyUsersService {
  constructor(private prisma: PrismaService) {}

  // Check if user has access to this agency
  private async validateAgencyAccess(agencyId: string, userId: string, isGeneralManager: boolean = true) {
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

    if (agency.status !== AgencyStatus.ACTIVE && agency.status !== AgencyStatus.TRIAL) {
      throw new ForbiddenException('Agency is not active');
    }

    if (isGeneralManager) {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          agencyId: agencyId,
          role: UserRole.GENERAL_MANAGER,
          status: UserStatus.ACTIVE,
        },
      });

      if (!user) {
        throw new ForbiddenException('Only General Manager can manage agency users');
      }
    }

    return agency;
  }

  async findAll(agencyId: string, currentUserId: string, page: number = 1, limit: number = 20, search?: string) {
    await this.validateAgencyAccess(agencyId, currentUserId);

    const skip = (page - 1) * limit;
    
    const where: any = {
      agencyId: agencyId,
      role: {
        not: UserRole.GENERAL_MANAGER, // Don't show General Manager in list (can't manage self)
      },
    };
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
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

    // Calculate total penalty points for each user
    const usersWithPenalties = users.map(user => ({
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

  async findOne(agencyId: string, currentUserId: string, userId: string) {
    await this.validateAgencyAccess(agencyId, currentUserId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        role: { not: UserRole.GENERAL_MANAGER },
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
          select: { points: true, reason: true, createdAt: true, ticket: { select: { ticketNumber: true } } },
        },
        activityLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: { action: true, createdAt: true, entityType: true },
        },
        tickets: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { ticketNumber: true, status: true, price: true, flightDate: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    const totalPenaltyPoints = user.penalties.reduce((sum, p) => sum + p.points, 0);

    return {
      ...user,
      totalPenaltyPoints,
    };
  }

  async create(agencyId: string, currentUserId: string, dto: CreateAgencyUserDto) {
    const agency = await this.validateAgencyAccess(agencyId, currentUserId);

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Check role validity
    if (dto.role !== UserRole.AGENCY_MANAGER && dto.role !== UserRole.NORMAL_USER) {
      throw new BadRequestException('General Manager cannot be created through this endpoint');
    }

    // Check plan limits
    const activePlan = agency.agencyPlans[0]?.plan;
    if (activePlan) {
      if (dto.role === UserRole.NORMAL_USER) {
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

      if (dto.role === UserRole.AGENCY_MANAGER) {
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

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
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

    // Log activity
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

  async update(agencyId: string, currentUserId: string, userId: string, dto: UpdateAgencyUserDto) {
    await this.validateAgencyAccess(agencyId, currentUserId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        role: { not: UserRole.GENERAL_MANAGER },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    // If changing email, check uniqueness
    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // If changing role, validate
    if (dto.role && dto.role !== UserRole.AGENCY_MANAGER && dto.role !== UserRole.NORMAL_USER) {
      throw new BadRequestException('Invalid role for agency user');
    }

    const updateData: any = {
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: dto.role,
      status: dto.status,
    };

    // If password is provided, hash it
    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

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

    // Log activity
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

  async changeStatus(agencyId: string, currentUserId: string, userId: string, status: UserStatus) {
    await this.validateAgencyAccess(agencyId, currentUserId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        role: { not: UserRole.GENERAL_MANAGER },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

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

  async delete(agencyId: string, currentUserId: string, userId: string) {
    await this.validateAgencyAccess(agencyId, currentUserId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        role: { not: UserRole.GENERAL_MANAGER },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    // Check if user has any tickets or invoices
    const ticketCount = await this.prisma.ticket.count({ where: { userId: userId } });
    if (ticketCount > 0) {
      throw new BadRequestException(`Cannot delete user with ${ticketCount} tickets. Deactivate instead.`);
    }

    await this.prisma.user.delete({ where: { id: userId } });

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

  async getUserPenalties(agencyId: string, currentUserId: string, userId: string) {
    await this.validateAgencyAccess(agencyId, currentUserId);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found in this agency');
    }

    const penalties = await this.prisma.penalty.findMany({
      where: { userId: userId },
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            passengerName: true,
            flightNumber: true,
            flightDate: true,
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
}