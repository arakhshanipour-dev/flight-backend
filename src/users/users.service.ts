import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserByAdminDto } from './dto/update-user-by-admin.dto';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    role?: UserRole,
    status?: UserStatus,
    agencyId?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    
    if (role) {
      where.role = role;
    }
    
    if (status) {
      where.status = status;
    }
    
    if (agencyId) {
      where.agencyId = agencyId;
    }
    
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
          agencyId: true,
          organizationId: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        agencyId: true,
        organizationId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            tickets: true,
            supportTickets: true,
            activityLogs: true,
            penalties: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async updateByAdmin(id: string, dto: UpdateUserByAdminDto, adminId: string) {
    const user = await this.findOne(id);

    // If changing email, check for uniqueness
    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // If changing role to agency-related, ensure agencyId is provided
    if (dto.role && 
        dto.role !== UserRole.SUPER_ADMIN && 
        dto.role !== UserRole.ORGANIZATION_ADMIN) {
      const agencyId = dto.agencyId || user.agencyId;
      if (!agencyId) {
        throw new BadRequestException('Agency ID is required for this role');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        status: dto.status,
        agencyId: dto.agencyId,
        organizationId: dto.organizationId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        agencyId: true,
        organizationId: true,
        updatedAt: true,
      },
    });

    // Log activity
    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        agencyId: updatedUser.agencyId,
        action: 'ADMIN_UPDATE_USER',
        entityType: 'User',
        entityId: id,
        newData: { updatedFields: Object.keys(dto) },
      },
    });

    return updatedUser;
  }

  async changeStatus(id: string, status: UserStatus, adminId: string) {
    await this.findOne(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        agencyId: user.agencyId,
        action: status === UserStatus.ACTIVE ? 'ADMIN_ACTIVATE_USER' : 'ADMIN_DEACTIVATE_USER',
        entityType: 'User',
        entityId: id,
        newData: { status },
      },
    });

    return { message: `User status changed to ${status}`, user };
  }

  async resetPassword(id: string, adminId: string) {
    const user = await this.findOne(id);
    
    const temporaryPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: hashedPassword },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: adminId,
        agencyId: user.agencyId,
        action: 'ADMIN_RESET_PASSWORD',
        entityType: 'User',
        entityId: id,
      },
    });

    return { 
      message: 'Password reset successfully',
      temporaryPassword,
      note: 'User must change password on first login',
    };
  }

  async delete(id: string) {
    const user = await this.findOne(id);
    
    // Prevent deleting super admin if it's the only one
    if (user.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({
        where: { role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
      });
      
      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the only active super admin');
      }
    }

    await this.prisma.user.delete({ where: { id } });

    return { message: 'User deleted successfully' };
  }

  async getPenalties(userId: string) {
    await this.findOne(userId);

    const penalties = await this.prisma.penalty.findMany({
      where: { userId },
      include: {
        ticket: {
          select: {
            ticketNumber: true,
            passengerName: true,
            flightNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPoints = penalties.reduce((sum, p) => sum + p.points, 0);

    return {
      totalPoints,
      penalties,
    };
  }
}