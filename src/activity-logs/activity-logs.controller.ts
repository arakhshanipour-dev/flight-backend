// activity-logs.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ActivityLogsService } from './activity-logs.service';
import {
  ActivityLogQueryDto,
  ActivityLogListResponseDto,
  ActivityLogResponseDto,
  ActivityLogStatsDto,
  UserActivitySummaryDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Activity Logs')
@ApiBearerAuth('JWT-auth')
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  // ============ Super Admin Only ============

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all activity logs with filters (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Logs retrieved successfully', type: ActivityLogListResponseDto })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async findAll(@Query() query: ActivityLogQueryDto) {
    return this.activityLogsService.findAll(query);
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Get activity log statistics (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully', type: ActivityLogStatsDto })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async getStats() {
    return this.activityLogsService.getStats();
  }

  @Get('users/:userId/summary')
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get user activity summary (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'User summary retrieved successfully', type: UserActivitySummaryDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async getUserSummary(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.activityLogsService.getUserSummary(userId);
  }

  @Get('users/:userId')
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get logs for a specific user (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'User logs retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async getUserLogs(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ActivityLogQueryDto,
  ) {
    return this.activityLogsService.getUserLogs(userId, query);
  }

  @Get('agencies/:agencyId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get logs for a specific agency' })
  @ApiResponse({ status: 200, description: 'Agency logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async getAgencyLogs(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('agencyId') currentAgencyId: string,
    @Param('agencyId', ParseUUIDPipe) agencyId: string,
    @Query() query: ActivityLogQueryDto,
  ) {
    // Check access: SUPER_ADMIN can see all, GENERAL_MANAGER only own agency
    if (userRole === UserRole.GENERAL_MANAGER && agencyId !== currentAgencyId) {
      throw new BadRequestException('You can only view logs for your own agency');
    }
    return this.activityLogsService.getAgencyLogs(agencyId, query);
  }

  @Get('organizations/:organizationId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZATION_ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get logs for a specific organization' })
  @ApiResponse({ status: 200, description: 'Organization logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Access denied' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async getOrganizationLogs(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('organizationId') currentOrgId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ActivityLogQueryDto,
  ) {
    // Check access: SUPER_ADMIN can see all, ORGANIZATION_ADMIN only own org
    if (userRole === UserRole.ORGANIZATION_ADMIN && organizationId !== currentOrgId) {
      throw new BadRequestException('You can only view logs for your own organization');
    }
    return this.activityLogsService.getOrganizationLogs(organizationId, query);
  }

  // ✅ اصلاح شده: تبدیل string به enum معتبر
  @Get('entity/:entityType/:entityId')
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get logs for a specific entity (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Entity logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  @ApiResponse({ status: 400, description: 'Invalid entity type' })
  async getEntityLogs(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseUUIDPipe) entityId: string,
    @Query() query: ActivityLogQueryDto,
  ) {
    // ✅ اعتبارسنجی entityType
    const validEntityTypes = [
      'User', 'Agency', 'Ticket', 'Invoice', 'Payment', 
      'BankCard', 'Organization', 'SupportTicket', 'Plan', 
      'RegistrationRequest', 'Airport', 'Airline'
    ];
    
    if (!validEntityTypes.includes(entityType)) {
      throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }

    return this.activityLogsService.getEntityLogs(entityType, entityId, query);
  }

  @Get('actions')
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all unique action types (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Actions retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async getActions() {
    return this.activityLogsService.getActions();
  }

  @Get('entity-types')
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all unique entity types (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Entity types retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async getEntityTypes() {
    return this.activityLogsService.getEntityTypes();
  }

  // ============ My Logs (Current User) ============

  @Get('my-logs')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get logs for the current user' })
  @ApiResponse({ status: 200, description: 'My logs retrieved successfully' })
  async getMyLogs(
    @CurrentUser('id') userId: string,
    @Query() query: ActivityLogQueryDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }
    return this.activityLogsService.getUserLogs(userId, query);
  }
}