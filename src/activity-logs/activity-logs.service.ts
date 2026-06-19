import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogQueryDto, ActivityLogStatsDto, UserActivitySummaryDto } from './dto';
import { UserRole } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ACTIVITY_LOG_CACHE_KEYS } from './activity-logs.constants';

@Injectable()
export class ActivityLogsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // ============ Create Log ============

  async createLog(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    agencyId?: string | null;
    organizationId?: string | null;
    oldData?: any;
    newData?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    // Clean sensitive data from newData
    if (data.newData) {
      const cleanData = { ...data.newData };
      delete cleanData.password;
      delete cleanData.passwordHash;
      delete cleanData.oldPassword;
      delete cleanData.newPassword;
      delete cleanData.temporaryPassword;
      delete cleanData.cardNumber;
      delete cleanData.sheba;
      data.newData = cleanData;
    }

    // Clean sensitive data from oldData
    if (data.oldData) {
      const cleanData = { ...data.oldData };
      delete cleanData.password;
      delete cleanData.passwordHash;
      delete cleanData.cardNumber;
      delete cleanData.sheba;
      data.oldData = cleanData;
    }

    // Invalidate cache when new log is created
    await this.cacheManager.del(ACTIVITY_LOG_CACHE_KEYS.STATS);

    return this.prisma.activityLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        agencyId: data.agencyId,
        organizationId: data.organizationId,
        oldData: data.oldData,
        newData: data.newData,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  // ============ Find All with Filters ============

  async findAll(query: ActivityLogQueryDto) {
    const {
      userId,
      agencyId,
      organizationId,
      entityType,
      entityId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      search,
    } = query;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (userId) where.userId = userId;
    if (agencyId) where.agencyId = agencyId;
    if (organizationId) where.organizationId = organizationId;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        where.createdAt.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    // Add agency and organization names
    const enrichedData = await Promise.all(
      data.map(async (log) => {
        let agencyName: string | null = null;
        let organizationName: string | null = null;

        if (log.agencyId) {
          const agency = await this.prisma.agency.findUnique({
            where: { id: log.agencyId },
            select: { name: true },
          });
          agencyName = agency?.name || null;
        }

        if (log.organizationId) {
          const org = await this.prisma.organization.findUnique({
            where: { id: log.organizationId },
            select: { name: true },
          });
          organizationName = org?.name || null;
        }

        return {
          ...log,
          agencyName,
          organizationName,
        };
      }),
    );

    return {
      data: enrichedData,
      meta: {
        page,
        limit: Math.min(limit, 100),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============ Get User Logs ============

  async getUserLogs(userId: string, query: ActivityLogQueryDto) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.findAll({
      ...query,
      userId,
    });
  }

  // ============ Get Agency Logs ============

  async getAgencyLogs(agencyId: string, query: ActivityLogQueryDto) {
    // Check if agency exists
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });
    if (!agency) {
      throw new NotFoundException(`Agency with ID ${agencyId} not found`);
    }

    return this.findAll({
      ...query,
      agencyId,
    });
  }

  // ============ Get Organization Logs ============

  async getOrganizationLogs(organizationId: string, query: ActivityLogQueryDto) {
    // Check if organization exists
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${organizationId} not found`);
    }

    return this.findAll({
      ...query,
      organizationId,
    });
  }

  // ============ Get Entity Logs ============

  async getEntityLogs(entityType: string, entityId: string, query: ActivityLogQueryDto) {
    return this.findAll({
      ...query,
      entityType,
      entityId,
    });
  }

  // ============ Get Stats ============

  async getStats(): Promise<ActivityLogStatsDto> {
    const cacheKey = ACTIVITY_LOG_CACHE_KEYS.STATS;
    const cached = await this.cacheManager.get<ActivityLogStatsDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const totalLogs = await this.prisma.activityLog.count();

    // Top actions
    const topActionsRaw = await this.prisma.activityLog.groupBy({
      by: ['action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    });
    const topActions = topActionsRaw.map((item) => ({
      action: item.action,
      count: item._count.action,
    }));

    // Top entity types
    const topEntityTypesRaw = await this.prisma.activityLog.groupBy({
      by: ['entityType'],
      _count: { entityType: true },
      orderBy: { _count: { entityType: 'desc' } },
      take: 10,
    });
    const topEntityTypes = topEntityTypesRaw.map((item) => ({
      entityType: item.entityType,
      count: item._count.entityType,
    }));

    // Daily stats (last 7 days)
    const dailyStats: { date: string; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const count = await this.prisma.activityLog.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      });

      dailyStats.push({
        date: date.toISOString().slice(0, 10),
        count,
      });
    }

    // Last week count
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    const lastWeekCount = await this.prisma.activityLog.count({
      where: {
        createdAt: { gte: weekAgo },
      },
    });

    // Today count
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = await this.prisma.activityLog.count({
      where: {
        createdAt: { gte: todayStart },
      },
    });

    const result: ActivityLogStatsDto = {
      totalLogs,
      topActions,
      topEntityTypes,
      dailyStats,
      lastWeekCount,
      todayCount,
    };

    await this.cacheManager.set(cacheKey, result, 300); // Cache for 5 minutes

    return result;
  }

  // ============ Get User Summary ============

  async getUserSummary(userId: string): Promise<UserActivitySummaryDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const totalActions = await this.prisma.activityLog.count({
      where: { userId },
    });

    const topActionsRaw = await this.prisma.activityLog.groupBy({
      by: ['action'],
      where: { userId },
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 5,
    });
    const topActions = topActionsRaw.map((item) => ({
      action: item.action,
      count: item._count.action,
    }));

    const lastActivity = await this.prisma.activityLog.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      totalActions,
      topActions,
      lastActivityAt: lastActivity?.createdAt || user.createdAt,
    };
  }

  // ============ Get Actions List ============

  async getActions(): Promise<string[]> {
    const actions = await this.prisma.activityLog.groupBy({
      by: ['action'],
      orderBy: { action: 'asc' },
    });
    return actions.map((item) => item.action);
  }

  // ============ Get Entity Types List ============

  async getEntityTypes(): Promise<string[]> {
    const types = await this.prisma.activityLog.groupBy({
      by: ['entityType'],
      orderBy: { entityType: 'asc' },
    });
    return types.map((item) => item.entityType);
  }

  // ============ Clean Old Logs (Admin) ============

  async cleanOldLogs(days: number = 90): Promise<{ deleted: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.prisma.activityLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    await this.cacheManager.del(ACTIVITY_LOG_CACHE_KEYS.STATS);

    return { deleted: result.count };
  }
}